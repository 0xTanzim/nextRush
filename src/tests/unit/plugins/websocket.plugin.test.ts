import { createApp } from '@/index';
import { WebSocketPlugin } from '@/plugins/websocket/websocket.plugin';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import { createConnection } from 'node:net';
import { describe, expect, it } from 'vitest';

// Node 22+ has global WebSocket client

describe('WebSocketPlugin', () => {
  it('accepts connections and echoes messages', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/ws' }).install(app as any);
    (app as any).ws('/ws', (socket: any) => {
      socket.onMessage((data: any) => {
        socket.send(typeof data === 'string' ? data.toUpperCase() : data);
      });
    });
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = server.address() as any;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const received: string[] = [];
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => ws.send('hello'));
      ws.addEventListener('message', (ev: any) => {
        received.push(String(ev.data));
        resolve();
      });
      ws.addEventListener('error', reject);
    });
    expect(received[0]).toBe('HELLO');
    ws.close();
    await app.shutdown();
  });

  it('rejects unmatched path', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/ws' }).install(app as any);
    (app as any).ws('/ws', () => {});
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = server.address() as any;

    const ws = new WebSocket(`ws://localhost:${port}/nope`);
    const result = await new Promise<'error' | 'open' | 'close'>(resolve => {
      ws.addEventListener('open', () => resolve('open'));
      ws.addEventListener('error', () => resolve('error'));
      ws.addEventListener('close', () => resolve('close'));
    });
    expect(result === 'error' || result === 'close').toBe(true);
    await app.shutdown();
  });

  it('verifyClient=false rejects connection', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/ws', verifyClient: () => false }).install(
      app as any
    );
    (app as any).ws('/ws', () => {});
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = server.address() as any;
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const result = await new Promise<'error' | 'open' | 'close'>(resolve => {
      ws.addEventListener('open', () => resolve('open'));
      ws.addEventListener('error', () => resolve('error'));
      ws.addEventListener('close', () => resolve('close'));
    });
    expect(result === 'error' || result === 'close').toBe(true);
    await app.shutdown();
  });

  it('enforces maxConnections', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/ws', maxConnections: 1 }).install(app as any);
    (app as any).ws('/ws', () => {});
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = server.address() as any;

    const ws1 = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>(resolve =>
      ws1.addEventListener('open', () => resolve())
    );

    const ws2 = new WebSocket(`ws://localhost:${port}/ws`);
    const result2 = await new Promise<'error' | 'open' | 'close'>(resolve => {
      ws2.addEventListener('open', () => resolve('open'));
      ws2.addEventListener('error', () => resolve('error'));
      ws2.addEventListener('close', () => resolve('close'));
    });
    expect(result2 === 'error' || result2 === 'close').toBe(true);
    ws1.close();
    await app.shutdown();
  });

  it('supports wildcard routes', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/chat/*' }).install(app as any);
    (app as any).ws('/chat/*', (socket: any) => {
      socket.onMessage((d: any) => socket.send(String(d).toUpperCase()));
    });
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = server.address() as any;

    const ws = new WebSocket(`ws://localhost:${port}/chat/room1`);
    const got = await new Promise<string>((resolve, reject) => {
      ws.addEventListener('open', () => ws.send('wild'));
      ws.addEventListener('message', (e: any) => resolve(String(e.data)));
      ws.addEventListener('error', reject as any);
    });
    expect(got).toBe('WILD');
    ws.close();
    await app.shutdown();
  });

  it('broadcasts to rooms only', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/chat/*' }).install(app as any);
    (app as any).ws('/chat/*', (socket: any) => {
      const room = socket.url.split('/').pop()!;
      socket.join(room);
    });
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = server.address() as any;

    const wsA = new WebSocket(`ws://localhost:${port}/chat/r1`);
    const wsB = new WebSocket(`ws://localhost:${port}/chat/r1`);
    const wsC = new WebSocket(`ws://localhost:${port}/chat/r2`);

    await Promise.all([
      new Promise<void>(res => wsA.addEventListener('open', () => res())),
      new Promise<void>(res => wsB.addEventListener('open', () => res())),
      new Promise<void>(res => wsC.addEventListener('open', () => res())),
    ]);

    const recvA = new Promise<string>(res =>
      wsA.addEventListener('message', (e: any) => res(String(e.data)))
    );
    const recvB = new Promise<string>(res =>
      wsB.addEventListener('message', (e: any) => res(String(e.data)))
    );
    let gotC = 'none';
    wsC.addEventListener('message', (e: any) => {
      gotC = String(e.data);
    });

    // broadcast to r1
    (app as any).wsBroadcast('hello', 'r1');
    const [a, b] = await Promise.all([recvA, recvB]);
    expect(a).toBe('hello');
    expect(b).toBe('hello');
    expect(gotC).toBe('none');

    wsA.close();
    wsB.close();
    wsC.close();
    await app.shutdown();
  });

  it('denies forbidden origins', async () => {
    const app = createApp();
    new WebSocketPlugin({
      path: '/ws',
      allowOrigins: ['https://allowed.example'],
    }).install(app as any);
    (app as any).ws('/ws', () => {});
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = (server as Server).address() as any;

    // WebSocket in Node doesn't let us set Origin directly; use fetch Upgrade fallback
    // Using undici WebSocket respects origin via headers option
    const ws = new WebSocket(`ws://localhost:${port}/ws`, {
      headers: { Origin: 'https://forbidden.example' } as any,
    });
    const result = await new Promise<'error' | 'open' | 'close'>(resolve => {
      ws.addEventListener('open', () => resolve('open'));
      ws.addEventListener('error', () => resolve('error'));
      ws.addEventListener('close', () => resolve('close'));
    });
    expect(result === 'error' || result === 'close').toBe(true);
    await app.shutdown();
  });

  it(
    'closes on ping/pong timeout (raw TCP without pong)',
    async () => {
      const app = createApp();
      new WebSocketPlugin({
        path: '/ws',
        heartbeatMs: 50,
        pongTimeoutMs: 120,
      }).install(app as any);
      (app as any).ws('/ws', () => {});
      const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = (server as Server).address() as any;

    const sock = createConnection({ host: '127.0.0.1', port });
    const key = randomBytes(16).toString('base64');
    sock.write(
      `GET /ws HTTP/1.1\r\n` +
        `Host: 127.0.0.1:${port}\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\n` +
        `Sec-WebSocket-Version: 13\r\n` +
        `\r\n`
    );

    await new Promise<void>(res => sock.once('data', () => res()));
    const closed = await new Promise<boolean>(res => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) res(false);
      }, 800);
      sock.once('close', () => {
        done = true;
        clearTimeout(timer);
        res(true);
      });
      sock.once('end', () => {
        done = true;
        clearTimeout(timer);
        res(true);
      });
    });
    expect(closed).toBe(true);
    try {
      sock.destroy();
    } catch {
      // Ignore socket destroy errors
    }
    await app.shutdown();
  },
    30000
  ); // 30s timeout for CI environments

  it('rejects messages larger than maxMessageSize', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/ws', maxMessageSize: 8 }).install(app as any);
    (app as any).ws('/ws', () => {});
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = (server as Server).address() as any;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>(res => ws.addEventListener('open', () => res()));
    // send more than 8 bytes
    ws.send('0123456789');
    const result = await new Promise<'close' | 'open' | 'error'>(resolve => {
      ws.addEventListener('close', () => resolve('close'));
      ws.addEventListener('error', () => resolve('error'));
      ws.addEventListener('open', () => resolve('open'));
    });
    expect(result === 'close' || result === 'error').toBe(true);
    await app.shutdown();
  });

  it('middleware error triggers early close', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/ws' }).install(app as any);
    (app as any).wsUse((_s: unknown, _r: unknown, _n: unknown) => {
      throw new Error('boom');
    });
    (app as any).ws('/ws', () => {
      // Empty handler
    });
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = server.address() as any;
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const result = await new Promise<'error' | 'close'>(resolve => {
      ws.addEventListener('error', () => resolve('error'));
      ws.addEventListener('close', () => resolve('close'));
    });
    expect(result === 'error' || result === 'close').toBe(true);
    await app.shutdown();
  });

  it('concurrent clients broadcast timing scenario', async () => {
    const app = createApp();
    new WebSocketPlugin({ path: '/room/*' }).install(app as any);
    (app as any).ws('/room/*', (socket: any) => {
      const room = socket.url.split('/').pop()!;
      socket.join(room);
    });
    const server = app.listen(0) as unknown as Server;
    await new Promise<void>(r =>
      (server as Server).once('listening', () => r())
    );
    const { port } = (server as Server).address() as any;

    const clients = Array.from({ length: 5 }).map(
      () => new WebSocket(`ws://localhost:${port}/room/a`)
    );
    await Promise.all(
      clients.map(
        c => new Promise<void>(res => c.addEventListener('open', () => res()))
      )
    );

    const received: string[] = [];
    clients.forEach(c =>
      c.addEventListener('message', (e: any) => received.push(String(e.data)))
    );
    (app as any).wsBroadcast('tick', 'a');
    await new Promise(res => setTimeout(res, 50));
    expect(received.filter(x => x === 'tick').length).toBe(5);
    clients.forEach(c => c.close());
    await app.shutdown();
  });
});
