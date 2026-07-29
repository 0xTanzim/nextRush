/**
 * Raw Node.js HTTP server — zero-framework baseline.
 *
 * Serves every benchmark scenario using only `node:http`. It is the absolute
 * performance ceiling: overhead above this number IS framework overhead.
 *
 * Fairness notes:
 * - Response bodies come from the shared payload module (identical across servers).
 * - The middleware scenario runs a REAL function chain (not inline setHeader), so
 *   raw-node pays a comparable per-layer dispatch cost to the frameworks.
 * - Content-Type includes `charset=utf-8` to match the frameworks' JSON headers.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  ERROR_BODY,
  ERROR_MESSAGE,
  HELLO_WORLD,
  JSON_USER,
  LARGE_JSON,
  MIDDLEWARE_BODY,
  MIDDLEWARE_HEADERS,
  SEND_OBJECT_BODY,
  deepRoute,
  largePostResponse,
  mwHeaderValue,
  postUserResponse,
  searchResponse,
  userById,
} from './_shared/payloads.js';

const STATIC_ROOT = fileURLToPath(new URL('../public', import.meta.url));

const PORT = parseInt(process.env.PORT || '8080', 10);
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
/** Max POST body size (bytes) — bounds buffering, comparable to framework parser defaults. */
const MAX_BODY_BYTES = 1024 * 1024;
/** Raised cap for /large-post — the scenario body is ~1.5MB by design. */
const MAX_LARGE_BODY_BYTES = 5 * 1024 * 1024;

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...JSON_HEADERS, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// Genuine 5-layer middleware chain — each layer is a function that sets one
// header then calls next(). This mirrors the frameworks' dispatch cost instead
// of collapsing to five inline setHeader calls.
const middlewareChain = MIDDLEWARE_HEADERS.map((header) => (req, res, next) => {
  res.setHeader(header.name, mwHeaderValue(header));
  next();
});

function runChain(chain, req, res, done) {
  let index = 0;
  const next = () => {
    const layer = chain[index++];
    if (layer) layer(req, res, next);
    else done();
  };
  next();
}

const server = createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  if (method === 'GET') {
    if (url === '/') return void sendJson(res, 200, HELLO_WORLD);
    if (url === '/json') return void sendJson(res, 200, JSON_USER);
    if (url === '/large-json') return void sendJson(res, 200, LARGE_JSON);

    if (url === '/empty') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === '/middleware') {
      runChain(middlewareChain, req, res, () => sendJson(res, 200, MIDDLEWARE_BODY));
      return;
    }

    if (url === '/error') {
      // raw-node has no error pipeline — a local catch is its idiomatic form.
      try {
        throw new Error(ERROR_MESSAGE);
      } catch {
        sendJson(res, 500, ERROR_BODY);
      }
      return;
    }

    // /users/:id
    if (url.startsWith('/users/') && url.indexOf('/', 7) === -1) {
      return void sendJson(res, 200, userById(url.slice(7)));
    }

    if (url === '/send-object') {
      return void sendJson(res, 200, SEND_OBJECT_BODY);
    }

    // /static/bench.txt — the one fixture file this benchmark serves; no
    // general traversal-safe resolver is implemented here (raw-node is the
    // zero-framework baseline, not a security-hardened static server), so
    // this deliberately matches only the exact known fixture path rather
    // than accepting an arbitrary decoded path.
    if (url === '/static/bench.txt') {
      readFile(STATIC_ROOT + '/static/bench.txt')
        .then((data) => {
          res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Length': data.length,
          });
          res.end(data);
        })
        .catch(() => {
          sendJson(res, 404, { error: 'Not Found' });
        });
      return;
    }

    // /search?...
    if (url.startsWith('/search')) {
      const qIdx = url.indexOf('?');
      const params = qIdx !== -1 ? new URLSearchParams(url.slice(qIdx + 1)) : new URLSearchParams();
      return void sendJson(res, 200, searchResponse(params.get('q'), params.get('limit')));
    }

    // /api/v1/orgs/:orgId/teams/:teamId/members/:memberId
    if (url.startsWith('/api/v1/orgs/')) {
      const parts = url.split('/');
      if (parts.length === 9 && parts[5] === 'teams' && parts[7] === 'members') {
        return void sendJson(res, 200, deepRoute(parts[4], parts[6], parts[8]));
      }
    }
  }

  // POST /users
  if (method === 'POST' && url === '/users') {
    let body = '';
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      // Cap request body to match framework parser defaults and avoid unbounded
      // buffering (audit F-L08). Benchmark bodies are a few dozen bytes.
      if (size > MAX_BODY_BYTES) {
        aborted = true;
        sendJson(res, 413, { error: 'Payload Too Large' });
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        sendJson(res, 200, postUserResponse(JSON.parse(body)));
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  // POST /large-post — same shape as /users but with a raised cap, since the
  // scenario body is ~1.5MB by design (past the default 1MB floor other
  // frameworks' parsers also had to raise for this route).
  if (method === 'POST' && url === '/large-post') {
    let body = '';
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_LARGE_BODY_BYTES) {
        aborted = true;
        sendJson(res, 413, { error: 'Payload Too Large' });
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const parsed = JSON.parse(body);
        const items = parsed?.items;
        sendJson(res, 200, largePostResponse(Array.isArray(items) ? items.length : 0));
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`Raw Node.js server listening on http://localhost:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
