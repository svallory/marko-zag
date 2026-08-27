# marko-zag — agent notes

Zag.js v1 bindings for Marko 6: an SSR-safe adapter running Zag's
framework-agnostic state machines inside Marko components. Ported from
`@zag-js/solid`; parity target is Zag's official adapters
(see https://zagjs.com/guides/framework-adapters).

## Commands (bun only — never npm)

- `bun run check` — marko-type-check over TS + `.marko` (the gate; also
  compiles `tests/type-assertions.ts`)
- `bun run test` — vitest twice: the jsdom/node suite, then the
  server-render suite (`vitest.ssr.config.ts`, `tests/ssr/**`), which
  compiles real `.marko` templates through `@marko/vite` with no DOM.
  The jsdom config has no Marko plugin, so `.marko` imports only work in
  the SSR and browser projects.
- `bun run test:browser` — vitest browser mode, real Chromium
  (`bunx playwright install chromium` once)
- `bun run lint:package` — publint
- `bun run release` — maintainer-only manual npm publish
  (1Password-backed; NEVER run without the user's explicit approval)

## Architecture

- `src/machine.ts` — the whole machine interpreter (`createService`,
  `ssrService`, `MarkoService`). Every Zag-version-specific call lives here
  by design. Reactivity = plain values + a `notify` callback; the host bumps
  an internal counter `<let>` to give derived values fresh identity.
- `src/normalize-props.ts` — React-dialect → Marko attributes. Load-bearing
  mappings: `tabIndex→tabindex` (Chromium blur bug), `onFocus→onFocusin` /
  `onBlur→onFocusout` (focus doesn't bubble; Marko delegates at document).
- `src/prop-types.ts` — `PropTypes` mapped over all `Marko.NativeTags`;
  `element` is `Marko.HTMLAttributes<Element>` (contravariance-safe
  fallback). Type changes need a pin in `tests/type-assertions.ts`.
- `src/tags/` — `<machine-props>`, `<service>`, `<portal>`, `<store>`;
  auto-discovered via `marko.json` (`script-lang: ts` there is load-bearing
  for consumers).
- `<service>` returns a service GETTER (`() => MarkoService<T>`), the Marko
  analog of `useMachine`. Connecting is a plain `<const>` in the consumer:
  `<const/api=() => m.connect(service(), normalizeProps)/>`. There is no
  `<connect>` tag and no `rev` in the public surface (2.0).

## Reactivity rules (verified against marko@6.3.36)

- `<let>`/`<const>` write and queue a render ONLY when the new value is
  `!==` the old one. A counter, a fresh object, or a fresh closure all
  propagate; the same closure does not. This identity rule is the entire
  mechanism behind `<service>`'s getter.
- A closure that reads a reactive value is itself reactive: its identity
  changes when that value does. So an inline `props=() => ({ ...x })` in a
  consumer already re-notifies `<service>` on every change to `x`.
- The getter arrow MUST be written directly as the `<const>` value. The
  compiler wraps a directly-written closure in `_resume(...)`, registering
  it so it can be serialized once the browser references it — which happens
  as soon as a consumer spreads `api()` onto an element. An IIFE wrapper
  produces an unregistered closure, and SSR dies with
  `Unable to serialize`. `<store>` shipped that way until 2.0; both tags now
  write the arrow directly.
- `<script>` compiles to an effect keyed on every binding it READS
  (assignment alone creates no dependency). A `<script>` that reads a `<let>`
  it also writes re-subscribes on itself, so service creation and `props()`
  tracking must never share one block.
- TS rejects a bare identifier on the left of a comma
  (`error TS2695`); use `void rev,` to keep the dependency read.

## Constraints

- SSR contract: services are never reactive state; server uses a throwaway
  `ssrService` inline, client builds the real one in `onMount`. Tag inputs
  must stay serializable (closures written in the caller's template).
- No build step: ships raw TS + `.marko` (tags can't be pre-compiled).
- NEVER add `"sideEffects": false` (or a `.marko` glob) to package.json:
  compiled `.marko` modules register resume scripts/content as module side
  effects, and bundlers will drop tag modules from client chunks — the SSR
  payload then references registrations the client never loads (production
  resume crash). Globs don't save you: compiled module ids carry query
  params/virtual prefixes that miss them.
- Marko re-syncs an input's live `.value` on re-render only when a
  `valueChange` handler exists — Zag machines write `.value`/`.checked` via
  watch effects instead; don't "fix" this.
- Conventional commits; user-visible changes go in `CHANGELOG.md` under
  `[Unreleased]`.
