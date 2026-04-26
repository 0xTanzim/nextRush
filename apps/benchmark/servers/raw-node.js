/**
 * Raw Node.js HTTP server — Zero-framework baseline.
 *
 * This server implements all benchmark scenarios using ONLY
 * the built-in http module. It serves as the absolute performance
 * ceiling — any overhead above this number IS framework overhead.
 */

import { createServer } from 'node:http';

const PORT = parseInt(process.env.PORT || '3000', 10);

// Response data — serialized per-request for fair comparison with frameworks
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const HELLO_WORLD_DATA = { message: 'Hello World' };
const JSON_RESPONSE_DATA = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  role: 'developer',
  active: true,
};
const LARGE_JSON_DATA = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 2 === 0 ? 'developer' : 'designer',
  active: i % 3 !== 0,
}));

const server = createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  // Fast path — most benchmarks hit GET /
  if (method === 'GET') {
    if (url === '/') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify(HELLO_WORLD_DATA));
      return;
    }

    if (url === '/json') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify(JSON_RESPONSE_DATA));
      return;
    }

    if (url === '/empty') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === '/large-json') {
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify(LARGE_JSON_DATA));
      return;
    }

    if (url === '/middleware') {
      // Simulate 5 middleware layers (header setting)
      res.setHeader('X-Request-Id', '12345');
      res.setHeader('X-Timestamp', Date.now().toString());
      res.setHeader('X-Framework', 'raw-node');
      res.setHeader('X-Version', '1.0');
      res.setHeader('X-Processed', 'true');
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ middleware: true, layers: 5 }));
      return;
    }

    if (url === '/error') {
      // Simulate throw+catch to match framework behavior
      try {
        throw new Error('Benchmark error');
      } catch {
        res.writeHead(500, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
      return;
    }

    // Route params: /users/:id
    if (url.startsWith('/users/') && url.indexOf('/', 7) === -1) {
      const id = url.slice(7);
      res.writeHead(200, JSON_HEADERS);
      res.end(JSON.stringify({ id, name: `User ${id}`, email: `user${id}@example.com` }));
      return;
    }

    // Query string: /search?...
    if (url.startsWith('/search')) {
      const qIdx = url.indexOf('?');
      const params = qIdx !== -1 ? new URLSearchParams(url.slice(qIdx + 1)) : new URLSearchParams();
      const q = params.get('q') || '';
      const limit = Math.min(parseInt(params.get('limit') || '10', 10), 10);
      res.writeHead(200, JSON_HEADERS);
      res.end(
        JSON.stringify({
          query: q,
          limit,
          results: Array.from({ length: limit }, (_, i) => ({
            id: i + 1,
            title: `Result ${i + 1} for "${q}"`,
          })),
        })
      );
      return;
    }

    // Deep route: /api/v1/orgs/:orgId/teams/:teamId/members/:memberId
    if (url.startsWith('/api/v1/orgs/')) {
      const parts = url.split('/');
      // /api/v1/orgs/123/teams/456/members/789 → ['', 'api', 'v1', 'orgs', '123', 'teams', '456', 'members', '789']
      if (parts.length === 9 && parts[5] === 'teams' && parts[7] === 'members') {
        res.writeHead(200, JSON_HEADERS);
        res.end(
          JSON.stringify({
            orgId: parts[4],
            teamId: parts[6],
            memberId: parts[8],
          })
        );
        return;
      }
    }
  }

  // POST /users
  if (method === 'POST' && url === '/users') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.writeHead(200, JSON_HEADERS);
        res.end(
          JSON.stringify({
            success: true,
            user: {
              id: Math.floor(Math.random() * 10000),
              ...data,
              createdAt: new Date().toISOString(),
            },
          })
        );
      } catch {
        res.writeHead(400, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, JSON_HEADERS);
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`Raw Node.js server listening on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
