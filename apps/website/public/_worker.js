/**
 * Cloudflare Pages _worker.js — Markdown content negotiation.
 *
 * When request includes `Accept: text/markdown`, rewrites HTML paths to
 * pre-generated markdown equivalents. Passes all other requests through to
 * the static ASSETS binding.
 *
 * Homepage  → /                → /api/mdx/index.md
 * Docs      → /docs/*          → /api/mdx/*.md
 * Blog      → /blog/*          → /api/blog/*.md
 * Skills    → /skills/*        → /api/skills/*.md
 */

const ROUTE_MAP = [
  { prefix: '/docs/',   replace: '/api/mdx/',    stripIndex: '/docs' },
  { prefix: '/blog/',   replace: '/api/blog/',    stripIndex: '/blog' },
  { prefix: '/skills/', replace: '/api/skills/',  stripIndex: '/skills' },
];

function toMarkdownPath(pathname) {
  const normalized = pathname.endsWith('/') && pathname !== '/'
    ? pathname.slice(0, -1)
    : pathname;

  // Homepage root
  if (normalized === '/') {
    return '/api/mdx/index.md';
  }

  for (const route of ROUTE_MAP) {
    if (normalized === route.stripIndex) {
      return `${route.replace}index.md`;
    }
    if (normalized.startsWith(route.prefix)) {
      const rest = normalized.slice(route.prefix.length);
      if (!rest) return `${route.replace}index.md`;
      return `${route.replace}${rest}.md`;
    }
  }

  return null;
}

// MIME types for static assets — Cloudflare CDN may cache with wrong type
const MIME_MAP = {
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.md':   'text/markdown; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg':  'image/svg+xml',
};

