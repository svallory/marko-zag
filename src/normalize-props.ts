/**
 * normalizeProps for Marko 6 native tags.
 *
 * - `className`→`class`, `htmlFor`→`for`, `onChange`→`onInput`,
 *   `onDoubleClick`→`onDblClick` (Marko lowercases the event name),
 *   `onFocus`→`onFocusin`, `onBlur`→`onFocusout` (bubbling parity — see
 *   propMap comment).
 * - style objects: hyphenate camelCase keys (Marko writes keys verbatim).
 * - `event.currentTarget` is unavailable in Marko's delegated events; every
 *   handler is wrapped to shadow it with the element Marko passes as the
 *   handler's 2nd argument.
 * - SSR: handlers are stripped — functions from @zag-js modules are not
 *   Marko-serializable, and server HTML doesn't need them. They re-appear on
 *   the first client recompute (service.start() schedules it).
 * - boolean `aria-*` values are stringified ("true"/"false"); Marko's
 *   boolean-attribute rendering would emit an empty attribute instead.
 */
import { createNormalizer } from "@zag-js/types";
import { isFunction } from "@zag-js/utils";
import type { PropTypes } from "./prop-types.ts";

type Dict = Record<string, any>;

const propMap: Dict = {
  className: "class",
  htmlFor: "for",
  defaultValue: "value",
  defaultChecked: "checked",
  onChange: "onInput",
  onDoubleClick: "onDblClick",
  // Zag's onFocus/onBlur assume React's synthetic-focus semantics, where a
  // parent's handler fires when a descendant gains focus. Marko delegates
  // every event at the document but only walks ancestors when `ev.bubbles`,
  // and focus/blur don't bubble — a delegated onFocus would fire for the
  // exact target only, never the parent. focusin/focusout are the bubbling
  // twins, so this mapping restores the semantics machines were written for
  // (every non-React official adapter does the same).
  onFocus: "onFocusin",
  onBlur: "onFocusout",
  // Zag emits the React-style `tabIndex`. Marko writes attribute keys verbatim,
  // so the camelCase spelling is treated as a *different* attribute from the
  // `tabindex` already on the element: each update removes the old one and adds
  // the new. Removing `tabindex` from the focused element blurs it in Chromium
  // (setting it in place does not), which made every roving-focus widget go
  // keyboard-dead after one keypress — the slider lost focus to <body> after a
  // single arrow press. Mapping to the canonical lowercase name keeps it a
  // single in-place attribute write.
  tabIndex: "tabindex",
};

const uppercasePattern = /[A-Z]/g;
/** camelCase → kebab-case for style keys; `--custom-props` pass through. */
function hyphenate(name: string) {
  if (name.startsWith("--")) return name;
  return name.replace(uppercasePattern, (m) => "-" + m.toLowerCase());
}

/** Normalizes a React-style style object to Marko's hyphenated shape. */
function cssify(style: Dict) {
  const css: Dict = {};
  for (const property in style) {
    const value = style[property];
    if (typeof value !== "string" && typeof value !== "number") continue;
    css[hyphenate(property)] = value;
  }
  return css;
}

/**
 * Wraps a Zag handler so `event.currentTarget` resolves to the element Marko
 * passes as the handler's second argument (delegated events lack it).
 */
function wrapHandler(fn: (event: Event) => void) {
  return function (event: Event, el?: Element) {
    if (el) {
      Object.defineProperty(event, "currentTarget", {
        get: () => el,
        configurable: true,
      });
    }
    return fn(event);
  };
}

const isServer = typeof document === "undefined";

/**
 * Zag `normalizeProps` implementation for Marko 6 native tags — maps Zag's
 * React-flavored prop objects onto Marko DOM attributes. Pass it (or let the
 * `<connect>` tag pass it) as the second argument of a machine module's
 * `connect()`.
 *
 * What it translates:
 * - `className`→`class`, `htmlFor`→`for`, `onChange`→`onInput`,
 *   `onDoubleClick`→`onDblClick` (Marko lowercases the event name),
 *   `onFocus`→`onFocusin` / `onBlur`→`onFocusout` (focus/blur don't bubble,
 *   so Marko's document-level delegation would never notify a parent — the
 *   focusin/focusout twins restore the React-like semantics Zag machines
 *   assume), and crucially `tabIndex`→`tabindex` (see remarks).
 * - style objects: camelCase keys hyphenated (Marko writes keys verbatim).
 * - `event.currentTarget` is unavailable in Marko's delegated events; every
 *   handler is wrapped to shadow it with the element Marko passes as the
 *   handler's 2nd argument.
 * - SSR: handlers are stripped — functions from `@zag-js/*` modules are not
 *   Marko-serializable, and server HTML doesn't need them. They re-appear on
 *   the first client recompute (`service.start()` schedules it).
 * - boolean `aria-*` values are stringified (`"true"`/`"false"`); Marko's
 *   boolean-attribute rendering would emit an empty attribute instead.
 *
 * @example
 * ```marko
 * <connect/api=(svc, np) => switchMachine.connect(svc, np) service=switchService/>
 * <label ...api().getRootProps()>
 * ```
 *
 * @remarks
 * The `tabIndex`→`tabindex` mapping is load-bearing: Marko treats attribute
 * keys verbatim, so the camelCase spelling is a *different* attribute from
 * the `tabindex` already on the element — every update removes the old one
 * and adds the new. Removing `tabindex` from the focused element blurs it in
 * Chromium, which made every roving-focus widget go keyboard-dead after one
 * keypress. Mapping to the canonical lowercase name keeps it a single
 * in-place attribute write.
 */
export const normalizeProps = createNormalizer<PropTypes>((props: Dict) => {
  const normalized: Dict = {};
  for (const key in props) {
    const value = props[key];
    if (key === "readOnly" && value === false) continue;
    if (key === "children") continue;
    if (key === "style" && typeof value === "object" && value !== null) {
      normalized.style = cssify(value);
      continue;
    }
    const target = key in propMap ? propMap[key] : key;
    if (/^on[A-Z]/.test(target) && isFunction(value)) {
      if (!isServer) normalized[target] = wrapHandler(value);
      continue;
    }
    if (isServer && isFunction(value)) continue;
    if (typeof value === "boolean" && target.startsWith("aria-")) {
      normalized[target] = String(value);
      continue;
    }
    normalized[target] = value;
  }
  return normalized;
});
