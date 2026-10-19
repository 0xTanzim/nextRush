import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RUNTIMES,
  STAGES,
  appliesTo,
  flattenRules,
  misexecutedRules,
  uncoveredRules,
  validateRules,
} from '../budget-rules.mjs';

const rule = (over = {}) => ({
  runtimes: ['bun'],
  stage: 'inproc',
  max: 1.9,
  target: 1.3,
  ...over,
});

const budgetsWith = (ratios = {}, bundleKb = {}) => ({ bundleKb, ratios });

test('accepts a complete budget with bundle and ratio rules', () => {
  const budgets = budgetsWith(
    { 'inproc.nextrush.vs_hono': rule() },
    { 'hello-nextrush': { max: 40, runtimes: ['bun', 'node'], stage: 'bundle' } }
  );
  assert.deepEqual(validateRules(budgets), []);
});

test('rejects a rule with no runtime list', () => {
  const errors = validateRules(budgetsWith({ bad: rule({ runtimes: undefined }) }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /runtimes/);
});

test('rejects an empty runtime list', () => {
  const errors = validateRules(budgetsWith({ bad: rule({ runtimes: [] }) }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /runtimes/);
});

test('rejects an unknown runtime', () => {
  const errors = validateRules(budgetsWith({ bad: rule({ runtimes: ['bun', 'deno2'] }) }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /deno2/);
});

test('rejects an unknown stage', () => {
  const errors = validateRules(budgetsWith({ bad: rule({ stage: 'wire' }) }));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /wire/);
});

test('rejects a rule with neither max nor min', () => {
  const errors = validateRules(
    budgetsWith({ bad: rule({ max: undefined, min: undefined, target: 1.3 }) })
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /max.*min/);
});

test('rejects a target outside the hard bound', () => {
  const above = validateRules(budgetsWith({ bad: rule({ max: 1.2, target: 1.3 }) }));
  assert.equal(above.length, 1);
  assert.match(above[0], /target/);
  const below = validateRules(budgetsWith({ bad: rule({ min: 0.9, target: 0.8, max: undefined }) }));
  assert.equal(below.length, 1);
  assert.match(below[0], /target/);
});

test('flattens every rule with its full name and stage', () => {
  const flat = flattenRules(
    budgetsWith(
      { 'inproc.nextrush.vs_hono': rule() },
      { 'hello-nextrush': { max: 40, runtimes: ['bun'], stage: 'bundle' } }
    )
  );
  assert.deepEqual(
    flat.map(({ name, stage }) => ({ name, stage })),
    [
      { name: 'bundle.hello-nextrush.kb', stage: 'bundle' },
      { name: 'inproc.nextrush.vs_hono', stage: 'inproc' },
    ]
  );
});

test('appliesTo honours the declared runtime list', () => {
  assert.equal(appliesTo(rule({ runtimes: ['bun'] }), 'bun'), true);
  assert.equal(appliesTo(rule({ runtimes: ['bun'] }), 'node'), false);
  assert.equal(appliesTo(rule({ runtimes: ['bun', 'deno'] }), 'deno'), true);
});

test('uncoveredRules reports an applicable rule whose stage ran but was not gated', () => {
  const flat = flattenRules(budgetsWith({ nr: rule() }));
  const uncovered = uncoveredRules(flat, {
    rt: 'bun',
    selectedStages: ['inproc'],
    evaluated: new Set(),
  });
  assert.deepEqual(uncovered.map((r) => r.name), ['nr']);
});

test('uncoveredRules ignores a rule whose stage did not run', () => {
  const flat = flattenRules(budgetsWith({ cold: rule({ stage: 'cold' }) }));
  const uncovered = uncoveredRules(flat, {
    rt: 'bun',
    selectedStages: ['inproc'],
    evaluated: new Set(),
  });
  assert.deepEqual(uncovered, []);
});

test('uncoveredRules ignores a rule scoped away from the current runtime', () => {
  const flat = flattenRules(budgetsWith({ nodeOnly: rule({ runtimes: ['node'] }) }));
  const uncovered = uncoveredRules(flat, {
    rt: 'bun',
    selectedStages: ['inproc'],
    evaluated: new Set(),
  });
  assert.deepEqual(uncovered, []);
});

test('uncoveredRules accepts an applicable rule that was evaluated', () => {
  const flat = flattenRules(budgetsWith({ nr: rule() }));
  const uncovered = uncoveredRules(flat, {
    rt: 'bun',
    selectedStages: ['inproc'],
    evaluated: new Set(['nr']),
  });
  assert.deepEqual(uncovered, []);
});

test('misexecutedRules flags a rule evaluated on a runtime it excludes', () => {
  const flat = flattenRules(budgetsWith({ bunOnly: rule({ runtimes: ['bun'] }) }));
  const bad = misexecutedRules(flat, { rt: 'node', evaluated: new Set(['bunOnly']) });
  assert.deepEqual(bad.map((r) => r.name), ['bunOnly']);
});

test('the known runtime and stage vocabularies are exposed', () => {
  assert.deepEqual(RUNTIMES, ['bun', 'node', 'deno']);
  assert.deepEqual(STAGES, ['bundle', 'cold', 'inproc']);
});
