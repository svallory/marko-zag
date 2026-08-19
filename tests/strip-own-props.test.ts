import { describe, expect, it } from "vitest";
import { stripOwnProps } from "../src/native-attrs.ts";

describe("stripOwnProps", () => {
  it("removes listed keys and keeps everything else", () => {
    const source = {
      class: "btn",
      valueChange: () => {},
      "data-testid": "x",
      title: "hi",
      tabindex: 0,
    };
    const out = stripOwnProps(source, "class", "valueChange");
    expect(out).toEqual({ "data-testid": "x", title: "hi", tabindex: 0 });
  });

  it("does not mutate the source object", () => {
    const source = { a: 1, b: 2 };
    stripOwnProps(source, "a");
    expect(source).toEqual({ a: 1, b: 2 });
  });

  it("stripping zero keys returns a shallow copy", () => {
    const source = { a: 1 };
    const out = stripOwnProps(source);
    expect(out).toEqual(source);
    expect(out).not.toBe(source);
  });
});
