---
title: "Landmines & Gotchas"
description: "Hard-won lessons: the tabindex fix, controlled props, callbacks the sugar can't reach, values that don't serialize, positioner styles."
---

# Landmines & Gotchas

Every item on this page cost real debugging time while building
[marko-ui](https://github.com/svallory/marko-ui) on top of this adapter.
marko-zag already handles most of them for you — this page explains *why*,
so you recognize the symptoms if you ever bypass the built-ins.

## `tabIndex` → `tabindex` (roving focus goes keyboard-dead)

Zag emits the React-style `tabIndex`. Marko writes attribute keys
**verbatim**, so camelCase `tabIndex` is a *different attribute* from the
`tabindex` already on the element — every update removes the old attribute
and adds the new one. Removing `tabindex` from the focused element **blurs
it in Chromium** (setting it in place does not).

Symptom: every roving-focus widget went keyboard-dead after one keypress —
a slider lost focus to `<body>` after a single arrow press.

Fix: `normalizeProps` maps `tabIndex` to the canonical lowercase
`tabindex`, keeping it a single in-place attribute write. If you write your
own normalizer, this mapping is not optional.

## Controlled props pin the machine

Zag v1 controlled-prop semantics: passing a controlled prop (e.g. `open=`)
**without** wiring its change handler pins the machine to that value. The
machine reports the attempted change through `onOpenChange` and expects the
owner to write the value back; if nobody does, the dialog never opens (or
never closes).

- Uncontrolled with an initial value → use `default*` props
  (`defaultOpen`, `defaultValue`, …).
- Controlled → pass the prop **and** update it in the change callback. With
  `<zag from=input/>`, declaring an `openChange?: (open: boolean) => void`
  on your component's `Input` is enough: the default callback rule wires
  `onOpenChange` to fire it, so callers get `open:=state.open` binding sugar
  for free.

## Not every callback gets the two-way sugar

A callback gets the two-way sugar only when **both** conditions hold: the
name matches `on<X>Change`, and the details object actually carries the
derived key (`x in details`, checked per call). Real Zag callbacks miss one
or the other often enough to be worth listing — for these you write an
explicit override attribute on the tag.

**Matches the name pattern, but the key is absent** — the wrapper is
installed and forwards to your `onXChange`, but the `xChange` half never
fires:

| Callback | What `details` actually carries |
| --- | --- |
| `onTriggerValueChange` | `details.value` — not `details.triggerValue` |

**Does not match `on<X>Change` at all** — no wrapper is generated; the
callback is picked out of `from=` and passed to the machine untouched:

| Callback | What it carries |
| --- | --- |
| `onValueComplete` | `details.value` |
| `onPositionChangeEnd` / `onSizeChangeEnd` | `details.position` / `details.size` |
| `onCollapse` / `onExpand` | called as `(panelId, size)` — no details object |
| `onTick` | the whole details object is the payload |
| `onSelect`, `onValueCommit`, `onComplete`, `onResizeStart` | not change events at all |

Passing through untouched is correct in that second group: there is nothing
to adapt, and the machine gets exactly what your component supplied.

The override is a plain attribute, merged after everything `from=` supplied:

```marko
<zag/api=() => machineModule from=input
  onSizeChangeEnd(details) {
    input.onSizeChangeEnd?.(details);
    input.sizeChange?.(details.size);
  }/>
```

## Collections, dates and colors must be built inside `props=`

A `ListCollection`, an `@internationalized/date` `DateValue`, and a `Color`
are class instances whose **methods** are the whole reason they exist. Tag
input is serialized for resume, so passing one through `from=` — or as a tag
attribute — dies with `Unable to serialize "input"`.

Build them inside `props=`, a closure written in your own template. It never
crosses the boundary at all, and with `from=` it receives the
already-picked-and-adapted props so you layer onto them instead of rebuilding
them by hand:

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

```marko
<!-- WRONG: the collection crosses tag input and the render throws -->
<zag/api=() => select from=input collection=myCollection/>
```

`tests/ssr/zag-props.ssr.test.ts` pins both halves under a real server
render: the closure's return value reaches the machine (the collection
resolves `value` to a label), and no function-bearing field
(`itemToValue`, `itemToString`, `isItemDisabled`) leaks into the resume
payload.

