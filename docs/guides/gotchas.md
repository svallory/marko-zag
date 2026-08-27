---
title: "Landmines & Gotchas"
description: "Hard-won lessons: the tabindex fix, controlled props, boolean attributes, positioner styles."
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
- Controlled → pass the prop **and** update it in the change callback
  (Marko's `open:=state.open` binding sugar plus a chained `openChange`
  callback in `<machine-props>` is the ergonomic path).

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

## `event.currentTarget` is shadowed, not native

Marko's delegated events leave `event.currentTarget` pointing at the
delegation root, not the element the handler was attached to. Zag machine
logic relies on `currentTarget` heavily. `normalizeProps` wraps every
handler and shadows `currentTarget` with the element Marko passes as the
handler's second argument. If you attach Zag-provided handlers *without*
going through `normalizeProps`, machine internals will misbehave in
hard-to-trace ways.

## Raw machines don't serialize

`<service machine=dialogMachine.machine/>` throws
`Unable to serialize "input"` under SSR. Always pass a template-written
closure: `machine=() => dialogMachine.machine`. See
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

This is why `<service>` returns a **getter**: a closure written in a
template is the only serializable stand-in for a service, and calling it
defers the real-vs-throwaway choice to call time.

## A `<script>` that reads a `<let>` it also writes re-subscribes on itself

`<script>` compiles to an effect keyed on every binding it **reads**
(assignment alone creates no dependency). So a block that reads and writes
the same `<let>` re-runs on its own notifications, aborting and
re-subscribing every time:

```marko
<script>x += 1</script>   <!-- reads x AND writes x: re-runs on every x change -->
<script>x = 1</script>    <!-- assignment only: no dependency on x -->
```

The consequence for this adapter: **service creation and `props()` tracking
must never share one `<script>`**. Put the machine's construction in
`<lifecycle onMount>` and keep the props-tracking `<script>` separate — a
single block doing both reads `props()`, so every prop change would tear
down and rebuild the service.

## Effects fire two frames late — on purpose

If you step through a machine and wonder why entry effects run ~2 frames
after the transition: that is deliberate. Marko batches renders, so the DOM
an effect needs (a just-opened positioner) doesn't exist at transition time.
See [SSR & Hydration](/guides/ssr-and-hydration/#effect-timing).
