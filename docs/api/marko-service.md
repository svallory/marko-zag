---
title: "MarkoService"
description: "The service interface consumed by every machine module's connect()."
---

# `MarkoService`

```ts
interface MarkoService {
  state: Dict;
  send: (event: Dict) => void;
  context: Dict;
  prop: (key: string) => any;
  scope: Dict;
  refs: Dict;
  computed: (key: string) => any;
  event: Dict;
  getStatus: () => string;
  start: () => void;
  stop: () => void;
  propsChanged: () => void;
}
```

A running (or, for SSR, never-started) Zag machine service — the object
every `machineModule.connect(service, normalizeProps)` call consumes.
Structurally identical to the service Zag's own framework adapters produce,
plus three Marko-lifecycle methods.

## Zag protocol members

| Member | Description |
| --- | --- |
| `state` | Current state accessor with `matches(...values)` / `hasTag(tag)` helpers. |
| `send(event)` | Sends an event to the machine. Processed on a microtask; a no-op unless the machine is started. |
| `context` | Bindable context accessor: `get` / `set` / `initial` / `hash` by key. |
| `prop(key)` | Reads a resolved machine prop (user props merged over machine defaults). |
| `scope` | Zag scope (`id`, `ids`, `getRootNode`) used for DOM queries. |
| `refs` | Mutable non-reactive refs store: `get(key)` / `set(key, value)`. |
| `computed(key)` | Evaluates a machine `computed` value. |
| `event` | Current event, with `current()` / `previous()` accessors. |
| `getStatus()` | `"Not Started"` \| `"Started"` \| `"Stopped"`. |

## Marko lifecycle members

| Member | Description |
| --- | --- |
| `start()` | **Client-only.** Marks the machine started and runs entry actions/effects. Call from `<lifecycle onMount>`. Also schedules one recompute so the handler-less SSR attributes are replaced with handler-bearing ones. |
| `stop()` | Stops the machine, running exit actions and effect cleanups. Call from `<lifecycle onDestroy>`. |
| `propsChanged()` | Host notification that reactive props changed (controlled usage): invalidates the props cache, syncs bindable `prev` trackers, re-runs `machine.watch` tracks, and notifies the renderer. |

## Remarks

A `MarkoService` instance is **not serializable** and must never cross the
server/client boundary:

- **Server** — keep it out of reactive state; build a throwaway via
  [`ssrService`](/api/ssr-service/) inside the render expression.
- **Client** — store the real instance in a `<let/svc=null>` (the `null`
  serializes; the instance is created fresh in `onMount`).

The [`<service>`](/api/tags/#service) tag implements this contract for you.
