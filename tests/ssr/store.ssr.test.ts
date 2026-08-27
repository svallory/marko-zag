// Server-render contract for <zag-store>: a snapshot spread onto an element must
// serialize.
//
// Spreading is what makes the browser reference the getter, and an
// unregistered closure (one built inside an IIFE rather than written directly
// as the <const> value) cannot be serialized — the render dies with
// `Unable to serialize "snap"`. Reading a snapshot in body content never
// triggers it, which is why this went unnoticed; the spread is the point of
// this test.
import { describe, expect, it } from "vitest";
import template from "./ssr-zag-store.marko";

const render = (input: Record<string, unknown>) =>
  (template as any).render(input).then((res: unknown) => String(res));

describe("<zag-store> under real SSR (node, no DOM)", () => {
  it("serializes a snapshot spread onto an element", async () => {
    expect(typeof document).toBe("undefined");
    const html = await render({ label: "toasts" });

    // Marko emits unquoted attribute values where it can.
    expect(html).toContain("data-count=1");
    expect(html).toContain("role=status");
  });

  it("renders the server snapshot in body content too", async () => {
    const html = await render({ label: "toasts" });
    // Marko emits unquoted attribute values where it can.
    expect(html).toContain("class=fx-store");
    expect(html).toContain(">1<");
  });
});
