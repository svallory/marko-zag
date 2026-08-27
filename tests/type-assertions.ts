/**
 * Compile-time regression assertions, checked by `bun run check` (this file
 * is listed in tsconfig include). No runtime — never imported.
 *
 * Guards the PropTypes contract: the generic `element` fallback must be
 * spreadable onto ANY native tag (its type parameter is contravariant-only),
 * while the specifically-typed keys stay strict.
 *
 * Also pins the tag return types: <zag-machine> returns a service GETTER and
 * <zag> returns an api GETTER — never a service or api object. That
 * distinction is the whole 2.0 contract: a getter is the only serializable
 * stand-in, and its identity is what makes downstream <const>s recompute.
 */
import type * as checkbox from "@zag-js/checkbox";
import type { MachineSchema } from "@zag-js/core";
import type { MarkoService } from "../src/machine.ts";
import type { PropTypes } from "../src/prop-types.ts";
import type { ZagApi, ZagModule, ZagSchema } from "../src/zag-module.ts";
import type Service from "../src/tags/zag-machine.marko";
import type { Input as ZagInput } from "../src/tags/zag.marko";

declare const element: PropTypes["element"];

// The generic fallback spreads onto any HTML element.
export const ontoSpan: Marko.Input<"span"> = element;
export const ontoAnchor: Marko.Input<"a"> = element;
export const ontoList: Marko.Input<"ul"> = element;
export const ontoListItem: Marko.Input<"li"> = element;
export const ontoNav: Marko.Input<"nav"> = element;
export const ontoDiv: Marko.Input<"div"> = element;

// Strict keys must NOT collapse into the generic shape.
declare const button: PropTypes["button"];
// @ts-expect-error button props are not valid input props
export const strictStaysStrict: Marko.Input<"input"> = button;

// The map covers ALL native tags (official-adapter parity), not just Zag's
// 13-key minimum — each entry types exactly like the tag's own attributes.
declare const li: PropTypes["li"];
export const liIsNative: Marko.Input<"li"> = li;
declare const anchorProps: PropTypes["a"];
export const anchorIsNative: Marko.Input<"a"> = anchorProps;

// style accepts hyphenated properties and custom properties.
export const styleShape: PropTypes["style"] = {
  "background-color": "red",
  "--reference-width": "10px",
};
// @ts-expect-error camelCase keys are not part of the normalized style shape
export const styleRejectsCamel: PropTypes["style"] = { backgroundColor: "red" };

// --- <zag-machine> return type -------------------------------------------------

// Marko wraps a tag's `<return>` in `{ value }`; the tag variable a consumer
// binds (`<zag-machine/service .../>`) is that `value`.
type ServiceVar = Marko.Return<typeof Service>["value"];

// The tag variable is a FUNCTION returning a MarkoService — never the service
// itself, and never a handle object.
declare const svcGetter: ServiceVar;
export const serviceIsGetter: () => MarkoService<MachineSchema> = svcGetter;
export const callingGetterYieldsService: MarkoService<MachineSchema> = svcGetter();

// `rev` is gone from the public surface — the getter exposes no properties.
// @ts-expect-error rev is not part of the 2.0 contract
export const noRev = svcGetter.rev;

// ...and neither are the old ServiceHandle's fields.
// @ts-expect-error `service` was a ServiceHandle field; handles no longer exist
export const noHandleService = svcGetter.service;
// @ts-expect-error `machine` was a ServiceHandle field; handles no longer exist
export const noHandleMachine = svcGetter.machine;

// --- <zag> return type -----------------------------------------------------

// <zag> returns the API getter, with the api type inferred from the module's
// own `connect` — no type argument written at the call site.
//
// Marko compiles a generic tag to a Template whose type parameter is carried
// on its render signature, not on the class, so `Marko.Return<typeof Zag>`
// cannot be instantiated with a module directly. Applying the tag's own
// generic to the input interface is the equivalent that does resolve.
type ZagApiGetter<M extends ZagModule> = Marko.Return<
  Marko.Template<ZagInput<M>, () => ZagApi<M>>
>;

declare const apiGetter: ZagApiGetter<typeof checkbox>;
export const apiIsGetter: () => ReturnType<typeof checkbox.connect> = apiGetter;

// Calling it yields the module's real api: the checkbox api's own members
// resolve, which only holds if inference reached through `mod.connect`.
export const apiChecked: boolean = apiGetter().checked;
export const apiRootProps: PropTypes["label"] = apiGetter().getRootProps();

// @ts-expect-error the checkbox api has no `getPatternProps` (that is qr-code's)
export const noForeignPart = apiGetter().getPatternProps();

// --- there is no ZagProps alias, and why ------------------------------------

// `ZagSchema<M>` recovers a module's schema through `Machine<infer T>`, but
// the schema types its own members loosely: indexing it yields `any`. These
// pins document that, so nobody reintroduces a `ZagProps<M>` alias believing
// it constrains anything. (An earlier revision shipped one aliased to the
// whole schema; `props?:` typed nothing and no assertion caught it.)
type IsAny<T> = 0 extends 1 & T ? "any" : "notany";

declare const schemaProps: IsAny<ZagSchema<typeof checkbox>["props"]>;
export const schemaPropsIsAny: "any" = schemaProps;

// A module's OWN exported Props is a real type — this is the precision path,
// via MachineInput on a component's Input, and it is what the docs point at.
declare const realProps: IsAny<checkbox.Props>;
export const moduleOwnPropsIsReal: "notany" = realProps;

// The whole schema still parameterises the service, which is all the tag
// needs it for.
declare const svcOverSchema: MarkoService<ZagSchema<typeof checkbox>>;
export const serviceTakesSchema: MarkoService<any> = svcOverSchema;

// --- old tag names do not resolve ------------------------------------------

// The pre-2.0-rc.2 names are gone; importing them must fail.
// @ts-expect-error <service> was renamed to <zag-machine>
export type OldService = typeof import("../src/tags/service.marko");
// @ts-expect-error <machine-props> was absorbed into <zag> / <zag-machine>
export type OldMachineProps = typeof import("../src/tags/machine-props.marko");
// @ts-expect-error <store> was renamed to <zag-store>
export type OldStore = typeof import("../src/tags/store.marko");
// @ts-expect-error <portal> was renamed to <zag-portal>
export type OldPortal = typeof import("../src/tags/portal.marko");
