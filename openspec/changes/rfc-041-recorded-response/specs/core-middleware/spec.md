## MODIFIED Requirements

### Requirement: The double-response warning is preserved on the fast path

When double-response warning is enabled (non-production), a middleware that has already committed a
response and then calls `next()` SHALL emit the same warning the general path emits (including the
index-0 reference). When disabled (production), no warning SHALL be emitted. A middleware that writes
a header or replaces the body after `await next()` SHALL NOT trigger this warning: a post-handler
write to a response the handler committed is the supported recorded-response case, not a second
response.

#### Scenario: Responding then calling next() warns in non-production
- **WHEN** `warnDoubleResponse` is enabled, the middleware sends a response, then calls `next()`
- **THEN** a warning is emitted whose text matches the general path's warning (referencing index 0)

#### Scenario: No warning is emitted in production
- **WHEN** `warnDoubleResponse` is disabled (production) and the middleware responds then calls `next()`
- **THEN** no warning is emitted

#### Scenario: A post-handler header write is not a double response
- **WHEN** a middleware calls `await next()`, the handler commits a response, and the middleware then
  sets a response header
- **THEN** no double-response warning is emitted, and the write reaches the flushed response

#### Scenario: A post-handler body rewrite is not a double response
- **WHEN** a middleware calls `await next()`, the handler commits a response, and the middleware then
  replaces the recorded body
- **THEN** no double-response warning is emitted, and the flushed response carries the new body

## ADDED Requirements

### Requirement: The error path answers whenever the recorded response is still uncommitted

The composed handler SHALL treat a recorded-but-unflushed response as uncommitted for the purpose of
error handling: a failure after the handler wrote the record SHALL still be answerable by the
application error handler, and a failure after the flush SHALL leave the flushed response in place
without a second write attempt.

#### Scenario: An uncommitted record can still be replaced by an error response

- **WHEN** a post-handler middleware throws after the handler wrote the record and before the flush
- **THEN** the error handler writes its response, the client receives the error response, and no
  second response is flushed

#### Scenario: A flushed response is not overwritten by the error path

- **WHEN** an error occurs after the response was flushed
- **THEN** the flushed response stands, the error is logged, and no additional bytes are written

#### Scenario: A failed flush still answers the client

- **WHEN** the flush path itself fails before any byte was written
- **THEN** the framework answers with the last-resort error body rather than leaving the request
  unanswered
