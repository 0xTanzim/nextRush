---
'@nextrush/adapter-bun': minor
'@nextrush/adapter-deno': minor
'@nextrush/runtime': minor
---

Hardens Bun and Deno adapters against runtime mismatches, eliminates mandatory second dummy server arguments, and exports runtime checking utilities (#72, #77).

### What's new

- **Defensive Runtime Guarding**: Calling `serve(app)` in `@nextrush/adapter-bun` or `@nextrush/adapter-deno` outside their target runtimes (e.g., executing Bun adapter on Node.js or in a Vercel Serverless Function without `"bunVersion"`) throws a descriptive `ServerStartError` with code `'ERR_RUNTIME_NOT_DETECTED'` and actionable migration guidance rather than crashing with an unhandled `ReferenceError: Bun is not defined` or `ReferenceError: Deno is not defined`.
- **Optional Server / Info Parameter**: `createHandler(app)` in `@nextrush/adapter-bun` and `@nextrush/adapter-deno` now marks the secondary server/connection info parameter as optional (`(request: Request, server?: ...) => Response | Promise<Response>`), enabling clean direct calling `await handler(request)` without supplying dummy mock server or connection info objects.
- **Exported Runtime Detection**: Both `@nextrush/adapter-bun` and `@nextrush/adapter-deno` re-export `isBun` / `isDeno` (and `isBunRuntime` / `isDenoRuntime`) and `ServerStartError` for straightforward runtime inspection.
- **Runtime Error Hierarchy**: Adds `'ERR_RUNTIME_NOT_DETECTED'` to `ServerStartErrorCode` in `@nextrush/runtime`.
