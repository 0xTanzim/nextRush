---
'create-nextrush': patch
---

version mismatch fix. The generated `package.json` should use `^3.0.0` for `nextrush` and related packages, not the exact version from `constants.js`. This allows users to get compatible updates without being locked to a specific version.
