---
title: "The Three-Tag Pattern"
description: "How machine-props, service, and connect wire a Zag machine into a Marko component."
---

# The Three-Tag Pattern

Every Zag integration in marko-zag follows the same three steps, one tag
each. It is the Marko analog of Zag's two-step `useMachine` + `connect`
idiom, with one extra tag that solves a Marko-specific problem (input
serialization — see below).

1. **`<machine-props>`** — picks the machine-owned props out of your
   component's input and returns a props *closure*.
2. **`<service>`** — owns the machine lifecycle: creates and starts the real
   service on the client, provides the SSR fallback recipe on the server.
3. **`<connect>`** — derives the connected API (the object full of
   `get*Props()` functions) and keeps it fresh across machine updates.

Overlay components add a fourth tag, **`<portal>`**, to render content at
`document.body`.

## Worked example: a dialog

A complete, production-shaped dialog component wrapping
[`@zag-js/dialog`](https://zagjs.com/components/react/dialog) (styling
trimmed for clarity — this is the exact wiring used by
[marko-ui](https://github.com/svallory/marko-ui)'s dialog):

```marko
/* dialog.marko */
import * as dialogMachine from "@zag-js/dialog";
import type { MachineInput } from "marko-zag";

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

// 3. Connect. The value shorthand holds the connect closure (again written
//    in the template, for the same serialization reason). `api` is a getter
//    you CALL at use sites: `api().getTriggerProps()`.
<connect/api=(service, normalizeProps) =>
  dialogMachine.connect(service, normalizeProps)
  service=service
/>

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

The Marko analog of `useMachine(machine, props)`. It returns a serializable
**handle** `{ service, machine, props, rev }`:

- `service` is the running machine on the client, and `null` during SSR —
  the client builds its own instance in `onMount` and starts it.
- `rev` is a counter bumped on every machine update, giving the handle fresh
  identity so everything derived from it recomputes.
- `machine` and `props` are forwarded so `<connect>` can build the SSR
  fallback.

It also watches your props closure: any reactive value read inside
`machineProps()` (a controlled `open=`, a changing `disabled=`) re-notifies
the machine automatically — no hand-typed dependency lists.

### `<connect>` — the API deriver

The Marko analog of `connect(service, normalizeProps)`. It returns the API
as a **getter** — you write `api().getTriggerProps()`, not
`api.getTriggerProps()` — so every read observes the latest machine state.
During SSR the handle carries no running service, so `<connect>` builds a
throwaway never-started one from the handle's `machine`/`props`; Zag's
`connect()` is a pure read, so this renders correct initial attributes with
zero DOM access.

Several `<connect>`s may share one `<service>` (e.g. connecting the same
machine's API in a parent and a repeated child).

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
