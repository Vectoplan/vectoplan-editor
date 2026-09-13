type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type GpuSample = { frameAtMs: number; durationMs: number; receivedAtMs: number };

/** Called only while F8 is recording. Query results are read only after AVAILABLE;
 * no finish(), synchronous fence, timer loop, or wait for the GPU is introduced. */
export function createGpuCapture(gl: WebGL2RenderingContext, onSample: (sample: GpuSample) => void) {
  const info: Record<string, unknown> = {};
  let extension: TimerExtension | null = null;
  let active: { query: WebGLQuery; frameAtMs: number } | null = null;
  const pending: Array<{ query: WebGLQuery; frameAtMs: number }> = [];
  let sampleCount = 0, totalMs = 0, maximumMs = 0, skippedCount = 0, discardedCount = 0, disjointCount = 0, failed = false, unavailable = false;
  try {
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    info.vendor = gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? gl.VENDOR);
    info.renderer = gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
    info.rendererUnmasked = Boolean(debug);
    info.version = gl.getParameter(gl.VERSION);
    info.shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
    info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    info.maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    info.contextAttributes = gl.getContextAttributes();
    extension = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExtension | null;
    info.timerQuerySupported = Boolean(extension && typeof gl.createQuery === "function");
    if (!info.timerQuerySupported) extension = null;
  } catch (error) {
    info.error = error instanceof Error ? error.message : String(error);
    info.timerQuerySupported = false;
  }
  const discard = () => {
    for (const item of pending.splice(0)) { gl.deleteQuery(item.query); discardedCount++; }
  };
  const poll = () => {
    if (!extension || failed) return;
    try {
      unavailable = gl.isContextLost() || Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      if (unavailable) { disjointCount++; discard(); return; }
      while (pending.length) {
        const item = pending[0]!;
        if (!gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) break;
        const nanoseconds = Number(gl.getQueryParameter(item.query, gl.QUERY_RESULT));
        pending.shift(); gl.deleteQuery(item.query);
        if (!Number.isFinite(nanoseconds) || nanoseconds < 0) { discardedCount++; continue; }
        const durationMs = nanoseconds / 1_000_000;
        sampleCount++; totalMs += durationMs; maximumMs = Math.max(maximumMs, durationMs);
        onSample({ frameAtMs: item.frameAtMs, durationMs, receivedAtMs: performance.now() });
      }
    } catch (error) { failed = true; info.timerQueryError = error instanceof Error ? error.message : String(error); }
  };
  return {
    info,
    beginFrame(frameAtMs: number): void {
      poll();
      if (!extension || failed || unavailable || active || pending.length >= 4) { skippedCount++; return; }
      let query: WebGLQuery | null = null;
      try {
        // Respect another diagnostic tool's active TIME_ELAPSED query.
        if (gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) { skippedCount++; return; }
        query = gl.createQuery();
        if (!query) { skippedCount++; return; }
        gl.beginQuery(extension.TIME_ELAPSED_EXT, query); active = { query, frameAtMs };
      } catch (error) { if (query) gl.deleteQuery(query); failed = true; info.timerQueryError = error instanceof Error ? error.message : String(error); }
    },
    endFrame(): void {
      if (!active || !extension) return;
      const item = active; active = null;
      try { gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push(item); }
      catch (error) { gl.deleteQuery(item.query); discardedCount++; failed = true; info.timerQueryError = String(error); }
    },
    finish() {
      if (active && extension) { try { gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push(active); } catch { gl.deleteQuery(active.query); discardedCount++; } active = null; }
      poll();
      const unresolvedCount = pending.length;
      discard();
      return { supported: Boolean(extension), failed, sampleCount, averageMs: sampleCount ? totalMs / sampleCount : null,
        maximumMs: sampleCount ? maximumMs : null, skippedCount, discardedCount, unresolvedCount, disjointCount,
        error: info.timerQueryError ?? null };
    },
  };
}
