/**
 * Express 5 benchmark server — all scenarios.
 *
 * Fairness notes:
 * - Response bodies come from the shared payload module.
 * - Body parser is attached only to the POST route.
 * - Error-handling middleware (4-arg) fires only on error (no per-request cost).
 */

import express from 'express';

import {
  ERROR_BODY,
  ERROR_MESSAGE,
  HELLO_WORLD,
  JSON_USER,
  LARGE_JSON,
  MIDDLEWARE_BODY,
  MIDDLEWARE_HEADERS,
  deepRoute,
  mwHeaderValue,
  postUserResponse,
  searchResponse,
  userById,
} from './_shared/payloads.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
const app = express();
// Fairness: Express sends `X-Powered-By: Express` by default, extra header bytes
// no other server emits. Disable it so on-the-wire responses match (audit F-M01).
app.disable('x-powered-by');
const jsonParser = express.json();

app.get('/', (_req, res) => {
  res.json(HELLO_WORLD);
});
app.get('/json', (_req, res) => {
  res.json(JSON_USER);
});
app.get('/large-json', (_req, res) => {
  res.json(LARGE_JSON);
});

app.get('/users/:id', (req, res) => {
  res.json(userById(req.params.id));
});

app.get('/search', (req, res) => {
  res.json(searchResponse(req.query.q, req.query.limit));
});

app.get('/api/v1/orgs/:orgId/teams/:teamId/members/:memberId', (req, res) => {
  res.json(deepRoute(req.params.orgId, req.params.teamId, req.params.memberId));
});

app.post('/users', jsonParser, (req, res) => {
  res.json(postUserResponse(req.body));
});

// 5-layer middleware stack — one header per layer, chained via next().
const middleware = MIDDLEWARE_HEADERS.map((header) => (_req, res, next) => {
  res.set(header.name, mwHeaderValue(header));
  next();
});
app.get('/middleware', ...middleware, (_req, res) => {
  res.json(MIDDLEWARE_BODY);
});

app.get('/error', () => {
  throw new Error(ERROR_MESSAGE);
});

app.get('/empty', (_req, res) => {
  res.status(204).end();
});

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by 4 args.
app.use((_err, _req, res, _next) => {
  res.status(500).json(ERROR_BODY);
});

const server = app.listen(PORT, () => {
  console.log(`Express server listening on http://localhost:${PORT}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
