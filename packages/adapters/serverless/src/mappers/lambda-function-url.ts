/**
 * @nextrush/adapter-serverless - AWS Lambda Function URL mapper.
 *
 * Uses the API Gateway v2 / Lambda Function URL payload format (version 2.0),
 * shared with the `apigw-v2` mapper via {@link ./\_v2}.
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

/** Lambda Function URL event (payload format 2.0). */
export type LambdaFunctionUrlEvent = ApiGatewayV2Event;
/** Lambda Function URL result (payload format 2.0). */
export type LambdaFunctionUrlResult = ApiGatewayV2Result;

/** AWS Lambda Function URL (APIGW v2 payload format) EventMapper. */
export const lambdaFunctionUrl: EventMapper<LambdaFunctionUrlEvent, LambdaFunctionUrlResult> = {
  name: 'lambda-function-url',
  toRequest: (event) => v2ToRequest(event),
  fromResponse: (response) => v2FromResponse(response),
  detect: (event) => event.version === '2.0',
};
