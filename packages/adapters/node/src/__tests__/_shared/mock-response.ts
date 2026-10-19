/**
 * @nextrush/adapter-node - Shared mock HTTP response/request for unit tests
 *
 * Returns the write spies alongside the response, so a test can assert that a
 * failed write produced no header byte and no body byte — not merely that the
 * write threw. An assertion on "nothing was written" is the whole point of the
 * serialize-before-commit contract, and it cannot be expressed by inspecting the
 * mock response afterwards.
 */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { vi } from 'vitest';

/** Build a mock `ServerResponse` whose write calls are observable. */
export function createMockResponse() {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);

  const setHeader = vi.spyOn(res, 'setHeader').mockImplementation(() => res);
  const end = vi.spyOn(res, 'end').mockImplementation(() => res);
  // Mirror writeHead's statusCode side effect so status assertions stay faithful.
  const writeHead = vi.spyOn(res, 'writeHead').mockImplementation((status: number) => {
    res.statusCode = status;
    return res;
  });

  return { res, setHeader, end, writeHead };
}

/** Build a mock `IncomingMessage`. */
export function createMockRequest(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);

  req.method = overrides.method ?? 'GET';
  req.url = overrides.url ?? '/';
  req.headers = overrides.headers ?? {};

  return req;
}
