/**
 * Input type for a Marko component wrapping a Zag machine: the native tag's
 * attributes intersected with the machine's full `Props` type.
 *
 * The only adjustment is `id`: Zag's `CommonProperties` requires it, but the
 * `<zag>` tag generates a stable one automatically, so consumers
 * may omit it (and may still override it).
 *
 * @typeParam Tag - The native tag name whose attributes the component
 * forwards (e.g. `"input"`, `"div"`).
 * @typeParam Props - The machine module's exported `Props` type
 * (e.g. `switchMachine.Props`).
 * @typeParam Own - Extra members the component itself declares on its
 * `Input` (e.g. an `<@title>` attr tag). Keys present in `Own` are omitted
 * from the native/`Props` side before intersecting, so a declared member
 * that shares a name with a native attribute (like `title`) is not forced
 * into an unsatisfiable intersection with that attribute's native type.
 * Defaults to `{}`, which is a no-op.
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
 * A component that declares a member colliding with a native attribute
 * (e.g. `title` on `div`) passes that member as `Own` so it is not
 * intersected with the native attribute's type:
 * ```ts
 * export type Input = MachineInput<
 *   "div",
 *   dialogMachine.Props,
 *   { title?: Marko.AttrTag<{ content: Marko.Body }> }
 * > & {
 *   title?: Marko.AttrTag<{ content: Marko.Body }>;
 * };
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
export type MachineInput<Tag, Props, Own = {}> = Omit<
  Marko.Input<Tag> & Omit<Props, "id"> & { id?: string },
  keyof Own
> &
  Own;
