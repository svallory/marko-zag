/**
 * Compile-time regression assertions, checked by `bun run check` (this file
 * is listed in tsconfig include). No runtime — never imported.
 *
 * Guards the PropTypes contract: the generic `element` fallback must be
 * spreadable onto ANY native tag (its type parameter is contravariant-only),
 * while the specifically-typed keys stay strict.
 *
 * Also pins the <service> tag's return type: it returns a service GETTER, not
 * a service object or a handle. That distinction is the whole 2.0 contract —
 * a getter is the only serializable stand-in for a service, and its identity
 * is what makes downstream <const>s recompute.
 */
import type { MachineSchema } from "@zag-js/core";
import type { MarkoService } from "../src/machine.ts";
import type { PropTypes } from "../src/prop-types.ts";
import type Service from "../src/tags/service.marko";

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

// --- <service> return type -------------------------------------------------

// Marko wraps a tag's `<return>` in `{ value }`; the tag variable a consumer
// binds (`<service/service .../>`) is that `value`.
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
