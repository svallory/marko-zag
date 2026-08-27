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

`<zag-machine>` stores the real service in a `<let/instance=null>`. The
`null` is what serializes; on mount the client constructs its own instance
with `createService(...)` and calls `start()`, which runs entry
actions/effects and schedules one recompute.

What the tag *returns* is a **getter** that picks whichever service is
available at call time:

```marko
// inside <zag-machine> (simplified)
<const/mod=input.value/>
<let/rev=0/>
<let/instance=null/>
<lifecycle
  onMount() {
    instance = createService(mod().machine, machineProps, () => { rev += 1 });
    instance.start();
  }
  onDestroy() { instance?.stop(); }
/>
<const/service=(void rev, machineProps(), () =>
  instance ?? ssrService(mod().machine, machineProps)
)/>
<return=service/>
```

`<zag>` is that tag plus one more line, so it inherits the whole contract:

```marko
// inside <zag> (simplified)
<zag-machine/service ...input/>
<const/api=() => mod().connect(service(), input.normalize ?? normalizeProps)/>
<return=api/>
```

So a consumer writes one line and never mentions the boundary:

```marko
<zag/api=() => dialogMachine from=input/>
```

Returning a getter rather than the service object is what keeps this safe.
Returning the service itself does **not** throw on the server: Marko
serializes it with every function silently stripped, the page renders, and
the first client read dies with `TypeError: … is not a function`. See the
[gotchas page](/guides/gotchas/).

The two eager reads (`rev` and `machineProps()`) are the getter's reactive
dependencies. Marko's `<const>` propagates only a value that is `!==` the
previous one, so each yields a *fresh closure* and every downstream `<const>`
recomputes — on machine transitions and on controlled-prop changes alike.
The `api` getter inside `<zag>` depends only on the service getter's
identity, which is why it follows both.

## The serialization boundary, itemized

| Value | Serializable? | How it crosses |
| --- | --- | --- |
| `<zag>`'s api getter / `<zag-machine>`'s service getter | yes | a closure written directly as a `<const>` value, which Marko registers and re-links on resume; the service instance itself is never referenced from the serialized value |
| The running service | no | never crosses — it lives in a `<let>` that holds `null` on the server, and is rebuilt client-side in `onMount` |
| The machine module | no | never crosses — both sides import it from `@zag-js/*` and access it through the `() => mod` value getter |
| Collections, `DateValue`s, `Color`s | no | never cross — built inside the `props=` closure, which is written in your template |
| Event handlers in connect output | no | stripped on the server by `normalizeProps` (server HTML doesn't need them); reappear on the first client recompute, which `service.start()` schedules |
| Machine getters/APIs | no | reconnected client-side — `connect()` re-derives the api from the client's own service |

## Why the module getter lives in your template

`<zag/api=() => dialogMachine from=input/>` looks like ceremony — why not
`api=dialogMachine`? Because tag input is serialized for resume, and the raw
module (an object with functions from npm code) is unserializable. A closure
**written in the template of the consuming component** is different: Marko
can re-establish it on resume because it knows which module and scope it came
from. The same reasoning is why `<zag>` returns a getter instead of an api
object, why `<zag-store>`'s `subscribe`/`snapshot` are closures, and why
`props=` — not `from=` — is where values with methods are built.

## `<zag-store>` on the server

`<zag-store>` follows the same rule from the other direction: on the server
its getter returns `serverSnapshot()` (falling back to `snapshot()`), the
same contract as React's third `useSyncExternalStore` argument. It subscribes
on mount and unsubscribes on destroy, so nothing external is touched during
render.

## Effect timing

`service.start()` (and every state transition) runs machine effects deferred
by **two animation frames**. Marko batches renders, so DOM created by a
state change — an opened popover's positioner, say — does not exist yet when
the machine's entry effects fire. Zag effects that resolve elements once
(floating-ui's `getPlacement`) would fail permanently. Two rAFs guarantee
the notify → render pass has committed first.
