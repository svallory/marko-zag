/**
 * The structural contract every Zag machine module satisfies, and the shared
 * input shape of the `<zag>` / `<zag-machine>` tags.
 *
 * Zag ships each component as a module namespace exporting `machine`,
 * `connect`, `props`, `splitProps` and `anatomy`. The tags are generic over
 * that namespace so a single `mod=() => switchMachine` getter supplies the
 * interpreter (`machine`), the api factory (`connect`), and the prop-name
 * list used to pick machine props out of a component's input (`props`).
 */
import type { Machine, MachineSchema, Service } from "@zag-js/core";
import type { PropTypes } from "./prop-types.ts";

/**
 * A Zag component module, as imported with
 * `import * as switchMachine from "@zag-js/switch"`.
 *
 * Deliberately structural and loose: Zag's per-component modules differ in
 * their generic parameters (collections, item types), and pinning them here
 * would reject valid modules. The members the tags actually call are the
 * ones typed.
 */
export interface ZagModule {
  /** The machine definition handed to the interpreter. */
  machine: Machine<any>;
  /** Builds the component api from a running service. */
  connect: (service: any, normalize: any) => any;
  /** Machine-owned prop names, used to pick them out of a component input. */
  props: readonly string[];
}

/** The machine schema a module's `machine` is defined over. */
export type ZagSchema<M extends ZagModule> =
  M["machine"] extends Machine<infer T> ? T : MachineSchema;

// There is deliberately no `ZagProps<M>` alias.
//
// The obvious definition — `ZagSchema<M>["props"]` — resolves to `any` for
// every real Zag module: `ZagSchema` recovers the schema through
// `Machine<infer T>`, and the schema types its own members loosely, so
// indexing it narrows nothing. An alias that always yields `any` is worse
// than none, because it reads as a constraint at every call site while
// enforcing nothing (an earlier revision shipped exactly that, aliased to the
// whole schema, and `props?:` typed nothing at all).
//
// A module's own exported `Props` (e.g. `checkbox.Props`) IS a real type, but
// it is not reachable structurally from `ZagModule` — modules export it under
// a name, not as a member. Components that want that precision get it from
// `MachineInput<Tag, checkbox.Props>` on their own `Input`, which is the
// documented path and is unaffected by any of this.

/**
 * The api object a module's `connect` returns — what `<zag>` yields when
 * called.
 */
export type ZagApi<M extends ZagModule> = ReturnType<M["connect"]>;

/**
 * Input shared by `<zag>` and `<zag-machine>`.
 *
 * Exactly one of `from` / `props` is required; both together means "pick from
 * `from`, then hand the result to `props` for a final pass" — the
 * serialization-safe place to add a `collection`, a parsed date, or a color.
 * Every other attribute written on the tag is an override merged last.
 */
export interface ZagMachineInput<M extends ZagModule> {
  /**
   * Module getter, written as the tag's value: `<zag/api=() => switchMachine/>`.
   *
   * Never the raw module — tag input is serialized for resume, and
   * npm-provided functions throw `Unable to serialize "input"`.
   */
  value: () => M;
  /**
   * The component's input object. Every name in the module's `props` array is
   * picked out of it, `id` is generated when absent, and `onXChange`
   * callbacks gain the two-way `xChange` sugar.
   */
  from?: Record<string, any>;
  /**
   * Machine props closure. With `from=` it receives the picked-and-adapted
   * props and its return value is what the machine gets; without `from=` it
   * is called with no argument and used verbatim.
   *
   * Written in the caller's template, so values with methods
   * (`ListCollection`, `DateValue`, `Color`) never cross the input boundary.
   */
  props?: (picked?: Record<string, any>) => Record<string, any>;
  /** Machine-prop overrides and callback replacements written on the tag. */
  [override: string]: any;
}

/** A service over a module's schema — what `<zag-machine>`'s getter returns. */
export type ZagService<M extends ZagModule> = Service<ZagSchema<M>>;

export type { PropTypes };
