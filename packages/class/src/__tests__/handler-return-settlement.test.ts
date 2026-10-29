/**
 * @nextrush/class — controller return-value settlement (RFC-050).
 *
 * A controller method's return settles through the same table as a route
 * handler's: `Response`, bytes and streams keep their representation, arrays and
 * objects become JSON, strings and primitives become text, and a response the
 * method already committed wins.
 */

import type { Container } from '@nextrush/di';
import { createContainer } from '@nextrush/di';
import type { Context } from '@nextrush/types';
import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controller, Ctx, Get, getControllerDefinition } from '../index.js';
import { buildRoutes } from '../registrar/builder.js';

let container: Container;

beforeEach(() => {
  container = createContainer();
});

/** Context double that flips `responded` on the first commit, like the real one. */
function createMockContext(): Context {
  let committed = false;
  return {
    method: 'GET',
    url: '/items',
    path: '/items',
    query: {},
    headers: {},
    ip: '127.0.0.1',
    body: undefined,
    readBody: async <T = unknown>() => undefined as T,
    params: {},
    status: 200,
    state: {},
    get responded(): boolean {
      return committed;
    },
    json: vi.fn(() => {
      committed = true;
    }),
    send: vi.fn(() => {
      committed = true;
    }),
    html: vi.fn(),
    redirect: vi.fn(),
    throw: () => {
      throw new Error();
    },
    assert: () => {},
    set: vi.fn(),
    get: vi.fn(),
    next: async () => {},
    raw: { req: {}, res: { writableEnded: false } },
  } as unknown as Context;
}

/** Register a one-route controller and return its executor. */
function executorFor(controller: new () => unknown): (ctx: Context) => Promise<void> {
  container.register(controller, { useClass: controller });
  const definition = getControllerDefinition(controller)!;
  return buildRoutes(definition, container, '', [])[0]!.handler as (ctx: Context) => Promise<void>;
}

describe('controller returns — non-plain values keep their representation (RED before RFC-050)', () => {
  it('preserves a returned Response', async () => {
    const rows = [{ id: 1 }];

    @Controller('/items')
    class ResponseController {
      @Get()
      list() {
        return Response.json(rows, { status: 201 });
      }
    }

    const ctx = createMockContext();
    await executorFor(ResponseController)(ctx);

    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.status).toBe(201);
    expect(ctx.send).toHaveBeenCalledTimes(1);
    const sent = vi.mocked(ctx.send).mock.calls[0]![0];
    expect(sent).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(sent as Uint8Array)).toBe('[{"id":1}]');
  });

  it('preserves returned bytes', async () => {
    const bytes = new Uint8Array([0, 1, 2]);

    @Controller('/items')
    class BytesController {
      @Get()
      list() {
        return bytes;
      }
    }

    const ctx = createMockContext();
    await executorFor(BytesController)(ctx);

    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(bytes);
  });

  it('preserves a returned ArrayBuffer', async () => {
    const buffer = new Uint8Array([9, 8]).buffer;

    @Controller('/items')
    class BufferController {
      @Get()
      list() {
        return buffer;
      }
    }

    const ctx = createMockContext();
    await executorFor(BufferController)(ctx);

    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(buffer);
  });

  it('preserves a returned Web stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    @Controller('/items')
    class StreamController {
      @Get()
      list() {
        return stream;
      }
    }

    const ctx = createMockContext();
    await executorFor(StreamController)(ctx);

    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(stream);
  });

  it('preserves a returned Node readable', async () => {
    const readable = {
      pipe: () => undefined,
      async *[Symbol.asyncIterator]() {
        // no chunks
      },
    };

    @Controller('/items')
    class NodeStreamController {
      @Get()
      list() {
        return readable;
      }
    }

    const ctx = createMockContext();
    await executorFor(NodeStreamController)(ctx);

    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledWith(readable);
  });
});

describe('controller returns — plain values stay unchanged', () => {
  it('keeps an array return as JSON', async () => {
    const rows = [{ id: 1 }];

    @Controller('/items')
    class ArrayController {
      @Get()
      list() {
        return rows;
      }
    }

    const ctx = createMockContext();
    await executorFor(ArrayController)(ctx);

    expect(ctx.json).toHaveBeenCalledWith(rows);
    expect(ctx.send).not.toHaveBeenCalled();
  });

  it('keeps an object return as JSON', async () => {
    @Controller('/items')
    class ObjectController {
      @Get()
      list() {
        return { ok: true };
      }
    }

    const ctx = createMockContext();
    await executorFor(ObjectController)(ctx);

    expect(ctx.json).toHaveBeenCalledWith({ ok: true });
  });

  it('keeps a string return as text', async () => {
    @Controller('/items')
    class StringController {
      @Get()
      list() {
        return 'hello';
      }
    }

    const ctx = createMockContext();
    await executorFor(StringController)(ctx);

    expect(ctx.send).toHaveBeenCalledWith('hello');
    expect(ctx.json).not.toHaveBeenCalled();
  });

  it('keeps a number return as its string form', async () => {
    @Controller('/items')
    class NumberController {
      @Get()
      list() {
        return 7;
      }
    }

    const ctx = createMockContext();
    await executorFor(NumberController)(ctx);

    expect(ctx.send).toHaveBeenCalledWith('7');
  });

  it('keeps a null return as JSON null', async () => {
    @Controller('/items')
    class NullController {
      @Get()
      list() {
        return null;
      }
    }

    const ctx = createMockContext();
    await executorFor(NullController)(ctx);

    expect(ctx.json).toHaveBeenCalledWith(null);
  });

  it('keeps an undefined return producing no body', async () => {
    @Controller('/items')
    class VoidController {
      @Get()
      list(@Ctx() c: Context) {
        c.send('committed');
      }
    }

    const ctx = createMockContext();
    await executorFor(VoidController)(ctx);

    expect(ctx.send).toHaveBeenCalledTimes(1);
    expect(ctx.send).toHaveBeenCalledWith('committed');
  });

  it('keeps a committed response over the returned value', async () => {
    @Controller('/items')
    class CommittedController {
      @Get()
      list(@Ctx() c: Context) {
        c.json({ committed: true });
        return ['ignored'];
      }
    }

    const ctx = createMockContext();
    await executorFor(CommittedController)(ctx);

    expect(ctx.json).toHaveBeenCalledTimes(1);
    expect(ctx.json).toHaveBeenCalledWith({ committed: true });
    expect(ctx.send).not.toHaveBeenCalled();
  });
});
