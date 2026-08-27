// Server-render contract for `from=` + `props=` composition on <zag>.
//
// Two things only a real render shows:
//   1. The object `props=` returns actually reaches the machine — a
//      ListCollection built in the template drives the api's own reads.
//   2. Nothing function-bearing lands in the resume payload. A collection
//      passed as tag INPUT would throw `Unable to serialize`; built inside
//      the closure it never crosses, so the render succeeds AND the payload
//      stays clean.
import { describe, expect, it } from "vitest";
import template from "./ssr-zag-props.marko";

const items = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
];

const render = (input: Record<string, unknown>) =>
  (template as any).render(input).then((res: unknown) => String(res));

describe("<zag> from= + props= under real SSR (node, no DOM)", () => {
  it("renders without throwing, proving the collection never crossed tag input", async () => {
    expect(typeof document).toBe("undefined");
    const html = await render({ id: "sel", items });
    expect(html).toContain("data-scope=select");
    expect(html).toContain("data-part=root");
  });

  it("feeds the closure's return value to the machine (collection drives the api)", async () => {
    // `value` is picked out of `from=`; resolving it to a LABEL is only
    // possible through the collection built inside props=.
    const html = await render({ id: "sel", items, value: ["b"] });
    expect(html).toContain("Banana");
    expect(html).not.toContain("pick one");
  });

  it("serializes no function-bearing collection into the resume payload", async () => {
    const html = await render({ id: "sel", items, value: ["a"] });
    for (const leak of ["itemToValue", "itemToString", "isItemDisabled", "firstValue"]) {
      expect(html).not.toContain(leak);
    }
  });
});
