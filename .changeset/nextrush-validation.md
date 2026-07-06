---
"@nextrush/validation": minor
---

Add `@nextrush/validation` — Standard Schema request validation middleware.

Bring your own schema library (Zod, Valibot, ArkType, or any [Standard
Schema](https://standardschema.dev) implementation) and validate `ctx.body`,
`ctx.query`, and `ctx.params` with one function:

```typescript
import { validate } from '@nextrush/validation';
import { z } from 'zod';

const User = z.object({ name: z.string().min(1), email: z.string().email() });

app.post('/users', validate(User), (ctx) => {
  ctx.json(ctx.body); // validated + coerced
});
```

- `validate(schema)` validates and coerces the request body, overwriting
  `ctx.body` with the coerced value.
- `validate({ body, query, params })` validates any combination of targets;
  `query`/`params` are validated but intentionally left unmodified so
  TypeScript's declared types are never wrong about them.
- Every failure throws the framework's existing `ValidationError` (from
  `@nextrush/errors`), rendered by the existing `errorHandler` — no new error
  shape to learn.
- Zero runtime dependencies.

See the [package README](../packages/middleware/validation/README.md) for the
full API and [RFC-NEXTRUSH-VALIDATION](../docs/RFC/RFC-NEXTRUSH-VALIDATION.md)
for the design rationale.
