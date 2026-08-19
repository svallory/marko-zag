/**
 * Hand-built Zag machine fixture exercising every adapter contract:
 * controlled/uncontrolled bindable context (plus a `sync: true` bindable),
 * entry/exit/transition actions, machine- and state-level effects with
 * cleanups, `watch` tracks, guards, and refs.
 */
import { createMachine } from "@zag-js/core";

export interface CounterCalls {
  actions: string[];
  effects: string[];
  cleanups: string[];
}

export function createCounterFixture() {
  const calls: CounterCalls = { actions: [], effects: [], cleanups: [] };

  const machine = createMachine<any>({
    props({ props }) {
      return { defaultCount: 0, step: 1, ...props };
    },
    initialState() {
      return "idle";
    },
    context({ prop, bindable }) {
      return {
        count: bindable(() => ({
          defaultValue: prop("defaultCount"),
          value: prop("count"),
          onChange(value: number, prev: number | undefined) {
            prop("onCountChange")?.(value, prev);
          },
        })),
        // sync bindable: adapters must flush this without microtask batching
        text: bindable(() => ({
          defaultValue: "",
          sync: true,
          onChange(value: string) {
            prop("onTextChange")?.(value);
          },
        })),
      };
    },
    refs() {
      return { calls: 0 };
    },
    watch({ track, prop, action }) {
      track([() => prop("label")], () => {
        action(["noteLabelChanged"]);
      });
    },
    entry: ["noteRootEntry"],
    effects: ["rootEffect"],
    exit: ["noteRootExit"],
    states: {
      idle: {
        on: {
          GO: { target: "active", actions: ["noteTransition"] },
          "COUNT.INC": { actions: ["increment"] },
          "COUNT.SET": { actions: ["setCount"] },
          "TEXT.SET": { actions: ["setText"] },
          "GUARDED.GO": { guard: "never", target: "active" },
        },
      },
      active: {
        entry: ["noteActiveEntry"],
        exit: ["noteActiveExit"],
        effects: ["activeEffect"],
        on: {
          STOP: { target: "idle" },
        },
      },
    },
    implementations: {
      guards: {
        never: () => false,
      },
      actions: {
        noteRootEntry: () => calls.actions.push("rootEntry"),
        noteRootExit: () => calls.actions.push("rootExit"),
        noteTransition: () => calls.actions.push("transition"),
        noteActiveEntry: () => calls.actions.push("activeEntry"),
        noteActiveExit: () => calls.actions.push("activeExit"),
        noteLabelChanged: () => calls.actions.push("labelChanged"),
        increment({ context, prop, refs }: any) {
          refs.set("calls", refs.get("calls") + 1);
          context.set("count", (prev: number) => prev + prop("step"));
        },
        setCount({ context, event }: any) {
          context.set("count", event.value);
        },
        setText({ context, event }: any) {
          context.set("text", event.value);
        },
      },
      effects: {
        rootEffect: () => {
          calls.effects.push("root");
          return () => calls.cleanups.push("root");
        },
        activeEffect: () => {
          calls.effects.push("active");
          return () => calls.cleanups.push("active");
        },
      },
    },
  });

  return { machine, calls };
}
