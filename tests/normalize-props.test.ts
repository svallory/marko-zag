import { describe, expect, it, vi } from "vitest";
import { normalizeProps } from "../src/normalize-props.ts";

// createNormalizer exposes the same transform under every element key; the
// element() entry is the generic path machines use most.
const normalize = (props: Record<string, any>) => normalizeProps.element(props as any) as any;

describe("normalizeProps (client)", () => {
  it("renames React-style prop names to Marko attributes", () => {
    const out = normalize({
      className: "root",
      htmlFor: "field-1",
      defaultValue: "hello",
      defaultChecked: true,
      tabIndex: 0,
    });
    expect(out).toMatchObject({
      class: "root",
      for: "field-1",
      value: "hello",
      checked: true,
      tabindex: 0,
    });
    expect(out.className).toBeUndefined();
    expect(out.htmlFor).toBeUndefined();
    expect(out.tabIndex).toBeUndefined();
  });

  it("renames event handlers: change→input, doubleclick→dblclick, focus/blur→focusin/focusout", () => {
    const fn = vi.fn();
    const out = normalize({ onChange: fn, onDoubleClick: fn, onFocus: fn, onBlur: fn });
    expect(typeof out.onInput).toBe("function");
    expect(typeof out.onDblClick).toBe("function");
    expect(typeof out.onFocusin).toBe("function");
    expect(typeof out.onFocusout).toBe("function");
    expect(out.onChange).toBeUndefined();
    expect(out.onFocus).toBeUndefined();
    expect(out.onBlur).toBeUndefined();
  });

  it("shadows event.currentTarget with the element Marko passes as second arg", () => {
    const seen: Array<EventTarget | null> = [];
    const out = normalize({ onClick: (ev: Event) => seen.push(ev.currentTarget) });
    const el = document.createElement("button");
    const event = new Event("click");
    out.onClick(event, el);
    expect(seen[0]).toBe(el);
  });

  it("hyphenates camelCase style keys and preserves custom properties", () => {
    const out = normalize({
      style: {
        backgroundColor: "red",
        "--reference-width": "10px",
        zIndex: 5,
        bogus: { nested: true }, // non string/number: dropped
      },
    });
    expect(out.style).toEqual({
      "background-color": "red",
      "--reference-width": "10px",
      "z-index": 5,
    });
  });

  it("stringifies boolean aria-* values", () => {
    const out = normalize({ "aria-expanded": true, "aria-disabled": false, hidden: true });
    expect(out["aria-expanded"]).toBe("true");
    expect(out["aria-disabled"]).toBe("false");
    // non-aria booleans stay booleans (Marko boolean attributes)
    expect(out.hidden).toBe(true);
  });

  it("drops readOnly:false and children", () => {
    const out = normalize({ readOnly: false, children: "text", id: "x" });
    expect(out).toEqual({ id: "x" });
  });

  it("keeps readOnly when true", () => {
    const out = normalize({ readOnly: true });
    expect(out.readOnly).toBe(true);
  });

  it("preserves case-sensitive SVG attributes", () => {
    const out = normalizeProps.svg({ viewBox: "0 0 24 24", preserveAspectRatio: "none" } as any) as any;
    expect(out.viewBox).toBe("0 0 24 24");
    expect(out.preserveAspectRatio).toBe("none");
  });
});
