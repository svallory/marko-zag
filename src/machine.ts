/**
 * Zag.js v1 service protocol for Marko 6.
 *
 * Every Zag-version-specific call (service construction, start/stop,
 * transitions, connect signature) lives in this file only (design C-1).
 *
 * Ported from @zag-js/solid@1.43.0, replacing Solid primitives with plain
 * values plus a `notify` callback that the host component uses to bump a
 * `<let/rev>` signal.
 *
 * SSR contract (see notes/specs/marko-ui/spike-results.md):
 * - Marko serializes reactive state and never re-runs render on resume, so
 *   services and connect() apis must NOT be reactive state.
 * - Server: create a throwaway service inline (`ssrService`) — never started,
 *   so `connect` renders correct initial attrs with no DOM access.
 * - Client: create the real service in `<lifecycle onMount>`, store it in a
 *   `<let/svc=null>` (null serializes; the client instance never crosses).
 */
import {
  createScope,
  findTransition,
  getExitEnterStates,
  hasTag,
  INIT_STATE,
  MachineStatus,
  matchesState,
  resolveStateValue,
  type Bindable,
  type BindableParams,
  type EventObject,
  type Machine,
  type MachineSchema,
  type Scope,
  type Service,
} from "@zag-js/core";
import { callAll, compact, ensure, isFunction, isString, toArray, warn, isEqual } from "@zag-js/utils";

type Dict = Record<string, any>;

/**
 * A running (or, for SSR, never-started) Zag machine service — the object
 * every `machineModule.connect(service, normalizeProps)` call consumes.
 *
 * Structurally identical to the service Zag's own framework adapters
 * produce, plus three Marko-lifecycle methods ({@link MarkoService.start},
 * {@link MarkoService.stop}, {@link MarkoService.propsChanged}).
 *
 * @remarks
 * A `MarkoService` instance is **not serializable** and must never cross the
 * server/client boundary. On the server keep it out of reactive state and
 * build a throwaway via {@link ssrService} inside the render expression; on
 * the client store the real instance in a `<let/svc=null>` (the `null`
 * serializes; the instance is created fresh in `onMount`). The `<service>`
 * tag implements this contract for you.
 */
export interface MarkoService<T extends MachineSchema = MachineSchema> extends Service<T> {
  /**
   * Client-only: marks the machine started and runs entry actions/effects.
   * Call from `<lifecycle onMount>`. Also schedules one recompute so the
   * handler-less SSR attributes are replaced with handler-bearing ones.
   */
  start: () => void;
  /** Stops the machine, running exit actions and effect cleanups. Call from `<lifecycle onDestroy>`. */
  stop: () => void;
  /**
   * Host notification that reactive props changed (controlled usage):
   * invalidates the props cache, syncs bindable `prev` trackers, re-runs
   * `machine.watch` tracks, and notifies the renderer.
   */
  propsChanged: () => void;
}

/** Unwraps a value-or-thunk (Zag passes deps and props both ways). */
const access = <T>(v: T | (() => T)): T => (isFunction(v) ? v() : v);
const noop = () => {};

/**
 * Server-render helper: builds a never-started {@link MarkoService} purely
 * for computing a machine's initial DOM attributes.
 *
 * Zag's `connect()` is a pure read over the service, so connecting a
 * never-started service yields correct initial attributes without touching
 * the DOM. Because it is never started, no entry actions or effects run and
 * nothing needs cleanup — the instance is created inline during render and
 * simply garbage-collected.
 *
 * @param machine - The Zag machine definition (e.g. `switchMachine.machine`).
 * @param userProps - Closure returning the machine's props (must include `id`).
 * @returns A never-started service, safe to pass to `connect()` during SSR.
 *
 * @example
 * ```marko
 * // inside the reactive snapshot expression:
 * connect(svc ?? ssrService(machine, props), normalizeProps)
 * ```
 *
 * @remarks
 * Marko serializes reactive state at the SSR boundary and never re-runs
 * render on resume, so the service must NOT be stored in reactive state —
 * use it inline. The client builds its own real service via
 * {@link createService} on mount.
 */
