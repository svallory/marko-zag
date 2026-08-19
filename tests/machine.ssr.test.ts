// @vitest-environment node
//
// SSR contract: a never-started service plus connect() must yield correct
// initial attributes with zero DOM access.
import { describe, expect, it } from "vitest";
import * as checkbox from "@zag-js/checkbox";

describe("ssrService (node, no DOM)", () => {
  it("connect() over a never-started service renders initial attrs without touching the DOM", async () => {
    expect(typeof document).toBe("undefined");
    const { ssrService } = await import("../src/machine.ts");
    const { normalizeProps } = await import("../src/normalize-props.ts");

    const service = ssrService(checkbox.machine, () => ({
      id: "cb1",
      defaultChecked: true,
    }));
    const api = checkbox.connect(service, normalizeProps);

    expect(api.checked).toBe(true);
    const root = api.getRootProps() as Record<string, any>;
    expect(root["data-state"]).toBe("checked");
    // SSR branch strips handlers (unserializable @zag-js functions)
    const input = api.getHiddenInputProps() as Record<string, any>;
    for (const key of Object.keys(input)) {
      expect(typeof input[key]).not.toBe("function");
    }
  });

  it("never runs entry actions or effects on the server", async () => {
    const { ssrService } = await import("../src/machine.ts");
    const { createCounterFixture } = await import("./fixtures/counter-machine.ts");
    const { machine, calls } = createCounterFixture();
    ssrService(machine, () => ({ id: "x" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(calls.actions).toEqual([]);
    expect(calls.effects).toEqual([]);
  });
});
