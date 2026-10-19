// Pure budget-rule helpers.
//
// The gate's rules live in `budgets.json`; keeping their validation and coverage
// logic here makes both testable without starting a measurement. A rule must
// declare the runtimes it applies to and the stage that evaluates it: silence is
// how a rule becomes inert on one runtime.

export const RUNTIMES = Object.freeze(['bun', 'node', 'deno']);
export const STAGES = Object.freeze(['bundle', 'cold', 'inproc']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

/** Flatten every measured rule to `{ name, stage, rule }`. */
export function flattenRules(budgets) {
  const flat = [];
  for (const [key, rule] of Object.entries(budgets?.bundleKb ?? {})) {
    flat.push({ name: `bundle.${key}.kb`, stage: rule?.stage, rule });
  }
  for (const [name, rule] of Object.entries(budgets?.ratios ?? {})) {
    flat.push({ name, stage: rule?.stage, rule });
  }
  return flat;
}

function validateOne(name, rule) {
  const errors = [];
  if (!isObject(rule)) return [`${name}: rule must be an object`];

  const runtimes = rule.runtimes;
  if (!Array.isArray(runtimes) || runtimes.length === 0) {
    errors.push(`${name}: runtimes must be a non-empty array`);
  } else {
    for (const runtime of runtimes) {
      if (!RUNTIMES.includes(runtime)) errors.push(`${name}: unknown runtime "${runtime}"`);
    }
    if (new Set(runtimes).size !== runtimes.length) {
      errors.push(`${name}: runtimes must not contain duplicates`);
    }
  }

  if (!STAGES.includes(rule.stage)) {
    errors.push(`${name}: stage must be one of ${STAGES.join(', ')} (got "${rule.stage}")`);
  }

  if (rule.max === undefined && rule.min === undefined) {
    errors.push(`${name}: must declare max or min`);
  }
  for (const field of ['max', 'min', 'target']) {
    if (rule[field] !== undefined && !isNumber(rule[field])) {
      errors.push(`${name}: ${field} must be a finite number`);
    }
  }
  if (isNumber(rule.max) && isNumber(rule.target) && rule.target > rule.max) {
    errors.push(`${name}: target ${rule.target} must not exceed max ${rule.max}`);
  }
  if (isNumber(rule.min) && isNumber(rule.target) && rule.target < rule.min) {
    errors.push(`${name}: target ${rule.target} must not be below min ${rule.min}`);
  }
  return errors;
}

/** Validate every budget rule. Returns human-readable errors; empty means valid. */
export function validateRules(budgets) {
  const errors = [];
  for (const section of ['bundleKb', 'ratios']) {
    const value = budgets?.[section];
    if (value !== undefined && !isObject(value)) {
      errors.push(`${section}: must be an object`);
    }
  }
  for (const { name, rule } of flattenRules(budgets)) {
    errors.push(...validateOne(name, rule));
  }
  return errors;
}

/** Whether `rule` applies to the runtime under test. */
export function appliesTo(rule, rt) {
  return Array.isArray(rule?.runtimes) && rule.runtimes.includes(rt);
}

/**
 * Applicable rules whose stage is part of this run but that were never gated.
 *
 * A partial run (`check.mjs probe`) must not demand coverage for stages it did
 * not select, so `selectedStages` is part of the contract.
 */
export function uncoveredRules(flat, { rt, selectedStages, evaluated }) {
  return flat
    .filter(
      ({ name, stage, rule }) =>
        appliesTo(rule, rt) && selectedStages.includes(stage) && !evaluated.has(name)
    )
    .map(({ name, stage }) => ({ name, stage }));
}

/** Rules that were gated on a runtime their declaration excludes. */
export function misexecutedRules(flat, { rt, evaluated }) {
  return flat
    .filter(({ name, rule }) => evaluated.has(name) && !appliesTo(rule, rt))
    .map(({ name }) => ({ name }));
}
