---
title: "The Component Pattern"
description: "How machine-props and service wire a Zag machine into a Marko component."
---

# The Component Pattern

Every Zag integration in marko-zag follows the same three steps. Two are
tags; the third is a plain `<const>`.

1. **`<machine-props>`** — picks the machine-owned props out of your
   component's input and returns a props *closure*.
2. **`<service>`** — owns the machine lifecycle: creates and starts the real
   service on the client, and returns a service **getter** that yields a
   never-started throwaway on the server.
3. **`<const/api=...>`** — calls the machine's own `connect()`. No tag
   needed: `<const>` is Marko's re-running render code, which is exactly
   where Zag expects `connect` to be called.

Overlay components add one more tag, **`<portal>`**, to render content at
`document.body`.

The last two steps are the Marko analog of Zag's own two lines:

```ts
const service = useMachine(accordion.machine, { id: useId() })
const api = accordion.connect(service, normalizeProps)
```

```marko
<service/service machine=() => accordion.machine props=machineProps/>
<const/api=() => accordion.connect(service(), normalizeProps)/>
```

The two differences are irreducible Marko taxes: the `() =>` wrappers,
because tag input is serialized for resume, and calling `api()` at use
sites, because the value is a getter.

## Worked example: a dialog

A complete, production-shaped dialog component wrapping
[`@zag-js/dialog`](https://zagjs.com/components/react/dialog) (styling
trimmed for clarity — this is the exact wiring used by
[marko-ui](https://github.com/svallory/marko-ui)'s dialog):

```marko
/* dialog.marko */
import * as dialogMachine from "@zag-js/dialog";
import { normalizeProps, type MachineInput } from "marko-zag";

export type Input = MachineInput<"div", dialogMachine.Props> & {
  /** Marko-friendly sugar so callers can write `open:=state.showDialog` */
  openChange?: (open: boolean) => void;
  trigger?: Marko.Body<[Record<string, unknown>]>;
  title?: Marko.Body;
  content?: Marko.Body;
};

// 1. Pick the machine's props from this component's input.
//    `pick=dialogMachine.props` is the machine's exported prop-NAME array —
//    plain strings, so it serializes. Extra attributes written here are
//    merged in: callback adaptations, inline overrides, anything.
<machine-props/machineProps from=input pick=dialogMachine.props
  role="dialog"
  onOpenChange(details: dialogMachine.OpenChangeDetails) {
    input.onOpenChange?.(details);
    input.openChange?.(details.open);
  }/>

// 2. Run the machine. `machine=` MUST be a getter closure written here in
//    the template — a raw machine object as tag input would hit Marko's
//    serialization wall ("Unable to serialize input").
<service/service machine=() => dialogMachine.machine props=machineProps/>

// 3. Connect — a plain <const>, calling the machine's own connect(). `api`
//    is a getter you CALL at use sites: `api().getTriggerProps()`.
<const/api=() => dialogMachine.connect(service(), normalizeProps)/>

// Render: spread the prop getters onto native tags.
<if=input.trigger>
  <${input.trigger}(api().getTriggerProps())/>
</if>
<portal>
  <if=api().open>
    <div ...api().getBackdropProps()/>
    <div ...api().getPositionerProps()>
      <div ...api().getContentProps()>
        <if=input.title>
          <h2 ...api().getTitleProps()><${input.title}/></h2>
        </if>
        <${input.content}/>
        <button ...api().getCloseTriggerProps()>Close</button>
      </div>
    </div>
  </if>
</portal>

<return=api>
```

Using it:

```marko
<let/open=false/>
<dialog open:=open>
  <@trigger|triggerProps|><button ...triggerProps>Open dialog</button></@trigger>
  <@title>Are you sure?</@title>
  <@content>This action cannot be undone.</@content>
</dialog>
```

## Why each tag exists

### `<machine-props>` — the serialization-safe prop picker

Zag machines take a typed props object (`id`, `open`, `onOpenChange`, …).
Your Marko component's input contains those props *plus* your own additions
(`class`, body content, sugar callbacks). `<machine-props>`:

- picks the machine-owned keys by name using the machine module's exported
  `props` array (`dialogMachine.props`) — a **serializable** string array,
  where a splitter *function* would not survive Marko's input serialization;
- injects a stable generated `id` (Zag requires one; callers may override
  via `input.id`);
- merges every other attribute you write on the tag, which is where
  **chained callbacks** live: the `onOpenChange` above forwards to both the
  Zag-style `input.onOpenChange` and the Marko-bind-style
  `input.openChange`, so callers can use `open:=state.open` shorthand.

It returns a *closure* (`machineProps()`), not a plain object — that is what
lets `<service>` re-read it reactively when controlled props change.

### `<service>` — the machine lifecycle owner

The Marko analog of `useMachine(machine, props)`. It returns a service
**getter**: `service()` yields the running machine on the client after
mount, and a never-started throwaway on the server and before mount. Zag's
`connect()` is a pure read over the service, so connecting the throwaway
renders correct initial attributes with zero DOM access.

A getter rather than the service object is load-bearing, and not merely a
style choice. Returning the service itself does **not** throw on the server:
Marko serializes it with every function silently stripped, the page renders,
and the first client read dies with `TypeError: … is not a function`. A
closure written in a template is the only serializable stand-in for a
service, and calling it defers the real-vs-throwaway choice to call time.

The getter's **identity** is the change signal. Marko's `<const>` propagates
a new value only when it is `!==` the old one, so `<service>` returns a
*fresh closure* on every machine update and on every change to a value read
inside your props closure. That is what makes
`<const/api=() => m.connect(service(), normalizeProps)/>` recompute — both
when the machine transitions and when a controlled prop changes — with no
hand-written dependency list anywhere.

`<service>` also watches your props closure: any reactive value read inside
`machineProps()` (a controlled `open=`, a changing `disabled=`) re-notifies
the machine automatically.

Any number of `<const>`s may derive from one `<service>`, and the getter can
be threaded into child components as ordinary tag input when a child needs
the parent's machine.

### `<const/api=...>` — the API deriver

There is no tag here, and that is the point: Zag's `useMachine` never learns
about `connect`; the author calls `connect` in render code that re-runs.
Marko's re-running render code is `<const>`.

`api` is a **getter** — you write `api().getTriggerProps()`, not
`api.getTriggerProps()` — so every read observes the latest machine state.

### `<portal>` — SSR-safe overlay rendering

Renders its content inline on the server (inside a `display: contents`
host), then reparents the host to `document.body` (or a `to=` CSS selector
target) on mount. Marko tracks DOM nodes by reference, so the moved nodes
keep updating normally. Use it for dialog backdrops, toasts, menus —
anything that must escape ancestor `overflow`/`z-index` contexts.

## Floating elements

Machines positioned by floating-ui (popover, menu, tooltip, select) need one
extra ingredient: a **static** `style=positionerStyle` after the positioner
spread. See [positionerStyle](/api/positioner-style/) and the
[gotchas page](/guides/gotchas/) for why.
