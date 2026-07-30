/**
 * Cloudflare Pages Function — Markdown for Agents content negotiation.
 *
 * When a request includes `Accept: text/markdown`, rewrites HTML page paths
 * to their pre-generated markdown equivalents and returns them with the
 * correct `Content-Type: text/markdown` header and token estimate.
 *
 * Docs pages → /docs/*          → /api/mdx/*.md
 * Blog posts  → /blog/*         → /api/blog/*.md
 * Skills      → /skills/*       → /api/skills/*.md
 *
 * Falls through to static assets for HTML, non-matching paths, and requests
 * that don't negotiate for markdown.
 *
 * @param {import('@cloudflare/workers-types').PagesFunctionContext} context
 */

// Route mapping: HTML URL prefix → markdown API path prefix
const ROUTE_MAP = [
  { prefix: '/docs/',   replace: '/api/mdx/',    stripIndex: '/docs' },
  { prefix: '/blog/',   replace: '/api/blog/',    stripIndex: '/blog' },
  { prefix: '/skills/', replace: '/api/skills/',  stripIndex: '/skills' },
];

/**
 * Map an HTML page path to the pre-generated markdown API path.
 * Returns null when no markdown version exists.
 *
 * @param {string} pathname
 * @returns {string|null}
 */
function toMarkdownPath(pathname) {
  // Remove trailing slash for matching consistency
  const normalized = pathname.endsWith('/') && pathname !== '/'
    ? pathname.slice(0, -1)
    : pathname;

  for (const route of ROUTE_MAP) {
    // Exact root match: /docs → /api/mdx/index.md
    if (normalized === route.stripIndex) {
      return `${route.replace}index.md`;
    }

    // Path prefix match: /docs/getting-started → /api/mdx/getting-started.md
    if (normalized.startsWith(route.prefix)) {
      const rest = normalized.slice(route.prefix.length);
      // Skip empty path (handled above as exact match)
      if (!rest) return `${route.replace}index.md`;
      return `${route.replace}${rest}.md`;
    }
  }

  return null;
}

/**
 * Rough token estimate: ~1.3 tokens per word for technical English.
 * Used for x-markdown-tokens header so agents can estimate context usage.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

/**
 * Pages Functions v2 onRequest middleware.
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const accept = request.headers.get('Accept') || '';

  // Fast path: skip content negotiation when markdown isn't requested
  if (!accept.includes('text/markdown')) {
    return next();
  }

  const url = new URL(request.url);
  const markdownPath = toMarkdownPath(url.pathname);

  // No markdown version exists for this path — serve HTML as-is
  if (!markdownPath) {
    return next();
  }

  // Fetch the pre-generated markdown from the static asset store.
  // `env.ASSETS` is Cloudflare Pages' built-in binding for static files.
  const assetUrl = new URL(markdownPath, url);
  const assetRequest = new Request(assetUrl, request);
  const assetResponse = await env.ASSETS.fetch(assetRequest);

  if (!assetResponse.ok) {
    // Markdown file not found at build output — fall through to HTML
    return next();
  }

  const markdown = await assetResponse.text();
  const tokens = estimateTokens(markdown);

  // Preserve origin's Content-Signal policy if set; otherwise default to permissive
  const contentSignal = assetResponse.headers.get('content-signal')
    || 'ai-train=yes, search=yes, ai-input=yes';

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'x-markdown-tokens': String(tokens),
      'content-signal': contentSignal,
      // Vary on Accept so caches store separate variants for HTML and Markdown
      'Vary': 'Accept',
      // Preserve caching from original response
      'Cache-Control': assetResponse.headers.get('Cache-Control') || 'public, max-age=3600',
    },
  });
}
