---
title: "positionerStyle"
description: "Static style contract for floating-ui positioner elements."
---

# `positionerStyle`

```ts
const positionerStyle = {
  position: "absolute",
  isolation: "isolate",
  width: "var(--reference-width, auto)",
  "min-width": "max-content",
  top: "0px",
  left: "0px",
  transform: "translate3d(var(--x, 0px), var(--y, -100vh), 0)",
  "z-index": "var(--z-index, 50)",
} as const;
```

Static style for floating-ui positioner elements — required by every
machine that positions content with `@zag-js/popper` (popover, menu,
tooltip, select, combobox, hover-card…).

## Why it exists

Zag's placement effect writes `--x`, `--y`, `--z-index`,
`--reference-width` as inline CSS custom properties directly on the
positioner element. Marko re-applies **reactive** style attributes on every
recompute, which would wipe those vars. Applying this object through a
**static** `style=` attribute means Marko writes it once and never touches
style again — letting Zag's imperative var writes survive.

Until placement is computed, `--y` defaults to `-100vh` (off-screen), the
same trick Zag's own base styles use.

## Usage

```marko
import { positionerStyle } from "marko-zag";

<div ...api().getPositionerProps() style=positionerStyle>
  <div ...api().getContentProps()>...</div>
</div>
```

## Remarks

Attribute **order matters**: the positioner-props spread comes first and the
static `style=` last, so the static attribute wins over the (reactive) style
inside the positioner props. Put the constant at module scope or import it —
never build the object inline in a reactive expression, or it stops being
static.
