# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.1] - 2026-09-09

### Changed

- Root `typescript` devDependency moves back from `^7.0.2` to `^6.0.3` —
  marko's tooling (`@marko/type-check`, `@marko/vite`) has issues with
  TypeScript 7 (native `tsgo`). Added an optional `typescript` peerDependency
  (`^5.0.0 || ^6.0.0`) so a TS 7 install surfaces an npm warning; see README
  for the compatibility note.

## [2.0.0] - 2026-09-01

### Changed

- **BREAKING** — every tag is renamed under a `zag-` prefix:
  `<service>` → `<zag-machine>`, `<store>` → `<zag-store>`,
  `<portal>` → `<zag-portal>`.
- **BREAKING** — `<zag-machine>` returns a service **getter**
  (`() => MarkoService<T>`) instead of a serializable
  `{ service, machine, props, rev }` handle. `service()` yields the real
  running service on the client after mount, and a never-started throwaway
  (`ssrService`) on the server and before mount, so `connect()` renders
  correct initial attributes with no DOM access. `ServiceHandle` is deleted;
  `rev` is gone from the public surface (it survives only as an internal
  `<let>` counter inside `<zag-machine>`).
- **BREAKING** — `<zag-machine>`'s value shorthand is the **module** getter
  (`() => switchMachine`), not the machine getter. The tag reads `.machine`
  for the interpreter and `.props` for the name list it picks out of
  `from=`, so a component never repeats the module name.
- **BREAKING** — the `<connect>` tag is **deleted**. Call the machine's own
  `connect()` in a plain `<const>`, or use the new `connect(mod, service)`
  helper — Marko's re-running render code is exactly where Zag expects
  `connect` to be called, so the tag was pure ceremony.
- **BREAKING** — the `<machine-props>` tag is **deleted**. Its job — pick the
  machine-owned props out of a component's input, generate an `id`, merge the
  tag's own attributes as overrides — is now the `from=` attribute on `<zag>`
  and `<zag-machine>`.
- **BREAKING** — every `@zag-js/*` dependency (`core`, `types`, `utils`, and
  the machine devDependencies `checkbox`, `combobox`, `qr-code`, `select`,
  `tooltip`) is pinned to exact `1.43.3`. No external users and no
  compatibility commitment on this adapter, so the range is dropped for an
  exact pin rather than widened.
- **BREAKING** — root `typescript` moves to `^7.0.2` (native `tsgo`),
  matching the consumer. No code in this repo imports the `typescript`
  compiler API (`import ts from "typescript"`), which TS 7 does not export,
  so the move needed no source changes. `@marko/type-check` bundles its own
  TypeScript (6.0.3) and is unaffected by this bump.

### Added

- **`<zag>`** — the whole machine wiring in one tag. It is `<zag-machine>`
  plus the connect line, returning the **api getter**:

  ```marko
  <zag/api=() => switchMachine from=input/>
  <label ...api().getRootProps()>
  ```

  Identity contract: a fresh closure per machine notify and per tracked
  props change, so every `api()` spread recomputes with no hand-written
  dependency list.
- **A default callback rule.** A picked machine prop matching
  `on<X>Change` is wrapped automatically when the component supplies either
  Zag's `onXChange` or Marko's bind-shorthand `xChange`. The wrapper forwards
  the details object, then — only when `x in details` — calls
  `xChange(details[x])`. A component declaring nothing but a
  `checkedChange?: (checked: boolean) => void` input therefore supports
  `<Switch checked:=myState/>` with no callback code of its own.

  The `x in details` guard is deliberate: `onTriggerValueChange` matches the
  name pattern but carries `details.value`, so its `triggerValueChange` half
  correctly never fires. Callbacks that are not `on<X>Change` at all —
  `onValueComplete`, `onPositionChangeEnd`/`onSizeChangeEnd`,
  `onCollapse`/`onExpand` (called as `(panelId, size)`), `onTick`,
  `onSelect`, `onValueCommit`, `onComplete`, `onResizeStart` — generate no
  wrapper and are passed to the machine untouched. Write an override
  attribute on the tag where you want more.
