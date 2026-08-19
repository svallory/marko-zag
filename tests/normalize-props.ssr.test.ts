// @vitest-environment node
//
// The SSR branch of normalizeProps is decided at module load time
// (`typeof document === "undefined"`), so it needs a document-less
// environment and a fresh module instance.
import { describe, expect, it } from "vitest";

describe("normalizeProps (SSR)", () => {
  it("strips every function value on the server", async () => {
    expect(typeof document).toBe("undefined");
    const { normalizeProps } = await import("../src/normalize-props.ts");
    const out = normalizeProps.element({
      id: "x",
      onClick: () => {},
      onChange: () => {},
      "aria-expanded": false,
      style: { backgroundColor: "red" },
    } as any) as any;
    expect(out.onClick).toBeUndefined();
    expect(out.onInput).toBeUndefined();
    expect(out.id).toBe("x");
    expect(out["aria-expanded"]).toBe("false");
    expect(out.style).toEqual({ "background-color": "red" });
  });
});
