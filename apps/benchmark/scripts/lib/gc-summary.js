/**
 * Summarizes the `gcEvents` array already captured by `startServer()`'s
 * `--trace-gc` stderr parser (scripts/lib/server.js) — no new GC-trace
 * parsing is introduced here.
 */

/**
 * @param {Array<{ timestamp: number, type: string, pauseMs: number, totalMs: number }>} gcEvents
 * @returns {{ count: number, totalPauseMs: number, byType: Record<string, { count: number, pauseMs: number }> }}
 */
export function summarizeGcEvents(gcEvents) {
  const byType = {};
  let totalPauseMs = 0;

  for (const event of gcEvents) {
    totalPauseMs += event.pauseMs;
    const bucket = byType[event.type] ?? { count: 0, pauseMs: 0 };
    bucket.count += 1;
    bucket.pauseMs += event.pauseMs;
    byType[event.type] = bucket;
  }

  return { count: gcEvents.length, totalPauseMs, byType };
}
