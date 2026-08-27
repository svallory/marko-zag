---
title: "connect"
description: "Builds a Zag module's api from a running service, with Marko's normalizer applied by default."
---

# `connect`

```ts
function connect<M extends ZagModule>(
  mod: M,
  service: any,
  normalize?: NormalizeProps<PropTypes>,
): ZagApi<M>;
```

Calls a Zag module's own `connect()` against a running service, passing
marko-zag's [`normalizeProps`](/api/normalize-props/) unless you supply a
different normalizer. That is the whole implementation:

```ts
return mod.connect(service, normalize ?? normalizeProps);
```

It is generic over the module, so the returned api is the module's real api
type — `connect(toast, service())` gives you `toast`'s methods and prop
getters, not `any`.

## When to use it

`connect()` is the plain-function half of what [`<zag>`](/api/tags/) does.
Use it when the component owns the service itself via `<zag-machine>` —
because it needs to thread the service into a child, or to connect a second
module against it — and still wants the api:

```marko
import * as toast from "@zag-js/toast";
import { connect } from "marko-zag";

<zag-machine/service=() => toast props=() => ({ ...input.options() })/>
<const/api=() => connect(toast, service())/>

<div ...api().getRootProps()>
  <span ...api().getTitleProps()>${api().title}</span>
</div>
```

If all you need is the api, reach for `<zag>` instead — it is exactly
`<zag-machine>` plus this line, and returns the api getter directly:

```marko
<zag/api=() => switchMachine from=input/>
<label ...api().getRootProps()>
```

> `service` is a **getter**. `<zag-machine>` returns `() => service`, so the
> call site is `connect(toast, service())`. The getter's identity is the
> change signal — a fresh closure on every machine notify — which is what
> makes the surrounding `<const>` recompute. Writing the arrow directly as
> the `<const>` value is required; an IIFE wrapper produces an unregistered
> closure and SSR dies with `Unable to serialize`.

## The `normalize` argument

The third argument replaces the normalizer for this call. It takes a
`NormalizeProps<PropTypes>` — the object `createNormalizer` from
`@zag-js/types` returns, **not** a plain function:

```ts
import { createNormalizer } from "@zag-js/types";
import { normalizeProps, type PropTypes } from "marko-zag";

const withTestIds = createNormalizer<PropTypes>((props: Record<string, any>) => ({
  ...(normalizeProps.element(props as any) as Record<string, any>),
  "data-testid": props.id,
}));

const api = connect(toast, service(), withTestIds);
```

See [Wrapping it](/api/normalize-props/#wrapping-it) for why this has to go
through `createNormalizer` — `normalizeProps` is a Proxy, and spreading it
yields an empty object.

## Why it exists

Every call site previously ended in the same two words:

```marko
<const/api=() => toast.connect(service(), normalizeProps)/>
```

The normalizer is not optional in practice — a Marko component that skips it
gets React-dialect attributes — and **forgetting it is not a type error**.
Zag's `connect()` accepts any normalizer, so an omitted or wrong one compiles
cleanly and then misbehaves at runtime: `tabIndex` and `onFocus` survive as
written, roving-focus widgets go keyboard-dead after one keypress, and
delegated focus handlers never fire on parents. `connect()` makes the correct
normalizer the default and leaves the override explicit.