## Boolean `aria-*` attributes need `String()`

`aria-expanded={false}` must render as `aria-expanded="false"` — the
*string* — for assistive tech. Marko's boolean-attribute rendering instead
omits falsy attributes and renders truthy ones as empty (`aria-expanded`),
both wrong for ARIA. `normalizeProps` stringifies every boolean whose
attribute name starts with `aria-` (`String(value)`), so screen readers see
the tri-state (`"true"` / `"false"` / absent) Zag intends.

## Floating elements: `positionerStyle` must be a STATIC style

Zag's placement effect writes `--x`, `--y`, `--z-index`,
`--reference-width` as inline CSS custom properties directly on the
positioner element. Marko re-applies *reactive* style attributes on every
recompute — wiping those vars and snapping your popover to the corner.

Fix: apply [`positionerStyle`](/api/positioner-style/) through a **static**
`style=` attribute placed *after* the positioner-props spread. Marko writes
a static attribute once and never touches it again, so Zag's imperative var
writes survive:

```marko
import { positionerStyle } from "marko-zag";

<div ...api().getPositionerProps() style=positionerStyle>
  <div ...api().getContentProps()>...</div>
</div>
```

## `TS2589` when you annotate a native-attribute passthrough

Building a passthrough of leftover native attributes and spreading it onto
an element next to a Zag prop getter is a common pattern:

```marko
<const/nativeAttrs=(): PropTypes["element"] =>
  stripOwnProps(checkboxMachine.splitProps(input)[1] as typeof input, "class")
/>

<label ...api().getRootProps()>
  <input ...nativeAttrs() ...api().getHiddenInputProps()>
</label>
```

The annotation on that `<const>` matters. Writing it with a **narrowed**
element parameter — `Marko.HTMLAttributes<HTMLInputElement>` — makes the
type checker fail with:

```
error TS2589: Type instantiation is excessively deep and possibly infinite.
```

Use `PropTypes["element"]` (exported from `marko-zag`) instead, or the
equivalent `Marko.HTMLAttributes<Element>`.

This is a **Marko type-level limit, not a marko-zag one**: checking a
narrowed `HTMLAttributes<T>` against a native tag's own input instantiates
marko's shared `CommonAttributes<T>` event-handler surface at a second,
different `T`, and the combined check exceeds TypeScript's instantiation
depth. It reproduces in a project with only `marko` installed — no
marko-zag, no Zag — from a *single* spread:

```marko
<const/nativeAttrs=(): Marko.HTMLAttributes<HTMLInputElement> => ({})/>
<input ...nativeAttrs()>
```

Verified on marko 6.3.36 and 6.3.46. marko-zag's own api type is not a
factor: `...api().getHiddenInputProps()` spreads twice over cleanly on its
own. `PropTypes["element"]` is deliberately `HTMLAttributes<Element>` — its
type parameter appears only contravariantly, so it stays assignable to every
tag while keeping the check shallow.

Do not reach for `@ts-expect-error` here; the annotation change is the fix.

## `event.currentTarget` is shadowed, not native

Marko's delegated events leave `event.currentTarget` pointing at the
delegation root, not the element the handler was attached to. Zag machine
logic relies on `currentTarget` heavily. `normalizeProps` wraps every
handler and shadows `currentTarget` with the element Marko passes as the
handler's second argument. If you attach Zag-provided handlers *without*
going through `normalizeProps` (or `connect()`, which applies it for you),
machine internals will misbehave in hard-to-trace ways.

