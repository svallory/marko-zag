---
title: "Tags"
description: "The four Marko tags: machine-props, service, connect, portal."
---

# Tags

marko-zag ships four tags, auto-discovered from the package's `marko.json`
taglib — no imports needed in `.marko` files. They compose in a fixed order;
see [The Three-Tag Pattern](/guides/three-tag-pattern/) for the full worked
example.

## `<machine-props>`

Builds the machine-props closure for `<service>` from a component's input:
picks the machine-owned props by name, injects a stable generated `id`
(overridable via `input.id`), and merges every other attribute written on
the tag — callback adaptations and inline overrides alike.

```marko
<machine-props/machineProps from=input pick=switchMachine.props
  onCheckedChange(details) {
    input.checkedChange?.(details.checked);
  }/>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| `from` | `Record<string, any>` | The component's full input object. |
| `pick` | `readonly string[]` | Machine prop names — the machine module's exported `props` array (e.g. `switchMachine.props`). |
| *anything else* | `any` | Callback adaptations and machine-prop overrides, merged last. |

### Returns

A closure `() => ({ id, ...picked, ...overrides })`.

> **Why a name array, not a splitter function?** `pick=` takes plain strings
> because they serialize. Passing a split *function* would hit Marko's
> tag-input serialization wall. The callback adaptation stays in your
> component file on purpose — it is the component's public contract.

## `<service>`

Creates and owns a running Zag service — the Marko analog of
`useMachine(machine, props)`.

```marko
<service/service machine=() => switchMachine.machine props=machineProps/>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| `machine` | `() => any` | Machine getter — **always a closure written in your template** (`() => switchMachine.machine`), never the raw machine (unserializable). |
| `props` | `() => Record<string, any>` | The closure from `<machine-props>`. Optional. |

### Returns

A serializable `ServiceHandle`:

| Field | Type | Description |
| --- | --- | --- |
| `service` | `MarkoService \| null` | Running service on the client; `null` during SSR. |
| `machine` | `() => any` | Forwarded getter, for `<connect>`'s SSR fallback. |
| `props` | `() => Record<string, any>` | Forwarded props closure. |
| `rev` | `number` | Update counter — fresh handle identity per machine update. |

The tag tracks every reactive read inside your props closure: controlled
props re-notify the machine with no hand-typed dependency list.

## `<connect>`

Derives the connected API from a `<service>` handle — the Marko analog of
`connect(service, normalizeProps)`. Returns the API as a **getter** you call
at use sites.

```marko
<connect/api=(service, normalizeProps) =>
  switchMachine.connect(service, normalizeProps)
  service=switchService
/>
<label ...api().getRootProps()>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| *(value shorthand)* | `(service, normalizeProps) => Api` | The connect closure — written in your template (raw `switchMachine.connect` as input is unserializable). |
| `service` | `ServiceHandle` | Handle returned by `<service>`. |

During SSR the handle carries no running service, so a throwaway
never-started one is built from the handle's `machine`/`props`; Zag's
`connect()` is a pure read, so this renders correct initial attributes.
Several `<connect>`s may share one `<service>`.

## `<portal>`

SSR-safe portal: renders content inline on the server (inside a
`display: contents` host), then reparents the host to the target on mount.
Marko tracks nodes by reference, so moved nodes keep working.

```marko
<portal>
  <if=api().open>
    <div ...api().getBackdropProps()/>
    ...
  </if>
</portal>
```

### Input

| Attribute | Type | Description |
| --- | --- | --- |
| `to` | `string` | CSS selector for the portal target. Defaults to `document.body`. |
| `disabled` | `boolean` | Disable reparenting (render in place). |
| `content` | `Marko.Body` | The portalled content (body content works too). |

On destroy the tag removes the host manually — required, not defensive:
Marko's own removal walks the *original* parent chain, which no longer
contains the reparented host.
