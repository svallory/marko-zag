import { describe, expect, it, vi } from "vitest";
import { createService } from "../src/machine.ts";
import { createCounterFixture } from "./fixtures/counter-machine.ts";

/** Waits out microtasks, the send() queue, and the double-rAF effect defer. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

function setup(props: Record<string, any> = {}) {
  const { machine, calls } = createCounterFixture();
  const notify = vi.fn();
  let userProps = { id: "c1", ...props };
  const service = createService(machine, () => userProps, notify);
  return {
    calls,
    notify,
    service,
    setProps(next: Record<string, any>) {
      userProps = { id: "c1", ...next };
      service.propsChanged();
    },
  };
}

describe("createService lifecycle", () => {
  it("start() runs root entry actions and (deferred) effects, then notifies", async () => {
    const { service, calls, notify } = setup();
    expect(calls.actions).toEqual([]);
    service.start();
    expect(calls.actions).toEqual(["rootEntry"]);
    expect(calls.effects).toEqual([]); // deferred by two rAFs
    await settle();
    expect(calls.effects).toEqual(["root"]);
    expect(notify).toHaveBeenCalled();
  });

  it("transitions run exit/transition/entry actions in Zag's order", async () => {
    const { service, calls } = setup();
    service.start();
    await settle();
    calls.actions.length = 0;
    service.send({ type: "GO" });
    await settle();
    expect(calls.actions).toEqual(["transition", "activeEntry"]);
    expect(service.state.matches("active")).toBe(true);
    expect(calls.effects).toEqual(["root", "active"]);

    service.send({ type: "STOP" });
    await settle();
    expect(calls.actions).toEqual(["transition", "activeEntry", "activeExit"]);
    expect(calls.cleanups).toEqual(["active"]);
  });

  it("guarded transitions with a false guard do not fire", async () => {
    const { service } = setup();
    service.start();
    await settle();
    service.send({ type: "GUARDED.GO" });
    await settle();
    expect(service.state.matches("idle")).toBe(true);
  });

  it("buffers events sent before start and replays them on start", async () => {
    const { service, calls } = setup();
    service.send({ type: "GO" });
    await settle();
    expect(service.state.matches("idle")).toBe(true); // not started yet
    service.start();
    await settle();
    expect(service.state.matches("active")).toBe(true);
    expect(calls.actions).toContain("transition");
  });

  it("stop() runs effect cleanups and machine exit; later sends are dropped", async () => {
    const { service, calls } = setup();
    service.start();
    await settle();
    service.stop();
    expect(calls.cleanups).toEqual(["root"]);
    expect(calls.actions).toContain("rootExit");
    service.send({ type: "GO" });
    await settle();
    expect(service.state.matches("idle")).toBe(true);
  });

  it("refs hold mutable values without notifying", async () => {
    const { service, notify } = setup();
    service.start();
    await settle();
    notify.mockClear();
    expect(service.refs.get("calls")).toBe(0);
    service.refs.set("calls", 7);
    expect(service.refs.get("calls")).toBe(7);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("bindable context", () => {
  it("uncontrolled: set updates value, fires onChange once, notifies", async () => {
    const onCountChange = vi.fn();
    const { service, notify } = setup({ defaultCount: 5, onCountChange });
    service.start();
    await settle();
    notify.mockClear();
    service.send({ type: "COUNT.INC" });
    await settle();
    expect(service.context.get("count")).toBe(6);
    expect(onCountChange).toHaveBeenCalledTimes(1);
    expect(onCountChange).toHaveBeenCalledWith(6, 5);
    expect(notify).toHaveBeenCalled();
  });

  it("value-equal writes do not fire onChange but still notify (render must happen)", async () => {
    const onCountChange = vi.fn();
    const { service, notify } = setup({ defaultCount: 5, onCountChange });
    service.start();
    await settle();
    notify.mockClear();
    service.send({ type: "COUNT.SET", value: 5 });
    await settle();
    expect(onCountChange).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
  });

  it("controlled: machine reports the change but does not own the value", async () => {
    const onCountChange = vi.fn();
    const { service, setProps } = setup({ count: 10, onCountChange });
    service.start();
    await settle();
    service.send({ type: "COUNT.INC" });
    await settle();
    // change reported to the owner…
    expect(onCountChange).toHaveBeenCalledWith(11, 10);
    // …but the live value still comes from the prop
    expect(service.context.get("count")).toBe(10);
    // owner writes the new value back; prev tracker syncs without re-firing
    onCountChange.mockClear();
    setProps({ count: 11, onCountChange });
    expect(service.context.get("count")).toBe(11);
    expect(onCountChange).not.toHaveBeenCalled();
  });

  it("sync bindables notify synchronously instead of batching on a microtask", async () => {
    const { service, notify } = setup();
    service.start();
    await settle();
    notify.mockClear();
    // context.set on a sync bindable must reach notify before the microtask
    // queue drains — write directly through the context facade.
    service.context.set("text", "abc");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(service.context.get("text")).toBe("abc");
  });

  it("non-sync writes batch: several writes in one tick produce one notify", async () => {
    const { service, notify } = setup();
    service.start();
    await settle();
    notify.mockClear();
    service.context.set("count", 1);
    service.context.set("count", 2);
    service.context.set("count", 3);
    expect(notify).not.toHaveBeenCalled(); // still queued
    await settle();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(service.context.get("count")).toBe(3);
  });
});

describe("watch tracks", () => {
  it("propsChanged re-runs tracks only when tracked deps changed", async () => {
    const { service, calls, setProps } = setup({ label: "a" });
    service.start();
    await settle();
    calls.actions.length = 0;

    setProps({ label: "a" }); // unchanged dep
    expect(calls.actions).not.toContain("labelChanged");

    setProps({ label: "b" }); // changed dep
    expect(calls.actions).toContain("labelChanged");
  });

  it("propsChanged notifies the host", async () => {
    const { service, notify, setProps } = setup({ label: "a" });
    service.start();
    await settle();
    notify.mockClear();
    setProps({ label: "b" });
    expect(notify).toHaveBeenCalled();
  });
});
