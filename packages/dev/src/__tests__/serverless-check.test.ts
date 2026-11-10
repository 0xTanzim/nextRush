import { describe, expect, it } from 'vitest';
import { detectTopLevelAwait, formatTopLevelAwaitWarning } from '../checker/serverless-check.js';

describe('Serverless Static Analysis: Top-Level Await Detection (Issue #75)', () => {
  it('detects top-level await in simple scripts', () => {
    const code = `
import { createApp } from 'nextrush';
const app = createApp();
await app.ready();
export default app;
`;
    const result = detectTopLevelAwait(code);
    expect(result.hasTopLevelAwait).toBe(true);
    expect(result.lines).toEqual([4]);
  });

  it('does not flag await inside functions or async methods', () => {
    const code = `
import { createApp } from 'nextrush';
const app = createApp();

export const handler = createLambdaHandler(async () => {
  await registerControllers(app, { root: './src' });
  return app;
});

app.get('/test', async (ctx) => {
  const data = await fetchData();
  ctx.json(data);
});
`;
    const result = detectTopLevelAwait(code);
    expect(result.hasTopLevelAwait).toBe(false);
    expect(result.lines).toEqual([]);
  });

  it('ignores comments containing await', () => {
    const code = `
// await app.ready();
/* await somethingElse(); */
const app = createApp();
export default app;
`;
    const result = detectTopLevelAwait(code);
    expect(result.hasTopLevelAwait).toBe(false);
  });

  it('formats a descriptive and actionable diagnostic message', () => {
    const warning = formatTopLevelAwaitWarning('src/index.ts', [12]);
    expect(warning).toContain('src/index.ts');
    expect(warning).toContain('ERR_REQUIRE_ASYNC_MODULE');
    expect(warning).toContain('createLambdaHandler(async () =>');
  });
});
