/**
 * Compile-time regression assertions, checked by `bun run check` (this file
 * is listed in tsconfig include). No runtime — never imported.
 *
 * Guards the PropTypes contract: the generic `element` fallback must be
 * spreadable onto ANY native tag (its type parameter is contravariant-only),
 * while the specifically-typed keys stay strict.
 */
import type { PropTypes } from "../src/prop-types.ts";

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
