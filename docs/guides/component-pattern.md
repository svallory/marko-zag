---
title: "The Component Pattern"
description: "How <zag> wires a Zag machine into a Marko component in one line, and when to reach for <zag-machine> instead."
---

# The Component Pattern

Zag's own two-line recipe is:

```ts
const service = useMachine(accordion.machine, { id: useId() })
const api = accordion.connect(service, normalizeProps)
```

In marko-zag both lines collapse into one tag:

```marko
<zag/api=() => accordion from=input/>
```

`<zag>` creates the service, connects it, and returns the **api getter**.
You call `api()` at every use site — `api().getRootProps()` — because the
value is a getter, not a snapshot.

Two things about that line are irreducible Marko taxes, not style:

- The value is a **module getter** (`() => accordion`), never the machine and
  never the raw module. Tag input is serialized for resume, so npm-provided
  functions cannot cross it; a closure written in your template can. One
  getter carries both halves the tag needs: `accordion.machine` for the
  interpreter and `accordion.props` for the prop-name list.
- `api` is a getter, so you write `api().getTriggerProps()`, never
  `api.getTriggerProps()`.

Overlay components add one more tag, **`<zag-portal>`**, to render content at
`document.body`.

## What `from=` does

`from=input` is the whole prop-wiring step. Given your component's input
object, `<zag>`:

- picks every name in the module's exported `props` array out of it
  (`accordion.props` — a plain string array the tag reads through the module
  getter, so nothing unserializable crosses the boundary);
- injects `id: from.id ?? <generated>`, since Zag requires a stable id;
- applies the **default callback rule** (below) to `onXChange` props;
- merges every *other* attribute written on the tag last, as an override.
  Overrides win, which is how you pin a machine prop or substitute your own
  callback.

```marko
<zag/api=() => tooltip from=input closeOnEscape=false
  onOpenChange(details) {
    input.onOpenChange?.(details);
    track(details.open);
  }/>
```

### The default callback rule

Zag reports changes as `onCheckedChange(details)`. Marko's `checked:=state`
bind shorthand compiles to a `checkedChange(value)` attribute. Wiring both by
hand used to be the single most repeated line in adapter code, so `<zag>`
does it for you.

A machine prop matching `^on([A-Z]\w*)Change$` is wrapped when your component
supplies **either** half — `onXChange` or the bind-shorthand `xChange`. The
wrapper calls `from.onXChange?.(details)`, then, **only if** `x in details`
(`x` being `X` with its first letter lowercased), calls
`from.xChange?.(details[x])`.

So a controlled checkbox needs no callback wiring at all:

```marko
/* checkbox.marko */
import * as checkbox from "@zag-js/checkbox";

export interface Input {
  id?: string;
  checked?: boolean;
  /** Marko-friendly sugar so callers can write `checked:=state.checked` */
  checkedChange?: (checked: boolean) => void;
}

<zag/api=() => checkbox from=input/>

<label ...api().getRootProps()>
  <input ...api().getHiddenInputProps()/>
  <span ...api().getControlProps()/>
</label>
```

```marko
<let/checked=false/>
<checkbox checked:=checked/>
```

The guard is what keeps the rule honest. Callbacks whose `details` key does
not match their name — `onTriggerValueChange` carries `details.value`, not
`details.triggerValue` — get no sugar, and callbacks that are not `Change`
callbacks at all (`onSelect`, `onValueCommit`) are picked through untouched.
Write an explicit override attribute for those; see the
[gotchas page](/guides/gotchas/).

## Worked example: a dialog

