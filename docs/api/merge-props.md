---
title: "mergeProps"
description: "Composes user attributes with Zag prop-getter output instead of overwriting."
---

# `mergeProps`

```ts
function mergeProps<T extends Record<string, any>>(...args: T[]): T;
```

Composes several prop objects into one, the way every official Zag adapter
does: `on*` handlers are chained (both run), `class` values are joined,
`style` values are deep-merged, and plain attributes follow last-wins.
Without it, spreading a prop getter and then writing a literal `onClick`
would *replace* Zag's handler and silently break the machine.

```marko
import { mergeProps } from "marko-zag";

<button ...mergeProps(api().getTriggerProps(), {
  class: "btn",
  onClick() { console.log("runs first, then Zag's handler") },
})>
```

## Behavior

- **Handlers**: for a key present in both objects, the later object's
  handler runs first, then the earlier one's (Zag's convention). Marko's
  extra handler argument (the element) is forwarded to every handler.
- **`class`**: values joined with a space.
- **`style`**: objects are merged; a CSS *string* style is parsed and merged
  too. The result is always an object with hyphenated keys
  (`--custom-props` untouched) — the shape Marko expects.
- **Plain attributes**: the later object wins; `undefined` never clobbers an
  earlier value.

Wraps `@zag-js/core`'s `mergeProps` (which also unions `data-ownedby`) and
re-normalizes the merged style for Marko.
