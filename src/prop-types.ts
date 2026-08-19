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
 * @remarks
 * The key set (`button`, `label`, …, `element`, `style`) is fixed by
 * `@zag-js/types`' `PropTypes` contract — every adapter supplies the same
 * thirteen entries. `element` is the generic fallback used by most prop
 * getters; `style` is the shape of a normalized style value (camelCase
 * already hyphenated by the normalizer, `--custom-props` preserved).
 */
export interface PropTypes {
  button: Marko.Input<"button">;
  label: Marko.Input<"label">;
  input: Marko.Input<"input">;
  textarea: Marko.Input<"textarea">;
  img: Marko.Input<"img">;
  output: Marko.Input<"output">;
  select: Marko.Input<"select">;
  svg: Marko.Input<"svg">;
  path: Marko.Input<"path">;
  rect: Marko.Input<"rect">;
  circle: Marko.Input<"circle">;
  /**
   * Generic element props — the fallback shape for most prop getters.
   *
   * Typed as the attribute surface every HTML element shares
   * (`HTMLAttributes<Element>`), NOT a specific tag's input: the element
   * type parameter only appears contravariantly (event-handler `target`
   * params), so this shape is assignable to `<span>`, `<ul>`, `<a>`, … —
   * a `Marko.Input<"div">` here would make every generic getter spreadable
   * onto divs only.
   */
  element: Marko.HTMLAttributes<Element>;
  /** Normalized style object: hyphenated keys, `--custom-props` untouched. */
  style: Record<string, string | number>;
}
