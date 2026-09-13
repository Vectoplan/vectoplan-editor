import assert from "node:assert/strict";
import test from "node:test";
import { createResourceCapture, animationFrameTiming } from "../src/frontend/performance/capture_observability";
import { createGpuCapture } from "../src/frontend/performance/gpu_capture";
import { createPerformanceRecorder } from "../src/frontend/performance/performance_recorder";

const resource = (name: string, startTime: number, duration: number) => ({ name, startTime, duration,
  initiatorType: "fetch", transferSize: 123, responseStart: startTime + 4 }) as PerformanceResourceTiming;

test("resource capture counts in-flight completions and bounds details independently of the browser resource buffer", () => {
  const capture = createResourceCapture(100, 2);
  capture.add([resource("before", 80, 40), resource("during", 101, 20), resource("excess", 102, 80)]);
  const result = capture.summary();
  assert.equal(result.count, 3); assert.equal(result.startedBeforeCaptureCount, 1);
  assert.equal(result.totalTransferBytes, 369); assert.equal(result.totalDurationMs, 140);
  assert.equal(result.omittedDetails, 1); assert.equal(result.slowest.length, 2);
});

test("frame callback lateness is separate from rAF timestamp and time since requesting the callback", () => {
  assert.deepEqual(animationFrameTiming(500, 80, 720), { rafRequestedAtMs: 80, callbackStartedAtMs: 720,
    callbackLatenessMs: 220, requestToCallbackMs: 640 });
  assert.equal(animationFrameTiming(50, null, 50).requestToCallbackMs, null);
});

function fakeGl(supported = true) {
  const queries: Array<{ available: boolean; nanoseconds: number; deleted: boolean }> = [];
  const reads: number[] = [];
  const gl = {
    VENDOR: 1, RENDERER: 2, VERSION: 3, SHADING_LANGUAGE_VERSION: 4, MAX_TEXTURE_SIZE: 5, MAX_RENDERBUFFER_SIZE: 6,
    QUERY_RESULT_AVAILABLE: 7, QUERY_RESULT: 8, CURRENT_QUERY: 9,
    disjoint: false, current: null as unknown, queries, reads,
    getExtension: (name: string) => name === "EXT_disjoint_timer_query_webgl2" && supported ? { TIME_ELAPSED_EXT: 10, GPU_DISJOINT_EXT: 11 } : null,
    getParameter: (parameter: number) => parameter === 11 ? gl.disjoint : "fixture",
    getContextAttributes: () => ({ antialias: false }), isContextLost: () => false,
    getQuery: () => gl.current,
    createQuery: () => { const query = { available: false, nanoseconds: 7_500_000, deleted: false }; queries.push(query); return query; },
    beginQuery: (_: number, query: unknown) => { gl.current = query; }, endQuery: () => { gl.current = null; },
    deleteQuery: (query: typeof queries[number]) => { query.deleted = true; },
    getQueryParameter: (query: typeof queries[number], parameter: number) => {
      reads.push(parameter);
      if (parameter === 8) assert.equal(query.available, true, "Unready GPU result must never be read");
      return parameter === 7 ? query.available : query.nanoseconds;
    },
  };
  return gl;
}

test("GPU timing never reads unready results, reports actual elapsed milliseconds and deletes pending queries on stop", () => {
  const gl = fakeGl(), results: any[] = [];
  const capture = createGpuCapture(gl as any, sample => results.push(sample));
  capture.beginFrame(10); capture.endFrame(); capture.beginFrame(20); capture.endFrame();
  assert.equal(gl.reads.includes(gl.QUERY_RESULT), false);
  gl.queries[0]!.available = true;
  capture.beginFrame(30); capture.endFrame();
  assert.equal(results.length, 1); assert.equal(results[0].frameAtMs, 10); assert.equal(results[0].durationMs, 7.5);
  const summary = capture.finish();
  assert.equal(summary.averageMs, 7.5); assert.equal(summary.unresolvedCount, 2);
  assert.ok(gl.queries.every(query => query.deleted));
});

test("GPU query backlog is bounded and disjoint readings are discarded instead of reported as valid GPU time", () => {
  const gl = fakeGl(), results: any[] = [], capture = createGpuCapture(gl as any, sample => results.push(sample));
  for (let index = 0; index < 8; index++) { capture.beginFrame(index); capture.endFrame(); }
  assert.equal(gl.queries.length, 4);
  gl.disjoint = true; gl.queries.forEach(query => query.available = true);
  capture.beginFrame(9); capture.endFrame();
  assert.equal(results.length, 0); assert.equal(gl.queries.length, 4);
  const summary = capture.finish(); assert.equal(summary.discardedCount, 4); assert.ok(summary.disjointCount > 0);
});

