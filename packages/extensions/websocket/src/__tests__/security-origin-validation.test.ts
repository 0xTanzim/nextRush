/**
 * @nextrush/websocket - Security: Origin validation on upgrade (CSWSH surface)
 *
 * Part of the `audit-unreviewed-security-surface` investigation (task 6.1/6.2).
 * Confirms the *actual, observed* behavior of `WebSocketServer`'s upgrade path
 * when a cross-site page's `Origin` header is presented, with `allowedOrigins`
 * left at its documented default (`[]`) — the configuration most real
 * deployments start from unless they explicitly opt into a check.
 *
 * Drives a real `net.Socket` HTTP/1.1 upgrade handshake against a real
 * `http.Server` + `WebSocketServer.attach()`, following the same raw-socket
 * driving pattern as
 * `packages/adapters/node/src/__tests__/raw-socket-malformed-request.test.ts`
 * (`http.request()`/`fetch()` both normalize headers a raw socket lets through
 * untouched, and an `Origin` check is exactly the kind of behavior that must be
 * observed at the wire level, not asserted from reading the source).
 */
import { createServer, type Server } from 'node:http';
import { connect, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from '../server';

let httpServer: Server | undefined;
let wss: WebSocketServer | undefined;

afterEach(async () => {
  wss?.close();
  await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
  httpServer = undefined;
  wss = undefined;
});

/** A minimal, spec-valid WebSocket upgrade request with a caller-supplied Origin. */
function upgradeRequest(port: number, origin: string | undefined, path = '/'): string {
  const lines = [
    `GET ${path} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
    'Sec-WebSocket-Version: 13',
  ];
  if (origin !== undefined) lines.push(`Origin: ${origin}`);
  return lines.join('\r\n') + '\r\n\r\n';
}

/** Send a raw upgrade handshake over a real socket; resolve with the status line. */
function rawUpgrade(port: number, raw: string): Promise<{ statusLine: string; closed: boolean }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (result: { statusLine: string; closed: boolean }): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket: Socket = connect({ host: '127.0.0.1', port });
    const timer = setTimeout(() => {
      const data = Buffer.concat(chunks).toString('utf8');
      finish({ statusLine: data.split('\r\n')[0] ?? '', closed: false });
    }, 1000);

    socket.on('connect', () => socket.write(raw));
    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      // The status line is the first line of the response — enough to
      // distinguish a 101 handshake accept from a 403/404 rejection.
      if (Buffer.concat(chunks).includes('\r\n')) {
        clearTimeout(timer);
        const data = Buffer.concat(chunks).toString('utf8');
        finish({ statusLine: data.split('\r\n')[0] ?? '', closed: false });
      }
    });
    socket.on('close', () => {
      clearTimeout(timer);
      const data = Buffer.concat(chunks).toString('utf8');
      finish({ statusLine: data.split('\r\n')[0] ?? '', closed: true });
    });
    socket.on('error', () => {
      clearTimeout(timer);
      finish({ statusLine: '', closed: true });
    });
  });
}

async function startServer(wssInstance: WebSocketServer): Promise<number> {
  httpServer = createServer();
  wss = wssInstance;
  wss.on('/', () => {
    /* no-op handler — only the handshake outcome is under test */
  });
  await wss.attach(httpServer);
  return new Promise((resolve) => {
    httpServer!.listen(0, '127.0.0.1', () => {
      const addr = httpServer!.address();
      resolve(typeof addr === 'object' && addr !== null ? addr.port : 0);
    });
  });
}

describe('WebSocketServer upgrade — Origin validation (audit-unreviewed-security-surface, 6.1/6.2)', () => {
  it('FINDING: with the documented default (allowedOrigins: []), a cross-site Origin completes the handshake (101) — no CSWSH check unless explicitly configured', async () => {
    const port = await startServer(new WebSocketServer());

    const { statusLine } = await rawUpgrade(port, upgradeRequest(port, 'https://evil.attacker.example'));

    // This is the finding: an arbitrary, attacker-controlled cross-site Origin
    // is accepted exactly like a same-site Origin, because the default
    // allowedOrigins: [] means "skip the check entirely" (see verifyOrigin()
    // in server.ts: `if (this.resolvedOptions.allowedOrigins.length === 0) return true;`).
    // Compare @nextrush/cors, which requires an explicit, defensive posture
    // (isOriginSecure + isValidOriginFormat) even before consulting the
    // allowlist — @nextrush/websocket applies none of that by default.
    expect(statusLine).toContain('101');
  });

  it('a request with NO Origin header at all also completes the handshake by default (non-browser clients are indistinguishable from a hijacked browser tab)', async () => {
    const port = await startServer(new WebSocketServer());

    const { statusLine } = await rawUpgrade(port, upgradeRequest(port, undefined));

    expect(statusLine).toContain('101');
  });

  it('control group: once allowedOrigins is explicitly configured, an out-of-list Origin IS correctly rejected (403) — the mechanism works, it is simply off by default', async () => {
    const port = await startServer(new WebSocketServer({ allowedOrigins: ['https://trusted.example'] }));

    const { statusLine } = await rawUpgrade(port, upgradeRequest(port, 'https://evil.attacker.example'));

    expect(statusLine).toContain('403');
  });

  it('control group: an allowed Origin still completes the handshake once allowedOrigins is configured', async () => {
    const port = await startServer(new WebSocketServer({ allowedOrigins: ['https://trusted.example'] }));

    const { statusLine } = await rawUpgrade(port, upgradeRequest(port, 'https://trusted.example'));

    expect(statusLine).toContain('101');
  });
});
