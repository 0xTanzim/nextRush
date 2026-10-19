// Minimal raw HTTP/1.1 client. `fetch` and `curl` normalize the request target (dot segments,
// encoded dots) BEFORE sending, which hides exactly what we want to test. This writes the
// request target byte-for-byte and never follows redirects.
import net from 'node:net';

/**
 * @param {number} port
 * @param {{ method?: string, target: string, headers?: Record<string,string>, body?: string, timeoutMs?: number }} req
 * @returns {Promise<{ status: number, headers: Record<string,string>, body: string, bodyBytes: number, timedOut: boolean }>}
 */
export function rawRequest(port, req) {
  const { method = 'GET', target, headers = {}, body, timeoutMs = 2500 } = req;
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    const chunks = [];
    let done = false;
    const parse = () => {
      const buf = Buffer.concat(chunks);
      const end = buf.indexOf('\r\n\r\n');
      if (end === -1) return null;
      const head = buf.subarray(0, end).toString('latin1').split('\r\n');
      const hdrs = {};
      for (const line of head.slice(1)) {
        const i = line.indexOf(':');
        if (i > 0) hdrs[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      return { status: Number(head[0].split(' ')[1]) || 0, headers: hdrs, payload: buf.subarray(end + 4) };
    };
    const finish = (timedOut) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.destroy();
      const p = parse();
      resolve(p
        ? { status: p.status, headers: p.headers, body: p.payload.toString('utf8'), bodyBytes: p.payload.length, timedOut }
        : { status: 0, headers: {}, body: '', bodyBytes: 0, timedOut });
    };
    const timer = setTimeout(() => finish(true), timeoutMs);
    socket.on('data', (d) => {
      chunks.push(d);
      const p = parse();
      if (!p) return;
      const len = p.headers['content-length'];
      if (len !== undefined && p.payload.length >= Number(len)) finish(false);
      else if (method === 'HEAD') finish(false);
    });
    socket.on('close', () => finish(false));
    socket.on('error', () => finish(false));
    socket.on('connect', () => {
      const h = { host: `127.0.0.1:${port}`, connection: 'close', ...headers };
      if (body !== undefined) h['content-length'] = String(Buffer.byteLength(body));
      socket.write([`${method} ${target} HTTP/1.1`, ...Object.entries(h).map(([k, v]) => `${k}: ${v}`), '', body ?? ''].join('\r\n'));
    });
  });
}
