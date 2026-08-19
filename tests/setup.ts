// jsdom lacks requestAnimationFrame unless pretendToBeVisual is on; the
// machine's effect scheduler defers entry effects by two rAFs, so tests need
// a working (timer-based) implementation.
if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
