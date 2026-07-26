/**
 * P2-5 (report/dx-review-serverless-edge-adapters.md): each mapper's
 * `toRequest` currently dereferences untrusted event fields with no guard,
 * so a malformed event throws a raw `TypeError` from framework internals
 * instead of a named, actionable error. These tests assert the new guard.
 */

import { describe, expect, it } from 'vitest';
import { apigwV1, apigwV2, azure, gcf } from '../index';

describe('mapper guards on malformed events (P2-5)', () => {
  it('apigwV2.toRequest throws a named error when requestContext.http is missing', () => {
    // @ts-expect-error -- deliberately malformed event to exercise the guard
    expect(() => apigwV2.toRequest({})).toThrow(/\[nextrush\/serverless\].*requestContext\.http\.method/i);
  });

  it('apigwV1.toRequest throws a named error when httpMethod is missing', () => {
    // @ts-expect-error -- deliberately malformed event to exercise the guard
    expect(() => apigwV1.toRequest({})).toThrow(/\[nextrush\/serverless\].*apigw-v1.*method/i);
  });

  it('gcf.toRequest throws a named error when method is missing', () => {
    // @ts-expect-error -- deliberately malformed event to exercise the guard
    expect(() => gcf.toRequest({})).toThrow(/\[nextrush\/serverless\].*gcf.*method/i);
  });

  it('azure.toRequest throws a named error when method is missing', () => {
    // @ts-expect-error -- deliberately malformed event to exercise the guard
    expect(() => azure.toRequest({})).toThrow(/\[nextrush\/serverless\].*azure.*method/i);
  });

  it('azure.toRequest throws a named error when url is missing', () => {
    // @ts-expect-error -- deliberately malformed event to exercise the guard
    expect(() => azure.toRequest({ method: 'GET' })).toThrow(/\[nextrush\/serverless\].*azure.*url/i);
  });

  it('still parses a well-formed event with no error (no regression)', () => {
    const req = apigwV2.toRequest({
      requestContext: { http: { method: 'GET' } },
      rawPath: '/hello',
    });
    expect(req.method).toBe('GET');
  });
});
