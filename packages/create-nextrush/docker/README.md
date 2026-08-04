# create-nextrush Docker compatibility matrix (local)

Stand up a clean container environment and verify that the **real package-manager
entrypoints** — `npm create`, `pnpm create`, `yarn create`, `bun create` — scaffold,
install, build, test, and serve a generated NextRush project across every supported
generated runtime.

## What it tests

- Real `create` commands (not a direct binary invocation), via a local **verdaccio**
  registry that serves the packed `create-nextrush` tarball under test.
- Every package manager × generated runtime cell:

  | Package Manager | Node | Bun | Deno |
  | --------------- | ---- | --- | ---- |
  | npm             | ✅   | ✅   | ✅   |
  | pnpm            | ✅   | ✅   | ✅   |
  | yarn (Classic 1.22) | ✅ | ✅ | ✅ |
  | bun             | ✅   | ✅   | ✅   |

- For each cell: scaffold → `install` → `build` → `test` → `start` → `GET /health`
  responds 200.
- Tool versions inside the container: Yarn **Classic 1.22.22** (what most users run),
  pnpm 10, bun 1.x, Deno 2.x — all installed from scratch, so host `~/.npmrc` /
  global config cannot leak in.

## Run it

```bash
# from the repo root
pnpm --filter create-nextrush build
pnpm --filter create-nextrush pack --pack-destination /tmp
cp /tmp/create-nextrush-*.tgz packages/create-nextrush/docker/create-nextrush.tgz

docker build \
  --build-arg NODE_MAJOR=22 \
  -t create-nextrush-matrix \
  -f packages/create-nextrush/docker/Dockerfile.matrix \
  packages/create-nextrush/docker

docker run --rm create-nextrush-matrix /work/create-nextrush.tgz
```

A successful run ends with:

```text
ALL PACKAGE MANAGERS × RUNTIMES PASSED
```

Any failure aborts non-zero and names the offending `manager × runtime` cell.

## Configuration

- `NODE_MAJOR` build arg — Node major for the base image (22 or 24; 20 is not
  supported by the scaffolder, which requires Node >= 22).
- `PM_LIST` / `RUNTIME_LIST` env vars — restrict the matrix, e.g.
  `docker run --rm -e PM_LIST="npm pnpm" -e RUNTIME_LIST="node" ...` for a quick
  single-cell check.

## Notes

- The matrix publishes the packed tarball to a throwaway verdaccio on port 4873
  inside the container; nothing is written to any public registry.
- `create-nextrush.tgz` is gitignored (build artifact); the Dockerfile expects it
  in this directory before `docker build`.
