---
title: "Tags"
description: "The four Marko tags: machine-props, service, portal, store."
---

# Tags

marko-zag ships four tags, auto-discovered from the package's `marko.json`
taglib — no imports needed in `.marko` files. They compose in a fixed order;
see [The Component Pattern](/guides/component-pattern/) for the full worked
example.

Connecting the api is not a tag: `<service>` returns a service getter, so a
plain `<const>` calling the machine's own `connect()` is all it takes.

## `<machine-props>`

Builds the machine-props closure for `<service>` from a component's input:
picks the machine-owned props by name, injects a stable generated `id`
(overridable via `input.id`), and merges every other attribute written on
the tag — callback adaptations and inline overrides alike.

```marko
<machine-props/machineProps from=input pick=switchMachine.props
  onCheckedChange(details) {
    input.checkedChange?.(details.checked);
  }/>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| `from` | `Record<string, any>` | The component's full input object. |
| `pick` | `readonly string[]` | Machine prop names — the machine module's exported `props` array (e.g. `switchMachine.props`). |
| *anything else* | `any` | Callback adaptations and machine-prop overrides, merged last. |

### Returns

A closure `() => ({ id, ...picked, ...overrides })`.

> **Why a name array, not a splitter function?** `pick=` takes plain strings
> because they serialize. Passing a split *function* would hit Marko's
> tag-input serialization wall. The callback adaptation stays in your
> component file on purpose — it is the component's public contract.

## `<service>`

Creates and owns a running Zag service — the Marko analog of
`useMachine(machine, props)`.

```marko
<service/service machine=() => switchMachine.machine props=machineProps/>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| `machine` | `() => any` | Machine getter — **always a closure written in your template** (`() => switchMachine.machine`), never the raw machine (unserializable). |
| `props` | `() => Record<string, any>` | The closure from `<machine-props>`. Optional. |

### Returns

A service **getter**: `() => MarkoService<T>`.

`service()` returns the real running service on the client after mount, and
a never-started throwaway on the server and before mount. Zag's `connect()`
is a pure read over the service, so connecting the throwaway renders correct
initial attributes with no DOM access.

```marko
<service/service machine=() => switchMachine.machine props=machineProps/>
<const/api=() => switchMachine.connect(service(), normalizeProps)/>
<label ...api().getRootProps()>
```

The getter's **identity** changes on every machine update and on every change
to a value read inside your props closure. Marko's `<const>` propagates only
a value that is `!==` the previous one, so that identity change is what makes
the `api` line above recompute — for machine transitions and controlled-prop
changes alike, with no hand-written dependency list.

The tag also tracks every reactive read inside your props closure, so
controlled props re-notify the machine automatically.

Any number of `<const>`s may derive from one `<service>`, and the getter can
be passed into child components as ordinary tag input.

> **Why a getter and not the service?** Returning the service object does
> not throw on the server — Marko serializes it with every function silently
> stripped, the page renders, and the first client read fails with
> `TypeError: … is not a function`. See
> [Landmines & Gotchas](/guides/gotchas/).

## `<portal>`

SSR-safe portal: renders content inline on the server (inside a
`display: contents` host), then reparents the host to the target on mount.
Marko tracks nodes by reference, so moved nodes keep working.

```marko
<portal>
  <if=api().open>
    <div ...api().getBackdropProps()/>
    ...
  </if>
</portal>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| `to` | `string` | CSS selector for the portal target. Ignored when `container` matches. |
| `container` | `() => Element \| null` | Target element getter (highest priority) — a closure, so tag input stays serializable. |
| `getRootNode` | `() => ShadowRoot \| Document \| Node` | Root node resolver for shadow DOM/iframes; scopes the `to` lookup and the body fallback. Same shape as Zag's machine prop. |
| `disabled` | `boolean` | Disable reparenting (render in place). |
| `content` | `Marko.Body` | The portalled content (body content works too). |

Target resolution order (mirroring the official React/Preact `Portal`):
`container()`, then `to`, then the owner document's `body`.

On destroy the tag removes the host manually — required, not defensive:
Marko's own removal walks the *original* parent chain, which no longer
contains the reparented host.

## `<store>`

Marko analog of the official adapters' `useSyncExternalStore`: bridges an
external subscribe/snapshot store — Zag's toast store from
`toast.createStore`, or any `@zag-js/store` proxy — into Marko reactivity.
Subscribes on mount, unsubscribes on destroy; returns a **getter** (same
idiom as `<service>`).

```marko
<store/toasts
  subscribe=(onChange) => toastStore.subscribe(onChange)
  snapshot=() => toastStore.getState()
/>
<for|item| of=toasts().toasts> ... </for>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| `subscribe` | `(onChange: () => void) => () => void` | Subscribes to the store; returns unsubscribe. Written in your template (serialization). |
| `snapshot` | `() => T` | Reads the store's current value. |
| `serverSnapshot` | `() => T` | SSR-only value; defaults to `snapshot`. |
