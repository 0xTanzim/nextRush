/**
 * @nextrush/stream - Security: SSE/NDJSON framing injection from attacker-controlled data
 *
 * Part of the `audit-unreviewed-security-surface` investigation (task 6.1/6.2).
 * `sse-format.ts`'s `formatSSE()` already strips CR/LF from `event`/`id`
 * (see its own `strips CR/LF from event and id to prevent field injection`
 * test in `stream.test.ts`) — this file adds the audit's own evidence pass,
 * confirming that protection holds specifically for attacker-shaped payloads
 * (a value containing a fake `event:`/`id:`/blank-line sequence, not just a
 * bare `\n`), and that NDJSON's `JSON.stringify`-based framing cannot be
 * broken by embedded newlines in string values.
 */

import { describe, expect, it } from 'vitest';
import { runNDJSONStream, runSSEStream } from '../run';
import { formatSSE } from '../sse-format';

function createMockCtx() {
  const ac = new AbortController();
  const headers: Record<string, string> = {};
  let collectedPromise: Promise<Uint8Array[]> = Promise.resolve([]);
  return {
    signal: ac.signal,
    headers,
    set(field: string, value: string | number | string[]) {
      headers[field] = String(value);
    },
    sendStream(rs: ReadableStream<Uint8Array>) {
      collectedPromise = (async () => {
        const reader = rs.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        return chunks;
      })();
      return collectedPromise.then(() => undefined);
    },
    async collected() {
      const chunks = await collectedPromise;
      return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    },
  };
}

describe('SSE/NDJSON framing — no attacker-controlled event injection (audit-unreviewed-security-surface, 6.1/6.2)', () => {
  it('an attacker-shaped id containing a forged "event:"/blank-line sequence cannot inject a second, fake event', () => {
    // If the CR/LF strip were absent, this payload would render as two
    // distinct SSE events: the real one, plus a forged "malicious-event"
    // carrying attacker-controlled data — because a bare \n inside `id:`
    // would terminate the field and start a new one.
    const attackerId = 'real-id\n\nevent: malicious-event\ndata: forged-payload';
    const out = formatSSE({ data: 'legit', id: attackerId });

    // The entire attacker string collapses onto a single id: line with no \n —
    // the literal text survives (': ', 'data:'), only the \n bytes that would
    // have started a new SSE field/event are stripped.
    expect(out).toBe('id: real-idevent: malicious-eventdata: forged-payload\ndata: legit\n\n');
    // Critically: only one blank-line-terminated event exists in the output.
    expect(out.split('\n\n').filter(Boolean)).toHaveLength(1);
  });

  it('an attacker-shaped event field containing CRLF (not just LF) is also fully stripped', () => {
    const out = formatSSE({ data: 'x', event: 'ok\r\ndata: injected\r\n\r\nevent: fake' });
    expect(out).not.toContain('\r');
    expect(out).not.toContain('\n\n\n'); // no extra event boundary introduced
  });

  it('ctx.sse() end-to-end: an attacker-controlled id/event value passed to write() cannot forge an extra event in the wire output', async () => {
    const ctx = createMockCtx();
    const attackerControlled = 'token\nevent: fake-admin-message\ndata: you are now admin';

    await runSSEStream(ctx, async (w) => {
      await w.write({ data: 'real-payload', id: attackerControlled, event: 'legit-event' });
    });

    const wire = await ctx.collected();
    // Exactly one event (one blank-line terminator), regardless of what the
    // attacker put in id/event.
    expect(wire.split('\n\n').filter(Boolean)).toHaveLength(1);
    expect(wire).toContain('data: real-payload');
  });

  it('ctx.ndjson() end-to-end: a string value containing a raw newline cannot forge an extra NDJSON line, because JSON.stringify escapes it', async () => {
    const ctx = createMockCtx();
    const attackerControlled = 'line1\nFAKE_JSON_LINE\nline2';

    await runNDJSONStream(ctx, async (w) => {
      await w.write({ message: attackerControlled });
    });

    const wire = await ctx.collected();
    // Exactly one NDJSON record (one trailing \n from the writer, none
    // embedded inside the JSON value itself — JSON.stringify renders the
    // value's \n as the escape sequence \\n, not a literal byte).
    const lines = wire.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({ message: attackerControlled });
  });
});
