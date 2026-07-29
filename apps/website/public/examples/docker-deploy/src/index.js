// Minimal NextRush app used to verify the Dockerfile shown in
// /docs/production/deployment/docker actually builds and serves traffic.
//
// Uses the real, current, non-deprecated `nextrush` meta package (functional
// API) — the same imports shown in the docs page.
import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello from NextRush in Docker!' });
});

// Container orchestrators (Docker HEALTHCHECK, Kubernetes probes, load
// balancers) poll this route — it must stay cheap and dependency-free.
router.get('/health', (ctx) => {
  ctx.json({ status: 'ok' });
});

app.route('/', router);

const port = Number(process.env.PORT ?? 8080);
await listen(app, port);
