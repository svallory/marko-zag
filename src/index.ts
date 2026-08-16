/**
 * marko-zag — Zag.js v1 bindings for Marko 6.
 *
 * An SSR-safe adapter that runs Zag's framework-agnostic state machines
 * inside Marko 6 components. The TypeScript surface (this module) provides
 * the machine runtime ({@link createService}, {@link ssrService}), the
 * Marko-flavored {@link normalizeProps}, the floating-ui
 * {@link positionerStyle} constant, and the {@link MachineInput} helper type.
 *
 * The Marko surface — the `<machine-props>`, `<service>`, `<connect>`, and
 * `<portal>` tags — is auto-discovered through this package's `marko.json`
 * taglib; no import is needed inside `.marko` files.
 *
 * @packageDocumentation
 */
export { createService, ssrService, type MarkoService } from "./machine.ts";
export { normalizeProps } from "./normalize-props.ts";
export { positionerStyle } from "./positioner-style.ts";
export type { MachineInput } from "./machine-input.ts";
