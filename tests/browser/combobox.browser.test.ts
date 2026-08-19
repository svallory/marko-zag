// Real-Chromium integration test for @zag-js/combobox: exercises a real
// collection, open/close via the api, highlight navigation, and value
// selection updating api.value — all against actual DOM nodes.
import { beforeEach, describe, expect, it } from "vitest";
import * as combobox from "@zag-js/combobox";
import { createService, type MarkoService } from "../../src/machine.ts";
import { normalizeProps } from "../../src/normalize-props.ts";

const settle = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

const items = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Cherry", value: "cherry" },
];

const collection = combobox.collection({
  items,
  itemToString: (item) => item.label,
  itemToValue: (item) => item.value,
});

const connect = (service: MarkoService<any>) => combobox.connect(service, normalizeProps);

/** Per-element registry of the listeners applyProps last attached, so a
 * re-render (fresh handler closures each connect() call) doesn't pile up
 * duplicate listeners on the same DOM node. */
const attachedListeners = new WeakMap<HTMLElement, Record<string, EventListener>>();

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
    if (key === "value" && el instanceof HTMLInputElement) {
      if (value !== undefined) el.value = value;
      continue;
    }
    // boolean HTML attrs (hidden, disabled, …): presence-only, like Marko's
    // own runtime — `false`/`null`/`undefined` means "absent".
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

/** Builds root/input/content/item DOM from the api's prop getters. */
function mount(service: MarkoService<any>) {
  const api = connect(service);

  const input = document.createElement("input");
  applyProps(input, api.getInputProps());

  const content = document.createElement("div");
  applyProps(content, api.getContentProps());

  const itemEls = items.map((item) => {
    const el = document.createElement("div");
    applyProps(el, api.getItemProps({ item }));
    el.textContent = item.label;
    content.appendChild(el);
    return el;
  });

  document.body.appendChild(input);
  document.body.appendChild(content);

  return { input, content, itemEls };
}

/** Re-renders DOM props from the latest api snapshot (mirrors reactive re-render). */
function rerender(service: MarkoService<any>, dom: ReturnType<typeof mount>) {
  const api = connect(service);
  applyProps(dom.input, api.getInputProps());
  applyProps(dom.content, api.getContentProps());
  items.forEach((item, i) => applyProps(dom.itemEls[i]!, api.getItemProps({ item })));
  return api;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("combobox integration (real Chromium)", () => {
  it("opens via api.setOpen and reflects content/listbox attrs", async () => {
    const service = createService(combobox.machine, () => ({ id: "cb", collection }), () => {});
    const dom = mount(service);
    service.start();
    await settle();

    expect(connect(service).open).toBe(false);
    connect(service).setOpen(true);
    await settle();

    const api = rerender(service, dom);
    expect(api.open).toBe(true);
    expect(dom.content.getAttribute("data-state")).toBe("open");
    expect(dom.content.hasAttribute("hidden")).toBe(false);
    service.stop();
  });

  it("opens via real input interaction (click) too", async () => {
    // openOnClick defaults to false in @zag-js/combobox; opt in explicitly
    // to exercise the click-driven open path.
    const service = createService(
      combobox.machine,
      () => ({ id: "cb2", collection, openOnClick: true }),
      () => {},
    );
    const dom = mount(service);
    service.start();
    await settle();

    dom.input.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await settle();

    const api = rerender(service, dom);
    expect(api.open).toBe(true);
    service.stop();
  });

  it("highlight navigation moves through items via keyboard handler calls", async () => {
    const service = createService(combobox.machine, () => ({ id: "cb3", collection }), () => {});
    const dom = mount(service);
    service.start();
    await settle();

    connect(service).setOpen(true);
    await settle();
    rerender(service, dom);

    dom.input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    await settle();
    let api = rerender(service, dom);
    expect(api.highlightedValue).toBe("apple");

    dom.input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    await settle();
    api = rerender(service, dom);
    expect(api.highlightedValue).toBe("banana");

    service.stop();
  });

  it("selecting an item (via api) updates api.value", async () => {
    const service = createService(combobox.machine, () => ({ id: "cb4", collection }), () => {});
    const dom = mount(service);
    service.start();
    await settle();

    connect(service).setOpen(true);
    await settle();
    rerender(service, dom);

    connect(service).selectValue("banana");
    await settle();

    const api = rerender(service, dom);
    expect(api.value).toEqual(["banana"]);
    expect(api.valueAsString).toBe("Banana");
    service.stop();
  });

  it("selecting an item via real click on the item element updates value", async () => {
    const service = createService(combobox.machine, () => ({ id: "cb5", collection }), () => {});
    const dom = mount(service);
    service.start();
    await settle();

    connect(service).setOpen(true);
    await settle();
    rerender(service, dom);

    dom.itemEls[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await settle();

    const api = rerender(service, dom);
    expect(api.value).toEqual(["cherry"]);
    service.stop();
  });
});
