# Note — why `npm publish` kept failing (and what was actually wrong)

Date: 2026-07-30. Scope: `@nextrush/form-data`, `@nextrush/static`, and the publish pipeline.

## The symptom

Publishing from `packages/middleware/form-data` always failed:

```
npm error code E403
npm error 403 403 Forbidden - PUT https://registry.npmjs.org/@nextrush%2fform-data1
npm error 403 In most cases, you or one of your dependencies are requesting a package version
npm error 403 that is forbidden by your security policy, or on a server you do not have access to.
```

The same name, same token, same command, same `--tag beta` published successfully seconds later
from a scratch `publish-test/` directory. Version bumps, `--access public`, `publishConfig`,
`npm whoami` (`0xtanzim` from both directories), and cleaning `package.json` down to a dummy all
changed nothing.

## The main issue: Cloudflare's WAF, not npm

The 403 never came from npm's registry API. Relaying the publish through a local proxy captured
the raw response:

```
PUT /@nextrush%2fform-data1 -> 403
content-type: text/html; charset=UTF-8
server: cloudflare
cf-ray: a235819a0bf65807-DAC
```

An HTML block page from Cloudflare, which sits in front of `registry.npmjs.org`. npm cannot parse
an HTML body, so it prints its own generic "forbidden by your security policy" fallback — which is
what sent the investigation toward a permissions problem that did not exist.

Why the README was the trigger: `npm publish` sends the README as **plain text** in the JSON
request body (the `readme` field), while the tarball travels as base64-gzip. The WAF can therefore
read the README and cannot read the source files. `form-data/README.md` line 56 contained:

```
// `../../etc/passwd` reaching your filesystem write untouched
```

That is a textbook path-traversal / LFI signature. Cloudflare classified the publish request as an
attack and blocked it before npm saw it.

## Evidence (A/B, on a scratch package)

| Publish body | Result |
| --- | --- |
| `form-data` full README | 403 |
| Same README with `../../etc/passwd` neutralized | published |
| `form-data` dir with README temporarily removed | published |
| `publish-test` with `form-data`'s README copied in | 403 |
| `` `/etc/passwd` `` alone | published |
| `` `../../` `` alone | published |
| `` `../../etc/passwd` `` alone | 403 |
| `../../../etc/shadow` | 403 |
| 27 KB of synthetic filler text | published |

The trigger is a traversal sequence **combined with** an `/etc/<sensitive-file>` path. Neither
half alone trips the rule, and payload size is irrelevant.

One caveat: Cloudflare's managed rules include heuristic scoring, so one early test returned 403 on
a README prefix containing no traversal string and did not reproduce on retest. The
`../../etc/passwd` trigger reproduced every single time; that outlier did not.

## The fix

Replaced the example path with one that is equally clear and not a WAF signature:

- `packages/middleware/form-data/README.md:56` → `` `../../.env` ``
- `packages/middleware/static/README.md:52` → `'../../.env'` (identical string; would have failed
  on its first publish for the same reason)

Verified: both READMEs publish successfully. No other publishable README in `packages/` contains
the pattern.

Rule going forward: **never put `../../` together with a real system path such as `/etc/passwd` in
a package README.** Use `../../.env`, `../../secret.txt`, or a placeholder. `ARCHITECTURE.md` and
docs-site pages are safe from this specific block (they travel inside the gzipped tarball, or are
not published to npm at all), but the README is scanned in the clear on every publish.

## Released

| Package | Version | Tag | State |
| --- | --- | --- | --- |
| `@nextrush/form-data` | `1.0.0-beta.0` | `beta` (+`latest`) | published, installs and imports cleanly |
| `@nextrush/static` | `1.0.0-beta.0` | `beta` (+`latest`) | published, **import broken** — see below |

Both were built with `pnpm pack` (not `npm pack`) so the `@nextrush/types: workspace:^` dependency
is rewritten to `^4.0.0-beta.0` in the published manifest. Publishing these with plain `npm` would
have shipped a literal `workspace:^` range and produced an uninstallable package.

Pre-publish gates run for each: `pnpm build`, `pnpm typecheck`, `pnpm test`
(form-data 80 tests, static 129 tests), tarball contents inspected, credential sweep of the
tarball.

## Two further issues found

### 1. `@nextrush/static@1.0.0-beta.0` cannot be imported (blocking)

```
SyntaxError: The requested module '@nextrush/types' does not provide an export named 'SECURITY_AUDIT'
```

Cause: the **published** `@nextrush/types@4.0.0-beta.0` and the **local** `4.0.0-beta.0` are not
the same artifact. `SECURITY_AUDIT` was added to `packages/types` after that version was published,
without a version bump.

- published runtime exports: `ContentType, HTTP_METHODS, HttpStatus, ROUTE_METADATA`
- local runtime exports: the same **plus `SECURITY_AUDIT`**

Any package whose `dist` imports `SECURITY_AUDIT` breaks the same way once published. Currently
that is `core`, `errors`, `cors`, `csrf`, and `static`. `form-data` does not import it, which is why
it works.

Fix: publish `@nextrush/types@4.0.0-beta.1` (the runtime-surface delta is exactly one additive
export). Because `static` depends on `^4.0.0-beta.0`, existing installs resolve forward to
`4.0.0-beta.1` and start working with no republish of `static`. Caveat: doing this by hand
desynchronizes the Changesets pre-release train (`.changeset/pre.json`), which
`pnpm validate:changeset-baselines` and `pnpm verify:release-state` exist to guard — so route it
through Changesets rather than a manual `npm publish` if possible. Until it ships, `static@1.0.0-beta.0`
should be treated as broken (`npm deprecate` is appropriate).

### 2. An npm auth token is in git history

`packages/middleware/form-data/npmrc-nextrush` (containing `//registry.npmjs.org/:_authToken=…`)
was committed in `7570b3a` ("refactor(form-data): rename @nextrush/multipart to @nextrush/form-data").
`git branch -a --contains 7570b3a` lists only the local `feat/dev`, so it has **not** been pushed.

Also: the failing tarball at the start of this session packed `npmrc-nextrush` plus a nested `.tgz`,
because the dummy `package.json` had no `files` field. Cloudflare's rejection is the only reason
that token was not published to the registry. The real manifests declare
`files: ["dist","README.md"]`, which prevents this.

Actions:

- Rotate both tokens: the one committed in `7570b3a` and the one that was pasted into a chat
  session (`git log -S` confirms they are different tokens).
- Remove the file from history before pushing `feat/dev` (history rewrite — coordinate first).
- Keep credential files outside the repo, e.g. `~/.npmrc-nextrush`, and never inside a package root.
- `packages/middleware/test/` and `packages/middleware/publish-test/` are untracked and **not**
  gitignored; `test/npmrc-nextrush` holds a live token. Either gitignore those exact paths or move
  the scratch setup out of the repo.
