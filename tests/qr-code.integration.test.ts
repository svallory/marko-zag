/**
 * Pins the machine-side fact the <zag-machine> getter's props dependency exists
 * for: @zag-js/qr-code's `value` prop feeds ONLY `computed(...)`.
 *
 * Changing it performs no bindable write and triggers no state transition, so
 * the machine never calls `notify`. Anything deriving from the service that
 * invalidates only on machine notification therefore goes stale — this is the
 * regression marko-ui hit in 79ff534f. The browser-level counterpart is
 * tests/browser/getter-service.browser.test.ts.
 */
import { describe, expect, it } from "vitest";
import * as qrCode from "@zag-js/qr-code";
import { createService } from "../src/machine.ts";
import { normalizeProps } from "../src/normalize-props.ts";

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("qr-code: a prop that feeds only computed(...)", () => {
  it("changing `value` never notifies the machine, yet changes the encoded pattern", async () => {
    let props: Record<string, any> = { id: "qr", value: "https://a.example" };
    let notifies = 0;
    const service = createService(qrCode.machine, () => props, () => { notifies += 1 });
    service.start();
    await settle();

    const pattern = () => (qrCode.connect(service, normalizeProps).getPatternProps() as any).d as string;
    const before = pattern();
    const notifiesAfterStart = notifies;

    props = { ...props, value: "https://a-much-longer-value.example/path" };
    await settle();

    // No bindable write, no transition: the machine has nothing to report.
    expect(notifies).toBe(notifiesAfterStart);

    // But the derived value genuinely differs, so a consumer that only
    // invalidates on notify would render a stale QR code indefinitely.
    service.propsChanged();
    const after = pattern();
    expect(after).not.toBe(before);
    expect(notifies).toBe(notifiesAfterStart + 1);

    service.stop();
  });
});