- **`props=` composes with `from=`.** When both are given, `props=` receives
  the picked-and-adapted props and its return value is what the machine gets.
  That is the serialization-safe place to build a `ListCollection`, an
  `@internationalized/date` value, or a `Color` — class instances that throw
  `Unable to serialize "input"` if they cross the tag-input boundary, but
  never cross when born inside a closure written in your own template.
- **`connect(mod, service, normalize?)`** — the plain-function half of
  `<zag>`, for components that own the service via `<zag-machine>`. Equal to
  `mod.connect(service, normalize ?? normalizeProps)`, typed so the api
  infers from the module. `normalizeProps` remains exported.
- **`normalize=`** on `<zag>` swaps the prop normalizer.

At least one of `from=` / `props=` is required; passing neither throws at
setup with a message naming both.

### Fixed

- `<store>`: spreading a store snapshot's fields onto an element
  (`<div ...toasts().attrs>`) no longer fails with `Unable to serialize`.
  The snapshot getter was built inside an IIFE, which left it unregistered;
  it is now written directly as the `<const>` value so the compiler wraps it
  in `_resume(...)`.
- `tests/type-assertions.ts`'s `ZagSchema<M>["props"]` pin: zag 1.43.3
  tightened the machine schema so `props` is now a real
  (`RequiredBy<Props, ...>`) type instead of `any`.

### Migration

The three-tag 1.x block collapses to one line, and now reads the same as
Zag's own two lines:

```marko
<!-- before (1.x) -->
<machine-props/machineProps from=input pick=accordion.props/>
<service/service machine=() => accordion.machine props=machineProps/>
<connect/api=(service, normalizeProps) =>
  accordion.connect(service, normalizeProps)
  service=service
/>

<!-- after (2.0.0) -->
<zag/api=() => accordion from=input/>
```

The callback block disappears: forwarding `onCheckedChange` and unwrapping
for `checkedChange` is now the default. Keep an explicit callback only where
you do something extra, or where the details key does not match the name.

`api` is a **getter** — call it at every use site (`api().getRootProps()`).
The old handle's fields have no replacement fields — use the getter itself:

```marko
<!-- before (1.x) -->             <!-- after (2.0.0) -->
service.service                   service()
service.machine()                 <!-- import the machine module directly -->
service.props                     <!-- pass your own props= closure -->
service.rev                       service
```

- **`service.service` → `service()`.** The getter returns the running
  service on the client, so `const ownService = service.service` becomes
  `const ownService = service()`. In `onMount` this is equivalent: every
  ancestor's machine has already mounted.
- **`service.rev` as a `<script>` dependency → `service`.** A bare
  `service;` is a valid dependency read, and the getter's identity now
  changes on every update:

  ```marko
  <script>
    service;          // was: service.rev;
    uiValue = api();
  </script>
  ```

- **Cross-service threading (`groupRevision=service.rev`) → thread the
  getter.** Pass `service` itself as the prop; its identity changes on every
  notify, so the child re-derives.
- **`connectFresh` helpers** that hand-rolled `<connect>`'s body against the
  raw handle are now just `<zag>`, or `connect(mod, service())`.

`normalizeProps` is no longer passed for you, but `<zag>` and `connect()`
both apply it by default, so most components stop importing it entirely.

`<store>` → `<zag-store>` and `<portal>` → `<zag-portal>` are pure renames.

---

The sections below are the original `2.0.0-rc.1`–`2.0.0-rc.3` pre-release
entries, kept for historical record. No stable release ever shipped them;
the consolidated `[2.0.0]` entry above is the complete, accurate change
against `1.x`.

## [2.0.0-rc.3] - 2026-08-30

### Changed

- **BREAKING** — every `@zag-js/*` dependency (`core`, `types`, `utils`, and
  the machine devDependencies `checkbox`, `combobox`, `qr-code`, `select`,
  `tooltip`) is pinned to exact `1.43.3`, up from the `^1.43.0` range
  (installed `1.43.0`). No external users and no compatibility commitment on
  this adapter, so the range is dropped for an exact pin rather than widened.
