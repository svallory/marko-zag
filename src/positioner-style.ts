/**
 * Static style for floating-ui positioner elements.
 *
 * Zag's placement effect (getPlacement/@zag-js/popper) writes `--x`, `--y`,
 * `--z-index`, `--reference-width` as inline CSS custom properties on the
 * positioner element. Marko re-applies reactive style attributes on every
 * recompute, which would wipe those vars — so components must apply this
 * object through a STATIC `style=` attribute (module-scope constant after the
 * positioner spread): Marko writes it once and never touches style again,
 * letting Zag's imperative var writes survive.
 *
 * Until placement is computed, `--y` defaults to -100vh (off-screen), same
 * trick Zag's own base styles use.
 *
 * @example
 * ```marko
 * import { positionerStyle } from "marko-zag";
 * <div ...api().getPositionerProps() style=positionerStyle>
 *   <div ...api().getContentProps()>...</div>
 * </div>
 * ```
 *
 * @remarks
 * The spread must come FIRST and the static `style=` attribute LAST, so the
 * static attribute wins over the (reactive) style in the positioner props —
 * that ordering is what keeps Marko from rewriting the style on every
 * recompute.
 */
export const positionerStyle = {
  position: "absolute",
  isolation: "isolate",
  width: "var(--reference-width, auto)",
  "min-width": "max-content",
  top: "0px",
  left: "0px",
  transform: "translate3d(var(--x, 0px), var(--y, -100vh), 0)",
  "z-index": "var(--z-index, 50)",
} as const;
