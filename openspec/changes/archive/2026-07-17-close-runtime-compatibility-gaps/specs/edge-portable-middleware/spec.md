## ADDED Requirements

### Requirement: No needless runtime coupling in middleware
Middleware and extensions SHALL NOT import from `node:*` (or reference a Node-only global) for
functionality that is available via a Web-standard global on the framework's supported runtimes.
Where a Web-standard equivalent exists (e.g. `crypto.randomUUID()`, `crypto.subtle`,
`TextEncoder`), the Web-standard form MUST be used so the package remains edge-portable. A genuine
Node-only capability (filesystem, `node:net`, Node streams) is permitted only in a package
explicitly declared Node-only (see "Declared runtime support").

#### Scenario: request-id uses the Web-standard crypto global
- **WHEN** `@nextrush/request-id`'s default ID generator produces an ID
- **THEN** it calls the global `crypto.randomUUID()` (guarded by a capability check) and imports no
  `node:crypto`, so it loads and runs on Node, Bun, Deno, Cloudflare, Vercel, and Netlify

#### Scenario: Regression guard rejects a reintroduced node: import
- **WHEN** a `node:*` import is added to an edge-declared middleware's `src` for a capability that
  has a Web-standard global
- **THEN** the package's portability guard test fails and CI reports the offending import

#### Scenario: Guarded absence fails clearly, not cryptically
- **WHEN** the required Web-standard global is absent on an exotic host
- **THEN** the middleware throws a clear, typed error naming the missing capability rather than an
  unguarded `ReferenceError`

### Requirement: Declared runtime support per package and strategy
Each middleware/extension SHALL declare its runtime support — `edge-safe`, `Node-only`, or `mixed`
— in its README, and MUST state per-strategy support where a single package varies by
configuration. The declaration MUST match the package's actual `node:` coupling.

#### Scenario: multipart declares its per-strategy support
- **WHEN** a reader consults `@nextrush/multipart`'s runtime-support declaration
- **THEN** it states memory storage is edge-portable and disk storage (`node:fs`) is Node-only

#### Scenario: request-id is declared edge-safe
- **WHEN** a reader consults `@nextrush/request-id`'s runtime-support declaration
- **THEN** it states the package is edge-safe, consistent with its zero `node:` imports

#### Scenario: Declaration matches actual coupling
- **WHEN** a package declares `edge-safe` but its `src` contains a `node:` import without a
  per-strategy Node-only carve-out
- **THEN** the declaration is treated as incorrect and must be fixed (or the coupling removed)
