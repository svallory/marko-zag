// Real Marko rendering test: verifies normalizeProps output, spread onto a
// native tag via Marko's `...` spread, sets input `value`/`checked` as DOM
// PROPERTIES (not just string attributes) and updates reactively. jsdom
// technically has value/checked properties too, but this test compiles and
// mounts actual .marko components through @marko/vite in a real browser —
// exercising Marko's real runtime attr/property-application code path,
// which is what actually decides property vs attribute, not our test code.
import { beforeEach, describe, expect, it } from "vitest";
import CheckboxInput from "./fixtures/checkbox-input.marko";
import ValueInput from "./fixtures/value-input.marko";

const settle = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

let container: HTMLDivElement;

beforeEach(() => {
  document.body.innerHTML = "";
  container = document.createElement("div");
  document.body.appendChild(container);
});

describe("value/checked property semantics through real Marko rendering", () => {
  it("checkbox: hidden input's `checked` is a real DOM property, defaults applied", async () => {
    const mounted = CheckboxInput.mount({ id: "fx-cb", defaultChecked: true }, container);
    await settle();

    const input = container.querySelector<HTMLInputElement>(".fixture-checkbox")!;
    expect(input).toBeTruthy();
    expect(input.type).toBe("checkbox");
    // property, not just attribute presence
    expect(input.checked).toBe(true);

    mounted.destroy();
  });

  it("checkbox: clicking toggles the real DOM checked property reactively", async () => {
    const onCheckedChange = (details: { checked: boolean }) => {
      lastChecked = details.checked;
    };
    let lastChecked: boolean | undefined;
    const mounted = CheckboxInput.mount({ id: "fx-cb2", defaultChecked: false, onCheckedChange }, container);
    await settle();

    const input = container.querySelector<HTMLInputElement>(".fixture-checkbox")!;
    expect(input.checked).toBe(false);

    input.click();
    await settle(200);

    expect(input.checked).toBe(true);
    expect(lastChecked).toBe(true);

    mounted.destroy();
  });

  it("value-input: initial value is set as a DOM property, not merely an attribute string", async () => {
    const mounted = ValueInput.mount({ id: "fx-val", initialValue: "hello" }, container);
    await settle();

    const input = container.querySelector<HTMLInputElement>(".fixture-value-input")!;
    expect(input.value).toBe("hello");

    mounted.destroy();
  });

  it("value-input: typing updates the reactive <let>, which flows back into the value property", async () => {
    const mounted = ValueInput.mount({ id: "fx-val2", initialValue: "" }, container);
    await settle();

    const input = container.querySelector<HTMLInputElement>(".fixture-value-input")!;
    input.focus();
    input.value = "typed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();

    // controlled-value re-render must not clobber what the user just typed
    expect(input.value).toBe("typed");

    mounted.destroy();
  });

  // Marko finding: `value=` without `valueChange` behaves like React's
  // *uncontrolled* input — Marko only sets `defaultValue` past the first
  // mount (see node_modules/marko/dist/dom-*.js `_attr_input_value`). This
  // is exactly the shape normalizeProps produces for a Zag machine (it maps
  // Zag's onChange to onInput, never to Marko's `valueChange`), so an
  // external `<let>` write does NOT re-sync a plain `...normalizeProps`
  // spread's `.value` property.
  it("value-input: plain normalizeProps spread (no valueChange) is uncontrolled after mount — external <let> writes do NOT reach the DOM property", async () => {
    const mounted = ValueInput.mount({ id: "fx-val3", initialValue: "start" }, container);
    await settle();

    const input = container.querySelector<HTMLInputElement>(".fixture-value-input")!;
    const button = container.querySelector<HTMLButtonElement>(".fixture-set-btn")!;
    expect(input.value).toBe("start");

    button.click();
    await settle();

    // still "start": the <let> changed, but Marko didn't re-sync .value
    // because there's no valueChange handler on this input.
    expect(input.value).toBe("start");

    mounted.destroy();
  });

  it("value-input: WITH valueChange wired, the input is genuinely controlled — external <let> writes DO reach the DOM property", async () => {
    const mounted = ValueInput.mount({ id: "fx-val4", initialValue: "start" }, container);
    await settle();

    const controlled = container.querySelector<HTMLInputElement>(".fixture-controlled-input")!;
    const button = container.querySelector<HTMLButtonElement>(".fixture-set-btn")!;
    expect(controlled.value).toBe("start");

    button.click();
    await settle();

    expect(controlled.value).toBe("set-from-button");

    mounted.destroy();
  });
});
