/** Keep bounded details while counting resources delivered during this capture.
 * Observers also receive requests which started before recording and finish in it. */
export function createResourceCapture(startedAtMs: number, detailLimit = 2_000) {
  let count = 0, totalDurationMs = 0, totalTransferBytes = 0, startedBeforeCaptureCount = 0;
  const slowest: Array<Record<string, string | number>> = [];
  const initiatorCounts: Record<string, number> = {};
  return {
    add(entries: readonly PerformanceResourceTiming[]): void {
      for (const entry of entries) {
        count++;
        const durationMs = Math.max(0, Number(entry.duration) || 0);
        totalDurationMs += durationMs;
        totalTransferBytes += Math.max(0, Number(entry.transferSize) || 0);
        if (entry.startTime < startedAtMs) startedBeforeCaptureCount++;
        const type = String(entry.initiatorType || "other").slice(0, 64);
        initiatorCounts[type] = (initiatorCounts[type] ?? 0) + 1;
        if (count > detailLimit) continue;
        slowest.push({ name: String(entry.name).slice(0, 512), initiatorType: type,
          startTimeMs: entry.startTime, durationMs, responseStartMs: Math.max(0, entry.responseStart - entry.startTime),
          transferBytes: entry.transferSize || 0 });
        slowest.sort((left, right) => Number(right.durationMs) - Number(left.durationMs));
        slowest.length = Math.min(12, slowest.length);
      }
    },
    summary() {
      return { source: "performance-observer", count, totalDurationMs, totalTransferBytes,
        startedBeforeCaptureCount, omittedDetails: Math.max(0, count - detailLimit),
        initiatorCounts: { ...initiatorCounts }, slowest: [...slowest] };
    },
  };
}

export function animationFrameTiming(rafAtMs: number, requestedAtMs: number | null, callbackStartedAtMs: number) {
  return { rafRequestedAtMs: requestedAtMs, callbackStartedAtMs,
    callbackLatenessMs: Math.max(0, callbackStartedAtMs - rafAtMs),
    requestToCallbackMs: requestedAtMs === null ? null : Math.max(0, callbackStartedAtMs - requestedAtMs) };
}
