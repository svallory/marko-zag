---
title: "Introduction"
description: "Zag.js v1 bindings for Marko 6 — SSR-safe state machine adapter."
---

# marko-zag

**Zag.js v1 bindings for Marko 6** — an SSR-safe adapter that runs Zag's
framework-agnostic state machines inside Marko components.

[Zag.js](https://zagjs.com) ships accessible, headless UI logic (dialogs,
menus, sliders, comboboxes, …) as finite state machines with official
adapters for React, Vue, Solid, and Svelte. marko-zag is that adapter for
Marko 6: it was ported from `@zag-js/solid@1.43.0`, replacing Solid's
reactive primitives with Marko's tag-based reactivity, and it is the
foundation the [marko-ui](https://github.com/svallory/marko-ui) component
registry is built on.

## What you get

- **Four Marko tags** — `<zag>`, `<zag-machine>`, `<zag-portal>`, and
  `<zag-store>` — auto-discovered via the package's `marko.json` taglib.
  `<zag>` owns the whole wiring: it runs the machine, connects the api, and
  picks the machine's props out of your component's input.
- **`normalizeProps` and `connect`** — `normalizeProps` maps Zag's
  React-style prop objects onto Marko DOM attributes (including the
  focus-preserving `tabIndex` → `tabindex` fix); `connect(mod, service)`
  applies it for you.
- **SSR-safety by construction** — the server renders correct initial
  attributes from a never-started machine; the client builds and starts the
  real machine on mount. Nothing unserializable ever crosses the boundary.
- **`positionerStyle`** — the static style contract that keeps floating-ui
  positioned elements (popovers, menus, tooltips) working under Marko's
  reactive re-renders.

## Quickstart

```sh
bun add marko-zag @zag-js/switch
```

```marko
import * as switchMachine from "@zag-js/switch";
import type { MachineInput } from "marko-zag";

export type Input = MachineInput<"input", switchMachine.Props> & {
  checkedChange?: (checked: boolean) => void;
};

<zag/api=() => switchMachine from=input/>

<label ...api().getRootProps()>
  <input ...api().getHiddenInputProps()>
  <span ...api().getControlProps()>
    <span ...api().getThumbProps()/>
  </span>
  <span ...api().getLabelProps()>
    <${input.content}/>
  </span>
</label>
```

That's the whole integration. `from=input` picks the machine's own props out
of your component's input, generates an `id`, and wires `checkedChange` to
Zag's `onCheckedChange` so Marko's two-way bind shorthand
(`<Switch checked:=myState/>`) works with no callback code of your own. Then
you spread the prop getters onto native tags.

Compare Zag's own two lines — the Marko version reads the same way, with
`() =>` wrappers because tag input is serialized, and `api()` at use sites
because the value is a getter:

```ts
const service = useMachine(accordion.machine, { id: useId() })
const api = accordion.connect(service, normalizeProps)
```

## Next steps

- [Installation](/installation/) — bundler requirements and taglib discovery.
- [The Component Pattern](/guides/component-pattern/) — a full worked
  example wiring `@zag-js/dialog`.
- [SSR & Hydration](/guides/ssr-and-hydration/) — how the server/client
  boundary works.
- [API Reference](/api/tags/) — every export, documented.
