import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectFrameworkIds } from '../framework-selection.js';

const frameworks = {
  'raw-node': { name: 'Raw Node.js' },
  'nextrush-v3': { name: 'NextRush v3' },
  fastify: { name: 'Fastify' },
};
const defaultFrameworks = ['raw-node', 'nextrush-v3', 'fastify'];

for (const profileName of ['standard', 'full', 'stress']) {
  test(`${profileName} profile defaults to all comparison frameworks`, () => {
    assert.deepEqual(
      selectFrameworkIds({ args: {}, profileName, frameworks, defaultFrameworks }),
      defaultFrameworks
    );
  });
}

test('explicit framework selection stays single-framework', () => {
  assert.deepEqual(
    selectFrameworkIds({
      args: { framework: 'fastify' },
      profileName: 'standard',
      frameworks,
      defaultFrameworks,
    }),
    ['fastify']
  );
});

test('quick profile remains NextRush-only when no framework is specified', () => {
  assert.deepEqual(
    selectFrameworkIds({ args: {}, profileName: 'quick', frameworks, defaultFrameworks }),
    ['nextrush-v3']
  );
});

test('explicit framework set stays targeted and ordered', () => {
  assert.deepEqual(
    selectFrameworkIds({
      args: { frameworks: 'nextrush-v3, raw-node' },
      profileName: 'full',
      frameworks,
      defaultFrameworks,
    }),
    ['nextrush-v3', 'raw-node']
  );
});
