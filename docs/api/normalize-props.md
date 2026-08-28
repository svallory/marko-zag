---
title: "normalizeProps"
description: "Maps Zag's React-style prop objects onto Marko DOM attributes."
---

# `normalizeProps`

```ts
const normalizeProps: NormalizeProps<PropTypes>;
```

Zag's machines are framework-agnostic in their logic but not in their prop
dialect: every `getXProps()` returns a React-flavored object — `className`,
`onFocus`, `tabIndex`, a camelCase `style` object. `normalizeProps` is the
translation layer that turns those into attributes Marko can write onto a
native tag. Every official Zag adapter ships one; this is Marko's.

It is built with `createNormalizer<PropTypes>` from `@zag-js/types`, so it is
an *object* with a method per element kind (`normalizeProps.button(...)`,
`normalizeProps.element(...)`), all backed by the same transform function.
[`PropTypes`](/api/tags/) binds each entry to Marko's own native-tag input
types, which is what makes `api().getTriggerProps()` type-check exactly like
attributes hand-written on a `<button>`.

You rarely pass it yourself: [`<zag>`](/api/tags/) and
[`connect()`](/api/connect/) apply it by default.

```marko
<zag/api=() => switchMachine from=input/>
<label ...api().getRootProps()>
```

## What it translates

| Zag emits | Marko gets | Why |
| --- | --- | --- |
| `className` | `class` | Marko uses the HTML attribute name. |
| `htmlFor` | `for` | Same. |
| `defaultValue` / `defaultChecked` | `value` / `checked` | Initial-value path for native inputs; Marko has no `default*` spelling. |
| `onChange` | `onInput` | React's `onChange` fires per keystroke — that is the DOM's `input` event, not `change`. |
| `onDoubleClick` | `onDblClick` | Marko names handlers after the DOM event (`dblclick`). |
| `onFocus` / `onBlur` | `onFocusin` / `onFocusout` | **Bubbling parity** — see below. |
| `tabIndex` | `tabindex` | **Load-bearing focus fix** — see below. |
| style objects | hyphenated keys | Marko writes style keys verbatim; camelCase must become `kebab-case`. |
| boolean `aria-*` | `"true"` / `"false"` strings | Marko's boolean-attribute rendering would emit an empty attribute. |

Anything not in that table passes through under its own name. Two keys are
dropped outright: `children` (Zag's React-only slot; Marko uses
`renderBody`), and `readOnly` when it is `false` — the presence of the
attribute is what makes an input read-only, so a `false` value must not be
written at all.

## `tabIndex` → `tabindex`

Marko treats attribute keys **verbatim**: it does not lowercase them, so the
camelCase `tabIndex` is a *different* attribute from the `tabindex` already
on the element. Each update therefore removes the old attribute and adds the
new one, rather than writing one attribute in place.

Removing `tabindex` from the currently focused element **blurs it in
Chromium** (setting it in place does not). The result was that every
roving-focus widget went keyboard-dead after a single keypress: press an
arrow key on a slider, the machine recomputes `tabIndex`, the attribute is
removed and re-added, and focus falls to `<body>`. Mapping to the canonical
lowercase name keeps it a single in-place attribute write.

> This is the one mapping you cannot skip. It is also the one whose absence
> looks like a Marko reactivity bug rather than a normalizer bug.

## `onFocus` / `onBlur` → `onFocusin` / `onFocusout`

Zag machines are written against React's synthetic focus semantics, where a
parent's `onFocus` fires when any descendant gains focus. The DOM does not
work that way: `focus` and `blur` do not bubble.

Marko delegates every event at the document and only walks ancestors when
`ev.bubbles` is true. A delegated `onFocus` would therefore fire for the
exact target and never for a parent — silently breaking any machine that
watches focus on a container. `focusin`/`focusout` are the bubbling twins of
the same events, so this mapping restores the semantics the machines were
written for. Every non-React official adapter maps them the same way.

## `event.currentTarget` shadowing

`currentTarget` is only meaningful while an event is dispatching, and it is
not available in Marko's delegated events. Zag machine handlers read it
routinely.

So every function prop whose (post-mapping) name matches `on[A-Z]` is
wrapped. Marko calls handlers with the element as a **second argument**; the
wrapper uses that to define a `currentTarget` getter on the event before
calling Zag's handler:

```ts
function wrapHandler(fn: (event: Event) => void) {
  return function (event: Event, el?: Element) {
    if (el) {
      Object.defineProperty(event, "currentTarget", {
        get: () => el,
        configurable: true,
      });
    }
    return fn(event);
  };
}
```

Zag's handler still receives exactly one argument, so nothing downstream has
to know about Marko's calling convention.

## Boolean `aria-*` stringification

`aria-expanded={false}` must serialize to `aria-expanded="false"` — ARIA
attributes are tri-state, and *absent* means something different from
*false*. Marko's boolean-attribute rendering would emit an empty attribute
instead, which assistive technology reads wrong. Boolean values on keys
starting with `aria-` are therefore converted to the strings `"true"` and
`"false"`.

Only `aria-*` keys get this treatment; ordinary boolean attributes
(`disabled`, `checked`, `hidden`) keep Marko's presence-based rendering,
which is correct for them.

## SSR handler stripping

On the server (`typeof document === "undefined"`), function props are dropped
entirely. Two reasons:

- Functions coming out of `@zag-js/*` modules are **not Marko-serializable**.
  Leaving them on a prop object would fail the resume serialization pass.
- Server HTML has no use for them — there is nothing to listen with.

They reappear on the first client recompute, which `service.start()`
schedules on mount. Until then the server-rendered markup carries the correct
static attributes from a never-started machine (`ssrService`), which is what
makes the SSR pass work at all.

## Style objects

A `style` prop that is an object is rebuilt with hyphenated keys, because
Marko writes style-object keys verbatim — `backgroundColor` would emit a
property no browser knows. Keys beginning with `--` pass through untouched so
custom properties keep their exact spelling, and values that are neither
strings nor numbers are dropped.

```ts
{ backgroundColor: "red", "--gap": 4 }
// →
{ "background-color": "red", "--gap": 4 }
```

## Wrapping it

`normalize=` on `<zag>` (and the third argument of
[`connect()`](/api/connect/)) takes a `NormalizeProps<PropTypes>` — the whole
normalizer object, not a plain function. Build a replacement with
`createNormalizer` and delegate to `normalizeProps` inside it:

```marko
import * as switchMachine from "@zag-js/switch";
import { createNormalizer } from "@zag-js/types";
import { normalizeProps, type PropTypes } from "marko-zag";

<const/withTestIds=createNormalizer<PropTypes>((props: Record<string, any>) => {
  const out = normalizeProps.element(props as any) as Record<string, any>;
  if (props.id) out["data-testid"] = props.id;
  return out;
})/>

<zag/api=() => switchMachine from=input normalize=withTestIds/>
<label ...api().getRootProps()>
```

> **Do not spread `normalizeProps`.** It is a Proxy with no own enumerable
> keys — its per-element methods are synthesized on access — so
> `{ ...normalizeProps, button: myButton }` evaluates to an object with a
> `button` key and nothing else. Every other element getter is then
> `undefined`, and the machine crashes the first time it calls one. Wrapping
> must go through `createNormalizer`.

`normalize=` is used verbatim — `<zag>` reads `input.normalize ?? normalizeProps`
and hands it straight to the module's `connect()`. Build the normalizer in the
caller's template, as above, rather than importing a prebuilt one: tag input is
serialized for resume, and a normalizer that crosses the input boundary as an
imported value is npm-provided function data.
