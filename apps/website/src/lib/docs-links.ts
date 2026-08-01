/**
 * Centralized documentation link contracts.
 *
 * Every public doc path lives here — never hardcoded in components,
 * pages, guides, or package-links. Update one place when a doc moves.
 *
 * Every entry:
 *   - Is a const string (not a function — no runtime overhead)
 *   - Is validated to exist under apps/website/content/docs/
 *   - Has a comment explaining what the page is
 */

// ---- Getting Started --------------------------------------------------

/** Intro landing: what NextRush is, who it's for, first steps */
export const DOCS_GETTING_STARTED = '/docs/getting-started' as const;

/** Full overview: philosophy, architecture, trade-offs */
export const DOCS_GETTING_STARTED_OVERVIEW = '/docs/getting-started/overview' as const;

/** Quick-start tutorial: build a working API in minutes */
export const DOCS_GETTING_STARTED_QUICK_START = '/docs/getting-started/quick-start' as const;

/** Install guide: per-runtime setup instructions */
export const DOCS_GETTING_STARTED_INSTALLATION = '/docs/getting-started/installation' as const;

// ---- Core Concepts ----------------------------------------------------

export const DOCS_CONCEPTS_ROUTING = '/docs/concepts/routing' as const;
export const DOCS_CONCEPTS_MIDDLEWARE = '/docs/concepts/middleware' as const;
export const DOCS_CONCEPTS_CONTEXT = '/docs/concepts/context' as const;

// ---- Guides -----------------------------------------------------------

export const DOCS_GUIDES = '/docs/guides' as const;
export const DOCS_GUIDES_REST_API = '/docs/guides/api-development/rest-api' as const;
export const DOCS_GUIDES_CLASS_BASED = '/docs/guides/api-development/class-based' as const;
export const DOCS_GUIDES_VALIDATION = '/docs/guides/api-development/validation' as const;
export const DOCS_GUIDES_ERROR_HANDLING = '/docs/guides/api-development/error-handling' as const;

// ---- Reference --------------------------------------------------------

export const DOCS_REFERENCE = '/docs/reference' as const;
export const DOCS_MIGRATE = '/docs/migrate' as const;
export const DOCS_ARCHITECTURE = '/docs/architecture' as const;
