---
"create-nextrush": patch
---

Fix dependency-install compatibility across package managers and runtimes:

- **npm**: detect a global `allow-scripts` config (`~/.npmrc`) before install and print clear guidance (add it to the project `.npmrc` or remove it) instead of surfacing npm's cryptic `EALLOWSCRIPTS` error. The install continues and reports the exact retry command on failure.
- **Yarn Classic (1.x)**: generated projects no longer pin `packageManager: yarn@4.0.0` (that field made Yarn Classic refuse to run and abort install). Yarn Classic now installs the generated project out of the box, with a friendly notice about Yarn Berry (v4) via Corepack.
- **Yarn Berry (v4)**: generated projects ship a `.yarnrc.yml` with `nodeLinker: node-modules`, so Yarn 4 installs into a real `node_modules` and the generated scripts (`nextrush build`, `vitest`) work instead of failing under PnP.
- **bun**: generated projects no longer emit `packageManager: bun@x.y.z` — pnpm 10 rejects a bun spec in that field with "Unsupported package manager specification" and aborts install.
- **Deno**: generated `dev`/`build` scripts now include `--allow-sys`, which `@nextrush/dev`'s build requires under Deno >= 2.9 (SWC's native binding performs an `Object.uid` os check; without it `nextrush build` fails with `NotCapable`).

Also adds a local Docker compatibility harness (`packages/create-nextrush/docker/`) that stands up a local verdaccio registry, publishes the packed tarball, and exercises the REAL `npm create` / `pnpm create` / `yarn create` / `bun create` entrypoints across every package manager × generated runtime (node/bun/deno), verifying scaffold → install → build → test → dev server → health 200 in clean containers. Run it with:

```bash
pnpm --filter create-nextrush pack --pack-destination /tmp
cp /tmp/create-nextrush-*.tgz packages/create-nextrush/docker/create-nextrush.tgz
docker build -t create-nextrush-matrix -f packages/create-nextrush/docker/Dockerfile.matrix packages/create-nextrush/docker
docker run --rm create-nextrush-matrix /work/create-nextrush.tgz
```
