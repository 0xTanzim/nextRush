# adopt-ts7-oxlint-toolchain

Adopt TypeScript 7.0.2 across the workspace and replace ESLint + typescript-eslint with Oxlint + tsgolint (RFC-037). Repo-internal lint engine swaps before the compiler bump so each phase's deltas stay attributable; the generated-project toolchain (create-nextrush) and the @nextrush/dev declaration pass must both keep their guarantees under TS 7.
