# marko-zag

[![CI](https://github.com/svallory/marko-zag/actions/workflows/ci.yml/badge.svg)](https://github.com/svallory/marko-zag/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/marko-zag)](https://www.npmjs.com/package/marko-zag)
[![docs](https://img.shields.io/badge/docs-marko--zag.saulo.tech-blue)](https://marko-zag.saulo.tech)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**Zag.js v1 bindings for Marko 6** — an SSR-safe adapter that runs
[Zag](https://zagjs.com)'s framework-agnostic state machines inside Marko
components. Ported from `@zag-js/solid`, adapted to Marko's serialize-and-resume
model. [marko-ui](https://github.com/svallory/marko-ui) — the shadcn-style
component registry for Marko — is built on it.

## Install

```sh
bun add marko-zag
```

Requires Marko `^6.3.34` and a **Marko-aware bundler** (marko-run or
`@marko/vite` both work out of the box): the package ships source — `.marko`
tags cannot be pre-compiled by a library, and the TypeScript exports are
consumed directly.

## The three-tag pattern

The five tags (`<machine-props>`, `<service>`, `<connect>`, `<portal>`, `<store>`) are
auto-discovered from the package's taglib — no imports in `.marko` files:

```marko
import * as switchMachine from "@zag-js/switch";
import type { MachineInput } from "marko-zag";

export type Input = MachineInput<"input", switchMachine.Props> & {
  checkedChange?: (checked: boolean) => void;
};

// 1. pick the machine's props from this component's input
<machine-props/machineProps from=input pick=switchMachine.props
  onCheckedChange(details) { input.checkedChange?.(details.checked) }/>

// 2. run the machine (SSR-safe: server renders a never-started one)
<service/service machine=() => switchMachine.machine props=machineProps/>

// 3. connect the api and spread the prop getters onto native tags
<connect/api=(service, normalizeProps) =>
  switchMachine.connect(service, normalizeProps)
  service=service
/>

<label ...api().getRootProps()>
  <input ...api().getHiddenInputProps()>
  <span ...api().getControlProps()><span ...api().getThumbProps()/></span>
  <span ...api().getLabelProps()><${input.renderBody}/></span>
</label>
```

## Documentation

Full guides (SSR & hydration, controlled props, floating elements, the
hard-won gotchas) and the complete API reference live at
**[marko-zag.saulo.tech](https://marko-zag.saulo.tech)**.

## Contributing

Bug reports, parity requests, and PRs welcome — see
[CONTRIBUTING.md](./CONTRIBUTING.md) for setup and conventions.

## License

MIT © [Saulo Vallory](https://about.me/saulovallory)
