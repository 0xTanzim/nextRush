/**
 * @nextrush/stream - Server-Sent Events wire formatting
 *
 * @packageDocumentation
 */

import type { SSEEvent } from '@nextrush/types';

/**
 * Format a single {@link SSEEvent} into its `text/event-stream` wire representation.
 *
 * @remarks
 * Handles every framing detail so handlers never touch it:
 * - `data`: objects are `JSON.stringify`'d; strings are sent verbatim.
 * - Multi-line `data` is split into one `data:` line per line, per the SSE spec
 *   (a raw `\n` inside a single `data:` field would corrupt the stream).
 * - Optional `event:`, `id:`, and `retry:` fields precede the data lines.
 * - The event is terminated by a blank line (`\n\n`).
 *
 * Carriage returns and newlines are stripped from `event`/`id` to prevent
 * field injection (a `\n` in `id` would otherwise start a new field/event).
 *
 * @param event - The event to format.
 * @returns The event as an SSE wire-format string.
 */
export function formatSSE(event: SSEEvent): string {
  let out = '';

  if (event.event !== undefined) {
    out += `event: ${sanitizeField(event.event)}\n`;
  }
  if (event.id !== undefined) {
    out += `id: ${sanitizeField(event.id)}\n`;
  }
  if (event.retry !== undefined) {
    out += `retry: ${String(Math.trunc(event.retry))}\n`;
  }

  const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
  // Per SSE spec, each line of the payload is its own `data:` field.
  // Split on \n; also strip any \r so CRLF sources don't leak a stray \r.
  for (const line of data.split('\n')) {
    out += `data: ${line.replace(/\r$/, '')}\n`;
  }

  // Blank line terminates the event.
  out += '\n';
  return out;
}

/** Strip CR/LF so a field value cannot inject additional SSE fields or events. */
function sanitizeField(value: string): string {
  return value.replace(/[\r\n]/g, '');
}