export function ssrService<T extends MachineSchema>(
  machine: Machine<T>,
  userProps: () => Partial<T["props"]>,
): MarkoService<T> {
  return createService(machine, userProps, noop);
}

/**
 * Creates a Zag v1 machine service for Marko 6 — the Marko analog of
 * `useMachine` in Zag's official adapters.
 *
 * Ported from `@zag-js/solid@1.43.0` with Solid's reactive primitives
 * replaced by plain values plus a `notify` callback: whenever the machine
 * updates (a state transition or a bindable context write), `notify` is
 * invoked and the host component bumps a `<let/rev>` signal to trigger a
 * re-render. The `<service>` tag wraps this function; call it directly only
 * when building custom integrations (e.g. spawned child services).
 *
 * @param machine - The Zag machine definition (e.g. `switchMachine.machine`).
 * @param userProps - Closure returning the machine's props. Read lazily and
 * memoized; call {@link MarkoService.propsChanged} after reactive props
 * change so the cache is invalidated.
 * @param notify - Called (batched on a microtask) after every machine
 * update; the host uses it to schedule a re-render.
 * @returns The service. Call {@link MarkoService.start} in `onMount` and
 * {@link MarkoService.stop} in `onDestroy`.
 *
 * @example
 * ```marko
 * <let/rev=0/>
 * <let/svc=null/>
 * <lifecycle
 *   onMount() {
 *     svc = createService(switchMachine.machine, () => ({ id }), () => { rev += 1 });
 *     svc.start();
 *   }
 *   onDestroy() { svc?.stop(); }
 * />
 * ```
 *
 * @remarks
 * Effects triggered by state entry are deferred by two animation frames:
 * Marko batches renders, so DOM created by a state change (an opened
 * positioner, say) does not exist yet when the machine's entry effects fire.
 * Two rAFs guarantee the notify → render pass has committed first.
 */
