# marko-zag — agent notes

Zag.js v1 bindings for Marko 6: an SSR-safe adapter running Zag's
framework-agnostic state machines inside Marko components. Ported from
`@zag-js/solid`; parity target is Zag's official adapters
(see https://zagjs.com/guides/framework-adapters).

## Commands (bun only — never npm)

- `bun run check` — marko-type-check over TS + `.marko` (the gate; also
  compiles `tests/type-assertions.ts`)
- `bun run test` — vitest, jsdom + node (SSR) suites
- `bun run test:browser` — vitest browser mode, real Chromium
  (`bunx playwright install chromium` once)
- `bun run lint:package` — publint
- `bun run release` — maintainer-only manual npm publish
  (1Password-backed; NEVER run without the user's explicit approval)

## Architecture

- `src/machine.ts` — the whole machine interpreter (`createService`,
  `ssrService`, `MarkoService`). Every Zag-version-specific call lives here
  by design. Reactivity = plain values + a `notify` callback; the host bumps
  a `<let/rev>`.
- `src/normalize-props.ts` — React-dialect → Marko attributes. Load-bearing
  mappings: `tabIndex→tabindex` (Chromium blur bug), `onFocus→onFocusin` /
  `onBlur→onFocusout` (focus doesn't bubble; Marko delegates at document).
- `src/prop-types.ts` — `PropTypes` mapped over all `Marko.NativeTags`;
  `element` is `Marko.HTMLAttributes<Element>` (contravariance-safe
  fallback). Type changes need a pin in `tests/type-assertions.ts`.
- `src/tags/` — `<machine-props>`, `<service>`, `<connect>`, `<portal>`,
  `<store>`; auto-discovered via `marko.json` (`script-lang: ts` there is
  load-bearing for consumers).

## Constraints

- SSR contract: services are never reactive state; server uses a throwaway
  `ssrService` inline, client builds the real one in `onMount`. Tag inputs
  must stay serializable (closures written in the caller's template).
- No build step: ships raw TS + `.marko` (tags can't be pre-compiled).
- Marko re-syncs an input's live `.value` on re-render only when a
  `valueChange` handler exists — Zag machines write `.value`/`.checked` via
  watch effects instead; don't "fix" this.
- Conventional commits; user-visible changes go in `CHANGELOG.md` under
  `[Unreleased]`.