function fixMimeType(response, pathname) {
  for (const [ext, mime] of Object.entries(MIME_MAP)) {
    if (!pathname.endsWith(ext)) continue;
    const ct = response.headers.get('Content-Type') || '';
    if (ct === mime || ct.startsWith(mime + ';')) return response;
    // Wrong (or missing) Content-Type — fix it
    const headers = new Headers(response.headers);
    headers.set('Content-Type', mime);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
}

function estimateTokens(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

// Static responses served directly to bypass asset cache issues
const AUTH_MD_CONTENT = `# auth.md — Agent Registration for NextRush Documentation

This service supports **agentic registration**: discover → register → access. It is a public documentation site with no authentication required. Follow the steps in order; do not skip ahead.

## Step 1 — Discover

Fetch the OAuth Protected Resource Metadata:

\`\`\`http
GET /.well-known/oauth-protected-resource HTTP/1.1
Host: nextrush.dev
\`\`\`

Response:

\`\`\`json
{
  "resource": "https://nextrush.dev",
  "authorization_servers": ["https://nextrush.dev"],
  "scopes_supported": ["read:docs", "read:blog", "read:skills", "read:catalog"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://nextrush.dev/auth.md"
}
\`\`\`

## Step 2 — Fetch the Authorization Server Metadata

\`\`\`http
GET /.well-known/oauth-authorization-server HTTP/1.1
Host: nextrush.dev
\`\`\`

Response uses standard RFC 8414 fields plus the \`agent_auth\` block:

\`\`\`json
{
  "issuer": "https://nextrush.dev",
  "token_endpoint": "https://nextrush.dev/auth.md",
  "grant_types_supported": ["urn:ietf:params:oauth:grant-type:jwt-bearer"],
  "scopes_supported": ["read:docs", "read:blog", "read:skills", "read:catalog"],
  "agent_auth": {
    "skill": "https://nextrush.dev/auth.md",
    "identity_endpoint": "https://nextrush.dev/auth.md",
    "claim_endpoint": "https://nextrush.dev/auth.md",
    "events_endpoint": "https://nextrush.dev/auth.md",
    "identity_types_supported": ["anonymous"],
    "identity_assertion": {
      "assertion_types_supported": []
    },
    "events_supported": []
  }
}
\`\`\`

## Step 3 — Pick a method

The only supported identity type is \`anonymous\`. This service is a public documentation site — no authentication required.

## Step 4 — Register

Send an anonymous registration request:

\`\`\`http
POST /auth.md HTTP/1.1
Host: nextrush.dev
Content-Type: application/json

{ "type": "anonymous" }
\`\`\`

This service is open-access. All scopes are granted automatically. No bearer token, API key, or cookie is needed.

\`\`\`json
{
  "registration_id": "reg_anonymous",
  "registration_type": "anonymous",
  "scopes": ["read:docs", "read:blog", "read:skills", "read:catalog"]
}
\`\`\`

## Step 5 — Access Resources

All endpoints are publicly accessible. Use \`Accept: text/markdown\` for markdown responses.

| Scope | Resource | Endpoint |
|---|---|---|
| \`read:docs\` | Framework documentation | \`GET /docs/*\`, \`GET /llms.txt\`, \`GET /llms-full.txt\` |
| \`read:blog\` | Blog posts | \`GET /blog/*\` |
| \`read:skills\` | Agent skills | \`GET /.well-known/agent-skills/index.json\` |
| \`read:catalog\` | API catalog | \`GET /.well-known/api-catalog\` |

## Access Policies

- **Authentication**: None required — public documentation site.
- **Rate limiting**: None enforced.
- **Contact**: https://nextrush.dev/docs

## DNS-AID Discovery

DNS-AID records published under \`_agents.nextrush.dev\`:
- \`_index._agents.nextrush.dev\` — Discovery entry
- \`_a2a._agents.nextrush.dev\` — A2A interface
`;

// OAuth metadata responses — served directly to guarantee correct content
const OAUTH_METADATA = new Map([
  ['/.well-known/oauth-authorization-server', {
    contentType: 'application/json',
    body: JSON.stringify({
      issuer: 'https://nextrush.dev',
      authorization_endpoint: 'https://nextrush.dev/auth.md',
      token_endpoint: 'https://nextrush.dev/auth.md',
      scopes_supported: ['read:docs', 'read:blog', 'read:skills', 'read:catalog'],
      response_types_supported: [],
      grant_types_supported: [
        'urn:ietf:params:oauth:grant-type:jwt-bearer'
      ],
      token_endpoint_auth_methods_supported: [],
      service_documentation: 'https://nextrush.dev/auth.md',
      op_policy_uri: 'https://nextrush.dev/auth.md',
      op_tos_uri: 'https://nextrush.dev/docs',
      agent_auth: {
        skill: 'https://nextrush.dev/auth.md',
        identity_endpoint: 'https://nextrush.dev/auth.md',
        claim_endpoint: 'https://nextrush.dev/auth.md',
        events_endpoint: 'https://nextrush.dev/auth.md',
        identity_types_supported: ['anonymous'],
        identity_assertion: {
          assertion_types_supported: []
        },
        events_supported: []
      }
    }),
  }],
  ['/.well-known/oauth-protected-resource', {
    contentType: 'application/oauth-protected-resource-v1+json',
    body: JSON.stringify({
      resource: 'https://nextrush.dev',
      authorization_servers: ['https://nextrush.dev'],
      scopes_supported: ['read:docs', 'read:blog', 'read:skills', 'read:catalog'],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://nextrush.dev/auth.md'
    }),
  }],
]);

/**
 * Attempts to fetch an asset with clean-URL fallback.
 * Cloudflare Pages ASSETS binding does NOT auto-resolve clean URLs
 * (unlike the default Pages worker).  We try the exact path first,
 * then .html extension, then index.html for directory-like paths.
 */
async function fetchAsset(request, env, pathname) {
  // 1. Try exact path
  let res = await env.ASSETS.fetch(request);
  if (res.ok) return res;

  // 2. Try + .html (Next.js static export generates .html files)
  const htmlUrl = new URL(request.url);
  const trimmed = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  htmlUrl.pathname = trimmed + '.html';
  res = await env.ASSETS.fetch(new Request(htmlUrl, request));
  if (res.ok) return res;

  // 3. Try /index.html
  htmlUrl.pathname = pathname.replace(/\/?$/, '/') + 'index.html';
  res = await env.ASSETS.fetch(new Request(htmlUrl, request));
  if (res.ok) return res;

  // 4. Try path without trailing slash
  if (pathname !== '/' && pathname.endsWith('/')) {
    const noSlash = new URL(request.url);
    noSlash.pathname = pathname.slice(0, -1);
    res = await env.ASSETS.fetch(new Request(noSlash, request));
    if (res.ok) return res;
  }

  // None worked — return the original 404
  return res;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const accept = request.headers.get('Accept') || '';

    // Serve auth.md and well-known metadata directly to bypass asset cache
    if (url.pathname === '/auth.md' || url.pathname === '/.well-known/auth.md') {
      return new Response(AUTH_MD_CONTENT, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const metadata = OAUTH_METADATA.get(url.pathname);
    if (metadata) {
      return new Response(metadata.body, {
        headers: {
          'Content-Type': metadata.contentType,
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Fast path: skip content negotiation when markdown isn't requested
    if (!accept.includes('text/markdown')) {
      const res = await fetchAsset(request, env, url.pathname);
      return fixMimeType(res, url.pathname);
    }

    const markdownPath = toMarkdownPath(url.pathname);

    // No markdown version exists — serve HTML
    if (!markdownPath) {
      const res = await fetchAsset(request, env, url.pathname);
      return fixMimeType(res, url.pathname);
    }

    // Fetch the pre-generated markdown from static assets
    const mdUrl = new URL(markdownPath, url);
    const mdReq = new Request(mdUrl, request);
    const mdRes = await env.ASSETS.fetch(mdReq);

    if (!mdRes.ok) {
      // Markdown file not found — fall through to HTML
      const res = await fetchAsset(request, env, url.pathname);
      return fixMimeType(res, url.pathname);
    }

    const body = await mdRes.text();
    const tokens = estimateTokens(body);

    return new Response(body, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'x-markdown-tokens': String(tokens),
        'content-signal': 'ai-train=yes, search=yes, ai-input=yes',
        'Vary': 'Accept',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
};
