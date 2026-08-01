/**
 * @nextrush/adapter-serverless - AWS API Gateway v2 (HTTP API) mapper.
 *
 * Payload format 2.0 — identical translation to Lambda Function URL; only the
 * mapper name differs. Shared logic lives in {@link ./\_v2}.
 *
 * @packageDocumentation
 */

import type { EventMapper } from '../types';
import {
  v2FromResponse,
  v2ToRequest,
  type ApiGatewayV2Event,
  type ApiGatewayV2Result,
} from './_v2';

export type { ApiGatewayV2Event, ApiGatewayV2Result };

/** AWS API Gateway v2 / HTTP API (payload format 2.0) EventMapper. */
export const apigwV2: EventMapper<ApiGatewayV2Event, ApiGatewayV2Result> = {
  name: 'apigw-v2',
  toRequest: (event) => v2ToRequest(event),
  fromResponse: (response) => v2FromResponse(response),
  detect: (event) => event.version === '2.0',
};
