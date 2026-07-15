/**
 * True Lambda Function URL response-streaming tests (5a.1).
 *
 * Proves the streaming handler writes chunks INCREMENTALLY (one write per
 * produced chunk, not one buffered blob) and sends status/headers via
 * `awslambda.HttpResponseStream.from`, using a mock `awslambda` global.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import {
  createLambdaStreamingHandler,
  type AwsLambdaStreaming,
  type LambdaResponseStream,
  type LambdaStreamMetadata,
} from '../index';
import type { ApiGatewayV2Event } from '../index';

const globalRef = globalThis as unknown as { awslambda?: AwsLambdaStreaming };

afterEach(() => {
  delete globalRef.awslambda;
});

function v2(path: string): ApiGatewayV2Event {
  return { version: '2.0', rawPath: path, requestContext: { http: { method: 'GET' } } };
}

describe('createLambdaStreamingHandler (5a.1 true streaming)', () => {
  it('streams chunks incrementally and sets metadata via HttpResponseStream', async () => {
    const chunks: string[] = [];
    let meta: LambdaStreamMetadata | undefined;
    let streamifyUsed = false;
    let ended = false;

    const responseStream: LambdaResponseStream = {
      write: (c) => chunks.push(typeof c === 'string' ? c : new TextDecoder().decode(c)),
      end: () => { ended = true; },
    };

    globalRef.awslambda = {
      streamifyResponse: <H>(h: H): H => { streamifyUsed = true; return h; },
      HttpResponseStream: {
        from: (stream: LambdaResponseStream, metadata: LambdaStreamMetadata) => {
          meta = metadata;
          return stream;
        },
      },
    };

    const app = createApp();
    app.use(async (ctx) => {
      ctx.set('content-type', 'text/plain');
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(enc.encode('alpha'));
          controller.enqueue(enc.encode('beta'));
          controller.close();
        },
      });
      await ctx.sendStream(stream);
    });

    const handler = createLambdaStreamingHandler(app);
    await handler(v2('/stream'), responseStream);

    expect(streamifyUsed).toBe(true); // wrapped with streamifyResponse when the global is present
    expect(meta?.statusCode).toBe(200);
    expect(meta?.headers?.['content-type']).toContain('text/plain');
    // Two separate writes prove incremental streaming — a buffered path would be one blob.
    expect(chunks).toEqual(['alpha', 'beta']);
    expect(ended).toBe(true);
  });

  it('works without the awslambda global (local/dev): writes straight to the stream', async () => {
    const chunks: string[] = [];
    const responseStream: LambdaResponseStream = {
      write: (c) => chunks.push(typeof c === 'string' ? c : new TextDecoder().decode(c)),
      end: () => undefined,
    };

    const app = createApp();
    app.use(async (ctx) => {
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(enc.encode('x'));
          controller.close();
        },
      });
      await ctx.sendStream(stream);
    });

    const handler = createLambdaStreamingHandler(app);
    await handler(v2('/s'), responseStream);
    expect(chunks).toEqual(['x']);
  });
});