A complete, production-shaped dialog wrapping
[`@zag-js/dialog`](https://zagjs.com/components/react/dialog) (styling
trimmed — this is the wiring used by
[marko-ui](https://github.com/svallory/marko-ui)'s dialog):

```marko
/* dialog.marko */
import * as dialogMachine from "@zag-js/dialog";
import type { MachineInput } from "marko-zag";

export type Input = MachineInput<"div", dialogMachine.Props> & {
  /** Marko-friendly sugar so callers can write `open:=state.showDialog` */
  openChange?: (open: boolean) => void;
  trigger?: Marko.Body<[Record<string, unknown>]>;
  title?: Marko.Body;
  content?: Marko.Body;
};

// One tag: pick the machine props out of `input`, run the machine, connect.
// `openChange` needs no wiring — `onOpenChange` carries `details.open`, so
// the default callback rule fires it.
<zag/api=() => dialogMachine from=input/>

// Render: spread the prop getters onto native tags.
<if=input.trigger>
  <${input.trigger}(api().getTriggerProps())/>
</if>
<zag-portal>
  <if=api().open>
    <div ...api().getBackdropProps()/>
    <div ...api().getPositionerProps()>
      <div ...api().getContentProps()>
        <if=input.title>
          <h2 ...api().getTitleProps()><${input.title}/></h2>
        </if>
        <${input.content}/>
        <button ...api().getCloseTriggerProps()>Close</button>
      </div>
    </div>
  </if>
</zag-portal>

<return=api/>
```

Using it:

```marko
<let/open=false/>
<dialog open:=open>
  <@trigger|triggerProps|><button ...triggerProps>Open dialog</button></@trigger>
  <@title>Are you sure?</@title>
  <@content>This action cannot be undone.</@content>
</dialog>
```

## When you need the service

`<zag>` hands you the api and keeps the service to itself. When the component
needs the **service** — to thread into a child, or to connect a second module
against it — use `<zag-machine>` and call `connect()` yourself:

```marko
import * as toast from "@zag-js/toast";
import { connect } from "marko-zag";

<zag-machine/service=() => toast props=() => ({ ...input.options() })/>
<const/api=() => connect(toast, service())/>
```

`<zag-machine>` takes the same input as `<zag>` (`from=`, `props=`, overrides,
the module getter as its value) and returns a **service getter** instead of an
api getter. `<zag>` is exactly this tag plus the `connect` line.

`connect(mod, service, normalize?)` is `mod.connect(service, normalize ??
normalizeProps)`. Passing `normalizeProps` at every call site is the line it
removes, and forgetting it produces subtly broken attributes rather than a
type error — React-dialect `tabIndex` and `onFocus` survive as-is and
misbehave. See [normalizeProps](/api/normalize-props/).

Connecting is a plain `<const>` and not a tag on purpose: Zag's `useMachine`
never learns about `connect`; the author calls `connect` in render code that
re-runs. Marko's re-running render code is `<const>`.

Any number of `<const>`s may derive from one `<zag-machine>`, and the service
getter can be threaded into child components as ordinary tag input when a
child needs the parent's machine.

### Swapping the normalizer

`<zag>` accepts `normalize=` to replace marko-zag's prop normalizer. It takes
a `NormalizeProps<PropTypes>` — the object `createNormalizer` from
`@zag-js/types` returns, **not** a plain function. Omit it and marko-zag's own
`normalizeProps` is used.

```marko
<zag/api=() => dialogMachine from=input normalize=myNormalizer/>
```

With `<zag-machine>`, the equivalent is `connect`'s third argument:
`connect(dialogMachine, service(), myNormalizer)`.

## Composing props with `props=`

`props=` is a **template closure**, and it is the serialization-safe place to
build machine props that cannot cross the tag-input boundary.

- **With `from=`**, it *receives* the picked-and-adapted props and its return
  value is what the machine gets. Layer onto them rather than rebuilding
  them.
- **Without `from=`**, it is called with no argument and its return value is
  used verbatim.
- Exactly one of `from=` / `props=` is required. Neither one throws at setup.

Collections, `@internationalized/date` values and `Color` instances are class
instances whose methods are the whole reason they exist. Passed through
`from=` or as a tag attribute they hit the serialization wall
(`Unable to serialize "input"`). Built inside `props=` — a closure written in
your template — they never cross at all.

```marko
/* select.marko */
import * as select from "@zag-js/select";

export interface Input {
  id?: string;
  items: { value: string; label: string }[];
  value?: string[];
  valueChange?: (value: string[]) => void;
}

<zag/api=() => select from=input props=(picked) => ({
  ...picked,
  collection: select.collection({
    items: input.items,
    itemToValue: (item) => item.value,
    itemToString: (item) => item.label,
  }),
})/>

<div ...api().getRootProps()>
  <button ...api().getTriggerProps()>
    ${api().valueAsString || "pick one"}
  </button>
</div>
```

The same shape covers date pickers and color pickers:

```marko
import * as datePicker from "@zag-js/date-picker";
import { parseDate } from "@internationalized/date";

<zag/api=() => datePicker from=input props=(picked) => ({
  ...picked,
  value: input.dates?.map((d) => parseDate(d)),
})/>
```

```marko
import * as colorPicker from "@zag-js/color-picker";
import { parseColor } from "@zag-js/color-utils";

<zag/api=() => colorPicker from=input props=(picked) => ({
  ...picked,
  value: parseColor(input.color ?? "#000000"),
})/>
```

Because the closure reads reactive values (`input.items`, `input.color`), its
identity changes when they do — which is exactly the signal `<zag>` tracks to
re-notify the machine. No dependency list to write.

## Floating elements

Machines positioned by floating-ui (popover, menu, tooltip, select) need one
extra ingredient: a **static** `style=positionerStyle` after the positioner
spread. See [positionerStyle](/api/positioner-style/) and the
[gotchas page](/guides/gotchas/) for why.