- **BREAKING** — root `typescript` moves from `^5.7.0` to `^7.0.2` (native
  `tsgo`), matching the consumer. No code in this repo imports the
  `typescript` compiler API (`import ts from "typescript"`), which TS 7 does
  not export, so the move needed no source changes. `@marko/type-check`
  bundles its own TypeScript (6.0.3) and is unaffected by this bump — the
  `bun run check` gate's behavior is unchanged.

### Fixed

- `tests/type-assertions.ts`'s `ZagSchema<M>["props"]` pin: zag 1.43.3
  tightened the machine schema so `props` is now a real
  (`RequiredBy<Props, ...>`) type instead of `any`. The assertion is updated
  to require `"notany"` instead of `"any"`; `checkbox.Props` remains the
  precision path a component's `Input` should extend.

## [2.0.0-rc.2] - 2026-08-27

### Changed

- **BREAKING** — every tag is renamed under a `zag-` prefix:
  `<service>` → `<zag-machine>`, `<store>` → `<zag-store>`,
  `<portal>` → `<zag-portal>`.
- **BREAKING** — `<zag-machine>`'s value shorthand is now the **module**
  getter (`() => switchMachine`), not the machine getter. The tag reads
  `.machine` for the interpreter and `.props` for the name list it picks out
  of `from=`, so a component never repeats the module name. It still returns
  the service getter, unchanged.
- **BREAKING** — the `<machine-props>` tag is **deleted**. Its job — pick the
  machine-owned props out of a component's input, generate an `id`, merge
  the tag's own attributes as overrides — is now the `from=` attribute on
  `<zag>` and `<zag-machine>`.

### Added

- **`<zag>`** — the whole machine wiring in one tag. It is `<zag-machine>`
  plus the connect line, returning the **api getter**:

  ```marko
  <zag/api=() => switchMachine from=input/>
  <label ...api().getRootProps()>
  ```

  Identity contract is unchanged: a fresh closure per machine notify and per
  tracked props change, so every `api()` spread recomputes with no
  hand-written dependency list.
- **A default callback rule.** A picked machine prop matching
  `on<X>Change` is wrapped automatically when the component supplies either
  Zag's `onXChange` or Marko's bind-shorthand `xChange`. The wrapper forwards
  the details object, then — only when `x in details` — calls
  `xChange(details[x])`. A component declaring nothing but a
  `checkedChange?: (checked: boolean) => void` input therefore supports
  `<Switch checked:=myState/>` with no callback code of its own.

  The `x in details` guard is deliberate: `onTriggerValueChange` matches the
  name pattern but carries `details.value`, so its `triggerValueChange` half
  correctly never fires. Callbacks that are not `on<X>Change` at all —
  `onValueComplete`, `onPositionChangeEnd`/`onSizeChangeEnd`,
  `onCollapse`/`onExpand` (called as `(panelId, size)`), `onTick`,
  `onSelect`, `onValueCommit`, `onComplete`, `onResizeStart` — generate no
  wrapper and are passed to the machine untouched. Write an override
  attribute on the tag where you want more.
- **`props=` composes with `from=`.** When both are given, `props=` receives
  the picked-and-adapted props and its return value is what the machine gets.
  That is the serialization-safe place to build a `ListCollection`, an
  `@internationalized/date` value, or a `Color` — class instances that throw
  `Unable to serialize "input"` if they cross the tag-input boundary, but
  never cross when born inside a closure written in your own template.
- **`connect(mod, service, normalize?)`** — the plain-function half of
  `<zag>`, for components that own the service via `<zag-machine>`. Equal to
  `mod.connect(service, normalize ?? normalizeProps)`, typed so the api
  infers from the module. `normalizeProps` remains exported.
- **`normalize=`** on `<zag>` swaps the prop normalizer.

Exactly one of `from=` / `props=` is required; passing neither throws at
setup with a message naming both.

### Migration

#### From 2.0.0-rc.1

Rename the tags, and collapse the two-line block into one:

