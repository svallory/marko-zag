# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/svallory/marko-zag/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/svallory/marko-zag/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/svallory/marko-zag/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/svallory/marko-zag/releases/tag/v1.0.1
