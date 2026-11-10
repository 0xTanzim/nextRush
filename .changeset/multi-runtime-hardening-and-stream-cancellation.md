---
'@nextrush/adapter-serverless': patch
'@nextrush/adapter-edge': patch
'@nextrush/stream': patch
'@nextrush/dev': patch
---

fix(serverless,edge,stream,dev): harden multi-runtime handlers, streaming cancellation, and packaging

- **AWS Lambda & ALB Hardening**: Injected `statusDescription` and broadened detection for AWS Application Load Balancer (ALB) single-value and multi-value headers; fixed negative timeout inversion in task drainage; unref'd timer in `Promise.race`; added unhandled rejection shield on tracked tasks; set `callbackWaitsForEmptyEventLoop = false`.
- **Azure Functions v4 & GCF**: Added RFC-compliant Set-Cookie parsing (`Domain`, `Path`, `Expires`, `Max-Age`, `Secure`, `HttpOnly`, `SameSite`) for Azure Functions v4 structured cookies; wrapped GCF handlers in top-level error boundaries.
- **Base64 Body Parsing**: Added null and empty string guards before base64 body decoding to prevent `atob("null")` ghost bytes in API Gateway v2 and GCF mappers.
- **Streaming Cancellation & Abort Safety**: Added `controller.onCancel()` to `StreamController` and guarded `enqueue()` against client disconnects so consumer stream cancellation safely swallows `StreamAbortedError` without throwing unhandled `TypeError` exceptions.
- **Packaging Dual-Entry Bridge**: Exported `import * as _mod from './index.js'; export * from './index.js'; export default _mod.default;` in serverless artifacts to support both named handler exports (`export const handler = ...`) and default exports without link-time syntax errors.
- **Cold-Start Boot Gate**: Memoized application boot with error resets in Cloudflare Workers and Vercel Edge handlers to eliminate initialization stampedes.
