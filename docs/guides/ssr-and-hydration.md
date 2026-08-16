---
title: "SSR & Hydration"
description: "How marko-zag renders correct machine attributes on the server and hands off to the client."
---

# SSR & Hydration

marko-zag is SSR-safe **by construction**, not by opt-in. Understanding the
model helps when you build custom integrations or debug hydration.

## The constraint

Marko's resume model serializes reactive state on the server and **never
re-runs render on resume** — the client picks up exactly where the server
left off. Two consequences:

1. Anything stored in reactive state (`<let>`) must be serializable. A
   running machine service — an object graph full of functions from
   `@zag-js/*` modules — is not. Storing one in a `<let>` throws
   `Unable to serialize "input"` (or silently breaks resume).
2. There is no "second render on the client" to patch things up. The
   server-rendered attributes must already be correct.

## The solution: two services, one recipe

### Server: `ssrService` — a throwaway, never-started machine

Zag's `connect()` is a *pure read* over a service. A machine that was never
started has its correct initial state, so connecting it yields the correct
initial DOM attributes — `role`, `aria-*`, `data-state`, `id`s — without
touching the DOM and without running any effects. `ssrService(machine,
props)` builds exactly that, inline in the render expression, and it is
simply garbage-collected after render. It never crosses the boundary.

### Client: `createService` — the real machine, born in `onMount`

The `<service>` tag stores the real service in a `<let/service=null>`. The
`null` is what serializes; on mount the client constructs its own instance
with `createService(...)` and calls `service.start()`, which runs entry
actions/effects and schedules one recompute.

```marko
// inside <service> (simplified)
<let/rev=0/>
<let/service=null/>
<lifecycle
  onMount() {
    service = createService(input.machine(), props, () => { rev += 1 });
    service.start();
  }
  onDestroy() { service?.stop(); }
/>
<return={ service, machine: input.machine, props, rev }/>
```

`<connect>` then uses whichever is available:

```ts
input.value(
  handle.service ?? ssrService(handle.machine(), handle.props),
  normalizeProps,
)
```

## The serialization boundary, itemized

| Value | Serializable? | How it crosses |
| --- | --- | --- |
| `<service>`'s handle | yes | `service` is `null` on the server; `machine`/`props` are closures created in the template (Marko serializes those by re-linking them on resume); `rev` is a number |
| The machine definition | no | never crosses — both sides import it from `@zag-js/*` and access it through the `machine=() => ...` getter |
| Event handlers in connect output | no | stripped on the server by `normalizeProps` (server HTML doesn't need them); reappear on the first client recompute, which `service.start()` schedules |
| Machine getters/APIs | no | reconnected client-side — `connect()` re-derives the API from the client's own service |

## Why `machine=` and the connect closure live in your template

`<service machine=() => dialogMachine.machine .../>` looks like ceremony —
why not `machine=dialogMachine.machine`? Because tag input is serialized for
resume, and the raw machine (an object with functions from npm code) is
unserializable. A closure **written in the template of the consuming
component** is different: Marko can re-establish it on resume because it
knows which module and scope it came from. The same reasoning applies to
`<connect>`'s value shorthand.

## Effect timing

`service.start()` (and every state transition) runs machine effects deferred
by **two animation frames**. Marko batches renders, so DOM created by a
state change — an opened popover's positioner, say — does not exist yet when
the machine's entry effects fire. Zag effects that resolve elements once
(floating-ui's `getPlacement`) would fail permanently. Two rAFs guarantee
the notify → render pass has committed first.
