/**
 * Minimal Chrome DevTools Protocol (CDP) client over the built-in global
 * `WebSocket` (Node >= 21) — connects to a spawned server's `--inspect` port
 * to trigger `HeapProfiler.takeHeapSnapshot` externally, with zero code
 * added to the profiled server file (design.md: no server-file
 * instrumentation for profiling).
 */

/**
 * @param {number} inspectPort
 * @returns {Promise<string>} the ws:// debugger URL for the target's single page
 */
async function resolveDebuggerUrl(inspectPort) {
  const res = await fetch(`http://127.0.0.1:${inspectPort}/json/list`);
  const targets = await res.json();
  if (!targets[0]?.webSocketDebuggerUrl) {
    throw new Error(`No inspector target found on port ${inspectPort}`);
  }
  return targets[0].webSocketDebuggerUrl;
}

/**
 * Opens one CDP session, takes a heap snapshot, and closes the session.
 * Each call opens a fresh connection so before/after snapshots cannot leak
 * event listeners or chunk buffers between calls.
 * @param {number} inspectPort
 * @returns {Promise<string>} the reassembled heap snapshot JSON
 */
export async function takeHeapSnapshot(inspectPort) {
  const url = await resolveDebuggerUrl(inspectPort);
  const ws = new WebSocket(url);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('error', (e) => reject(new Error(`CDP connect failed: ${e.message}`)), { once: true });
  });

  const chunks = [];
  let nextId = 1;

  const snapshot = await new Promise((resolve, reject) => {
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.method === 'HeapProfiler.addHeapSnapshotChunk') {
        chunks.push(msg.params.chunk);
      } else if (msg.id === nextId) {
        resolve(chunks.join(''));
      } else if (msg.error) {
        reject(new Error(`CDP error: ${msg.error.message}`));
      }
    });
    ws.send(JSON.stringify({ id: nextId, method: 'HeapProfiler.takeHeapSnapshot' }));
  });

  ws.close();
  return snapshot;
}
