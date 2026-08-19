/**
 * Marko-flavored {@link https://zagjs.com Zag} `PropTypes` — the per-element
 * shapes that {@link normalizeProps} produces.
 *
 * Zag machines call `normalizeProps.button(...)`, `normalizeProps.input(...)`
 * etc. and type each prop getter's return value with the matching entry of
 * this map. Binding the entries to Marko's own native-tag input types means
 * `api().getTriggerProps()` is typed exactly like attributes hand-written on
 * a `<button>` — spreading it onto the wrong element (or alongside a
 * conflicting attribute) is a compile error in `.marko` templates checked by
 * `@marko/type-check`.
 *
 * Mirrors the official adapters, which all pass their framework's full
 * intrinsic-elements map (`JSX.IntrinsicElements & { element, style }` in
 * React/Solid, `Vue.NativeElements`, `SvelteHTMLElements`, …): Zag's
 * 13-key `PropTypes` from `@zag-js/types` is only the *minimum contract*,
 * so this maps every tag in `Marko.NativeTags` and then overrides the two
 * special entries:
 *
 * - `element` — the generic fallback most prop getters use. Typed as the
 *   attribute surface every HTML element shares (`HTMLAttributes<Element>`),
 *   NOT a specific tag's input: the element type parameter only appears
 *   contravariantly (event-handler `target` params), so this shape is
 *   assignable to `<span>`, `<ul>`, `<a>`, … — a `Marko.Input<"div">` here
 *   would make every generic getter spreadable onto divs only.
 * - `style` — the shape of a normalized style value: hyphenated CSS
 *   property names (Marko writes style-object keys verbatim) plus
 *   `--custom-props`, which the normalizer passes through untouched.
 */
export type PropTypes = {
  [K in keyof Marko.NativeTags]: Marko.Input<K>;
} & {
  element: Marko.HTMLAttributes<Element>;
  style: Marko.CSS.Properties & { [custom: `--${string}`]: string | number };
};
