---
"@nextrush/adapter-edge": patch
"@nextrush/runtime": patch
"@nextrush/types": patch
---

Adds `ctx.platform` (`PlatformId | undefined`) across `@nextrush/adapter-edge` and
`@nextrush/adapter-serverless`, orthogonal to the unchanged `ctx.runtime` (RFC-026). Each
serverless Tier-1 handler (`createLambdaHandler`/`createGoogleHandler`/`createAzureHandler`) sets
it explicitly to its own known platform; `@nextrush/adapter-edge`'s Cloudflare/Vercel/Netlify
handlers detect it via the new `detectPlatform()` in `@nextrush/runtime`. Fully additive — no
existing type or value changes.
