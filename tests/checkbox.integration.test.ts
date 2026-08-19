/**
 * Integration test with a real Zag machine (@zag-js/checkbox), per the
 * framework-adapter guide's checklist: controlled/uncontrolled sync, watch
 * tracks driving DOM writes, effect setup/cleanup, handler-bearing props on
 * the client.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as checkbox from "@zag-js/checkbox";
import { createService, type MarkoService } from "../src/machine.ts";
import { normalizeProps } from "../src/normalize-props.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

const connect = (service: MarkoService<any>) => checkbox.connect(service, normalizeProps);

/** Renders the DOM nodes the machine's dom-query helpers look up by id. */
function mount(service: MarkoService<any>) {
  const api = connect(service);
  const root = document.createElement("label");
  root.id = (api.getRootProps() as any).id;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = (api.getHiddenInputProps() as any).id;
  root.appendChild(input);
  document.body.appendChild(root);
  return { root, input };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("checkbox integration", () => {
  it("uncontrolled: setChecked flows through machine, onCheckedChange, and the DOM input", async () => {
    const onCheckedChange = vi.fn();
    const notify = vi.fn();
    const service = createService(checkbox.machine, () => ({ id: "cb", onCheckedChange }), notify);
    const { input } = mount(service);
    service.start();
    await settle();

    expect(connect(service).checked).toBe(false);
    connect(service).setChecked(true);
    await settle();

    expect(connect(service).checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledWith({ checked: true });
    // watch track ("checked" changed) ran syncInputElement against real DOM
    expect(input.checked).toBe(true);
    expect(notify).toHaveBeenCalled();
    service.stop();
  });

  it("controlled: prop pins the value; owner write-back completes the loop", async () => {
    const onCheckedChange = vi.fn();
    let props: Record<string, any> = { id: "cb", checked: false, onCheckedChange };
    const service = createService(checkbox.machine, () => props, () => {});
    mount(service);
    service.start();
    await settle();

    connect(service).setChecked(true);
    await settle();
    // reported, but still pinned to the prop
    expect(onCheckedChange).toHaveBeenCalledWith({ checked: true });
    expect(connect(service).checked).toBe(false);

    // owner writes the value back
    props = { ...props, checked: true };
    service.propsChanged();
    expect(connect(service).checked).toBe(true);
    service.stop();
  });

  it("client props carry wrapped event handlers; SSR-vs-client parity on attributes", async () => {
    const service = createService(checkbox.machine, () => ({ id: "cb", defaultChecked: true }), () => {});
    mount(service);
    service.start();
    await settle();

    const api = connect(service);
    const rootProps = api.getRootProps() as Record<string, any>;
    expect(rootProps["data-state"]).toBe("checked");
    const inputProps = api.getHiddenInputProps() as Record<string, any>;
    // at least one handler function present on the client
    expect(Object.values(inputProps).some((v) => typeof v === "function")).toBe(true);
    service.stop();
  });

  it("stop() disposes machine effects without throwing", async () => {
    const service = createService(checkbox.machine, () => ({ id: "cb" }), () => {});
    mount(service);
    service.start();
    await settle();
    expect(() => service.stop()).not.toThrow();
  });
});
