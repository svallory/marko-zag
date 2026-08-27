/**
 * Machine-props building — the shared core of the `<zag>` and
 * `<zag-machine>` tags. Kept in TypeScript (rather than inlined in both
 * templates) so the rules are testable in isolation and stated once.
 */

/**
 * Matches Zag's `onXChange` callback convention, capturing `X`.
 *
 * Only this exact shape gets the two-way sugar below. Callbacks that merely
 * *end* in `Change` after another word (`onValueChangeEnd`) or that report
 * something other than a change (`onSelect`, `onComplete`) do not match and
 * pass through untouched.
 */
const CHANGE_CALLBACK = /^on([A-Z]\w*)Change$/;

/**
 * Adapts one machine callback to also fire a Marko two-way `xChange` handler.
 *
 * Zag reports changes as `onCheckedChange(details)`; Marko's `checked:=state`
 * bind shorthand compiles to a `checkedChange(value)` attribute. Wiring both
 * by hand in every component is the single most repeated line in adapter
 * code, so it is the default here.
 *
 * The wrapper is only installed when the details object actually carries the
 * key — `x in details`, evaluated per call. That guard is what keeps the rule
 * honest: `onTriggerValueChange` carries `details.value` (not
 * `details.triggerValue`), `onPositionChangeEnd` carries `position`, and
 * `onCollapse` is not a `Change` callback at all. None of those get sugar;
 * a component that wants it writes the override on the tag.
 *
 * @param name - the callback's prop name, e.g. `onCheckedChange`
 * @param from - the source object (normally the component's `input`)
 * @returns the adapted callback, or `undefined` when the name does not match
 */
export function adaptChangeCallback(
  name: string,
  from: Record<string, any>,
): ((details: any) => void) | undefined {
  const match = CHANGE_CALLBACK.exec(name);
  if (!match) return undefined;
  // `onCheckedChange` → key `checked`, sugar prop `checkedChange`.
  const key = match[1]!.charAt(0).toLowerCase() + match[1]!.slice(1);
  const sugarName = `${key}Change`;
  // Nothing to adapt unless the component supplies at least one half. Without
  // this, every machine callback would be installed as a live wrapper and the
  // machine would treat the prop as controlled.
  if (typeof from[name] !== "function" && typeof from[sugarName] !== "function") {
    return undefined;
  }
  return (details: any) => {
    from[name]?.(details);
    if (details && typeof details === "object" && key in details) {
      from[sugarName]?.(details[key]);
    }
  };
}

/**
 * Picks the machine-owned props out of `from`, injecting a generated id and
 * adapting `onXChange` callbacks, then layers the tag's own attributes over
 * the result.
 *
 * Overrides win: an attribute written on the tag replaces whatever `from`
 * supplied, which is how a component pins `role="dialog"` or substitutes its
 * own callback.
 *
 * @param from - the component's input object
 * @param names - the machine module's exported `props` array
 * @param overrides - the remaining attributes written on the tag
 * @param generatedId - fallback id, used when `from.id` is absent
 */
export function buildMachineProps(
  from: Record<string, any>,
  names: readonly string[],
  overrides: Record<string, any>,
  generatedId: string,
): Record<string, any> {
  const picked: Record<string, any> = {};
  for (const name of names) {
    // A callback prop is adapted whenever EITHER half is present: the
    // component may supply Zag's own `onCheckedChange`, Marko's
    // `checkedChange` bind sugar, or both. Keying the pick on `from[name]`
    // alone would silently drop the sugar-only case, which is the common one.
    const adapted = adaptChangeCallback(name, from);
    if (adapted) {
      picked[name] = adapted;
      continue;
    }
    const value = from[name];
    if (value !== undefined) picked[name] = value;
  }
  return { id: from.id ?? generatedId, ...picked, ...overrides };
}
