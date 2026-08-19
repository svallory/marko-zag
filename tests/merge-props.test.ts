import { describe, expect, it, vi } from "vitest";
import { mergeProps } from "../src/merge-props.ts";

describe("mergeProps", () => {
  it("chains on* handlers instead of overwriting (later runs first)", () => {
    const order: string[] = [];
    const merged = mergeProps(
      { onClick: () => order.push("zag") },
      { onClick: () => order.push("user") },
    );
    merged.onClick(new Event("click"));
    expect(order).toEqual(["user", "zag"]);
  });

  it("forwards handler arguments (Marko passes the element as 2nd arg)", () => {
    const fn = vi.fn();
    const merged = mergeProps({ onClick: fn }, { onClick: () => {} });
    const ev = new Event("click");
    const el = document.createElement("div");
    merged.onClick(ev, el as any);
    expect(fn).toHaveBeenCalledWith(ev, el);
  });

  it("joins class values", () => {
    const merged = mergeProps({ class: "a" }, { class: "b" });
    expect(merged.class).toBe("a b");
  });

  it("merges style objects and hyphenates camelCase keys", () => {
    const merged = mergeProps(
      { style: { "background-color": "red", "--x": "1px" } },
      { style: { borderColor: "blue" } },
    );
    expect(merged.style).toEqual({
      "background-color": "red",
      "--x": "1px",
      "border-color": "blue",
    });
  });

  it("merges a string style with an object style into one object", () => {
    const merged = mergeProps(
      { style: "color: red; --y: 2px" } as any,
      { style: { fontSize: 12 } } as any,
    );
    expect(merged.style).toEqual({ color: "red", "--y": "2px", "font-size": 12 });
  });

  it("later plain attributes win; undefined does not clobber", () => {
    const merged = mergeProps({ id: "a", title: "t" }, { id: "b", title: undefined } as any);
    expect(merged.id).toBe("b");
    expect(merged.title).toBe("t");
  });
});
