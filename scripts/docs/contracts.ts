/**
 * Contract definitions for NextRush documentation validation.
 *
 * Defines tier classification, required sections per tier, forbidden words,
 * and word budgets. Source of truth: docs-standards.instructions.md + PRD.
 */

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

export type Tier = 1 | 2 | 3;

/**
 * Map file paths (relative to content/docs/) to documentation tiers.
 * Paths are matched by the directory/filename under packages/.
 */
const TIER_1_PACKAGES = new Set([
  'core/core',
  'core/router',
  'core/types',
  'core/errors',
  'di/di',
  'di/decorators',
  'plugins/controllers',
]);

const TIER_2_PACKAGES = new Set([
  'middleware/cors',
  'middleware/helmet',
  'middleware/body-parser',
  'middleware/rate-limit',
  'middleware/compression',
  'middleware/cookies',
  'plugins/logger',
  'plugins/static',
  'plugins/template',
  'plugins/events',
  'plugins/websocket',
]);

const TIER_3_PACKAGES = new Set([
  'middleware/request-id',
  'middleware/timer',
  'adapters/node',
  'adapters/bun',
  'adapters/deno',
  'adapters/edge',
  'core/dev',
  'core/runtime',
  'core/nextrush',
]);

export function classifyTier(relativePath: string): Tier | null {
  // Extract key from path like "packages/core/core.mdx" → "core/core"
  const match = relativePath.match(/^packages\/(.+)\.mdx$/);
  if (!match) return null;

  const key = match[1];
  if (TIER_1_PACKAGES.has(key)) return 1;
  if (TIER_2_PACKAGES.has(key)) return 2;
  if (TIER_3_PACKAGES.has(key)) return 3;
  return null;
}

// ---------------------------------------------------------------------------
// Required sections per tier
// ---------------------------------------------------------------------------

export const TIER_1_SECTIONS = [
  'The Real Problem',
  'Why NextRush Solves It This Way',
  'Mental Model',
  'Execution Flow',
  'Minimal Correct Usage',
  'What Happens Automatically',
  'Configuration',
  'Error and Failure Behavior',
  'Performance Notes',
  'Security Considerations',
  'Common Mistakes',
  'When Not To Use',
  'Next Steps',
] as const;

export const TIER_2_SECTIONS = [
  'Problem',
  'Default Behavior',
  'Installation',
  'Minimal Usage',
  'Configuration Options',
  'Integration Example',
  'Common Mistakes',
  'Troubleshooting',
] as const;

export const TIER_3_SECTIONS = [
  'Purpose',
  'Installation',
  'Minimal Usage',
  'API Reference',
  'One Practical Example',
] as const;

export function getRequiredSections(tier: Tier): readonly string[] {
  switch (tier) {
    case 1:
      return TIER_1_SECTIONS;
    case 2:
      return TIER_2_SECTIONS;
    case 3:
      return TIER_3_SECTIONS;
  }
}

// ---------------------------------------------------------------------------
// Word budgets per tier
// ---------------------------------------------------------------------------

export interface WordBudget {
  min: number;
  max: number;
}

export function getWordBudget(tier: Tier): WordBudget {
  switch (tier) {
    case 1:
      return { min: 1200, max: 2000 };
    case 2:
      return { min: 600, max: 1200 };
    case 3:
      return { min: 300, max: 700 };
  }
}

// ---------------------------------------------------------------------------
// Forbidden words
// ---------------------------------------------------------------------------

export const FORBIDDEN_WORDS = [
  'simply',
  'just',
  'easy',
  'obviously',
  'straightforward',
  'powerful',
  'flexible',
  'robust',
  'enterprise-ready',
  'blazing',
  'blazing fast',
  'lightning',
] as const;

/**
 * Build a single regex that matches any forbidden word as a whole word.
 * Case-insensitive.
 */
export function buildForbiddenRegex(): RegExp {
  const escaped = FORBIDDEN_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

// ---------------------------------------------------------------------------
// Required frontmatter fields
// ---------------------------------------------------------------------------

export const REQUIRED_FRONTMATTER = ['title', 'description'] as const;
