---
'@nextrush/adapter-serverless': minor
'@nextrush/types': minor
---

Adds first-class `createVercelHandler` for Node.js Serverless runtime on Vercel (Fluid Compute) and hybrid standalone runner support (#71).

### What's new

- **Universal Dual-Protocol Dispatch**: `createVercelHandler(app, options?)` returns a callable handler set accepting both Web standard `Request` (Route Handlers) and Node.js `(IncomingMessage, ServerResponse)` invocations.
- **Node.js HTTP Bridge**: Efficiently adapts Node incoming messages into Web standard `Request` without external dependencies, and streams the Web `Response` with chunk backpressure (`drain`), multi-cookie preservation via `response.headers.getSetCookie()`, and client disconnect cancellation (`reader.cancel()`).
- **Callable Handler Set**: The returned handler carries named HTTP method exports (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `fetch`) and `.listenIfStandalone()`, supporting both universal default export and named destructuring.
- **Standalone Runner Support**: `listenIfStandalone(handler, options?)`, `isServerlessEnvironment()`, and `isStandaloneEnvironment()` enable running the identical handler in local dev, Docker, or standalone VMs without wrapping code in environment guards.
- **Platform Identity**: Adds `'vercel'` to `PlatformId`, declared on `ctx.platform === 'vercel'`.
