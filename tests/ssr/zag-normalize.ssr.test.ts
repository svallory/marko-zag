// Server-render contract for a CUSTOM `normalize=` on <zag>.
//
// The default normalizer path is covered by zag.ssr.test.ts; this pins the
// OTHER public contract — the docs' "Wrapping it" recipe, where a component
// supplies its own normalizer built with `createNormalizer`. Without this
// test, `normalize=` could stop reaching `connect()` (or start being called
// as a function) and every gate would still pass.
import { describe, expect, it } from "vitest";
import template from "./ssr-zag-normalize.marko";

const render = (input: Record<string, unknown>) =>
  (template as any).render(input).then((res: unknown) => String(res));

describe("<zag> with a custom normalize= under real SSR (node, no DOM)", () => {
  it("routes prop getters through the supplied normalizer", async () => {
    expect(typeof document).toBe("undefined");
    const html = await render({ id: "ssr-norm", defaultChecked: true });

    // The trace only exists if `normalize=` reached the module's connect().
    expect(html).toContain("data-normalized=custom");

    // The wrapped normalizer still delegates, so the real attributes survive.
    expect(html).toContain("data-scope=checkbox");
    expect(html).toContain("data-part=root");
    expect(html).toContain("data-state=checked");
  });
});
