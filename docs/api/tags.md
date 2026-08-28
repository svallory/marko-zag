---
title: "Tags"
description: "The four Marko tags: zag, zag-machine, zag-portal, zag-store."
---

# Tags

marko-zag ships four tags, auto-discovered from the package's `marko.json`
taglib — no imports needed in `.marko` files. Most components need only
`<zag>`; see [The Component Pattern](/guides/component-pattern/) for the full
worked example.

Every tag's value shorthand is a **module getter** written in your template
(`() => switchMachine`), never the raw module: tag input is serialized for
resume, and functions from npm code throw `Unable to serialize "input"`.

## `<zag>`

The whole machine wiring in one tag: creates the service, connects it, and
returns the **api getter**.

```marko
import * as switchMachine from "@zag-js/switch";

<zag/api=() => switchMachine from=input/>

<label ...api().getRootProps()>
```

It is exactly `<zag-machine>` plus the connect line, so it takes the same
input plus `normalize=`.

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| *value* | `() => M` | Module getter (`() => switchMachine`) — supplies `machine`, `connect`, and the `props` name list. |
| `from` | `Record<string, any>` | The object to pick machine props out of, normally `input`. See [Prop building](#prop-building). |
| `props` | `(picked?) => Record<string, any>` | Machine-props closure. With `from=` it receives the picked props and its return value wins; without `from=` it is used verbatim. |
| `normalize` | `NormalizeProps<PropTypes>` | Prop normalizer; defaults to marko-zag's [`normalizeProps`](/api/normalize-props/). |
| *anything else* | `any` | Machine-prop overrides and callback replacements, merged last. |

Exactly one of `from=` / `props=` is required. Passing neither throws at
setup with a message naming both.

### Returns

An api **getter**: `() => ReturnType<M["connect"]>`. Call it at every use
site.

The getter's **identity** changes on every machine update and on every change
to a value read inside your props closure. Marko's `<const>` propagates only
a value that is `!==` the previous one, so that identity change is what makes
every `api()` spread recompute — for machine transitions and controlled-prop
changes alike, with no hand-written dependency list.

## Prop building

`from=` and `props=` are how machine props are assembled. Both `<zag>` and
`<zag-machine>` take them; this replaces the `<machine-props>` tag from 1.x.

Given `from=`, the tag:

1. picks every name in the module's exported `props` array out of the object;
2. injects `id: from.id ?? <generated id>`;
3. applies the **default callback rule** below;
4. merges every other attribute written on the tag as an override — the
   override wins.

### The default callback rule

A machine prop matching `on<X>Change` is wrapped automatically when your
component supplies **either** Zag's own `onXChange` **or** Marko's
bind-shorthand `xChange`. The wrapper forwards the details object, then
unwraps for the sugar:

```js
onCheckedChange(details) {
  from.onCheckedChange?.(details);
  if ("checked" in details) from.checkedChange?.(details.checked);
}
```

So a component declaring nothing but a `checkedChange?: (checked: boolean) => void`
input already supports Marko's two-way bind (`<Switch checked:=myState/>`),
and Zag's own `onCheckedChange` keeps working alongside it.

The `"checked" in details` guard is what keeps the rule honest. Callbacks
whose payload key does not match their name get **no** sugar — see
[Landmines & Gotchas](/guides/gotchas/) for the list. Callbacks that are not
`on<X>Change` at all (`onSelect`, `onValueCommit`, `onComplete`,
`onResizeStart`) are picked through untouched.

To replace a generated wrapper, write the callback on the tag — an override
replaces it outright, with no implicit forwarding:

```marko
<zag/api=() => tooltip from=input closeOnEscape=false
  onOpenChange(details) {
    input.onOpenChange?.(details);
    track(details.open);
  }/>
```

### `props=` for values with methods

`props=` is a closure written in **your** template, so what it builds never
crosses the tag-input boundary. That makes it the only safe place for a
`ListCollection`, an `@internationalized/date` value, or a `Color` — class
instances whose methods are the whole point, and which die with
`Unable to serialize "input"` if passed as tag input.

With `from=` present it receives the picked-and-adapted props, so you layer
onto them rather than rebuilding them:

```marko
<zag/api=() => select from=input props=(picked) => ({
  ...picked,
  collection: select.collection({
    items: input.items,
    itemToValue: (item) => item.value,
    itemToString: (item) => item.label,
  }),
})/>
```

## `<zag-machine>`

Creates and owns a running Zag service — the Marko analog of
`useMachine(machine, props)` — and returns the **service getter**.

Reach for it when the component needs the service itself: to thread into a
child, or to connect a different module against it. Otherwise use `<zag>`.

```marko
<zag-machine/service=() => toast props=() => ({ ...input.options(), parent: input.parent() })/>
<const/api=() => connect(toast, service())/>
```

### Input

Identical to `<zag>` minus `normalize=`: the module getter as its value,
`from=`, `props=`, and any overrides. See [Prop building](#prop-building).

### Returns

A service **getter**: `() => MarkoService<T>`.

`service()` returns the real running service on the client after mount, and a
never-started throwaway on the server and before mount. Zag's `connect()` is
a pure read over the service, so connecting the throwaway renders correct
initial attributes with no DOM access.

Any number of `<const>`s may derive from one `<zag-machine>`, and the getter
can be passed into child components as ordinary tag input.

> **Why a getter and not the service?** Returning the service object does
> not throw on the server — Marko serializes it with every function silently
> stripped, the page renders, and the first client read fails with
> `TypeError: … is not a function`. See
> [Landmines & Gotchas](/guides/gotchas/).

## `<zag-portal>`

SSR-safe portal: renders content inline on the server (inside a
`display: contents` host), then reparents the host to the target on mount.
Marko tracks nodes by reference, so moved nodes keep working.

```marko
<zag-portal>
  <if=api().open>
    <div ...api().getBackdropProps()/>
    ...
  </if>
</zag-portal>
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

## `<zag-store>`

Marko analog of the official adapters' `useSyncExternalStore`: bridges an
external subscribe/snapshot store — Zag's toast store from
`toast.createStore`, or any `@zag-js/store` proxy — into Marko reactivity.
Subscribes on mount, unsubscribes on destroy; returns a **getter** (same
idiom as `<zag-machine>`).

```marko
<zag-store/toasts
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
