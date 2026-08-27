// Tests for the connect() helper — the plain-function half of what <zag>
// does, used by components that own the service via <zag-machine>.
//
// The whole point is that the normalizer stops being a per-call-site
// argument. Forgetting it is not a type error (Zag's connect accepts any
// normalizer), it just silently yields React-dialect attributes, so the
// default is the feature.
import { createNormalizer } from "@zag-js/types";
import { describe, expect, it, vi } from "vitest";
import { connect } from "../src/connect.ts";
import { normalizeProps } from "../src/normalize-props.ts";

describe("connect()", () => {
  it("calls the module's connect with the service and marko-zag's normalizeProps", () => {
    const api = { getRootProps: () => ({}) };
    const mod = { connect: vi.fn(() => api), machine: {} as any, props: [] };
    const service = { fake: "service" } as any;

    expect(connect(mod as any, service)).toBe(api);
    // Identity, not shape: normalizeProps is a Proxy with no own keys, so a
    // structural comparison would pass against any empty object.
    expect(mod.connect).toHaveBeenCalledOnce();
    expect(mod.connect.mock.calls[0]![0]).toBe(service);
    expect(mod.connect.mock.calls[0]![1]).toBe(normalizeProps);
  });

  it("passes a supplied normalizer through instead of the default", () => {
    const mine = createNormalizer((props: Record<string, any>) => props) as any;
    const mod = { connect: vi.fn(() => ({})), machine: {} as any, props: [] };

    connect(mod as any, {} as any, mine);
    expect(mod.connect.mock.calls[0]![1]).toBe(mine);
    expect(mod.connect.mock.calls[0]![1]).not.toBe(normalizeProps);
  });

  it("produces a working api against a real machine module", async () => {
    const checkbox = await import("@zag-js/checkbox");
    const { ssrService } = await import("../src/machine.ts");
    const service = ssrService(checkbox.machine, () => ({ id: "cb" }));

    const api = connect(checkbox, service);
    // Normalization actually ran: the root props carry Marko-dialect keys.
    const root = api.getRootProps() as Record<string, unknown>;
    expect(root["data-scope"]).toBe("checkbox");
    expect(root).not.toHaveProperty("tabIndex");
  });
});
