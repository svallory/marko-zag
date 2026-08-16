---
title: "createService"
description: "Creates a Zag v1 machine service for Marko 6."
---

# `createService`

```ts
function createService(
  machine: any,
  userProps: () => Record<string, any>,
  notify: () => void,
): MarkoService;
```

Creates a Zag v1 machine service for Marko 6 — the Marko analog of
`useMachine` in Zag's official adapters. Ported from `@zag-js/solid@1.43.0`
with Solid's reactive primitives replaced by plain values plus a `notify`
callback.

The [`<service>`](/api/tags/#service) tag wraps this function; call it
directly only for custom integrations (e.g. spawned child services).

## Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `machine` | `any` | The Zag machine definition (e.g. `switchMachine.machine`). |
| `userProps` | `() => Record<string, any>` | Closure returning the machine's props. Read lazily and memoized; call [`propsChanged()`](/api/marko-service/) after reactive props change to invalidate the cache. |
| `notify` | `() => void` | Called (batched on a microtask) after every machine update; the host uses it to schedule a re-render — typically by bumping a `<let/rev>` signal. |

## Returns

A [`MarkoService`](/api/marko-service/). Call `start()` in
`<lifecycle onMount>` and `stop()` in `onDestroy`.

## Example

```marko
<let/rev=0/>
<let/svc=null/>
<lifecycle
  onMount() {
    svc = createService(switchMachine.machine, () => ({ id }), () => { rev += 1 });
    svc.start();
  }
  onDestroy() { svc?.stop(); }
/>
```

## Remarks

- **Client-only creation.** A `MarkoService` is not serializable and must
  never live in reactive state on the server; create it in `onMount` and
  keep `null` in the `<let>` (the `null` serializes). Use
  [`ssrService`](/api/ssr-service/) for the server-render read.
- **Props memoization.** Machines call `prop()` dozens of times per
  `connect()`; the resolved props (and scope) are cached and invalidated on
  `propsChanged()` and on each update flush.
- **Effect timing.** State-entry effects are deferred by two animation
  frames so that DOM created by the triggering render exists before effects
  (like floating-ui's placement) resolve elements. See
  [SSR & Hydration](/guides/ssr-and-hydration/#effect-timing).
