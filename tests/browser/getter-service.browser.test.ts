// Real-Chromium tests for the <service> tag's public contract: it returns a
// service GETTER whose identity changes on every machine notify AND on every
// change to a value read inside the caller's `props` closure, so a plain
// `<const/api=() => m.connect(service(), normalizeProps)/>` recomputes with no
// hand-written dependency list.
//
// These go through real Marko compilation and mounting on purpose. The
// mechanism under test is Marko's own `_const` identity dedupe — a jsdom test
// calling createService directly would not exercise it at all.
import { beforeEach, describe, expect, it } from "vitest";
import ServiceCheckbox from "./fixtures/service-checkbox.marko";
import ServiceQr from "./fixtures/service-qr.marko";

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

let container: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

describe("<service> returns a getter (real Chromium)", () => {
  it("a machine transition yields a fresh getter, and the derived <const> recomputes", async () => {
    ServiceCheckbox.mount({ id: "sv-cb" }, container);
    await settle();

    const root = container.querySelector<HTMLElement>(".fx-root")!;
    const input = container.querySelector<HTMLInputElement>(".fx-input")!;
    const state = container.querySelector<HTMLElement>(".fx-state")!;
    expect(root.getAttribute("data-state")).toBe("unchecked");
    expect(state.textContent).toBe("off");

    // A real user interaction drives a real machine transition.
    input.click();
    await settle();

    // If the getter kept its identity, `api` would not recompute and every
    // one of these would still read the initial (unchecked) values.
    expect(root.getAttribute("data-state")).toBe("checked");
    expect(state.textContent).toBe("on");
    expect(input.checked).toBe(true);

    // Repeated transitions keep propagating — identity is fresh each time,
    // not merely once.
    input.click();
    await settle();
    expect(root.getAttribute("data-state")).toBe("unchecked");
    expect(state.textContent).toBe("off");

    input.click();
    await settle();
    expect(root.getAttribute("data-state")).toBe("checked");
    expect(state.textContent).toBe("on");
  });

  it("a controlled prop feeding ONLY computed(...) still recomputes api", async () => {
    // qr-code's `value` prop produces no bindable write and no transition, so
    // the machine never notifies. The props closure identity is stable here
    // (written inline in the fixture, reading a <let>), so the `props()`
    // dependency inside <service> is the ONLY thing that can invalidate the
    // getter — which is exactly the path that historically went stale.
    ServiceQr.mount({ id: "sv-qr", value: "https://a.example" }, container);
    await settle();

    const before = container.querySelector<SVGPathElement>(".fx-qr-pattern")!.getAttribute("d")!;
    expect(before).toBeTruthy();

    container.querySelector<HTMLButtonElement>(".fx-qr-set")!.click();
    await settle();

    const after = container.querySelector<SVGPathElement>(".fx-qr-pattern")!.getAttribute("d")!;
    expect(after).toBeTruthy();
    // The encoded pattern is a pure computed() of prop("value"); a stale api
    // would leave `d` byte-identical.
    expect(after).not.toBe(before);
  });

  it("renders correct initial attributes before mount completes (ssr fallback path)", async () => {
    // Synchronously after mount() — before the machine has started — the
    // getter must already return a usable never-started service, so the
    // markup is correct rather than empty or crashed.
    ServiceCheckbox.mount({ id: "sv-cb2", defaultChecked: true }, container);

    const root = container.querySelector<HTMLElement>(".fx-root")!;
    expect(root).toBeTruthy();
    expect(root.getAttribute("data-scope")).toBe("checkbox");
    expect(root.getAttribute("data-state")).toBe("checked");

    await settle();
    // and stays correct once the real service takes over
    expect(container.querySelector(".fx-root")!.getAttribute("data-state")).toBe("checked");
  });
});
