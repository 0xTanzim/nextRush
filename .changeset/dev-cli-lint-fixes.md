---
"@nextrush/dev": patch
---

Fix dev CLI lint/typecheck failures: template-literal error in `formatSize`, async
spawn handlers with no await, and fixture `nextrush` module resolution (declare
`nextrush` as a workspace devDependency so its dist is built before dev tests run).
