/**
 * Connects a Zag module against a running service, applying marko-zag's
 * prop normalizer by default.
 *
 * This is the plain-function half of what the `<zag>` tag does. Use it when a
 * component owns the service itself (via `<zag-machine>`) and still wants the
 * api:
 *
 * ```marko
 * <zag-machine/service=() => toast props=() => ({ ...input.options() })/>
 * <const/api=() => connect(toast, service())/>
 * ```
 *
 * Passing `normalizeProps` at every call site is the line this removes; the
 * normalizer is not optional in practice, and forgetting it produces subtly
 * broken attributes rather than a type error (React-dialect `tabIndex` and
 * `onFocus` survive as-is and silently misbehave). See
 * {@link normalizeProps} for what each rule is load-bearing for.
 *
 * @param mod - the Zag module namespace, e.g. `import * as toast from "@zag-js/toast"`
 * @param service - the running service, normally `service()` from `<zag-machine>`
 * @param normalize - optional replacement normalizer; wraps or substitutes
 * marko-zag's own
 * @returns the module's api object
 */
import type { NormalizeProps } from "@zag-js/types";
import { normalizeProps } from "./normalize-props.ts";
import type { PropTypes } from "./prop-types.ts";
import type { ZagModule, ZagApi } from "./zag-module.ts";

export function connect<M extends ZagModule>(
  mod: M,
  service: any,
  normalize?: NormalizeProps<PropTypes>,
): ZagApi<M> {
  return mod.connect(service, normalize ?? normalizeProps);
}
