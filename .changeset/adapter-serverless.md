---
"@nextrush/adapter-serverless": minor
---

New package: `@nextrush/adapter-serverless`.

Brings classic serverless onto the shared `Context` pipeline via a generic,
adapter-scoped `EventMapper<Event, Result, Ctx>` registry (no global mutable
registry). `createServerlessAdapter({ mappers, provider?, timeout? }).createHandler(app)`
returns an `(event) => result` handler; the Request→Response execution model
(warm `ready()` reuse, per-invocation timeout→504) is shared with the edge adapter.

Ships the `lambda-function-url` mapper (AWS Lambda Function URL / API Gateway v2
payload format): method/path/query, JSON + base64 bodies, multi-value headers,
Set-Cookie→cookies. Additional providers (apigw-v1/v2, gcf, azure) and true
response streaming follow. Ratified in RFC-NEXTRUSH-ADAPTER-SERVERLESS.
