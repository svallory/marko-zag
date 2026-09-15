---
title: "MachineInput"
description: "Input type helper for components wrapping a Zag machine."
---

# `MachineInput`

```ts
type MachineInput<Tag, Props> = Omit<
  Marko.Input<Tag>,
  Exclude<keyof Props, "id">
> &
  Omit<Props, "id"> & { id?: string };
```

Input type for a Marko component wrapping a Zag machine: the native tag's
attributes, with `Props` members shadowing any native attribute of the same
name.

`Props` always wins on a name collision — there is no case where
intersecting a declared member with a native attribute is wanted, since it
only produces redundant, lossy, or unsatisfiable types. An attr-tag `title`
vs. the native `string | false | null` is unsatisfiable; `@zag-js/checkbox`'s
`checked: boolean | "indeterminate"` intersected with the native
`checked: boolean` silently collapses to `boolean`, dropping
`"indeterminate"` (lossy) — shadowing fixes that regression.

The only other adjustment is `id`: Zag's `CommonProperties` requires it, but
the [`<zag>`](/api/tags/#zag) tag generates a stable one automatically — so
consumers may omit it (and may still override it). `id` stays `string |
undefined` even when `Props` declares its own `id` member.

## Type parameters

| Parameter | Description |
| --- | --- |
| `Tag` | The native tag name whose attributes the component forwards (e.g. `"input"`, `"div"`). |
| `Props` | The machine module's exported `Props` type (e.g. `switchMachine.Props`), plus any component-declared extras folded in via intersection (e.g. an `<@title>` attr tag): `MachineInput<Tag, Props & Extras>`. Every member of this combined type shadows the same-named native attribute, if any. |

## Example

```ts
import * as switchMachine from "@zag-js/switch";
import type { MachineInput } from "marko-zag";

export type Input = MachineInput<"input", switchMachine.Props> & {
  // Marko bind-shorthand sugar (`checked:=state.on`):
  checkedChange?: (checked: boolean) => void;
};
```

## Shadowing a native attribute

A component's own declared member sometimes shares a name with a native
attribute — e.g. a `<@title>` attr tag on a `div`, which collides with the
native `title: AttrString` attribute. Fold the colliding member into
`Props` via intersection so it shadows the native attribute's type instead
of intersecting with it:

```ts
import * as dialogMachine from "@zag-js/dialog";
import type { MachineInput } from "marko-zag";

type Extras = { title?: Marko.AttrTag<{ content: Marko.Body }> };

export type Input = MachineInput<"div", dialogMachine.Props & Extras> &
  Extras;
```

## Don't forward a shadowed prop to the element

Shadowing widens the component's *public* input, which is the point — but a
widened prop is no longer assignable to the native attribute it shadows, so
it must not be spread straight onto the rendered element.

`checked` is the worked example: `Input["checked"]` is correctly
`boolean | "indeterminate"`, while the native `<input>`'s `checked` is
`AttrBoolean`. Spreading the leftover props from `splitProps` onto the
element therefore fails to type-check — correctly, since
`checked="indeterminate"` is not a valid HTML attribute value.

Such props are machine-owned state. Let the machine's own `get*Props()`
supply the element's value and drop the incoming prop from whatever leftover
object you spread:

```marko
// checkbox: api().getHiddenInputProps() already emits `checked`,
// so the incoming `checked` prop is dropped rather than forwarded.
<const/hiddenInputProps=(): Marko.NativeTags["input"]["input"] => ({
  ...stripOwnProps(splitProps(input)[1], "class", "checked"),
  ...api().getHiddenInputProps(),
})>
```

The same applies to any Zag prop whose type is wider than, or a different
shape from, the native attribute of that name. `@zag-js/slider` declares
`"aria-label"?: string[]` — one label per thumb — against the native
`aria-label?: AttrString`, so a consumer passes an array
(`aria-label=["Volume"]`), and the component reads it from
`api().getThumbProps({ index })` rather than forwarding it to the root
element.

## Remarks

Controlled-prop semantics follow Zag v1: passing a controlled prop (e.g.
`open=`) **without** wiring its change handler pins the machine to that
value — the machine reports changes through `onOpenChange` and expects the
owner to write the new value back. Use the `default*` props (`defaultOpen`,
`defaultValue`, …) for the uncontrolled, initial-value path. See
[Landmines & Gotchas](/guides/gotchas/#controlled-props-pin-the-machine).
