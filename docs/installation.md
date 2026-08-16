---
title: "Installation"
description: "Installing marko-zag and what your bundler needs to support."
---

# Installation

```sh
bun add marko-zag
```

Then add the Zag machine packages you actually use, e.g.:

```sh
bun add @zag-js/dialog @zag-js/switch @zag-js/tooltip
```

## Requirements

| Requirement | Version |
| --- | --- |
| Marko | `^6.3.34` (peer dependency) |
| Zag.js machines | `1.x` (the adapter tracks `@zag-js/core@1.43.0`) |
| Bundler | **Marko-aware** (see below) |

## A Marko-aware bundler is required

marko-zag **ships source**, not compiled output: the package exports
`./src/index.ts` directly, and the four tags are `.marko` files. Marko tags
cannot be usefully pre-compiled by a library — compilation happens in the
context of the consuming app (server vs. browser output, Marko version,
optimization flags). So your build must run `node_modules` sources through
the Marko compiler and a TypeScript-capable loader.

Any standard Marko 6 setup qualifies:

- **[marko-run](https://github.com/marko-js/run)** — works out of the box.
- **Vite** with `@marko/vite` — works out of the box (Vite transpiles TS in
  dependencies it processes).

If you maintain a custom webpack/rollup config, make sure `.marko` and `.ts`
files inside `node_modules/marko-zag` are not excluded from your loaders.

## Taglib auto-discovery

marko-zag ships a `marko.json` taglib definition:

```json
{
  "tags-dir": "./src/tags"
}
```

The Marko compiler discovers taglibs of installed dependencies
automatically, so `<machine-props>`, `<service>`, `<connect>`, and
`<portal>` are available in every `.marko` file of your app with **no
imports and no configuration**. Editor tooling (the Marko VSCode extension /
`@marko/type-check`) picks up the same definitions, including each tag's
TypeScript `Input` interface.

## TypeScript

The TypeScript exports are consumed straight from source, so your
`tsconfig.json` needs `moduleResolution` set to `"bundler"` (marko-zag's
internal imports use explicit `.ts` extensions, which bundler resolution
handles natively).
