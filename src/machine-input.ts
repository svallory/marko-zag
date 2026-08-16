/**
 * Input type for a Marko component wrapping a Zag machine: the native tag's
 * attributes intersected with the machine's full `Props` type.
 *
 * The only adjustment is `id`: Zag's `CommonProperties` requires it, but the
 * `<machine-props>` tag generates a stable one automatically, so consumers
 * may omit it (and may still override it).
 *
 * @typeParam Tag - The native tag name whose attributes the component
 * forwards (e.g. `"input"`, `"div"`).
 * @typeParam Props - The machine module's exported `Props` type
 * (e.g. `switchMachine.Props`).
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
 * @remarks
 * Controlled-prop semantics follow Zag v1: passing a controlled prop (e.g.
 * `open=`) **without** wiring its change handler pins the machine to that
 * value — the machine reports changes through `onOpenChange` and expects the
 * owner to write the new value back. Use the `default*` props
 * (`defaultOpen`, `defaultValue`, …) for the uncontrolled, initial-value
 * path.
 */
export type MachineInput<Tag, Props> = Marko.Input<Tag> &
  Omit<Props, "id"> & { id?: string };
