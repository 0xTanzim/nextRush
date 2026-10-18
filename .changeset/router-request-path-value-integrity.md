---
'@nextrush/router': minor
---

Parameter and wildcard values keep the casing the client sent. Route matching is unchanged — still
case-insensitive by default — but a value is no longer read out of the case-folded path the lookup
runs on: `GET /users/ABC123` binds `{ id: 'ABC123' }` where dispatch previously bound
`{ id: 'abc123' }`. The package README already documented this behavior ("parameter names and
values always preserve their original case"), so this closes the gap between the documented
contract and dispatch.

The mechanism is one canonicalization yielding both strings a match needs. `canonicalizePath()`
now returns a case-preserved `valuePath` alongside the folded `path`, and the trie walk folds each
segment individually for its child lookup rather than folding the whole path first. Because a bound
value and its position come from the same string, a fold that changes a character's length no
longer risks shifting a later binding. When nothing folded, the two paths are the same string, so
an all-lowercase request allocates nothing extra; measured per-request allocation on the match and
dispatch paths is unchanged.

`canonicalizePath()` additionally exports the `CanonicalPaths` type, and
`Router.matchesMountPrefix()` now returns the case-preserved remainder, so a mounted router binds
the client's casing too. `Router.match(method, path)` is unchanged: still two arguments, still
normalizes its own input.

Consumers that relied on a folded identifier must fold it themselves
(`ctx.params.id.toLowerCase()`); everything that treats a parameter as an opaque value is
unaffected.
