# openapi-basic

The NextRush OpenAPI golden path in ~40 lines: define a route once, get validation **and** an OpenAPI 3.1 spec + Swagger UI for free.

## Run it

```bash
pnpm --filter openapi-basic dev
```

Then open **http://localhost:3000/docs**.

## What you get

| Route | What documents it |
| --- | --- |
| `GET /users/:id` | `endpoint({ summary, tags, responses })` |
| `POST /users` | `validate(CreateUser)` (request body) + `endpoint()` (summary, response) |

- **`/docs`** — interactive Swagger UI
- **`/openapi.json`** — the raw OpenAPI 3.1 document

## The idea

You never write the spec by hand. `validate(CreateUser)` already knows the request shape, so it contributes that to the route's metadata. `endpoint()` adds the human parts (summary, tags, response schemas). NextRush collects all of it at registration; `@nextrush/openapi` renders it.

```ts
router.post(
  '/users',
  validate(CreateUser),                                   // ← validates the body
  endpoint({ summary: 'Create a user', responses: { 201: User } }), // ← documents it
  (ctx) => { ctx.status = 201; ctx.json(/* ... */); }
);
```

Change the schema, and both the validation and the docs update. There is no second source of truth.

## Response schemas need Zod 4

This example uses Zod 4, whose `z.toJSONSchema` lets the plugin render real request/response schemas. With Zod 3 the request still validates correctly — the docs just show an empty schema (`{}`) instead of failing. Populated schemas are opt-in, not required.

## Verify it yourself

```bash
# Real JSON Schema in the request body (name has minLength/maxLength):
curl -s localhost:3000/openapi.json | jq '.paths["/users"].post.requestBody'

# Validation is enforced at runtime — an empty name is a 400:
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/users \
  -H 'Content-Type: application/json' -d '{"name":""}'
```
