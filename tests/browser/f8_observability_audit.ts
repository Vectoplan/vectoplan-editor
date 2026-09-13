import { createPerformanceRecorder, type PerformanceFrameSample } from "../../src/frontend/performance/performance_recorder";
import { animationFrameTiming } from "../../src/frontend/performance/capture_observability";

document.body.innerHTML = '<button id="run">F8 mit echtem WebGL prüfen</button><pre id="result">Bereit</pre><div id="host"><canvas width="640" height="360"></canvas></div>';
const host = document.querySelector<HTMLElement>("#host")!;
const output = document.querySelector<HTMLElement>("#result")!;
const canvas = host.querySelector("canvas")!;
const gl = canvas.getContext("webgl2")!;
const endpoint = "/isolated-f8-audit/capture";
const realFetch = window.fetch.bind(window);
let captured: any;
window.fetch = async (input, init) => {
  if (String(input) !== endpoint) return realFetch(input, init);
  captured = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ ok: true, captureId: "isolated-only" }), { status: 201 });
};
const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
document.querySelector<HTMLButtonElement>("#run")!.onclick = async event => {
  (event.currentTarget as HTMLButtonElement).disabled = true;
  const recorder = createPerformanceRecorder({ root: host, host, projectId: "isolated-f8-audit", worldId: "fixture",
    endpoint, getGraphicsContext: () => gl });
  try {
    assert(gl, "WebGL2 fehlt");
    performance.setResourceTimingBufferSize(1);
    await realFetch("/static/editor/manifest.json?before-f8");
    await frame();
    recorder.start("isolated-browser-audit");
    await realFetch("/static/editor/manifest.json?during-f8");
    let previous = performance.now();
    for (let index = 0; index < 24; index++) {
      const requested = performance.now(), at = await frame(), started = performance.now();
      recorder.beginGpuFrame(at);
      gl.clearColor(index / 24, .25, .5, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      recorder.endGpuFrame();
      recorder.recordFrame({ atMs: at, frameMs: Math.max(0, at - previous), timing: animationFrameTiming(at, requested, started),
        phases: { cameraPhysicsMs: 0, targetingMs: 0, environmentMs: 0, avatarsHudMs: 0,
          renderSubmitMs: performance.now() - started, storeStreamMs: 0, cpuTotalMs: performance.now() - started },
        input: { lookDeltaX: 0, lookDeltaY: 0, lookDeltaMagnitude: 0, pointerLocked: false, movementActive: false,
          sprinting: false, inputReadMs: 0, physicsSimulationMs: 0, physicsStoreMs: 0, cameraFinalizeMs: 0, cameraStoreMs: 0, physicsSubSteps: 0 },
        camera: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
        renderer: { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, pixelRatio: 1, drawingBufferWidth: 640, drawingBufferHeight: 360 },
        world: { loadedChunks: 0, renderedChunks: 0, meshes: 0, pendingChunkMeshes: 0, shadowCasters: 0 },
        edits: { placeIntents: 0, removeIntents: 0, pendingCommands: 0, pendingOverlays: 0, pendingMeshBatchChunks: 0 },
        shadows: { environmentRefreshCount: 0, environmentRefreshReason: "fixture", terrainScanCount: 0, terrainChangeCount: 0 },
      } satisfies PerformanceFrameSample);
      previous = at;
    }
    await recorder.stop("isolated-browser-audit");
    const events: any[] = captured.events;
    const resources = events.find(item => item.type === "capture-resources")?.detail;
    const gpu = events.find(item => item.type === "capture-gpu" && item.phase === "start")?.detail;
    assert(resources?.count > 0 && resources.slowest.some((item: any) => item.name.includes("during-f8")), "Voller globaler Resource-Puffer versteckt neue Anfrage");
    assert(captured.frames.length === 24 && captured.frames.every((item: any) => item.timing.callbackStartedAtMs >= item.atMs), "Callbackzeit fehlt");
    assert(gpu?.renderer && typeof gpu.timerQuerySupported === "boolean", "Grafikrenderer/Support fehlt");
    assert(!gpu.timerQuerySupported || captured.gpuSummary.sampleCount > 0, "Unterstützte GPU-Timer liefern keine Messung");
    assert(captured.captureId !== "perf_960abffed11e4e4e", "Nutzerdiagnose wurde überschrieben");
    output.textContent = `PASS\nNeue Resource trotz vollem globalen Puffer erfasst.\n24 tatsächliche rAF-/WebGL-Aufrufe mit separater CPU-Startzeit.\nGPU: ${gpu.renderer}\nTimer: ${gpu.timerQuerySupported ? captured.gpuSummary.sampleCount + " asynchrone Messungen" : "nicht unterstützt, ausdrücklich gekennzeichnet"}\nKein Server-Capture und keine Projektmutation.`;
  } catch (error) { output.textContent = `FAIL ${String(error)}`; }
  finally { recorder.destroy(); window.fetch = realFetch; }
};
