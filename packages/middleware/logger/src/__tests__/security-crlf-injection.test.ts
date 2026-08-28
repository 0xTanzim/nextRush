/**
 * @nextrush/logger - Security: CRLF / log-forging surface
 *
 * Part of the `audit-unreviewed-security-surface` investigation (task 6.1/6.2).
 * Confirms whether attacker-controlled request data (`ctx.path`, `ctx.query`)
 * reaches the logger's default message/log-data unsanitized, which would let a
 * `\r\n`-bearing request forge fake log lines on a plain-text transport.
 *
 * @see report/ audit findings (this change does not remediate — see AGENTS.md §20)
 */

import type { Context } from '@nextrush/types';
import { describe, expect, it, vi } from 'vitest';
import { logger, type LogEntry, type LoggerContext } from '../index';

function createMockContext(overrides: Partial<Context> = {}): Context {
  const headers: Record<string, string | string[] | undefined> = {};
  const responseHeaders: Record<string, string> = {};

  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    query: {},
    params: {},
    headers,
    ip: '127.0.0.1',
    body: undefined,
    status: 200,
    state: {},
    raw: {
      req: {} as any,
      res: {} as any,
    },
    json: vi.fn(),
    send: vi.fn(),
    html: vi.fn(),
    redirect: vi.fn(),
    set: vi.fn((key: string, value: string) => {
      responseHeaders[key.toLowerCase()] = value;
    }),
    get: vi.fn((key: string) => headers[key.toLowerCase()]),
    next: vi.fn(),
    ...overrides,
  } as Context;
}

describe('logger() middleware — CRLF / log-forging surface (audit-unreviewed-security-surface, 6.1/6.2)', () => {
  it('passes a raw \\r\\n-bearing ctx.path straight into the default log message, unsanitized', async () => {
    const captured: LogEntry[] = [];
    const forgedPath = '/legit\r\n[FAKE] 2024-01-01 ERROR admin deleted all users\r\n/still-attacker';

    const ctx = createMockContext({ path: forgedPath });
    const middleware = logger({
      silent: true,
      transports: [(entry) => void captured.push(entry)],
    });

    await middleware(ctx, async () => {});

    const entry = captured.find((e) => typeof e.message === 'string' && e.message.includes(forgedPath));
    expect(entry).toBeDefined();
    // The finding: the message contains the raw, un-stripped CR/LF bytes.
    // @nextrush/logger performs no sanitization before handing this string to
    // the (external, out-of-scope) @nextrush/log transport — a plain-text
    // transport would render the embedded \r\n as literal newlines, letting
    // the request forge additional, fake-looking log lines.
    expect(entry!.message).toContain('\r\n');
    expect(entry!.message).toBe(`GET ${forgedPath}`);
  });

  it('passes raw \\r\\n-bearing query values into logData unsanitized', async () => {
    const captured: LogEntry[] = [];
    const forgedQueryValue = 'x\r\n[FAKE] admin escalated privileges';

    const ctx = createMockContext({ query: { redirect: forgedQueryValue } });
    const middleware = logger({
      silent: true,
      transports: [(entry) => void captured.push(entry)],
    });

    await middleware(ctx, async () => {});

    const entry = captured.find((e) => e.data && 'query' in e.data);
    expect(entry).toBeDefined();
    const query = (entry!.data as { query: Record<string, string> }).query;
    expect(query['redirect']).toBe(forgedQueryValue);
    expect(query['redirect']).toContain('\r\n');
  });

  it('a custom formatMessage receives the same unsanitized ctx.path (confirms the gap is upstream of any user hook)', async () => {
    const forgedPath = '/x\r\ninjected-line';
    const ctx = createMockContext({ path: forgedPath });
    const formatMessage = vi.fn((c: Context) => `custom: ${c.path}`);

    const middleware = logger({ silent: true, formatMessage });

    await middleware(ctx, async () => {});

    expect(formatMessage).toHaveBeenCalled();
    const [passedCtx] = formatMessage.mock.calls[0]!;
    expect(passedCtx.path).toBe(forgedPath);
    expect(passedCtx.path).toContain('\r\n');
  });
});