export function createService<T extends MachineSchema>(
  typedMachine: Machine<T>,
  userProps: () => Partial<T["props"]>,
  notify: () => void,
): MarkoService<T> {
  // Machine<T>'s mapped types (implementations keyed by T["action"], context
  // keyed by keyof T["context"], Scope's full method set, etc.) are fine on
  // the public signature but unworkable inside this generic-erased runtime —
  // every helper below reads arbitrary string keys resolved dynamically, not
  // statically known members of T. Erase once here; the return statement
  // re-asserts MarkoService<T> for callers.
  const machine: any = typedMachine;
  // Memoized: machines call prop() dozens of times per connect(); rebuilding
  // props (and e.g. select collections) per read defeats Zag's identity
  // checks and is O(n) jank. Invalidated on propsChanged() and each flush.
  let propsCache: Dict | null = null;
  let scopeCache: Scope | null = null;
  const invalidateProps = () => {
    propsCache = null;
    scopeCache = null;
  };

  /** Resolved machine props (user props through `machine.props`), memoized. */
  const getProps = (): Dict =>
    (propsCache ??=
      machine.props?.({ props: compact(access(userProps)), scope: getScope() }) ?? access(userProps));

  /** Zag scope (id/ids/getRootNode DOM helpers), memoized with the props. */
  const getScope = (): Scope => {
    if (!scopeCache) {
      const { id, ids, getRootNode } = access(userProps) as Dict;
      scopeCache = createScope({ id, ids, getRootNode });
    }
    return scopeCache;
  };

  /** Zag's `prop(key)` accessor — reads through the memoized props. */
  const prop = (key: string) => getProps()[key];

  const debug = (...args: unknown[]) => {
    if (machine.debug) console.log(...args);
  };

  // --- track (machine.watch) ------------------------------------------------
  /** One registered `machine.watch` tracker: dep thunks + last-seen values. */
  interface TrackEntry {
    deps: Array<() => unknown>;
    effect: VoidFunction;
    prev: unknown[];
  }
  const tracks: TrackEntry[] = [];
  const createTrack = (deps: Array<() => unknown>, effect: VoidFunction) => {
    tracks.push({ deps, effect, prev: deps.map((d) => access(d)) });
  };
  /** Diffs every track's deps (deep `isEqual`) and fires changed effects. */
  const runTracks = () => {
    for (const t of tracks) {
      const next = t.deps.map((d) => access(d));
      if (next.some((v, i) => !isEqual(t.prev[i], v))) {
        t.prev = next;
        t.effect();
      }
    }
  };

  // --- bindable -------------------------------------------------------------
  // prev is tracked in a dedicated ref (mirroring @zag-js/react/solid): in
  // controlled mode re-deriving prev from the live prop double-fires onChange
  // before the parent applies the value, and silences it (plus the render!)
  // after. scheduleUpdate() is unconditional — a transition must always
  // reach the DOM even when a context write is value-equal.
  const bindablePrevSyncs: VoidFunction[] = [];
  function createBindable<V>(props: () => BindableParams<V>): Bindable<V> {
    const initial = props().value ?? props().defaultValue;
    const eq = props().isEqual ?? Object.is;
    let value = initial as V;
    const controlled = () => props().value !== undefined;
    const get = (): V => (controlled() ? (props().value as V) : value);
    const prevValue = { current: initial };
    bindablePrevSyncs.push(() => {
      prevValue.current = get();
    });
    const ref = {
      get current() {
        return get();
      },
      set current(v: V) {
        value = v;
      },
    };
    const set = (v: V | ((prev: V) => V)) => {
      const next = isFunction(v) ? v(get()) : v;
      const prev = prevValue.current;
      if (props().debug) console.log(`[bindable > ${props().debug}] setValue`, { next, prev });
      if (!controlled()) value = next;
      prevValue.current = next;
      if (!eq(next, prev)) props().onChange?.(next, prev);
      // sync bindables (input-cursor machines: number-input, pin-input, …)
      // must reach the renderer before the machine's next DOM read — flush
      // now instead of batching on a microtask.
      if (props().sync) flushUpdate();
      else scheduleUpdate();
    };
    return {
      initial,
      ref,
      get,
      set,
      invoke(nextValue: V, previousValue: V) {
        props().onChange?.(nextValue, previousValue);
        scheduleUpdate();
      },
      hash(v: V) {
        return props().hash?.(v) ?? String(v);
      },
    };
  }
  createBindable.cleanup = (fn: VoidFunction) => {
    cleanups.push(fn);
  };
  createBindable.ref = (defaultValue: any) => {
    let v = defaultValue;
    return { get: () => v, set: (next: any) => (v = next) };
  };

  let updateScheduled = false;
  /** Invalidate caches, re-run watch tracks, and notify the host — now. */
  const flushUpdate = () => {
    updateScheduled = false;
    invalidateProps();
    runTracks();
    notify();
  };
  /** Batches {@link flushUpdate} on a microtask; collapses repeat calls. */
  const scheduleUpdate = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    queueMicrotask(() => {
      if (!updateScheduled) return; // a sync flush already ran
      flushUpdate();
    });
  };

  const cleanups: VoidFunction[] = [];

  // --- context / refs / computed -------------------------------------------
  const context = machine.context?.({
    prop,
    bindable: createBindable,
    get scope() {
      return getScope();
    },
    flush: (fn: VoidFunction) => fn(),
    getContext: () => ctx,
    getComputed: () => computed,
    getRefs: () => refs,
    getEvent: () => getEvent(),
  });

  /** Zag's `BindableContext` facade — string-keyed reads/writes over the bindables. */
  const ctx = {
    get: (key: string) => context?.[key].get(),
    set: (key: string, value: any) => context?.[key].set(value),
    initial: (key: string) => context?.[key].initial,
    hash: (key: string) => {
      const current = context?.[key].get();
      return context?.[key].hash(current);
    },
  };

  const refsInit = machine.refs?.({ prop, context: ctx }) ?? {};
  const refsStore: Dict = { ...refsInit };
  const refs = {
    get: (key: string) => refsStore[key],
    set: (key: string, value: any) => {
      refsStore[key] = value;
    },
  };

  /** Zag's `computed(key)` — recomputed per call, never cached (Zag contract). */
  const computed = (key: string): any => {
    ensure(machine.computed, () => `[zag-js] No computed object found on machine`);
    const fn = machine.computed[key];
    return fn({ context: ctx, event: eventRef.current, prop, refs, scope: getScope(), computed });
  };

  // --- events / state -------------------------------------------------------
  const effects = new Map<string, VoidFunction>();
  const transitionRef: { current: Dict | null } = { current: null };
  const previousEventRef: { current: EventObject | null } = { current: null };
  const eventRef: { current: EventObject } = { current: { type: "" } };

  /** Current event decorated with `current()`/`previous()` accessors. */
  const getEvent = () =>
    Object.assign({}, eventRef.current, {
      current: () => eventRef.current,
      previous: () => previousEventRef.current,
    });

  /** State bindable decorated with `matches()`/`hasTag()` helpers. */
  const getState = () =>
    Object.assign({}, state, {
      matches: (...values: string[]) => values.some((v) => matchesState(state.get(), v)),
      hasTag: (tag: string) => hasTag(machine, state.get(), tag),
    });

  /** The `Params` bag Zag hands to actions, guards, effects, and `watch`. */
  const getParams = (): Dict => ({
    state: getState(),
    context: ctx,
    event: getEvent(),
    prop,
    send,
    action,
    guard,
    track: createTrack,
    refs,
    computed,
    flush: (fn: VoidFunction) => fn(),
    get scope() {
      return getScope();
    },
    choose,
  });

  /** Runs the named actions from `machine.implementations.actions`. */
  const action = (keys: any) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys;
    if (!strs) return;
    for (const s of strs) {
      const fn = machine.implementations?.actions?.[s];
      if (!fn) warn(`[zag-js] No implementation found for action "${JSON.stringify(s)}"`);
      fn?.(getParams());
    }
  };

  /** Evaluates a guard by name (via implementations) or inline function. */
  const guard = (str: any) => {
    if (isFunction(str)) return str(getParams());
    const fn = machine.implementations?.guards?.[str];
    if (!fn) warn(`[zag-js] No implementation found for guard "${JSON.stringify(str)}"`);
    return fn?.(getParams());
  };

  // Marko batches renders: DOM created by a state change (e.g. an opened
  // positioner) does not exist yet when the machine's entry effects fire.
  // Zag effects that resolve elements once (popper's getPlacement defer:raf)
  // would then fail permanently. Deferring effects by two frames guarantees
  // the notify → render pass has committed first.
  const effect = (keys: any) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys;
    if (!strs) return;
    const cleanupFns: VoidFunction[] = [];
    let disposed = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        for (const s of strs) {
          if (disposed) return;
          const fn = machine.implementations?.effects?.[s];
          if (!fn) warn(`[zag-js] No implementation found for effect "${JSON.stringify(s)}"`);
          const cleanup = fn?.(getParams());
          if (cleanup) {
            // if disposal happened while this effect ran, undo it immediately
            if (disposed) cleanup();
            else cleanupFns.push(cleanup);
          }
        }
      });
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      cleanupFns.forEach((fn) => fn?.());
    };
  };

  /** Picks the first transition whose guard passes (Zag's `choose`). */
  const choose = (transitions: any) =>
    toArray(transitions).find((t: any) => {
      let result = !t.guard;
      if (isString(t.guard)) result = !!guard(t.guard);
      else if (isFunction(t.guard)) result = t.guard(getParams());
      return result;
    });

  const state = createBindable(() => ({
    defaultValue: resolveStateValue(machine, machine.initialState({ prop })),
    onChange(nextState: string, previousState: string | undefined) {
      // A state bindable always transitions from a concrete state
      // (INIT_STATE on start); undefined never occurs at runtime.
      const prevState = previousState as string;
      const { exiting, entering } = getExitEnterStates(
        machine,
        prevState,
        nextState,
        transitionRef.current?.reenter,
      );
      exiting.forEach((item: any) => {
        const exitEffects = effects.get(item.path);
        exitEffects?.();
        effects.delete(item.path);
      });
      exiting.forEach((item: any) => action(item.state?.exit));
      action(transitionRef.current?.actions);
      entering.forEach((item: any) => {
        const cleanup = effect(item.state?.effects);
        if (cleanup) {
          const existing = effects.get(item.path);
          effects.set(item.path, existing ? callAll(existing, cleanup) : cleanup);
        }
      });
      if (prevState === INIT_STATE) {
        action(machine.entry);
        const cleanup = effect(machine.effects);
        if (cleanup) {
          const existing = effects.get(INIT_STATE);
          effects.set(INIT_STATE, existing ? callAll(existing, cleanup) : cleanup);
        }
      }
      entering.forEach((item: any) => action(item.state?.entry));
    },
  }));

  let status = MachineStatus.NotStarted;

  // Events sent before start() are buffered and replayed once the machine
  // starts (Vue-adapter pattern): in Marko, a child component's onMount runs
  // before its parent's, so a child can legitimately send() before the
  // parent's <lifecycle onMount> has started the service. Dropping those
  // events would silently lose real interactions.
  const pendingEvents: EventObject[] = [];

  /** Runs one event through the machine's transition table. */
  const transition = (event: EventObject) => {
    previousEventRef.current = eventRef.current;
    eventRef.current = event;
    const currentState = state.get();
    const { transitions, source } = findTransition(machine, currentState, event.type);
    const chosen = choose(transitions);
    if (!chosen) return;
    transitionRef.current = chosen;
    const target = resolveStateValue(machine, chosen.target ?? currentState, source) as string;
    debug("transition", event.type, chosen.target || currentState, `(${chosen.actions})`);
    if (target !== currentState) {
      state.set(target);
    } else if (chosen.reenter) {
      state.invoke(currentState, currentState);
    } else {
      action(chosen.actions);
    }
  };

  const send = (event: EventObject) => {
    queueMicrotask(() => {
      if (status === MachineStatus.NotStarted) {
        pendingEvents.push(event);
        return;
      }
      if (status !== MachineStatus.Started) return; // stopped: drop
      transition(event);
    });
  };

  machine.watch?.(getParams());

  // Runtime shape matches Service<T> structurally (verified above until the
  // erasure at the top of this function); the string-keyed helpers can't
  // satisfy T's mapped-type indices statically, so assert once at the
  // boundary instead of threading T through every closure.
  return {
    state: getState(),
    send,
    context: ctx,
    prop,
    get scope() {
      return getScope();
    },
    refs,
    computed,
    event: getEvent(),
    getStatus: () => status,
    /** Client-only: run entry actions/effects. Call from `<lifecycle onMount>`. */
    start() {
      const started = status === MachineStatus.Started;
      status = MachineStatus.Started;
      debug(started ? "rehydrating..." : "initializing...");
      state.invoke(state.initial as string, INIT_STATE);
      // Replay events buffered before start (child components mount first).
      for (const event of pendingEvents.splice(0)) transition(event);
      // SSR attrs were rendered without event handlers (see normalize-props);
      // force one client recompute so handler-bearing props are applied.
      scheduleUpdate();
    },
    /** Call from `<lifecycle onDestroy>`. */
    stop() {
      if (status !== MachineStatus.Started) return;
      debug("unmounting...");
      status = MachineStatus.Stopped;
      pendingEvents.length = 0;
      effects.forEach((fn) => fn?.());
      effects.clear();
      transitionRef.current = null;
      action(machine.exit);
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    },
    /** Host calls when reactive props changed (controlled usage). */
    propsChanged() {
      invalidateProps();
      bindablePrevSyncs.forEach((sync) => sync());
      runTracks();
      notify();
    },
  } as MarkoService<T>;
}
