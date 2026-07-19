## ADDED Requirements

### Requirement: A mid-stream body-size breach returns a clean 413, not a transport reset

When a request body exceeds the effective limit **while streaming** (no usable `Content-Length`,
so the breach is detected mid-read), the Node adapter SHALL deliver a well-formed `413` response
to the client before the request socket is torn down. It SHALL NOT `req.destroy()` in a way that
resets the connection before the `413` status line and body have flushed. The synchronous
`Content-Length` pre-check path (which rejects before any read) is unaffected.

#### Scenario: A chunked over-limit body receives a 413, not ECONNRESET
- **WHEN** a client streams a body (chunked / no accurate `Content-Length`) that exceeds the
  effective limit, and the framework's error handler maps the resulting `BodyTooLargeError` to a
  response
- **THEN** the client receives a `413` response (status + body) rather than a connection reset
  (`ECONNRESET` / socket hang up)

#### Scenario: The Content-Length pre-check path is unchanged
- **WHEN** a request declares a `Content-Length` over the effective limit
- **THEN** it is rejected synchronously with a `413` before any body is read, exactly as today

#### Scenario: Excess bytes are not buffered after the breach
- **WHEN** the running-total breach is detected mid-stream
- **THEN** no further body chunks are accumulated (the read stops consuming), while the response
  still flushes cleanly — memory is bounded near the limit

#### Scenario: Cross-adapter parity for the over-limit response
- **WHEN** the conformance suite drives an over-limit body through each adapter
- **THEN** every adapter returns a `413` (Web adapters via their stream cancellation), with no
  adapter resetting the connection before the response is delivered
