# @nextrush/stream

## 1.0.4

### Patch Changes

- [#80](https://github.com/0xTanzim/nextRush/pull/80) [`d87f80e`](https://github.com/0xTanzim/nextRush/commit/d87f80e31e27c04bb7e2bbf1adcbe33f12850afc) Thanks [@0xTanzim](https://github.com/0xTanzim)! - fix(serverless,edge,stream,dev): harden multi-runtime handlers, streaming cancellation, and packaging

  - **AWS Lambda & ALB Hardening**: Injected `statusDescription` and broadened detection for AWS Application Load Balancer (ALB) single-value and multi-value headers; fixed negative timeout inversion in task drainage; unref'd timer in `Promise.race`; added unhandled rejection shield on tracked tasks; set `callbackWaitsForEmptyEventLoop = false`.
  - **Azure Functions v4 & GCF**: Added RFC-compliant Set-Cookie parsing (`Domain`, `Path`, `Expires`, `Max-Age`, `Secure`, `HttpOnly`, `SameSite`) for Azure Functions v4 structured cookies; wrapped GCF handlers in top-level error boundaries.
  - **Base64 Body Parsing**: Added null and empty string guards before base64 body decoding to prevent `atob("null")` ghost bytes in API Gateway v2 and GCF mappers.
  - **Streaming Cancellation & Abort Safety**: Added `controller.onCancel()` to `StreamController` and guarded `enqueue()` against client disconnects so consumer stream cancellation safely swallows `StreamAbortedError` without throwing unhandled `TypeError` exceptions.
  - **Packaging Dual-Entry Bridge**: Exported `import * as _mod from './index.js'; export * from './index.js'; export default _mod.default;` in serverless artifacts to support both named handler exports (`export const handler = ...`) and default exports without link-time syntax errors.
  - **Cold-Start Boot Gate**: Memoized application boot with error resets in Cloudflare Workers and Vercel Edge handlers to eliminate initialization stampedes.

- Updated dependencies [[`914f2de`](https://github.com/0xTanzim/nextRush/commit/914f2de19ffbb4ff1790f5be86eadcc771bb7611), [`bd568d8`](https://github.com/0xTanzim/nextRush/commit/bd568d8926ea4ead65c4bce32016f691dec91140), [`73fd473`](https://github.com/0xTanzim/nextRush/commit/73fd4736234780455adf95e69cc981d52b84422b)]:
  - @nextrush/types@4.2.0

## 1.0.3

### Patch Changes

- Updated dependencies [[`57d4713`](https://github.com/0xTanzim/nextRush/commit/57d4713e607d071112db9250c9e6e7984214fc15), [`6004c48`](https://github.com/0xTanzim/nextRush/commit/6004c482727f50cd760d4ab55d3c6b7f033e018b), [`4bdf830`](https://github.com/0xTanzim/nextRush/commit/4bdf8303cbeed3bf4351d035935c44d5110f8738), [`a701579`](https://github.com/0xTanzim/nextRush/commit/a701579e7ac52bfeab8a5d8c539e07b40661e885)]:
  - @nextrush/types@4.1.0

## 1.0.2

### Patch Changes

- [`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Prepare the NextRush v4 ecosystem patch release with updates across core, routing, adapters, middleware, utilities, OpenAPI, testing, development tooling, and the create-nextrush scaffolder.

- Updated dependencies [[`826bd5e`](https://github.com/0xTanzim/nextRush/commit/826bd5e1b23a2f469d09c98e335c9e6dffc0a5f8)]:
  - @nextrush/types@4.0.2

## 1.0.1

### Patch Changes

- Updated dependencies []:
  - @nextrush/types@4.0.1

## 1.0.0

### Patch Changes

- [`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9) Thanks [@0xTanzim](https://github.com/0xTanzim)! - Consolidated patch release across all NextRush public packages.

- Updated dependencies [[`d4cb1f7`](https://github.com/0xTanzim/nextRush/commit/d4cb1f7982a3ff6f2f8ec8b0bc4000e109a49fd9)]:
  - @nextrush/types@4.0.0

## 1.0.0-beta.2

### Patch Changes

- Consolidated patch release across all NextRush public packages.

- Updated dependencies []:
  - @nextrush/types@4.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [[`207dbca`](https://github.com/0xTanzim/nextRush/commit/207dbca2ee20a0ce7a00fe6ee14615bbb56562a2)]:
  - @nextrush/types@4.0.0-beta.1

## 3.1.0

### Patch Changes

- Updated dependencies [d7eb075]
- Updated dependencies [32a0db6]
  - @nextrush/types@3.1.0
