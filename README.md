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

**TypeScript**: `^5.0.0` or `^6.0.0` supported. TypeScript **7** (`tsgo`,
the native compiler) is **NOT** supported — Marko's tooling
(`@marko/type-check`, `@marko/vite`) does not yet work with it.

## The pattern

The four tags (`<zag>`, `<zag-machine>`, `<zag-portal>`, `<zag-store>`) are
auto-discovered from the package's taglib — no imports in `.marko` files.
One tag owns the whole machine wiring:

```marko
import * as switchMachine from "@zag-js/switch";
import type { MachineInput } from "marko-zag";

export type Input = MachineInput<"input", switchMachine.Props> & {
  checkedChange?: (checked: boolean) => void;
};

// Runs the machine and connects the api. SSR-safe: the server renders from
// a never-started throwaway, so the initial attributes are correct with no
// DOM access. `from=input` picks the machine's own props out of this
// component's input and wires `checkedChange` to Zag's `onCheckedChange`.
<zag/api=() => switchMachine from=input/>

<label ...api().getRootProps()>
  <input ...api().getHiddenInputProps()>
  <span ...api().getControlProps()><span ...api().getThumbProps()/></span>
  <span ...api().getLabelProps()><${input.content}/></span>
</label>
```

`api` is a **getter** — call it at every use site. Its identity changes on
every machine transition and on every change to a controlled prop, which is
what makes the spreads above recompute with no dependency list.

Attributes written on the tag override what `from=` supplied, so pinning a
value or replacing a callback is a one-liner:

```marko
<zag/api=() => dialog from=input role="dialog"
  onOpenChange(details) { input.onOpenChange?.(details); track(details.open) }/>
```

When a component needs the service itself, `<zag-machine>` returns it and
`connect()` builds the api:

```marko
<zag-machine/service=() => toast props=() => ({ ...input.options() })/>
<const/api=() => connect(toast, service())/>
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