test("unsupported GPU timers do not manufacture zero-duration samples or touch query APIs", () => {
  const gl = fakeGl(false), capture = createGpuCapture(gl as any, () => assert.fail("unsupported timer sample"));
  capture.beginFrame(10); capture.endFrame();
  const summary = capture.finish(); assert.equal(summary.supported, false); assert.equal(summary.averageMs, null);
  assert.equal(gl.queries.length, 0);
});

test("F8 observes new resources, records visibility/focus and support, and drains queued browser entries before stopping", async () => {
  const keys = ["document", "window", "navigator", "PerformanceObserver", "fetch"];
  const descriptors = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  class Observer {
    static supportedEntryTypes = ["longtask", "long-animation-frame", "event", "layout-shift", "resource"];
    static instances = new Map<string, Observer>();
    pending: any[] = []; disconnected = false;
    constructor(readonly callback: (entries: { getEntries(): any[] }) => void) {}
    observe({ type }: { type: string }) { Observer.instances.set(type, this); }
    takeRecords() { return this.pending.splice(0); }
    disconnect() { this.disconnected = true; }
  }
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible", focused: true,
    hasFocus: () => doc.focused, createElement: () => ({ hidden: false, dataset: {}, setAttribute() {}, remove() {} }) });
  const win = Object.assign(new EventTarget(), { self: null as unknown, top: null as unknown, setTimeout, clearTimeout,
    location: { href: "http://isolated-fixture.invalid" }, screen: { width: 800, height: 600 }, devicePixelRatio: 1 });
  win.self = win; win.top = win;
  let payload: any;
  const values: Record<string, unknown> = { document: doc, window: win, navigator: { userAgent: "isolated-test", hardwareConcurrency: 1 },
    PerformanceObserver: Observer, fetch: async (_url: unknown, options: any) => {
      payload = JSON.parse(options.body); return { ok: true, json: async () => ({ captureId: "isolated-unit" }) };
    } };
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, configurable: true });
  let recorder: ReturnType<typeof createPerformanceRecorder> | null = null;
  try {
    const dataset: Record<string, string> = {};
    recorder = createPerformanceRecorder({ root: { dataset } as any, host: { append() {} } as any,
      projectId: "isolated-test", worldId: "isolated-test" });
    recorder.start("unit");
    const sample = { atMs: 1, frameMs: 16, phases: {}, input: {}, camera: {}, renderer: {}, world: {}, edits: {}, shadows: {} } as any;
    dataset.worldEditActive = "true"; dataset.worldEditBusy = "true";
    dataset.worldEditPlanningDraftPresent = "true"; dataset.worldEditPlanningGenerationPending = "true";
    recorder.recordFrame(sample);
    dataset.worldEditActive = "false"; dataset.worldEditBusy = "false";
    recorder.recordFrame({ ...sample, atMs: 2 });
    dataset.worldEditPlanningDraftPresent = "false"; dataset.worldEditPlanningGenerationPending = "false";
    recorder.recordFrame({ ...sample, atMs: 3 });
    Observer.instances.get("resource")!.pending.push(resource("during", performance.now(), 25));
    Observer.instances.get("long-animation-frame")!.pending.push({ name: "long-animation-frame", startTime: 20, duration: 55, scripts: [] });
    doc.visibilityState = "hidden"; doc.dispatchEvent(new Event("visibilitychange"));
    doc.focused = false; win.dispatchEvent(new Event("blur"));
    doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange"));
    doc.focused = true; win.dispatchEvent(new Event("focus"));
    await recorder.stop("unit-complete");
    const events = payload.events;
    assert.deepEqual(payload.frames.map(({ worldEdit }: any) => ({ active: worldEdit.active, busy: worldEdit.busy,
      draftPresent: worldEdit.draftPresent, pendingGeneration: worldEdit.pendingGeneration })), [
      { active: true, busy: true, draftPresent: true, pendingGeneration: true },
      { active: false, busy: false, draftPresent: true, pendingGeneration: true },
      { active: false, busy: false, draftPresent: false, pendingGeneration: false },
    ], "F8 must distinguish an inactive tool with pending fallback from a completed handoff");
    assert.equal(events.find((event: any) => event.type === "capture-resources").detail.count, 1);
    assert.equal(events.find((event: any) => event.type === "capture-resources").detail.source, "performance-observer");
    assert.equal(events.filter((event: any) => event.phase === "visibilitychange").length, 2);
    assert.ok(events.some((event: any) => event.phase === "blur")); assert.ok(events.some((event: any) => event.phase === "focus"));
    assert.ok(events.some((event: any) => event.type === "browser-long-animation-frame"), "Stop must drain unreported LoAF records");
    assert.deepEqual(events.find((event: any) => event.type === "capture-observers").detail.resource, { supported: true, active: true });
    assert.ok([...Observer.instances.values()].every(observer => observer.disconnected));
  } finally {
    recorder?.destroy();
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; }
  }
});
