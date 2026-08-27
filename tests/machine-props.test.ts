// Unit tests for the props-building rules that <zag> and <zag-machine>
// apply, exercised against the pure functions rather than through a template
// (the rules are the contract; the tags are two thin call sites).
//
// The interesting half is the DEFAULT CALLBACK RULE. Zag reports changes as
// `onCheckedChange(details)`; Marko's `checked:=state` bind shorthand
// compiles to `checkedChange(value)`. Wiring both by hand was the single most
// repeated line in adapter components, so it became the default — but only
// where the details object actually carries the key. These tests pin both
// the sugar and, just as importantly, where it must NOT appear.
import { describe, expect, it, vi } from "vitest";
import { adaptChangeCallback, buildMachineProps } from "../src/machine-props.ts";

describe("adaptChangeCallback — the onXChange default", () => {
  it("forwards the details object to the machine callback and unwraps for the sugar", () => {
    const onCheckedChange = vi.fn();
    const checkedChange = vi.fn();
    const from = { onCheckedChange, checkedChange };

    const adapted = adaptChangeCallback("onCheckedChange", from)!;
    adapted({ checked: true });

    // The machine callback keeps Zag's own signature...
    expect(onCheckedChange).toHaveBeenCalledWith({ checked: true });
    // ...and the two-way sugar receives the unwrapped value.
    expect(checkedChange).toHaveBeenCalledWith(true);
  });

  it("derives the key by lowercasing only the first letter (onValueChange -> value)", () => {
    const valueChange = vi.fn();
    const adapted = adaptChangeCallback("onValueChange", { valueChange })!;
    adapted({ value: ["a"] });
    expect(valueChange).toHaveBeenCalledWith(["a"]);
  });

  // Adapting a callback the component never asked for would install a live
  // handler on every machine callback prop, which Zag reads as "controlled".
  it("adapts nothing when the component supplied neither half", () => {
    expect(adaptChangeCallback("onCheckedChange", {})).toBeUndefined();
  });

  it("adapts when only the Marko bind sugar is supplied (the common case)", () => {
    const checkedChange = vi.fn();
    const adapted = adaptChangeCallback("onCheckedChange", { checkedChange })!;
    adapted({ checked: true });
    expect(checkedChange).toHaveBeenCalledWith(true);
  });

  it("still forwards to the machine callback when only it is supplied", () => {
    const onOpenChange = vi.fn();
    const adapted = adaptChangeCallback("onOpenChange", { onOpenChange })!;
    adapted({ open: true });
    expect(onOpenChange).toHaveBeenCalledWith({ open: true });
  });

  // The guard that keeps the rule honest. `onTriggerValueChange` would derive
  // the key `triggerValue`, but Zag puts the payload on `details.value` — so
  // there is nothing to unwrap and the sugar must stay silent rather than
  // hand the component `undefined`.
  it("adds no sugar when the derived key is absent from details", () => {
    const triggerValueChange = vi.fn();
    const onTriggerValueChange = vi.fn();
    const adapted = adaptChangeCallback("onTriggerValueChange", {
      onTriggerValueChange,
      triggerValueChange,
    })!;
    adapted({ value: "x" });

    expect(onTriggerValueChange).toHaveBeenCalledWith({ value: "x" });
    expect(triggerValueChange).not.toHaveBeenCalled();
  });

  it.each([
    ["onValueComplete", { value: "v" }, "valueCompleteChange"],
    ["onPositionChangeEnd", { position: 1 }, "positionChangeEndChange"],
  ])("leaves %s alone — it does not match the onXChange shape", (name, details, sugar) => {
    const sugarFn = vi.fn();
    expect(adaptChangeCallback(name, { [sugar]: sugarFn })).toBeUndefined();
  });

  it.each(["onSelect", "onValueCommit", "onComplete", "onResizeStart"])(
    "returns undefined for %s (non-Change callbacks pass through untouched)",
    (name) => {
      expect(adaptChangeCallback(name, {})).toBeUndefined();
    },
  );
});

describe("buildMachineProps", () => {
  const names = ["checked", "defaultChecked", "disabled", "onCheckedChange"] as const;

  it("picks only the machine-owned names out of the input", () => {
    const built = buildMachineProps(
      { checked: true, disabled: false, class: "mine", content: "body" },
      names,
      {},
      "gen-1",
    );
    expect(built).toEqual({ id: "gen-1", checked: true, disabled: false });
    expect(built).not.toHaveProperty("class");
    expect(built).not.toHaveProperty("content");
  });

  it("skips names the input does not carry (undefined is not a value)", () => {
    const built = buildMachineProps({ checked: undefined }, names, {}, "gen-1");
    expect(built).not.toHaveProperty("checked");
  });

  it("injects a generated id, and lets the input override it", () => {
    expect(buildMachineProps({}, names, {}, "gen-1").id).toBe("gen-1");
    expect(buildMachineProps({ id: "mine" }, names, {}, "gen-1").id).toBe("mine");
  });

  it("picks a callback the input supplies only as bind sugar", () => {
    const checkedChange = vi.fn();
    const built = buildMachineProps({ checkedChange }, names, {}, "gen-1");
    // `onCheckedChange` is absent from the input entirely — the machine prop
    // exists only because the rule generated it.
    expect(typeof built.onCheckedChange).toBe("function");
    built.onCheckedChange({ checked: true });
    expect(checkedChange).toHaveBeenCalledWith(true);
  });

  it("leaves a callback prop absent when neither half is supplied", () => {
    const built = buildMachineProps({ checked: true }, names, {}, "gen-1");
    expect(built).not.toHaveProperty("onCheckedChange");
  });

  it("wraps a picked onXChange callback with the sugar adapter", () => {
    const onCheckedChange = vi.fn();
    const checkedChange = vi.fn();
    const built = buildMachineProps({ onCheckedChange, checkedChange }, names, {}, "gen-1");

    // Not the same function — it has been adapted.
    expect(built.onCheckedChange).not.toBe(onCheckedChange);
    built.onCheckedChange({ checked: false });
    expect(onCheckedChange).toHaveBeenCalledWith({ checked: false });
    expect(checkedChange).toHaveBeenCalledWith(false);
  });

  it("lets an override replace the default-adapted callback entirely", () => {
    const onCheckedChange = vi.fn();
    const checkedChange = vi.fn();
    const override = vi.fn();
    const built = buildMachineProps(
      { onCheckedChange, checkedChange },
      names,
      { onCheckedChange: override },
      "gen-1",
    );

    built.onCheckedChange({ checked: true });
    expect(override).toHaveBeenCalledWith({ checked: true });
    // The override replaces the wrapper outright — no implicit forwarding.
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(checkedChange).not.toHaveBeenCalled();
  });

  it("lets a plain value override win over the picked input value", () => {
    const built = buildMachineProps({ disabled: false }, names, { disabled: true }, "gen-1");
    expect(built.disabled).toBe(true);
  });
});
