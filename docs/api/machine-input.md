---
title: "MachineInput"
description: "Input type helper for components wrapping a Zag machine."
---

# `MachineInput`

```ts
type MachineInput<Tag, Props, Own = {}> = Omit<
  Marko.Input<Tag> & Omit<Props, "id"> & { id?: string },
  keyof Own
> &
  Own;
```

Input type for a Marko component wrapping a Zag machine: the native tag's
attributes intersected with the machine's full `Props` type.

The only adjustment on the native/`Props` side is `id`: Zag's
`CommonProperties` requires it, but the [`<zag>`](/api/tags/#zag) tag
generates a stable one automatically — so consumers may omit it (and may
still override it).

> `Own` always wins: if it declares its own `id` member (e.g. `Own = {id:
> number}`), that member replaces the `id?: string` guarantee above —
> the stable auto-generated `id` is no longer part of the type.

## Type parameters

| Parameter | Description |
| --- | --- |
| `Tag` | The native tag name whose attributes the component forwards (e.g. `"input"`, `"div"`). |
| `Props` | The machine module's exported `Props` type (e.g. `switchMachine.Props`). |
| `Own` | Extra members the component itself declares on its `Input` (e.g. an `<@title>` attr tag). Keys present in `Own` are omitted from the native/`Props` side before intersecting, so a declared member sharing a name with a native attribute isn't forced into an unsatisfiable intersection with that attribute's native type. Defaults to `{}` (no-op). |

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
native `title: AttrString` attribute. Plain `&` intersection would then
force an unsatisfiable type at every consumer. Pass the colliding member as
`Own` so it resolves to the declared type instead:

```ts
import * as dialogMachine from "@zag-js/dialog";
import type { MachineInput } from "marko-zag";

export type Input = MachineInput<
  "div",
  dialogMachine.Props,
  { title?: Marko.AttrTag<{ content: Marko.Body }> }
> & {
  title?: Marko.AttrTag<{ content: Marko.Body }>;
};
```

## Remarks

Controlled-prop semantics follow Zag v1: passing a controlled prop (e.g.
`open=`) **without** wiring its change handler pins the machine to that
value — the machine reports changes through `onOpenChange` and expects the
owner to write the new value back. Use the `default*` props (`defaultOpen`,
`defaultValue`, …) for the uncontrolled, initial-value path. See
[Landmines & Gotchas](/guides/gotchas/#controlled-props-pin-the-machine).
