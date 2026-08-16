---
title: "ssrService"
description: "Server-render helper: a never-started service for computing initial attributes."
---

# `ssrService`

```ts
function ssrService(
  machine: any,
  userProps: () => Record<string, any>,
): MarkoService;
```

Builds a **never-started** [`MarkoService`](/api/marko-service/) purely for
computing a machine's initial DOM attributes during server rendering.

Zag's `connect()` is a pure read over a service, so connecting a
never-started service yields correct initial attributes — `role`, `aria-*`,
`data-state`, `id`s — without touching the DOM. No entry actions or effects
ever run, so nothing needs cleanup: the instance is created inline in the
render expression and garbage-collected.

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `machine` | `any` | The Zag machine definition. |
| `userProps` | `() => Record<string, any>` | Closure returning the machine's props (must include `id`). |

## Returns

A never-started `MarkoService`, safe to pass to a machine module's
`connect()` during SSR.

## Example

This is exactly what the [`<connect>`](/api/tags/#connect) tag does
internally:

```ts
input.value(
  handle.service ?? ssrService(handle.machine(), handle.props),
  normalizeProps,
)
```

## Remarks

Marko serializes reactive state at the SSR boundary and never re-runs
render on resume — so this service must **not** be stored in reactive
state. Use it inline; the client builds its own real service via
[`createService`](/api/create-service/) on mount. See
[SSR & Hydration](/guides/ssr-and-hydration/).
