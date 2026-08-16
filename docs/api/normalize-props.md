---
title: "normalizeProps"
description: "Maps Zag's React-style prop objects onto Marko DOM attributes."
---

# `normalizeProps`

```ts
const normalizeProps: PropNormalizer; // from @zag-js/types createNormalizer
```

Zag's machines emit React-flavored prop objects; `normalizeProps` maps them
onto Marko DOM attributes. Pass it as the second argument of a machine
module's `connect()` — or use the [`<connect>`](/api/tags/#connect) tag,
which passes it for you.

## What it translates

| Zag emits | Marko gets | Why |
| --- | --- | --- |
| `className` | `class` | Marko uses the HTML attribute name. |
| `htmlFor` | `for` | Same. |
| `onChange` | `onInput` | Marko/DOM input semantics. |
| `onDoubleClick` | `onDblClick` | Marko lowercases the event name. |
| `tabIndex` | `tabindex` | **Load-bearing focus fix** — see below. |
| `defaultValue` / `defaultChecked` | `value` / `checked` | Initial-value path for native inputs. |
| style objects | hyphenated keys | Marko writes style keys verbatim; camelCase must become `kebab-case`. |
| boolean `aria-*` | `"true"` / `"false"` strings | Marko's boolean-attribute rendering would emit an empty attribute — wrong for ARIA's tri-state. |

## Behavior details

- **`event.currentTarget` shadowing.** Marko's delegated events leave
  `currentTarget` pointing at the delegation root. Every handler is wrapped
  to shadow `currentTarget` with the element Marko passes as the handler's
  second argument, because Zag machine logic relies on it.
- **SSR handler stripping.** On the server, function props are dropped:
  functions from `@zag-js/*` modules are not Marko-serializable, and server
  HTML doesn't need them. They reappear on the first client recompute,
  which `service.start()` schedules.

## The `tabIndex` fix

Marko treats attribute keys verbatim, so camelCase `tabIndex` is a
*different* attribute from the `tabindex` already on the element: each
update removes the old attribute and adds the new one. Removing `tabindex`
from the focused element **blurs it in Chromium**, which made every
roving-focus widget go keyboard-dead after one keypress (a slider lost
focus to `<body>` after a single arrow press). Mapping to the canonical
lowercase name keeps it a single in-place attribute write.

## Example

```marko
<connect/api=(service, normalizeProps) =>
  switchMachine.connect(service, normalizeProps)
  service=switchService
/>
<label ...api().getRootProps()>
```

Or, in a custom integration:

```ts
import { normalizeProps, ssrService } from "marko-zag";
const api = switchMachine.connect(svc ?? ssrService(machine, props), normalizeProps);
```
