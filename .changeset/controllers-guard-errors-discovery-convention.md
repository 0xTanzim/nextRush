---
'@nextrush/controllers': minor
---

Controllers: propagate guard errors + convention-based discovery default

**Guards can now express any status (401, 404, …), not just 403.** A guard that
returns `false` still throws `GuardRejectionError` (403), but a guard that
*throws* now has its error propagate unchanged instead of being swallowed into a
generic `GuardRejectionError`. Throw a typed `HttpError` (e.g.
`UnauthorizedError` from `@nextrush/errors`) to control the status and message —
the original status, message, and stack are preserved.

**Auto-discovery now imports only `*.controller.*` files by default**
(behavioral change). Previously `registerControllers({ root })` dynamically
imported every `.ts`/`.js` file under `root`, running all their module
side-effects serially. The default `include` is now
`['**/*.controller.ts', '**/*.controller.js']`. Services, guards, and
repositories still register because they load transitively via the controllers
that import them.

- Escape hatch: pass `include: ['**/*.ts', '**/*.js']` to restore scan-all.
- Discovery imports now run in parallel with a bounded concurrency cap.
- The dynamic-import side-effect is now documented (discovery runs the
  top-level code of every matched module).

Migration: if you relied on scan-all discovery importing non-`*.controller.*`
files purely for their side-effects (and those files are not imported by any
controller), either rename them to the convention, import them from a
controller, or set `include: ['**/*.ts', '**/*.js']`.
