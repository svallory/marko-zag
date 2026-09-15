/**
 * Input type for a Marko component wrapping a Zag machine: the native tag's
 * attributes, with `Props` members shadowing any native attribute of the
 * same name.
 *
 * `Props` always wins on a name collision (e.g. a Zag `dir` prop over the
 * native `dir` attribute, `@zag-js/checkbox`'s `checked` over the native
 * `checked` attribute, or a component's own attr-tag member over a
 * same-named native attribute) — there is no case where intersecting a
 * declared member with a native attribute is wanted, since it only produces
 * redundant, lossy, or unsatisfiable types: an attr-tag `title` vs. the
 * native `string | false | null` is unsatisfiable, while
 * `checked: boolean | "indeterminate"` intersected with the native
 * `checked: boolean` silently collapses to `boolean`, dropping
 * `"indeterminate"` (lossy).
 *
 * The only other adjustment is `id`: Zag's `CommonProperties` requires it,
 * but the `<zag>` tag generates a stable one automatically, so consumers
 * may omit it (and may still override it).
 *
 * @typeParam Tag - The native tag name whose attributes the component
 * forwards (e.g. `"input"`, `"div"`).
 * @typeParam Props - The machine module's exported `Props` type
 * (e.g. `switchMachine.Props`), plus any component-declared extras folded in
 * via intersection (e.g. an `<@title>` attr tag): `MachineInput<Tag, Props &
 * Extras>`. Every member of this combined type shadows the same-named native
 * attribute, if any.
 *
 * @example
 * ```ts
 * import * as switchMachine from "@zag-js/switch";
 * import type { MachineInput } from "marko-zag";
 *
 * export type Input = MachineInput<"input", switchMachine.Props> & {
 *   // Marko bind-shorthand sugar (`checked:=state.on`):
 *   checkedChange?: (checked: boolean) => void;
 * };
 * ```
 *
 * Shadowing widens the component's *public* input, which is the point — but
 * a widened prop is no longer assignable to the native attribute it shadows,
 * so it must not be spread straight onto the rendered element. `checked` is
 * the worked example: `Input["checked"]` is correctly
 * `boolean | "indeterminate"`, while the native `<input>`'s `checked` is
 * `AttrBoolean`. Such props are machine-owned state — let the machine's own
 * `get*Props()` supply the element's value (for checkbox,
 * `api().getHiddenInputProps()` already emits `checked`) and drop the
 * incoming prop from whatever leftover object gets spread. The same applies
 * to any Zag prop whose type is wider than, or a different shape from, the
 * native attribute of that name (e.g. `@zag-js/slider`'s
 * `"aria-label"?: string[]`, one label per thumb, vs. the native
 * `aria-label?: AttrString`).
 *
 * A component that declares a member colliding with a native attribute
 * (e.g. `title` on `div`) folds it into `Props` via intersection, so it
 * shadows the native attribute's type instead of intersecting with it:
 * ```ts
 * type Extras = { title?: Marko.AttrTag<{ content: Marko.Body }> };
 * export type Input = MachineInput<"div", dialogMachine.Props & Extras> &
 *   Extras;
 * ```
 *
 * @remarks
 * Controlled-prop semantics follow Zag v1: passing a controlled prop (e.g.
 * `open=`) **without** wiring its change handler pins the machine to that
 * value — the machine reports changes through `onOpenChange` and expects the
 * owner to write the new value back. Use the `default*` props
 * (`defaultOpen`, `defaultValue`, …) for the uncontrolled, initial-value
 * path.
 */
export type MachineInput<Tag, Props> = Omit<
  Marko.Input<Tag>,
  Exclude<keyof Props, "id">
> &
  Omit<Props, "id"> & { id?: string };
