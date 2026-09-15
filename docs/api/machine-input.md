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
only produces unsatisfiable types (e.g. an attr-tag `title` vs. the native
`string | false | null`).

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

## Remarks

Controlled-prop semantics follow Zag v1: passing a controlled prop (e.g.
`open=`) **without** wiring its change handler pins the machine to that
value — the machine reports changes through `onOpenChange` and expects the
owner to write the new value back. Use the `default*` props (`defaultOpen`,
`defaultValue`, …) for the uncontrolled, initial-value path. See
[Landmines & Gotchas](/guides/gotchas/#controlled-props-pin-the-machine).
