// Server-render contract for the <zag> tag, exercised through a REAL
// .marko template compiled by @marko/vite and rendered in Node with no DOM.
//
// Two things must hold, and only a real render shows them:
//   1. `service()` works on the server — it returns a never-started throwaway,
//      so connect() renders correct initial attributes with no DOM access.
//   2. The serialized resume payload carries NO function-bearing service
//      object. Returning the service itself instead of a getter does not throw
//      here: Marko serializes it with every function silently stripped, the
//      page renders fine, and the first client read dies with
//      `TypeError: … is not a function`. The getter is what prevents that.
import { describe, expect, it } from "vitest";
import template from "./ssr-checkbox.marko";

const render = (input: Record<string, unknown>) =>
  (template as any).render(input).then((res: unknown) => String(res));

describe("<zag> under real SSR (node, no DOM)", () => {
  it("renders correct initial attributes from the server-side throwaway service", async () => {
    expect(typeof document).toBe("undefined");
    const html = await render({ id: "ssr-cb", defaultChecked: true });

    // Every one of these is computed by connect() over the never-started
    // service — proof that `service()` is usable on the server.
    // Marko emits unquoted attribute values where it can, hence the bare form.
    expect(html).toContain("data-scope=checkbox");
    expect(html).toContain("data-part=root");
    expect(html).toContain("data-state=checked");
    // Zag namespaces ids by machine scope.
    expect(html).toContain("id=checkbox:ssr-cb");
  });

  it("reflects machine props in the server output (unchecked variant)", async () => {
    const html = await render({ id: "ssr-cb2" });
    expect(html).toContain("data-state=unchecked");
    expect(html).not.toContain("data-state=checked");
  });

  it("serializes no function-bearing service object into the resume payload", async () => {
    const html = await render({ id: "ssr-cb", defaultChecked: true });

    // The tell-tale members of a serialized MarkoService. A getter serializes
    // as a closure reference; the service object graph must never appear.
    for (const leak of ["getStatus", "propsChanged", "machineStatus", "bindablePrevSyncs"]) {
      expect(html).not.toContain(leak);
    }
  });
});

describe("<zag> input validation", () => {
  it("throws a clear error when neither from= nor props= is given", async () => {
    const template = (await import("./ssr-zag-noinput.marko")).default;
    await expect((template as any).render({}).then(String)).rejects.toThrow(
      /requires `from=`.*or `props=`/s,
    );
  });
});
