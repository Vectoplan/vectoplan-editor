import { createResourceCapture } from "./capture_observability";
import { createGpuCapture } from "./gpu_capture";

export interface PerformancePhaseSample {
  readonly cameraPhysicsMs: number;
  readonly targetingMs: number;
  readonly environmentMs: number;
  readonly avatarsHudMs: number;
  readonly renderSubmitMs: number;
  readonly storeStreamMs: number;
  readonly cpuTotalMs: number;
}

export interface PerformanceFrameSample {
  readonly atMs: number;
  readonly frameMs: number;
  readonly timing?: {
    readonly rafRequestedAtMs: number | null;
    readonly callbackStartedAtMs: number;
    readonly callbackLatenessMs: number;
    readonly requestToCallbackMs: number | null;
  };
  readonly phases: PerformancePhaseSample;
  readonly input: {
    readonly lookDeltaX: number;
    readonly lookDeltaY: number;
    readonly lookDeltaMagnitude: number;
    readonly pointerLocked: boolean;
    readonly movementActive: boolean;
    readonly sprinting: boolean;
    readonly inputReadMs: number;
    readonly physicsSimulationMs: number;
    readonly physicsStoreMs: number;
    readonly cameraFinalizeMs: number;
    readonly cameraStoreMs: number;
    readonly physicsSubSteps: number;
  };
  readonly camera: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly yaw: number;
    readonly pitch: number;
  };
  readonly renderer: {
    readonly drawCalls: number;
    readonly triangles: number;
    readonly geometries: number;
    readonly textures: number;
    readonly pixelRatio: number;
    readonly drawingBufferWidth: number;
    readonly drawingBufferHeight: number;
  };
  readonly world: {
    readonly loadedChunks: number;
    readonly renderedChunks: number;
    readonly meshes: number;
    readonly pendingChunkMeshes: number;
    readonly shadowCasters: number;
  };
  readonly edits: {
    readonly placeIntents: number;
    readonly removeIntents: number;
    readonly pendingCommands: number;
    readonly pendingOverlays: number;
    readonly pendingMeshBatchChunks: number;
  };
  readonly shadows: {
    readonly environmentRefreshCount: number;
    readonly environmentRefreshReason: string;
    readonly terrainScanCount: number;
    readonly terrainChangeCount: number;
  };
  readonly worldEdit?: {
    readonly active: boolean;
    readonly tool: string;
    readonly draftPresent?: boolean;
    readonly pendingGeneration?: boolean;
    readonly busy?: boolean;
    readonly clipboardPhase: string;
    readonly clipboardCells: number;
    readonly clipboardGizmoHandles: number;
  };
}

