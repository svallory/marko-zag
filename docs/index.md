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

- **Four Marko tags** — `<machine-props>`, `<service>`, `<connect>`, and
  `<portal>` — auto-discovered via the package's `marko.json` taglib.
- **`normalizeProps`** — maps Zag's React-style prop objects onto Marko DOM
  attributes (including the focus-preserving `tabIndex` → `tabindex` fix).
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

<machine-props/machineProps from=input pick=switchMachine.props
  onCheckedChange(details: switchMachine.CheckedChangeDetails) {
    input.onCheckedChange?.(details);
    input.checkedChange?.(details.checked);
  }/>
<service/service machine=() => switchMachine.machine props=machineProps/>
<connect/api=(service, normalizeProps) =>
  switchMachine.connect(service, normalizeProps)
  service=service
/>

<label ...api().getRootProps()>
  <input ...api().getHiddenInputProps()>
  <span ...api().getControlProps()>
    <span ...api().getThumbProps()/>
  </span>
  <span ...api().getLabelProps()>
    <${input.renderBody}/>
  </span>
</label>
```

That's the whole integration: pick the machine's props from your component's
input, run the machine in a `<service>`, `<connect>` the API, and spread the
prop getters onto native tags.

## Next steps

- [Installation](/installation/) — bundler requirements and taglib discovery.
- [The Three-Tag Pattern](/guides/three-tag-pattern/) — a full worked
  example wiring `@zag-js/dialog`.
- [SSR & Hydration](/guides/ssr-and-hydration/) — how the server/client
  boundary works.
- [API Reference](/api/tags/) — every export, documented.
