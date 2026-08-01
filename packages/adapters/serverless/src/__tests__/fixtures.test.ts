/**
 * Full-chain golden-fixture conformance (spec: serverless-adapter — end-to-end
 * platform integration fixtures).
 *
 * For each provider: load `fixtures/<provider>/event.json`, run it through the
 * real mapper + a canonical app, and assert the produced platform result matches
 * `fixtures/<provider>/expected-result.json`. Exercises the full chain
 * `Platform Event → mapper → app.callback() → Response → mapper → result`, not
 * just an isolated Request→Response unit.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApp } from '@nextrush/core';
import {
  apigwV1,
  apigwV2,
  azure,
  createServerlessAdapter,
  gcf,
  type EventMapper,
} from '../index';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

interface Case {
  provider: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous mapper event/result types across providers; the fixture drives the shape
  mapper: EventMapper<any, any>;
  statusKey: 'statusCode' | 'status';
}

const cases: Case[] = [
  { provider: 'apigw-v2', mapper: apigwV2, statusKey: 'statusCode' },
  { provider: 'apigw-v1', mapper: apigwV1, statusKey: 'statusCode' },
  { provider: 'gcf', mapper: gcf, statusKey: 'statusCode' },
  { provider: 'azure', mapper: azure, statusKey: 'status' },
];

function readFixture(provider: string, name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixturesDir, provider, name), 'utf8')) as Record<string, unknown>;
}

/** Canonical app: echoes the mapped method/path/query so the chain is observable. */
function canonicalApp(): ReturnType<typeof createApp> {
  const app = createApp();
  app.use((ctx) => {
    ctx.json({ method: ctx.method, path: ctx.path, query: ctx.query });
  });
  return app;
}

describe.each(cases)('full-chain fixture [$provider]', ({ provider, mapper, statusKey }) => {
  it('produces the committed expected-result', async () => {
    const event = readFixture(provider, 'event.json');
    const expected = readFixture(provider, 'expected-result.json');

    const handler = createServerlessAdapter({ mappers: [mapper], provider }).createHandler(canonicalApp());
    const result = (await handler(event)) as Record<string, unknown>;

    expect(result[statusKey]).toBe(expected[statusKey]);
    expect(result.isBase64Encoded).toBe(expected.isBase64Encoded);
    expect(JSON.parse(result.body as string)).toEqual(expected.body);
  });
});