```marko
<!-- before (rc.1) -->
<machine-props/machineProps from=input pick=switchMachine.props
  onCheckedChange(details) {
    input.onCheckedChange?.(details);
    input.checkedChange?.(details.checked);
  }/>
<service/service machine=() => switchMachine.machine props=machineProps/>
<const/api=() => switchMachine.connect(service(), normalizeProps)/>

<!-- after (rc.2) -->
<zag/api=() => switchMachine from=input/>
```

The callback block disappears: forwarding `onCheckedChange` and unwrapping
for `checkedChange` is now the default. Keep an explicit callback only where
you do something extra, or where the details key does not match the name.

`<store>` → `<zag-store>` and `<portal>` → `<zag-portal>` are pure renames.

When a component wraps the picked props in a second closure to add a
collection, that closure becomes `props=`:

```marko
<!-- before (rc.1) -->
<machine-props/machineProps from=input pick=select.props .../>
<const/serviceProps=() => ({ ...machineProps(), collection: buildCollection(items) })/>
<service/service machine=() => select.machine props=serviceProps/>
<const/api=() => select.connect(service(), normalizeProps)/>

<!-- after (rc.2) -->
<zag/api=() => select from=input props=(picked) => ({
  ...picked,
  collection: buildCollection(items),
})/>
```

When a component needs the service itself, keep `<zag-machine>` and use
`connect()`:

```marko
<!-- before (rc.1) -->
<service/service machine=() => toast.machine props=toastProps/>
<const/api=() => toast.connect(service(), normalizeProps)/>

<!-- after (rc.2) -->
<zag-machine/service=() => toast props=toastProps/>
<const/api=() => connect(toast, service())/>
```

#### From 1.x

The three-tag block collapses to one line:

```marko
<!-- before (1.x) -->
<machine-props/machineProps from=input pick=accordion.props/>
<service/service machine=() => accordion.machine props=machineProps/>
<connect/api=(service, normalizeProps) =>
  accordion.connect(service, normalizeProps)
  service=service
/>

<!-- after (2.0.0-rc.2) -->
<zag/api=() => accordion from=input/>
```

`api` is a **getter** — call it at every use site (`api().getRootProps()`),
and note that `<connect>` and the `ServiceHandle` object are both gone. The
handle's fields have no replacements; use the getter itself:

- **`service.service` → `service()`** (from `<zag-machine>`). In `onMount`
  this is equivalent: every ancestor's machine has already mounted.
- **`service.machine()`** → import the machine module directly.
- **`service.props`** → pass your own `props=` closure.
- **`service.rev` as a `<script>` dependency → `service`.** A bare
  `service;` is a valid dependency read, and the getter's identity now
  changes on every update:

  ```marko
  <script>
    service;          // was: service.rev;
    uiValue = api();
  </script>
  ```

- **Cross-service threading (`groupRevision=service.rev`) → thread the
  getter.** Pass `service` itself as the prop; its identity changes on every
  notify, so the child re-derives.
- **`connectFresh` helpers** that hand-rolled `<connect>`'s body against the
  raw handle are now just `<zag>`, or `connect(mod, service())`.

`normalizeProps` is no longer passed for you inside `<connect>`, but `<zag>`
and `connect()` both apply it by default, so most components stop importing
it entirely.

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

[Unreleased]: https://github.com/svallory/marko-zag/compare/v2.0.1...HEAD
[2.0.1]: https://github.com/svallory/marko-zag/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/svallory/marko-zag/compare/v1.2.1...v2.0.0
[2.0.0-rc.3]: https://github.com/svallory/marko-zag/compare/v2.0.0-rc.2...v2.0.0-rc.3
[2.0.0-rc.2]: https://github.com/svallory/marko-zag/compare/v2.0.0-rc.1...v2.0.0-rc.2
[2.0.0-rc.1]: https://github.com/svallory/marko-zag/compare/v1.2.1...v2.0.0-rc.1
[1.2.1]: https://github.com/svallory/marko-zag/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/svallory/marko-zag/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/svallory/marko-zag/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/svallory/marko-zag/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/svallory/marko-zag/releases/tag/v1.0.1
