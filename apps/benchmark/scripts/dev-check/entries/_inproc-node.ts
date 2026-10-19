// A structural `IncomingMessage`/`ServerResponse` pair for the in-proc Node row.
//
// `createHandler` is the Node adapter's entry point and it takes node:http
// objects. Standing in for them keeps the measured work inside the adapter's
// per-request path — context, dispatch, body parsing, response building — and out
// of `node:http`'s own object construction, which the `wire` stage measures over a
// real socket. The response methods are the ones the adapter actually calls, and
// nothing is buffered, so a row cannot accidentally measure a sink.
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface NodeShape {
  path: string;
  headers: Record<string, string>;
  body?: string;
}

type Listener = (...args: never[]) => void;

interface FakeReq {
  req: IncomingMessage;
  emit(event: string, ...args: never[]): void;
}

function createReq(shape: NodeShape, hasBody: boolean): FakeReq {
  const listeners = new Map<string, Listener[]>();
  const req = {
    method: hasBody ? 'POST' : 'GET',
    url: shape.path,
    headers: shape.headers,
    socket: { remoteAddress: '1.1.1.1' },
    destroyed: false,
    complete: true,
    readableEnded: false,
    on(event: string, fn: Listener) {
      let list = listeners.get(event);
      if (list === undefined) {
        list = [];
        listeners.set(event, list);
      }
      list.push(fn);
      return req;
    },
    once(event: string, fn: Listener) {
      return req.on(event, fn);
    },
    off(event: string, fn: Listener) {
      const list = listeners.get(event);
      const index = list?.indexOf(fn) ?? -1;
      if (index >= 0) list?.splice(index, 1);
      return req;
    },
    pause() {
      return req;
    },
  };

  return {
    req: req as unknown as IncomingMessage,
    emit(event, ...args) {
      for (const fn of listeners.get(event) ?? []) fn(...args);
    },
  };
}

function createRes(onEnd: (status: number) => void): ServerResponse {
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader() {
      return res;
    },
    getHeader() {
      return undefined;
    },
    writeHead() {
      res.headersSent = true;
      return res;
    },
    write() {
      return true;
    },
    end() {
      onEnd(res.statusCode);
      return res;
    },
    on() {
      return res;
    },
    once() {
      return res;
    },
    off() {
      return res;
    },
    destroy() {
      /* nothing is buffered, so there is nothing to tear down */
    },
  };
  return res as unknown as ServerResponse;
}

/**
 * One request through the Node adapter, resolved with the response status.
 *
 * @remarks
 * The body is delivered on a macrotask rather than a microtask: the body parser
 * registers its listeners after at least one `await`, so a microtask queued
 * before the dispatch would fire before anything was listening.
 */
export function nodeRequest(
  handle: (req: IncomingMessage, res: ServerResponse) => void,
  shape: NodeShape
): () => Promise<number> {
  const body = shape.body === undefined ? undefined : Buffer.from(shape.body, 'utf8');

  return () =>
    new Promise<number>((resolve) => {
      const { req, emit } = createReq(shape, body !== undefined);
      const res = createRes(resolve);
      if (body !== undefined) {
        setImmediate(() => {
          emit('data', body as never);
          emit('end');
        });
      }
      handle(req, res);
    });
}
