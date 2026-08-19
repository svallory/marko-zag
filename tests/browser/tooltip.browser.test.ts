// Real-Chromium integration test for @zag-js/tooltip: jsdom cannot run
// floating-ui/popper's layout math (getBoundingClientRect etc.) nor real
// pointer/focus timing, so this drives an actual DOM in a real browser via
// vitest browser mode (see vitest.browser.config.ts).
import { beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "@vitest/browser/context";
import * as tooltip from "@zag-js/tooltip";
import { createService, type MarkoService } from "../../src/machine.ts";
import { normalizeProps } from "../../src/normalize-props.ts";

const settle = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

const connect = (service: MarkoService<any>) => tooltip.connect(service, normalizeProps);

/** Builds trigger/positioner/content DOM nodes from the api's prop getters. */
function mount(service: MarkoService<any>) {
  const api = connect(service);

  const trigger = document.createElement("button");
  Object.assign(trigger, { textContent: "Hover me" });
  applyProps(trigger, api.getTriggerProps());
  // pin the trigger near the top-left so floating-ui has real geometry to
  // compute against instead of a 0x0 rect
  trigger.style.position = "fixed";
  trigger.style.top = "20px";
  trigger.style.left = "20px";

  const positioner = document.createElement("div");
  applyProps(positioner, api.getPositionerProps());

  const content = document.createElement("div");
  content.textContent = "Tooltip content";
  applyProps(content, api.getContentProps());

  positioner.appendChild(content);
  document.body.appendChild(trigger);
  document.body.appendChild(positioner);

  return { trigger, positioner, content };
}

/** Per-element registry of the listeners applyProps last attached, so a
 * re-render (fresh handler closures each connect() call) doesn't pile up
 * duplicate listeners on the same DOM node. */
const attachedListeners = new WeakMap<HTMLElement, Record<string, EventListener>>();

/** Spreads a normalized prop object onto a real element (attrs + handlers). */
function applyProps(el: HTMLElement, props: Record<string, any>) {
  const prevListeners = attachedListeners.get(el) ?? {};
  const nextListeners: Record<string, EventListener> = {};
  for (const key in props) {
    const value = props[key];
    if (key === "style" && typeof value === "object" && value) {
      Object.assign(el.style, value);
      continue;
    }
    if (/^on[A-Z]/.test(key) && typeof value === "function") {
      const domEvent = key.slice(2).toLowerCase();
      const listener: EventListener = (e) => value(e, el);
      nextListeners[domEvent] = listener;
      continue;
    }
    if (key === "id") {
      if (value !== undefined) el.id = value;
      continue;
    }
    // boolean HTML attrs: presence-only, like Marko's own runtime.
    if (value === undefined || value === null || value === false) {
      el.removeAttribute(key);
      continue;
    }
    el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const domEvent in prevListeners) el.removeEventListener(domEvent, prevListeners[domEvent]!);
  for (const domEvent in nextListeners) el.addEventListener(domEvent, nextListeners[domEvent]!);
  attachedListeners.set(el, nextListeners);
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("tooltip integration (real Chromium)", () => {
  it("opens on pointer move (after openDelay) and closes on pointer leave", async () => {
    const service = createService(
      tooltip.machine,
      () => ({ id: "tt", openDelay: 10, closeDelay: 10 }),
      () => {},
    );
    const { trigger } = mount(service);
    service.start();
    await settle();

    expect(connect(service).open).toBe(false);

    trigger.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
    await settle(200);

    expect(connect(service).open).toBe(true);

    trigger.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true, pointerType: "mouse" }));
    await settle(200);

    expect(connect(service).open).toBe(false);
    service.stop();
  });

  it("opens on trigger focus (real keyboard Tab) and closes on blur", async () => {
    const service = createService(
      tooltip.machine,
      () => ({ id: "tt2", openDelay: 0, closeDelay: 0 }),
      () => {},
    );
    const { trigger } = mount(service);
    service.start();
    await settle();

    // Zag's tooltip only opens on focus when focus-visible (keyboard/virtual
    // modality) — a synthetic FocusEvent isn't trusted and won't flip the
    // focus-visible tracker, so drive a real Tab keypress via Playwright.
    await userEvent.tab();
    while (document.activeElement !== trigger) await userEvent.tab();
    await settle(100);
    expect(connect(service).open).toBe(true);

    await userEvent.tab();
    await settle(100);
    expect(connect(service).open).toBe(false);
    service.stop();
  });

  it("positions the positioner with real floating-ui layout once open", async () => {
    const service = createService(
      tooltip.machine,
      () => ({ id: "tt3", openDelay: 0, closeDelay: 0 }),
      () => {},
    );
    const { trigger, positioner } = mount(service);
    service.start();
    await settle();

    trigger.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
    // give the machine's open transition AND the popper effect's async
    // getPlacement (two rAFs in the adapter, plus floating-ui's own compute)
    // time to settle.
    await settle(300);

    expect(connect(service).open).toBe(true);

    // rebuild the DOM props from the now-open api and re-apply, mirroring
    // what a re-render would do (positioner style/data-placement change
    // once currentPlacement resolves).
    const api = connect(service);
    applyProps(positioner, api.getPositionerProps());
    const content = positioner.firstElementChild as HTMLElement;
    applyProps(content, api.getContentProps());

    expect(content.getAttribute("data-placement")).toBeTruthy();
    expect(positioner.style.getPropertyValue("--x")).not.toBe("");
    expect(positioner.style.getPropertyValue("--y")).not.toBe("");

    service.stop();
  });
});
