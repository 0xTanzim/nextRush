---
'@nextrush/router': minor
'@nextrush/runtime': minor
'@nextrush/types': minor
'@nextrush/adapter-node': patch
'@nextrush/adapter-deno': patch
---

**A dot segment is rejected in every spelling, and the path a Web adapter publishes is no longer
reshaped by a `URL` parser.**

`GET /files/%2e%2e/admin` was matched literally: `canonicalizePath()` treats `%2e` as three ordinary
characters, so that traversal spelling slipped past the rejection the literal `/files/../admin`
already received and was routed (or answered `404`) instead of `400`. Every percent-encoded dot
spelling — `%2e`, `%2E`, mixed case, either end of a segment — is now a dot segment, decided in one
linear scan as the path is canonicalized. A name that merely *contains* a dot is still not a segment:
`..hidden`, `archive.tar.gz`, and `%252e%252e` (a double-encoded dot, which is a literal `%` to every
parser in the chain) all route as before.

The Web context also stops deriving `ctx.path` through `new URL()`. That call parsed, percent-encoded,
and **resolved dot segments**, so on Deno — which hands the request target over unparsed — a target of
`/files/../admin` became `/admin` and dispatched to a route the client never named, while Node
rejected the same target with `400`. The two now agree: the published path is the bytes the platform
delivered, with no decoding and no resolution, and a request that names a traversal is rejected on
both.

One consequence is worth stating plainly: a target whose bytes `URL.pathname` would percent-encode (a
non-ASCII character, a space, `"`, `<`, `` ` ``, `{`, `}`) is now published **as delivered** rather
than re-encoded. Re-encoding would publish a form the client never sent and then match routes and
mounts against it — the same class of reshaping as resolving a segment.

**The platform decides first, and now says so.** Whether a dot segment survives to the application at
all belongs to the HTTP front end: `Bun.serve`, the edge isolates, and the serverless event mapping
parse the target into a `URL` before any framework code runs, so the original bytes are already gone
and the rejection cannot fire there. That fact is now a capability —
`RuntimeCapabilities.rawRequestTarget`, `true` on Node and Deno, `false` on the parsing platforms and
wherever it cannot be proven — and the adapter conformance suite derives its expectation from it over
a real socket instead of asserting one answer for every runtime. Nothing in the request path branches
on the flag.

`RuntimeCapabilities` gained a required property, so code that constructs one must include it; reading
it is unchanged. The behavior, the per-platform matrix, and where to enforce a path ACL are documented
in the security guide and on each adapter page.
