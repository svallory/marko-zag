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

## Raw machines and connect functions don't serialize

`<service machine=dialogMachine.machine/>` throws
`Unable to serialize "input"` under SSR. Always pass template-written
closures: `machine=() => dialogMachine.machine`, and write the connect
closure inline in `<connect/api=(service, normalizeProps) => ...>`.
See [SSR & Hydration](/guides/ssr-and-hydration/) for the full reasoning.

## Effects fire two frames late — on purpose

If you step through a machine and wonder why entry effects run ~2 frames
after the transition: that is deliberate. Marko batches renders, so the DOM
an effect needs (a just-opened positioner) doesn't exist at transition time.
See [SSR & Hydration](/guides/ssr-and-hydration/#effect-timing).
