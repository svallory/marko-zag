import { mergeProps as coreMergeProps } from "@zag-js/core";

/**
 * Marko-flavored `mergeProps` — composes user-supplied attributes with Zag
 * prop-getter output instead of overwriting.
 *
 * Wraps `@zag-js/core`'s `mergeProps` (which chains `on*` handlers, joins
 * `class`/`className`, deep-merges `style` values, and unions
 * `data-ownedby`) and then re-normalizes the merged `style` to the shape
 * Marko expects: an object with hyphenated keys (`--custom-props` left
 * untouched). Core may return camelCase keys (from user input) or a CSS
 * string (when a string style was merged); both are converted.
 *
 * @param args - Prop objects, least-specific first. Later objects win for
 * plain attributes; special keys (`on*`, `class`, `style`) are composed.
 * @returns A single prop object safe to spread onto a native tag.
 *
 * @example
 * ```marko
 * import { mergeProps } from "marko-zag";
 * <button ...mergeProps(api().getTriggerProps(), {
 *   class: "btn",
 *   onClick() { console.log("also runs, after Zag's handler") },
 * })>
 * ```
 *
 * @remarks
 * Handler composition order follows Zag's convention: for a key present in
 * both objects, the later object's handler runs first, then the earlier
 * one's — matching every official adapter. Without `mergeProps`, a spread
 * followed by a literal attribute would *replace* Zag's handler and silently
 * break the machine.
 */
export function mergeProps<T extends Record<string, any>>(...args: T[]): T {
  const merged = coreMergeProps(...args) as Record<string, any>;
  const style = merged.style;
  if (typeof style === "string") {
    merged.style = hyphenateKeys(parseStyleString(style));
  } else if (style && typeof style === "object") {
    merged.style = hyphenateKeys(style);
  }
  return merged as T;
}

const uppercasePattern = /[A-Z]/g;

/** Hyphenates camelCase style keys; `--custom-props` pass through verbatim. */
function hyphenateKeys(style: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const key in style) {
    const value = style[key];
    if (typeof value !== "string" && typeof value !== "number") continue;
    const name = key.startsWith("--")
      ? key
      : key.replace(uppercasePattern, (m) => "-" + m.toLowerCase());
    out[name] = value;
  }
  return out;
}

const CSS_DECL = /((?:--)?[\w-]+)\s*:\s*([^;]+)/g;

/** Parses a `prop: value; prop: value` CSS string into an object. */
function parseStyleString(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = CSS_DECL.exec(style))) {
    const [, name, value] = match;
    if (name && value) out[name] = value.trim();
  }
  return out;
}
