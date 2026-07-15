/**
 * @nextrush/adapter-serverless - AWS Lambda Function URL response STREAMING (5a.1).
 *
 * The buffered `createLambdaHandler` returns a v2 result whose `body` is the full
 * response (a streamed body is collected first). Lambda Function URLs also support
 * *true* streaming via `awslambda.streamifyResponse`, where the handler writes
 * bytes to a `responseStream` as they are produced — lower TTFB, unbounded body.
 *
 * `awslambda` is a runtime-injected global (not importable), so it is read from
 * `globalThis` and used only when present; locally/in tests the inner handler is
 * driven directly with a `responseStream` stub.
 *
 * ```ts
 * import { createLambdaStreamingHandler } from '@nextrush/adapter-serverless';
 * export const handler = createLambdaStreamingHandler(app); // Function URL, RESPONSE_STREAM mode
 * ```
 *
 * @packageDocumentation
 */

import type { Application } from '@nextrush/core';
import { createFetchHandler as createEdgeFetchHandler } from '@nextrush/adapter-edge';
import { v2ToRequest, type ApiGatewayV2Event } from './mappers/_v2';
import type { ServerlessHandlerOptions } from './types';

/** Minimal writable surface of the Lambda-provided response stream. */
export interface LambdaResponseStream {
  write(chunk: Uint8Array | string): void;
  end(): void;
}

/** The status/header prelude written ahead of a streamed body. */
export interface LambdaStreamMetadata {
  statusCode: number;
  headers?: Record<string, string>;
  cookies?: string[];
}

/** The subset of the `awslambda` runtime global this handler uses. */
export interface AwsLambdaStreaming {
  streamifyResponse<H>(handler: H): H;
  HttpResponseStream: {
    from(stream: LambdaResponseStream, metadata: LambdaStreamMetadata): LambdaResponseStream;
  };
}

/** A Lambda Function URL streaming handler `(event, responseStream, context?)`. */
export type StreamingLambdaHandler = (
  event: ApiGatewayV2Event,
  responseStream: LambdaResponseStream,
  context?: unknown,
) => Promise<void>;

/** Read the Lambda-injected `awslambda` global, if the runtime provides it. */
function getAwsLambda(): AwsLambdaStreaming | undefined {
  return (globalThis as unknown as { awslambda?: AwsLambdaStreaming }).awslambda;
}

/**
 * Create a **streaming** AWS Lambda Function URL handler for a NextRush app.
 *
 * Runs the shared `Context` pipeline, then writes the response body to the
 * Lambda `responseStream` chunk-by-chunk (no buffering) with the status/headers
 * sent as the metadata prelude. Wrapped with `awslambda.streamifyResponse` when
 * the runtime global is present.
 *
 * @param app - The NextRush application.
 * @param options - Optional Tier-2 tuning ({@link ServerlessHandlerOptions}).
 * @returns The streaming handler (streamify-wrapped on real Lambda).
 */
export function createLambdaStreamingHandler(
  app: Application,
  options: ServerlessHandlerOptions = {},
): StreamingLambdaHandler {
  const engine = createEdgeFetchHandler(
    app,
    options.timeout !== undefined ? { timeout: options.timeout } : {},
  );

  const inner: StreamingLambdaHandler = async (event, responseStream) => {
    const response = await engine(v2ToRequest(event));

    const headers: Record<string, string> = {};
    for (const [name, value] of response.headers.entries()) {
      if (name.toLowerCase() === 'set-cookie') continue;
      headers[name] = value;
    }
    const cookies = response.headers.getSetCookie();
    const metadata: LambdaStreamMetadata = {
      statusCode: response.status,
      headers,
      ...(cookies.length > 0 ? { cookies } : {}),
    };

    // On real Lambda, HttpResponseStream.from writes the metadata prelude and
    // returns the body-writable. Without the global (local/test), fall back to
    // the raw stream (metadata is carried out-of-band by the caller's stub).
    const aws = getAwsLambda();
    const out = aws !== undefined ? aws.HttpResponseStream.from(responseStream, metadata) : responseStream;

    if (response.body !== null) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        out.write(value); // one write per produced chunk — not buffered
      }
    }
    out.end();
  };

  const aws = getAwsLambda();
  return aws !== undefined ? aws.streamifyResponse(inner) : inner;
}