## Raw modules don't serialize

`<zag/api=dialogMachine from=input/>` throws `Unable to serialize "input"`
under SSR. The tag's value is always a **module getter** written in your
template: `api=() => dialogMachine`. Same for `<zag-machine>`, for
`<zag-store>`'s `subscribe`/`snapshot`, and for `<zag-portal>`'s
`container`/`getRootNode`. See
[SSR & Hydration](/guides/ssr-and-hydration/) for the full reasoning.

## Returning a service object instead of a getter fails *silently* on the server

This is the nastiest failure mode in the whole adapter, because the loud
`Unable to serialize "input"` error only fires for tag **input**. A tag
**variable** fails quietly.

```marko
<return=ssrService(machine, props)/>   <!-- renders fine, breaks on the client -->
```

The server does not throw. Marko serializes the service object with every
function silently stripped — the payload comes back as bare data like
`{state:{initial:"ready"},context:{},scope:{id:"x"},refs:{},event:{type:""}}`
— the page renders with correct markup, and the first client read dies with
`Uncaught TypeError: r is not a function`.

This is why `<zag-machine>` returns a **getter** (and `<zag>` an api getter):
a closure written in a template is the only serializable stand-in for a
service, and calling it defers the real-vs-throwaway choice to call time.

## A getter built inside an IIFE cannot be serialized

Returning a getter is necessary but not sufficient — *how you write it*
decides whether it survives the boundary. The compiler wraps a closure
written **directly** as a `<const>` value in `_resume(...)`, registering it
so it can be serialized. Wrap that same closure in an IIFE and it stays
unregistered:

```marko
<const/value=(void rev, () => snapshot())/>          <!-- registered -->
<const/value=((_rev: number) => () => snapshot())(rev)/>  <!-- NOT registered -->
```

Both behave identically until a consumer makes the browser reference the
getter — which a **spread** does:

```marko
<div ...store().attrs>   <!-- unregistered getter: Unable to serialize -->
<div>${store().count}</div>   <!-- body content: never triggers it -->
```

That asymmetry is why this hides so well: reading a snapshot in body content
works forever, and the failure appears only when someone spreads its fields
onto an element. marko-zag's own store tag shipped this way until 2.0.

An IIFE is tempting because TypeScript rejects a bare identifier before a
comma (`error TS2695`). Use `void dep,` instead — it keeps the dependency
read and leaves the arrow in the value position.

## A `<script>` that reads a `<let>` it also writes re-subscribes on itself

`<script>` compiles to an effect keyed on every binding it **reads**
(assignment alone creates no dependency). So a block that reads and writes
the same `<let>` re-runs on its own notifications, aborting and
re-subscribing every time:

```marko
<script>x += 1</script>   <!-- reads x AND writes x: re-runs on every x change -->
<script>x = 1</script>    <!-- assignment only: no dependency on x -->
```

The consequence for this adapter: **service creation and props tracking must
never share one `<script>`**. `<zag-machine>` puts the machine's construction
in `<lifecycle onMount>` and keeps the props-tracking `<script>` separate — a
single block doing both reads the props closure, so every prop change would
tear down and rebuild the service.

## `from=` or `props=` — one of them is required

`<zag>` and `<zag-machine>` throw if you supply neither:

```
<zag-machine> requires `from=` (an input object to pick machine props from)
or `props=` (a closure returning the machine props), or both.
```

The check is **eager**: `<zag-machine>` runs it in its own `<const>` at
setup, not inside the props closure. A wiring mistake therefore throws where
you wrote the tag, rather than on whichever later render first reads props.

## Effects fire two frames late — on purpose

If you step through a machine and wonder why entry effects run ~2 frames
after the transition: that is deliberate. Marko batches renders, so the DOM
an effect needs (a just-opened positioner) doesn't exist at transition time.
See [SSR & Hydration](/guides/ssr-and-hydration/#effect-timing).