export interface PerformanceActionSample {
  readonly atMs: number;
  readonly type: string;
  readonly phase: string;
  readonly durationMs: number;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface PerformanceRecorderOptions {
  readonly root: HTMLElement;
  readonly host: HTMLElement;
  readonly projectId: string;
  readonly worldId: string;
  readonly durationMs?: number;
  readonly endpoint?: string;
  readonly getGraphicsContext?: () => WebGL2RenderingContext | null;
}

export interface PerformanceRecorderHandle {
  readonly toggle: (reason?: string) => void;
  readonly start: (reason?: string) => void;
  readonly stop: (reason?: string) => Promise<void>;
  readonly recordFrame: (sample: PerformanceFrameSample) => void;
  readonly recordEvent: (
    type: string,
    phase?: string,
    durationMs?: number,
    detail?: Readonly<Record<string, unknown>>,
  ) => void;
  readonly isRecording: () => boolean;
  readonly beginGpuFrame: (frameAtMs: number) => void;
  readonly endGpuFrame: () => void;
  readonly destroy: () => void;
}

const DEFAULT_CAPTURE_DURATION_MS = 15_000;
const DEFAULT_CAPTURE_ENDPOINT = "/editor/api/performance-captures";
const MAX_CAPTURED_FRAMES = 1_800;
const MAX_CAPTURED_EVENTS = 1_200;
const BADGE_UPDATE_INTERVAL_MS = 200;

function rounded(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );
  return sorted[index] ?? 0;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function buildSummary(
  samples: readonly PerformanceFrameSample[],
  events: readonly PerformanceActionSample[],
): Record<string, unknown> {
  const frameTimes = samples.map((sample) => sample.frameMs).filter((value) => value > 0);
  const phaseNames: (keyof PerformancePhaseSample)[] = [
    "cameraPhysicsMs",
    "targetingMs",
    "environmentMs",
    "avatarsHudMs",
    "renderSubmitMs",
    "storeStreamMs",
    "cpuTotalMs",
  ];
  const phaseAverages = Object.fromEntries(
    phaseNames.map((name) => [
      name,
      rounded(average(samples.map((sample) => sample.phases[name]))),
    ]),
  );
  const inputFrames = samples.filter((sample) => sample.input.lookDeltaMagnitude > 0);
  const longTasks = events.filter((event) => event.type === "browser-long-task");
  const actionTypes = [...new Set(events.map((event) => event.type))];
  const actionPhases = [...new Set(events.map((event) => `${event.type}:${event.phase}`))];
  const eventSummary = Object.fromEntries(actionTypes.map((type) => {
    const matching = events.filter((event) => event.type === type);
    const durations = matching.map((event) => event.durationMs).filter((value) => value > 0);
    return [type, {
      count: matching.length,
      averageDurationMs: rounded(average(durations)),
      maxDurationMs: rounded(Math.max(0, ...durations)),
      totalDurationMs: rounded(durations.reduce((total, value) => total + value, 0)),
    }];
  }));
  const eventPhaseSummary = Object.fromEntries(actionPhases.map((typeAndPhase) => {
    const matching = events.filter(
      (event) => `${event.type}:${event.phase}` === typeAndPhase,
    );
    const durations = matching.map((event) => event.durationMs).filter((value) => value > 0);
    return [typeAndPhase, {
      count: matching.length,
      averageDurationMs: rounded(average(durations)),
      p95DurationMs: rounded(percentile(durations, 0.95)),
      maxDurationMs: rounded(Math.max(0, ...durations)),
      totalDurationMs: rounded(durations.reduce((total, value) => total + value, 0)),
    }];
  }));
  const movementFrames = samples.filter((sample) => sample.input.movementActive);
  const editingFrames = samples.filter((sample) => (
    sample.edits.pendingCommands > 0
    || sample.edits.pendingOverlays > 0
    || sample.edits.pendingMeshBatchChunks > 0
  ));
  const worstFrames = [...samples]
    .sort((left, right) => right.frameMs - left.frameMs)
    .slice(0, 12)
    .map((sample) => ({
      atMs: rounded(sample.atMs),
      frameMs: rounded(sample.frameMs),
      cpuTotalMs: rounded(sample.phases.cpuTotalMs),
      renderSubmitMs: rounded(sample.phases.renderSubmitMs),
      timing: sample.timing ?? null,
      movementActive: sample.input.movementActive,
      lookDeltaMagnitude: rounded(sample.input.lookDeltaMagnitude),
      camera: sample.camera,
      renderer: sample.renderer,
      world: sample.world,
      edits: sample.edits,
      worldEdit: sample.worldEdit ?? null,
    }));

  return {
    sampleCount: samples.length,
    callbackTiming: {
      sampleCount: samples.filter(sample => sample.timing).length,
      averageLatenessMs: rounded(average(samples.flatMap(sample => sample.timing ? [sample.timing.callbackLatenessMs] : []))),
      maximumLatenessMs: rounded(Math.max(0, ...samples.map(sample => sample.timing?.callbackLatenessMs ?? 0))),
      averageRequestToCallbackMs: rounded(average(samples.flatMap(sample => sample.timing?.requestToCallbackMs !== null && sample.timing?.requestToCallbackMs !== undefined ? [sample.timing.requestToCallbackMs] : []))),
    },
    averageFps: rounded(1_000 / Math.max(average(frameTimes), 0.001), 2),
    averageFrameMs: rounded(average(frameTimes)),
    p50FrameMs: rounded(percentile(frameTimes, 0.5)),
    p95FrameMs: rounded(percentile(frameTimes, 0.95)),
    p99FrameMs: rounded(percentile(frameTimes, 0.99)),
    maxFrameMs: rounded(Math.max(0, ...frameTimes)),
    onePercentLowFps: rounded(1_000 / Math.max(percentile(frameTimes, 0.99), 0.001), 2),
    estimatedDroppedFramesAt60Hz: frameTimes.reduce(
      (total, value) => total + Math.max(0, Math.round(value / (1_000 / 60)) - 1),
      0,
    ),
    hitchesOver25Ms: frameTimes.filter((value) => value > 25).length,
    hitchesOver50Ms: frameTimes.filter((value) => value > 50).length,
    cameraInputFrames: inputFrames.length,
    averageInputMagnitude: rounded(average(
      inputFrames.map((sample) => sample.input.lookDeltaMagnitude),
    )),
    inputPhaseAverageMs: {
      inputReadMs: rounded(average(samples.map((sample) => sample.input.inputReadMs))),
      physicsSimulationMs: rounded(average(
        samples.map((sample) => sample.input.physicsSimulationMs),
      )),
      physicsStoreMs: rounded(average(samples.map((sample) => sample.input.physicsStoreMs))),
      cameraFinalizeMs: rounded(average(
        samples.map((sample) => sample.input.cameraFinalizeMs),
      )),
      cameraStoreMs: rounded(average(samples.map((sample) => sample.input.cameraStoreMs))),
      averagePhysicsSubSteps: rounded(average(
        samples.map((sample) => sample.input.physicsSubSteps),
      )),
    },
    phaseAverageMs: phaseAverages,
    movementAverageFrameMs: rounded(average(movementFrames.map((sample) => sample.frameMs))),
    editingAverageFrameMs: rounded(average(editingFrames.map((sample) => sample.frameMs))),
    worstFrames,
    eventCount: events.length,
    eventSummary,
    eventPhaseSummary,
    longTaskCount: longTasks.length,
    longTaskTotalMs: rounded(
      longTasks.reduce((total, event) => total + event.durationMs, 0),
    ),
    longTaskMaxMs: rounded(Math.max(0, ...longTasks.map((event) => event.durationMs))),
  };
}

function createBadge(host: HTMLElement): HTMLDivElement {
  const badge = document.createElement("div");
  badge.className = "editor-performance-recorder";
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-live", "polite");
  badge.hidden = true;
  host.append(badge);
  return badge;
}

export function createPerformanceRecorder(
  options: PerformanceRecorderOptions,
): PerformanceRecorderHandle {
  const durationMs = Math.max(3_000, options.durationMs ?? DEFAULT_CAPTURE_DURATION_MS);
  const endpoint = options.endpoint ?? DEFAULT_CAPTURE_ENDPOINT;
  const badge = createBadge(options.host);
  let recording = false;
  let destroyed = false;
  let startedAtMs = 0;
  let startedAtIso = "";
  let startedReason = "manual";
  let lastBadgeUpdateElapsedMs = 0;
  let samples: PerformanceFrameSample[] = [];
  let events: PerformanceActionSample[] = [];
  let completionTimer: number | null = null;
  let longTaskObserver: PerformanceObserver | null = null;
  let longAnimationFrameObserver: PerformanceObserver | null = null;
  let eventTimingObserver: PerformanceObserver | null = null;
  let layoutShiftObserver: PerformanceObserver | null = null;
  let resourceObserver: PerformanceObserver | null = null;
  let resources = createResourceCapture(0);
  let gpuCapture: ReturnType<typeof createGpuCapture> | null = null;
  let droppedEventCount = 0;
  const contextCleanup: Array<() => void> = [];
  const observerDrains = new Map<PerformanceObserver, (entries: PerformanceEntryList) => void>();

  function createObservedPerformanceObserver(consume: (list: { getEntries(): PerformanceEntryList }) => void): PerformanceObserver {
    const observer = new PerformanceObserver(list => consume(list));
    observerDrains.set(observer, entries => consume({ getEntries: () => entries }));
    return observer;
  }

  function recordEvent(
    type: string,
    phase = "instant",
    eventDurationMs = 0,
    detail: Readonly<Record<string, unknown>> = {},
  ): void {
    if (!recording || destroyed) return;
    if (events.length >= MAX_CAPTURED_EVENTS + 32
      || (events.length >= MAX_CAPTURED_EVENTS && !type.startsWith("capture-"))) { droppedEventCount++; return; }
    events.push({
      atMs: rounded(performance.now()),
      type: String(type || "unknown").slice(0, 96),
      phase: String(phase || "instant").slice(0, 96),
      durationMs: rounded(Math.max(0, Number(eventDurationMs) || 0)),
      detail,
    });
  }

  function startLongTaskObserver(): void {
    if (longTaskObserver || !supportsEntryType("longtask")) return;
    try {
      longTaskObserver = createObservedPerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          recordEvent("browser-long-task", entry.name || "longtask", entry.duration, {
            startTimeMs: rounded(entry.startTime),
            entryType: entry.entryType,
          });
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: false });
    } catch {
      longTaskObserver = null;
    }
  }

  function supportsEntryType(type: string): boolean {
    return typeof PerformanceObserver !== "undefined"
      && (PerformanceObserver.supportedEntryTypes?.includes(type) ?? false);
  }

  function startLongAnimationFrameObserver(): void {
    if (longAnimationFrameObserver || !supportsEntryType("long-animation-frame")) return;
    try {
      longAnimationFrameObserver = createObservedPerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const loaf = entry as PerformanceEntry & {
            readonly blockingDuration?: number;
            readonly renderStart?: number;
            readonly styleAndLayoutStart?: number;
            readonly firstUIEventTimestamp?: number;
            readonly scripts?: readonly {
              readonly duration?: number;
              readonly sourceURL?: string;
              readonly sourceFunctionName?: string;
              readonly invokerType?: string;
              readonly invoker?: string;
            }[];
          };
          const scripts = [...(loaf.scripts ?? [])]
            .sort((left, right) => (right.duration ?? 0) - (left.duration ?? 0));
          recordEvent("browser-long-animation-frame", "loaf", entry.duration, {
            startTimeMs: rounded(entry.startTime),
            blockingDurationMs: rounded(loaf.blockingDuration ?? 0),
            renderDurationMs: rounded(
              loaf.renderStart ? Math.max(0, entry.startTime + entry.duration - loaf.renderStart) : 0,
            ),
            styleAndLayoutDurationMs: rounded(
              loaf.styleAndLayoutStart
                ? Math.max(0, entry.startTime + entry.duration - loaf.styleAndLayoutStart)
                : 0,
            ),
            inputDelayMs: rounded(
              loaf.firstUIEventTimestamp
                ? Math.max(0, loaf.firstUIEventTimestamp - entry.startTime)
                : 0,
            ),
            scriptCount: scripts.length,
            topScripts: scripts.slice(0, 5).map((script) => ({
              durationMs: rounded(script.duration ?? 0),
              sourceUrl: script.sourceURL ?? "",
              functionName: script.sourceFunctionName ?? "",
              invokerType: script.invokerType ?? "",
              invoker: script.invoker ?? "",
            })),
          });
        }
      });
      longAnimationFrameObserver.observe({ type: "long-animation-frame", buffered: false });
    } catch {
      longAnimationFrameObserver = null;
    }
  }

  function startEventTimingObserver(): void {
    if (eventTimingObserver || !supportsEntryType("event")) return;
    try {
      eventTimingObserver = createObservedPerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const timing = entry as PerformanceEntry & {
            readonly processingStart?: number;
            readonly processingEnd?: number;
            readonly interactionId?: number;
          };
          recordEvent("browser-input-event", entry.name || "event", entry.duration, {
            startTimeMs: rounded(entry.startTime),
            inputDelayMs: rounded(Math.max(
              0,
              (timing.processingStart ?? entry.startTime) - entry.startTime,
            )),
            handlerDurationMs: rounded(Math.max(
              0,
              (timing.processingEnd ?? timing.processingStart ?? entry.startTime)
                - (timing.processingStart ?? entry.startTime),
            )),
            presentationDelayMs: rounded(Math.max(
              0,
              entry.startTime + entry.duration
                - (timing.processingEnd ?? timing.processingStart ?? entry.startTime),
            )),
            interactionId: timing.interactionId ?? 0,
          });
        }
      });
      eventTimingObserver.observe({
        type: "event",
        buffered: false,
        durationThreshold: 8,
      } as PerformanceObserverInit);
    } catch {
      eventTimingObserver = null;
    }
  }

  function startLayoutShiftObserver(): void {
    if (layoutShiftObserver || !supportsEntryType("layout-shift")) return;
    try {
      layoutShiftObserver = createObservedPerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            readonly value?: number;
            readonly hadRecentInput?: boolean;
          };
          recordEvent(
            "browser-layout-shift",
            shift.hadRecentInput ? "after-input" : "unexpected",
            0,
            {
              startTimeMs: rounded(entry.startTime),
              value: rounded(shift.value ?? 0, 6),
            },
          );
        }
      });
      layoutShiftObserver.observe({ type: "layout-shift", buffered: false });
    } catch {
      layoutShiftObserver = null;
    }
  }

  function stopObserver(observer: PerformanceObserver | null): void {
    try {
      if (observer) observerDrains.get(observer)?.(observer.takeRecords());
      observer?.disconnect();
    } catch {
      // Diagnostics must never affect the editor.
    }
    if (observer) observerDrains.delete(observer);
  }

  function stopLongTaskObserver(): void {
    stopObserver(longTaskObserver);
    longTaskObserver = null;
  }

  function recordRuntimeSnapshot(phase: "start" | "stop" | "visibilitychange" | "focus" | "blur"): void {
    const memory = (performance as Performance & {
      readonly memory?: {
        readonly usedJSHeapSize?: number;
        readonly totalJSHeapSize?: number;
        readonly jsHeapSizeLimit?: number;
      };
    }).memory;
    const connection = (navigator as Navigator & {
      readonly connection?: {
        readonly effectiveType?: string;
        readonly downlink?: number;
        readonly rtt?: number;
        readonly saveData?: boolean;
      };
    }).connection;
    recordEvent("capture-context", phase, 0, {
      visibilityState: document.visibilityState,
      focused: document.hasFocus(),
      embedded: window.self !== window.top,
      usedJsHeapBytes: memory?.usedJSHeapSize ?? null,
      totalJsHeapBytes: memory?.totalJSHeapSize ?? null,
      jsHeapLimitBytes: memory?.jsHeapSizeLimit ?? null,
      connectionEffectiveType: connection?.effectiveType ?? null,
      connectionDownlinkMbps: connection?.downlink ?? null,
      connectionRttMs: connection?.rtt ?? null,
      connectionSaveData: connection?.saveData ?? null,
    });
  }

  function recordResourceSummary(): void {
    recordEvent("capture-resources", "summary", 0, {
      ...resources.summary(), observerActive: resourceObserver !== null,
      observerSupported: supportsEntryType("resource"),
    });
  }

  function startCaptureContext(): void {
    resources = createResourceCapture(startedAtMs);
    if (supportsEntryType("resource")) {
      try {
        resourceObserver = createObservedPerformanceObserver(list => resources.add(list.getEntries() as PerformanceResourceTiming[]));
        resourceObserver.observe({ type: "resource", buffered: false });
      } catch { resourceObserver = null; }
    }
    for (const [target, type] of [[document, "visibilitychange"], [window, "focus"], [window, "blur"]] as const) {
      const listener = () => recordRuntimeSnapshot(type);
      target.addEventListener(type, listener);
      contextCleanup.push(() => target.removeEventListener(type, listener));
    }
    const observers = { longtask: longTaskObserver, "long-animation-frame": longAnimationFrameObserver,
      event: eventTimingObserver, "layout-shift": layoutShiftObserver, resource: resourceObserver };
    recordEvent("capture-observers", "start", 0, Object.fromEntries(Object.entries(observers).map(([type, observer]) =>
      [type, { supported: supportsEntryType(type), active: Boolean(observer) }])));
    try {
      const context = options.getGraphicsContext?.();
      gpuCapture = context ? createGpuCapture(context, sample => recordEvent("gpu-render", "elapsed", sample.durationMs, {
        frameAtMs: sample.frameAtMs, receivedAtMs: sample.receivedAtMs,
        measurement: "EXT_disjoint_timer_query_webgl2", excludesPresentation: true,
      })) : null;
      recordEvent("capture-gpu", "start", 0, gpuCapture?.info ?? { timerQuerySupported: false, reason: "graphics-context-unavailable" });
    } catch (error) {
      gpuCapture = null;
      recordEvent("capture-gpu", "start", 0, { timerQuerySupported: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  function setDataset(status: string, captureId = ""): void {
    options.root.dataset.performanceCaptureStatus = status;
    options.root.dataset.performanceCaptureId = captureId;
    options.root.dataset.performanceCaptureFrameCount = String(samples.length);
  }

  function showBadge(text: string, state: string): void {
    badge.hidden = false;
    badge.dataset.state = state;
    badge.textContent = text;
  }

  function clearCompletionTimer(): void {
    if (completionTimer !== null) {
      window.clearTimeout(completionTimer);
      completionTimer = null;
    }
  }

  function start(reason = "manual"): void {
    if (destroyed || recording) return;
    clearCompletionTimer();
    samples = [];
    events = [];
    droppedEventCount = 0;
    recording = true;
    startedAtMs = performance.now();
    startedAtIso = new Date().toISOString();
    startedReason = reason;
    lastBadgeUpdateElapsedMs = 0;
    setDataset("recording");
    startLongTaskObserver();
    startLongAnimationFrameObserver();
    startEventTimingObserver();
    startLayoutShiftObserver();
    startCaptureContext();
    recordRuntimeSnapshot("start");
    showBadge("F8-Diagnose läuft · F8 beendet", "recording");
  }

  async function stop(reason = "manual"): Promise<void> {
    if (destroyed || !recording) return;
    const stoppedAtMs = performance.now();
    stopLongTaskObserver();
    stopObserver(longAnimationFrameObserver);
    stopObserver(eventTimingObserver);
    stopObserver(layoutShiftObserver);
    stopObserver(resourceObserver);
    longAnimationFrameObserver = null;
    eventTimingObserver = null;
    layoutShiftObserver = null;
    recordResourceSummary();
    resourceObserver = null;
    for (const observer of [...observerDrains.keys()]) stopObserver(observer);
    for (const cleanup of contextCleanup.splice(0)) cleanup();
    let gpuSummary: Record<string, unknown> | null = null;
    try { gpuSummary = gpuCapture?.finish() ?? null; }
    catch (error) { gpuSummary = { failed: true, error: String(error) }; }
    gpuCapture = null;
    recordEvent("capture-gpu", "summary", 0, gpuSummary ?? { supported: false });
    recordRuntimeSnapshot("stop");
    recording = false;
    const capturedSamples = samples;
    const capturedEvents = events;
    const summary = buildSummary(capturedSamples, capturedEvents);
    setDataset("saving");
    showBadge("F8-Diagnose wird gespeichert …", "saving");

    const payload = {
      contract: "vectoplan-editor-performance-capture.v1",
      startedAt: startedAtIso,
      stoppedAt: new Date().toISOString(),
      durationMs: rounded(stoppedAtMs - startedAtMs),
      timeOriginMs: performance.timeOrigin,
      timingContract: { frameAtMs: "requestAnimationFrame timestamp", eventAtMs: "observer delivery timestamp",
        entryStartTimeMs: "original browser entry timestamp in detail.startTimeMs", gpuDuration: "asynchronous elapsed render commands, not presentation" },
      droppedEventCount,
      gpuSummary,
      startReason: startedReason,
      stopReason: reason,
      projectId: options.projectId,
      worldId: options.worldId,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        devicePixelRatio: window.devicePixelRatio,
      },
      summary,
      frames: capturedSamples,
      events: capturedEvents,
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json() as { captureId?: string };
      const captureId = result.captureId ?? "unbekannt";
      setDataset("saved", captureId);
      showBadge(`F8-Diagnose gespeichert · ${captureId}`, "saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.root.dataset.performanceCaptureError = message;
      setDataset("failed");
      showBadge("F8-Diagnose konnte nicht gespeichert werden", "failed");
    }

    completionTimer = window.setTimeout(() => {
      badge.hidden = true;
      completionTimer = null;
    }, 6_000);
  }

  function toggle(reason = "manual"): void {
    if (recording) void stop(reason);
    else start(reason);
  }

  function recordFrame(sample: PerformanceFrameSample): void {
    if (!recording || destroyed) return;
    if (samples.length < MAX_CAPTURED_FRAMES) {
      samples.push({
        ...sample,
        worldEdit: {
          active: options.root.dataset.worldEditActive === "true",
          tool: options.root.dataset.worldEditTool ?? "",
          draftPresent: options.root.dataset.worldEditPlanningDraftPresent === "true",
          pendingGeneration: options.root.dataset.worldEditPlanningGenerationPending === "true",
          busy: options.root.dataset.worldEditBusy === "true",
          clipboardPhase: options.root.dataset.worldEditClipboardPhase ?? "",
          clipboardCells: Math.max(0, Number(options.root.dataset.worldEditClipboardCells) || 0),
          clipboardGizmoHandles: Math.max(0, Number(options.root.dataset.worldEditClipboardGizmoHandles) || 0),
        },
      });
    }
    const elapsedMs = performance.now() - startedAtMs;
    options.root.dataset.performanceCaptureFrameCount = String(samples.length);
    if (elapsedMs - lastBadgeUpdateElapsedMs >= BADGE_UPDATE_INTERVAL_MS) {
      lastBadgeUpdateElapsedMs = elapsedMs;
      const remainingSeconds = Math.max(0, (durationMs - elapsedMs) / 1_000);
      showBadge(
        `F8-Diagnose ${remainingSeconds.toFixed(1)} s · F8 beendet`,
        "recording",
      );
    }
    if (elapsedMs >= durationMs || samples.length >= MAX_CAPTURED_FRAMES) {
      void stop(elapsedMs >= durationMs ? "duration-complete" : "sample-limit");
    }
  }

  setDataset("idle");

  return {
    toggle,
    start,
    stop,
    recordFrame,
    recordEvent,
    isRecording: () => recording,
    beginGpuFrame(frameAtMs: number): void {
      if (!recording) return;
      try { gpuCapture?.beginFrame(frameAtMs); } catch { /* Diagnostic queries never interrupt rendering. */ }
    },
    endGpuFrame(): void {
      if (!recording) return;
      try { gpuCapture?.endFrame(); } catch { /* Diagnostic queries never interrupt rendering. */ }
    },
    destroy(): void {
      destroyed = true;
      recording = false;
      stopLongTaskObserver();
      stopObserver(longAnimationFrameObserver);
      stopObserver(eventTimingObserver);
      stopObserver(layoutShiftObserver);
      stopObserver(resourceObserver);
      for (const observer of [...observerDrains.keys()]) stopObserver(observer);
      for (const cleanup of contextCleanup.splice(0)) cleanup();
      try { gpuCapture?.finish(); } catch { /* Context teardown can invalidate pending queries. */ }
      gpuCapture = null;
      clearCompletionTimer();
      badge.remove();
    },
  };
}
