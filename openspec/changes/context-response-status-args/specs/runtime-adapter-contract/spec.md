# Spec Delta

## ADDED Requirements

### Requirement: Response helpers accept an explicit status argument

`ctx.json`, `ctx.html` and `ctx.send` SHALL accept an optional status argument. When it is supplied,
that value SHALL determine the status of the response for that call. When it is omitted, the status
already carried by `ctx.status` SHALL apply, exactly as before. Every existing single-argument call
SHALL remain valid and byte-identical.

#### Scenario: An explicit status wins over the carried status

- **WHEN** a handler sets `ctx.status = 200` and then calls `ctx.json({ id: 'u_123' }, 201)`
- **THEN** the client receives status `201` and the JSON body, on every adapter

#### Scenario: An omitted status keeps the carried status

- **WHEN** a handler sets `ctx.status = 201` and then calls `ctx.json({ id: 'u_123' })`
- **THEN** the client receives status `201`, identical to today's behavior

#### Scenario: The default remains 200 when nothing sets a status

- **WHEN** a handler calls `ctx.json({ ok: true })` without assigning `ctx.status`
- **THEN** the client receives status `200`

#### Scenario: Each helper accepts the argument

- **WHEN** `ctx.json(data, 201)`, `ctx.html(content, 202)` and `ctx.send('body', 203)` are each used
- **THEN** each response carries the requested status and its unchanged media type

### Requirement: An explicit helper status becomes the recorded outgoing status

The status supplied to a response helper SHALL be reflected in `ctx.status` for middleware that runs
after the handler, so a logging, metrics or response-aware middleware observes the status that was
actually sent rather than a value left over from an earlier assignment.

#### Scenario: Post-handler middleware reads the status that was sent

- **WHEN** a handler calls `ctx.json({ ok: true }, 201)` with no prior `ctx.status` assignment, and a
  middleware reads `ctx.status` after `await next()`
- **THEN** it observes `201`, and the client observes status `201`

#### Scenario: Headers set before the helper still survive

- **WHEN** a middleware calls `ctx.set('X-Trace', 't1')` and the handler then calls
  `ctx.json(data, 201)`
- **THEN** the response carries both `X-Trace: t1` and status `201`

### Requirement: An invalid explicit status is rejected before the response is committed

A helper's explicit status SHALL be validated before any body is serialized or committed. The
accepted values SHALL be integers from 200 to 599 inclusive — the range every supported adapter can
answer. Any other value SHALL throw a `RangeError` naming the accepted range, leaving the response
uncommitted so the application error handler can still answer. The same value SHALL be rejected on
every adapter.

#### Scenario: An out-of-range status is rejected and the error handler answers

- **WHEN** a handler calls `ctx.json(data, 99)` or `ctx.json(data, 600)`
- **THEN** a `RangeError` naming the accepted range is thrown, no header or body byte is written, and
  the application error handler produces a completed error response

#### Scenario: A non-integer status is rejected

- **WHEN** a handler calls `ctx.send('body', 201.5)`
- **THEN** a `RangeError` is thrown and the response is not committed

#### Scenario: Every adapter rejects the same value

- **WHEN** the conformance suite sends the same invalid status through each shipped adapter
- **THEN** each adapter throws the same error type and the client-visible outcome is identical

### Requirement: A helper-supplied status obeys body suppression and the commit guard

A status supplied to a helper SHALL NOT change any existing response-construction rule: HEAD, 204,
304 and 1xx responses SHALL remain bodyless, the media type per helper SHALL be unchanged, and a
helper call on an already-committed response SHALL NOT alter the response or the recorded status.

#### Scenario: 204 suppresses the body

- **WHEN** a handler calls `ctx.json({ hidden: true }, 204)`
- **THEN** the response carries status `204` and no body

#### Scenario: 304 suppresses the body

- **WHEN** a handler calls `ctx.json({ hidden: true }, 304)`
- **THEN** the response carries status `304` and no body

#### Scenario: HEAD stays bodyless with an explicit status

- **WHEN** a HEAD request handler calls `ctx.json({ ok: true }, 201)`
- **THEN** the response carries status `201` and no body

#### Scenario: Media types are unchanged

- **WHEN** `ctx.json(data, 201)`, `ctx.html(content, 202)` and `ctx.send('body', 203)` are used
- **THEN** the media types are `application/json`, `text/html; charset=utf-8` and
  `text/plain;charset=UTF-8` respectively

#### Scenario: A post-commit helper call changes nothing

- **WHEN** a handler has already sent a response and then calls `ctx.json(data, 500)`
- **THEN** the committed response and `ctx.status` are both unchanged

#### Scenario: Results are identical on every adapter

- **WHEN** the conformance suite runs the explicit-status scenarios on Node, Bun, Deno, Edge and
  serverless
- **THEN** status, headers and body bytes are identical across adapters
