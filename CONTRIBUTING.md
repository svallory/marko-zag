# Contributing to marko-zag

Thanks for helping! This adapter aims for parity with Zag's official
framework adapters — [Zag's framework-adapter guide](https://zagjs.com/guides/framework-adapters)
is the reference for what an adapter must provide.

## Reporting bugs

Open a [bug report](https://github.com/svallory/marko-zag/issues/new?template=bug_report.yml).
The most useful reproduction is a minimal `.marko` component plus the Zag
machine package and version it drives.

## Suggesting features

Open a [feature request](https://github.com/svallory/marko-zag/issues/new?template=feature_request.yml).
If the feature exists in an official Zag adapter (react/vue/solid/svelte/
preact/vanilla), link the corresponding source — parity requests are the
easiest to accept.

## Development setup

Uses [bun](https://bun.sh). npm is not used in this repo.

```sh
git clone https://github.com/svallory/marko-zag.git
cd marko-zag
bun install
bun run check           # marko-type-check (TS + .marko templates)
bun run test            # unit/integration suite (jsdom + node)
bun run test:browser    # real-Chromium suite (needs: bunx playwright install chromium)
bun run docs:dev        # docs site (docmd)
```

There is no build step: the package ships raw TypeScript and `.marko`
sources (tags cannot be pre-compiled by a library; consumers use a
Marko-aware bundler).

## Layout

- `src/machine.ts` — the machine interpreter (`createService`/`ssrService`),
  ported from `@zag-js/solid`. Every Zag-version-specific call lives here.
- `src/normalize-props.ts` — React-dialect → Marko attribute translation.
- `src/prop-types.ts` — `PropTypes` map binding prop getters to Marko's
  native-tag input types.
- `src/tags/` — the Marko tags (`<machine-props>`, `<service>`, `<connect>`,
  `<portal>`, `<store>`), auto-discovered via `marko.json`.
- `tests/` — vitest; `tests/browser/` runs in real Chromium,
  `tests/type-assertions.ts` holds compile-time regression pins.

## Code style

- Prettier (with `prettier-plugin-marko`) formats everything; a husky
  pre-commit hook runs the type check.
- Comments state constraints the code can't show — see the existing files
  for the expected density.
- Type-level behavior changes need a matching assertion in
  `tests/type-assertions.ts`.

## PR process

- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:` …).
- `bun run check` and `bun run test` must pass; add tests with behavior
  changes.
- Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
- Publishing to npm is maintainer-only and manual.

## Questions

Open a [discussion](https://github.com/svallory/marko-zag/discussions) or an
issue.
