# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0-rc.1] - 2026-08-27

### Changed

- **BREAKING** — `<service>` returns a service **getter**
  (`() => MarkoService<T>`) instead of a serializable
  `{ service, machine, props, rev }` handle. `service()` yields the real
  running service on the client after mount, and a never-started throwaway
  (`ssrService`) on the server and before mount, so `connect()` renders
  correct initial attributes with no DOM access.
- **BREAKING** — the `<connect>` tag is **deleted**. Call the machine's own
  `connect()` in a plain `<const>`; Marko's re-running render code is exactly
  where Zag expects `connect` to be called, so the tag was pure ceremony.
- **BREAKING** — `ServiceHandle` is **deleted**, and `rev` is gone from the
  public surface. Neither `service.service`, `service.machine`,
  `service.props`, nor `service.rev` exists — the tag variable *is* the
  getter. (`rev` survives only as an internal `<let>` counter inside
  `<service>`.)

`<machine-props>` and `<portal>` are unchanged; `<store>` keeps its API and
gains the serialization fix below.

Why a getter rather than the service object: returning the service itself
does **not** throw on the server. Marko serializes it with every function
silently stripped, the page renders, and the first client read dies with
`TypeError: … is not a function`. A closure written in a template is the
only serializable stand-in for a service, and calling it defers the
real-vs-throwaway choice to call time.

The getter's *identity* is the change signal: it is a fresh closure on every
machine update and on every change to a value read inside the caller's props
closure, so a downstream `<const>` recomputes for both machine transitions
and controlled-prop changes with no hand-written dependency list.

### Fixed

- `<store>`: spreading a store snapshot's fields onto an element
  (`<div ...toasts().attrs>`) no longer fails with
  `Unable to serialize`. The snapshot getter was built inside an IIFE, which
  left it unregistered; it is now written directly as the `<const>` value so
  the compiler wraps it in `_resume(...)`. Reading a snapshot in body
  content was unaffected, which is why this went unnoticed.

### Migration

The three-line block collapses to two, and now reads the same as Zag's own
two lines:

```marko
<!-- before (1.x) -->
<machine-props/machineProps from=input pick=accordion.props/>
<service/service machine=() => accordion.machine props=machineProps/>
<connect/api=(service, normalizeProps) =>
  accordion.connect(service, normalizeProps)
  service=service
/>

<!-- after (2.0) -->
<machine-props/machineProps from=input pick=accordion.props/>
<service/service machine=() => accordion.machine props=machineProps/>
<const/api=() => accordion.connect(service(), normalizeProps)/>
```

`normalizeProps` is no longer passed for you, so import it:

```marko
import { normalizeProps } from "marko-zag";
```

Handle field reads have no replacement fields — use the getter itself:

```marko
<!-- before -->                       <!-- after -->
service.service                       service()
service.machine()                     <!-- import the machine module directly -->
service.props                         <!-- pass your own props closure -->
service.rev                           service
```

- **`service.service` → `service()`.** The getter returns the running
  service on the client, so `const ownService = service.service` becomes
  `const ownService = service()`. In `onMount` this is equivalent: every
  ancestor's `<service>` has already mounted.
- **`service.rev` as a `<script>` dependency → `service`.** A bare
  `service;` is a valid dependency read (Babel counts the reference
  identically), and the getter's identity now changes on every update:

  ```marko
  <script>
    service;          // was: service.rev;
    uiValue = api();
  </script>
  ```

- **Cross-service threading (`groupRevision=service.rev`) → thread the
  getter.** Pass `service` itself as the prop; its identity changes on every
  notify, so the child re-derives. A `groupRevision: number` input becomes a
  getter-typed one.
- **`connectFresh` helpers** that hand-rolled `<connect>`'s body against the
  raw handle (`svc.service ?? ssrService(svc.machine(), svc.props)`) are now
  just the `<const>` line above.

## [1.2.1] - 2026-08-20

### Fixed

- Removed `"sideEffects": false` (added in 1.2.0). Compiled `.marko`
  modules perform their resume registrations (`_script`, content
  registration) as module side effects; declaring the package
  side-effect-free let bundlers drop the `<portal>` tag's module from
  client chunks that only referenced it through pure-annotated bindings —
  the server payload then referenced a registration the client never
  loaded, crashing Marko's resume in production builds. A glob like
  `["**/*.marko"]` is NOT a safe alternative: bundler module ids for
  compiled Marko files carry query params/virtual prefixes the glob won't
  match, silently reproducing `false`.

## [1.2.0] - 2026-08-19

### Fixed

- `PropTypes` is now mapped over **all** of `Marko.NativeTags` (matching the
  official adapters, which pass their framework's full intrinsic-elements
  map) instead of Zag's 13-key minimum. `style` is now
  `Marko.CSS.Properties` plus `--custom-props` instead of a loose record.

## [1.1.1] - 2026-08-19

### Fixed

- `PropTypes["element"]` — the generic prop-getter fallback — was
  `Marko.Input<"div">`, making every generic getter spreadable onto `<div>`
  only. Now `Marko.HTMLAttributes<Element>`, assignable to every native tag
  (the element type parameter is contravariant-only).

## [1.1.0] - 2026-08-19

### Added

- `mergeProps` — composes user attributes with Zag prop-getter output
  (chains `on*` handlers, joins `class`, merges `style` including CSS
  strings; result style is a hyphenated object).
- `PropTypes` type — `normalizeProps` is typed against Marko's native-tag
  inputs instead of `any`.
- `<store>` tag — `useSyncExternalStore` analog for external
  subscribe/snapshot stores (e.g. Zag's toast store).
- `<portal>` accepts `container=` (element getter) and `getRootNode=`
  (shadow DOM / iframe support).
- Test suites: 37 jsdom/node tests plus 14 real-Chromium tests
  (vitest browser mode).

### Fixed

- `normalizeProps` maps `onFocus`/`onBlur` to `onFocusin`/`onFocusout` —
  focus/blur don't bubble, so Marko's document-level delegation only fired
  them on the exact target; the bubbling twins restore the React-like
  semantics Zag machines assume.
- Bindable `sync: true` is honored: sync bindables flush synchronously
  instead of microtask batching (input-cursor machines).
- Events sent before `service.start()` are buffered and replayed on start
  instead of silently dropped (a Marko child's `onMount` runs before its
  parent's).

### Changed

- `@zag-js/*` dependencies loosened from exact `1.43.0` pins to `^1.43.0`.

## [1.0.1] - 2026-08-19

### Fixed

- `marko.json` declares `"script-lang": "ts"` so consumers type-check the
  package's tags as TypeScript.
- `MarkoService`, `createService`, and `ssrService` are generic over the
  machine schema.

### Added

- `stripOwnProps` native-attrs helper.

[Unreleased]: https://github.com/svallory/marko-zag/compare/v2.0.0-rc.1...HEAD
[2.0.0-rc.1]: https://github.com/svallory/marko-zag/compare/v1.2.1...v2.0.0-rc.1
[1.2.1]: https://github.com/svallory/marko-zag/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/svallory/marko-zag/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/svallory/marko-zag/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/svallory/marko-zag/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/svallory/marko-zag/releases/tag/v1.0.1
