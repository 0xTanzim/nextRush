# Spec Delta

## ADDED Requirements

### Requirement: Parse-failure messages are runtime-independent

A parse failure raised by a body parser SHALL carry a framework-authored constant message that does
not vary between JavaScript engines. Where the engine's own parse text is useful for diagnosis it
SHALL be retained as a non-enumerable `cause`, available to server-side logging and never serialized
into a response. Framework-authored detail, such as a configured size limit or a nesting limit, SHALL
remain in the message.

#### Scenario: Invalid JSON reports the constant message

- **WHEN** a malformed JSON body is parsed
- **THEN** the raised error's message is exactly the documented constant `Invalid JSON`

#### Scenario: The message is identical on every runtime

- **WHEN** the same malformed JSON body is parsed under Node and under Bun
- **THEN** the two responses carry byte-identical bodies

#### Scenario: Engine parse text stays server-side

- **WHEN** a malformed JSON body is parsed
- **THEN** the engine's message is present on the error as a non-enumerable `cause` and is absent from
  the serialized response body

#### Scenario: Framework-authored detail is preserved

- **WHEN** a body exceeds the configured limit or a JSON payload exceeds the configured nesting depth
- **THEN** the message still states the framework's own limit and cause, as today

#### Scenario: Other parsers do not embed engine text

- **WHEN** the urlencoded, text or raw parsers report a failure
- **THEN** none of them embeds an engine-authored message in the response-visible message

### Requirement: An unparsed content type is decided by an explicit policy

The combined body parser SHALL expose an explicit policy for the case where a request carries a body,
declares a `Content-Type`, and matches no configured parser. The default policy SHALL preserve today's
behaviour: `ctx.body` stays undefined and the request continues. Under the rejecting policy the
request SHALL fail with the framework's unsupported-content-type error before any route handler runs.

#### Scenario: The default policy preserves today's behaviour

- **WHEN** a request declares an unmatched `Content-Type` and no policy is configured
- **THEN** parsing is skipped, `ctx.body` is undefined, and the request continues as today

#### Scenario: The rejecting policy answers 415

- **WHEN** the rejecting policy is configured and a request carries a body with an unmatched
  `Content-Type`
- **THEN** the request fails with the framework's unsupported-content-type error and a 415 status,
  before any route handler runs

#### Scenario: Bodyless methods never reject

- **WHEN** the rejecting policy is configured and a bodyless method is handled
- **THEN** no rejection occurs, regardless of the declared `Content-Type`

#### Scenario: An absent or empty content type never rejects

- **WHEN** the rejecting policy is configured and a request carries no `Content-Type` header
- **THEN** no rejection occurs

#### Scenario: A configured parser is unaffected

- **WHEN** a request's `Content-Type` matches a configured parser under either policy
- **THEN** the body is parsed exactly as before

#### Scenario: Multipart keeps its dedicated diagnostic

- **WHEN** a `multipart/*` request is handled under the default policy
- **THEN** the existing dedicated unsupported-content-type error pointing at the multipart package is
  still raised
