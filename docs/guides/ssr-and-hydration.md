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

The `<service>` tag stores the real service in a `<let/instance=null>`. The
`null` is what serializes; on mount the client constructs its own instance
with `createService(...)` and calls `start()`, which runs entry
actions/effects and schedules one recompute.

What the tag *returns* is a **getter** that picks whichever service is
available at call time:

```marko
// inside <service> (simplified)
<let/rev=0/>
<let/instance=null/>
<lifecycle
  onMount() {
    instance = createService(input.machine(), props, () => { rev += 1 });
    instance.start();
  }
  onDestroy() { instance?.stop(); }
/>
<const/service=(void rev, props(), () => instance ?? ssrService(input.machine(), props))/>
<return=service/>
```

So a consumer writes one line and never mentions the boundary:

```marko
<const/api=() => dialogMachine.connect(service(), normalizeProps)/>
```

Returning a getter rather than the service object is what keeps this safe.
Returning the service itself does **not** throw on the server: Marko
serializes it with every function silently stripped, the page renders, and
the first client read dies with `TypeError: … is not a function`. See the
[gotchas page](/guides/gotchas/).

The two eager reads (`rev` and `props()`) are the getter's reactive
dependencies. Marko's `<const>` propagates only a value that is `!==` the
previous one, so each yields a *fresh closure* and every downstream `<const>`
recomputes — on machine transitions and on controlled-prop changes alike.

## The serialization boundary, itemized

| Value | Serializable? | How it crosses |
| --- | --- | --- |
| `<service>`'s getter | yes | it is a closure written in a template, which Marko registers and re-links on resume; the service instance itself is never referenced from the serialized value |
| The running service | no | never crosses — it lives in a `<let>` that holds `null` on the server, and is rebuilt client-side in `onMount` |
| The machine definition | no | never crosses — both sides import it from `@zag-js/*` and access it through the `machine=() => ...` getter |
| Event handlers in connect output | no | stripped on the server by `normalizeProps` (server HTML doesn't need them); reappear on the first client recompute, which `service.start()` schedules |
| Machine getters/APIs | no | reconnected client-side — `connect()` re-derives the API from the client's own service |

## Why `machine=` lives in your template

`<service machine=() => dialogMachine.machine .../>` looks like ceremony —
why not `machine=dialogMachine.machine`? Because tag input is serialized for
resume, and the raw machine (an object with functions from npm code) is
unserializable. A closure **written in the template of the consuming
component** is different: Marko can re-establish it on resume because it
knows which module and scope it came from. The same reasoning is why
`<service>` returns a getter instead of a service.

## Effect timing

`service.start()` (and every state transition) runs machine effects deferred
by **two animation frames**. Marko batches renders, so DOM created by a
state change — an opened popover's positioner, say — does not exist yet when
the machine's entry effects fire. Zag effects that resolve elements once
(floating-ui's `getPlacement`) would fail permanently. Two rAFs guarantee
the notify → render pass has committed first.
