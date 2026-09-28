/**
 * Check 2 — MDX code-example compile check.
 *
 * Extracts fenced ```ts / ```typescript blocks from .mdx files and typechecks
 * each one for real, by writing every sampled snippet to a temporary project
 * and running the workspace TypeScript compiler (`tsc --noEmit`) over it as a
 * spawned CLI — path-mapped so every NextRush workspace package resolves to
 * its `src/index.ts` (source, not `dist`; packages don't need to be built for
 * this check to run).
 *
 * WHY a spawned `tsc` CLI, not the TypeScript JS API:
 *   This check previously used the Language Service API
 *   (`ts.createDocumentRegistry()` + `ts.createLanguageService()`) so each
 *   snippet could be an independent root file while reusing parsed ASTs for
 *   the shared dependency graph. TypeScript 7 removed that API from the
 *   package's main entry (it now resolves to a version stub; the compiler
 *   lives behind `typescript/unstable/*` with a fundamentally different
 *   snapshot/project shape), so any JS-API import is a hard crash on the
 *   workspace compiler. The `tsc` CLI is the stable, version-agnostic surface:
 *   it works identically on TypeScript 6 and 7, which keeps this check (and
 *   the docs toolchain) independent of the installed TypeScript major.
 *
 * WHY two passes over one shared project, not one pass and not one `tsc`
 * per snippet (see git history / task report for the full trace):
 *     1. `ts.transpileModule` — single-file syntax transform only. It does
 *        NOT type-check, so it would silently pass a type error like
 *        `ctx.status = "not-a-number"`. Too weak to be a meaningful gate.
 *     2. One shared `tsc` project, single pass. Many doc snippets are
 *        intentionally-partial fragments (e.g. a single `@Body(...)`
 *        parameter decorator shown outside a class body, to illustrate one
 *        decorator in isolation) that produce cascading SYNTAX errors. When
 *        enough syntactically-broken sibling files share one `tsc` program,
 *        TypeScript's checker can suppress semantic diagnostics for files
 *        compiled after them — a real, reproduced bug, not a hypothetical:
 *        a seeded `ctx.status = "x"` type error was silently swallowed by 67
 *        unrelated syntax errors in a different snippet in the same shared
 *        project. That is unacceptable for a gate whose entire job is
 *        not-missing defects.
 *   Spawning one `tsc` per snippet would give perfect isolation but costs a
 *   full compiler startup per snippet (~50 snippets in the default sample —
 *   minutes per run). Instead this check runs TWO passes over one shared
 *   temporary project: pass 1 collects every diagnostic and identifies the
 *   files with syntax errors (TS1xxx); pass 2 re-checks only the
 *   syntactically-clean files, so no syntax error anywhere in the program can
 *   mask a clean file's semantic errors. Files that already have syntax errors
 *   are reported from pass 1 (their own breakage is itself a finding a human
 *   reviews); everything else is reported from the trustworthy pass 2.
 *
 * SAMPLING, not exhaustive: default sample is `sampleSize` .mdx files
 * (deterministic: sorted by relative path, stable across runs), every
 * ts/typescript block within them is checked. Raise `sampleSize` to check
 * more of the corpus; a future CI-nightly profile could set it to Infinity.
 *
 * LIMITATIONS (documented per task):
 *   - Each snippet is checked as a STANDALONE file. A snippet that only shows
 *     a fragment (e.g. a bare parameter decorator, or code that continues
 *     from a preceding snippet in the same doc via `// ...`) will report
 *     syntax/semantic errors even though it renders fine as illustrative
 *     prose. These are expected findings for intentionally-partial snippets,
 *     not necessarily authoring bugs — a human reviews them, this check does
 *     not attempt to detect "this snippet is intentionally partial".
 *   - Import specifiers that are NOT NextRush workspace packages (e.g. `zod`,
 *     `node:http`) resolve via `apps/website`'s own `node_modules` — if a sample
 *     imports something not installed there, that IS a real finding (the doc
 *     claims a dependency the docs site can't actually demonstrate). The temp
 *     project lives under `apps/website/` for exactly this reason, and
 *     `@types/node` is wired via an absolute `typeRoots`.
 *   - Top-level `await` requires `module: ESNext`, set in the shared options.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractCodeBlocks, readMdxDocs, type MdxDoc } from './lib/fs-walk.js';
import { resolveNextrushClassSubpathEntry, resolveWorkspacePackages } from './lib/package-resolver.js';

export interface CompileFinding {
  file: string;
  startLine: number;
  message: string;
}

const TS_LANGS = ['ts', 'typescript'] as const;

/** `tsc --pretty false` per-file diagnostic: `path(line,col): error TScode: msg`. */
const TSC_DIAGNOSTIC_RE = /^(.*)\((\d+),\d+\): error TS(\d+): (.*)$/;

interface RawDiagnostic {
  fileName: string;
  line: number;
  code: number;
  message: string;
}

function buildTempTsconfig(paths: Record<string, string[]>, websiteRoot: string, snippetFiles: string[]): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        lib: ['ES2022', 'DOM'],
        types: ['node'],
        typeRoots: [join(websiteRoot, 'node_modules/@types')],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        resolveJsonModule: true,
        paths,
      },
      files: snippetFiles,
    },
    null,
    2
  );
}

/** Resolve the workspace `tsc` CLI without importing the TypeScript JS API. */
function resolveTscPath(): string {
  // Base the resolution on this file: it lives under apps/website, so the
  // lookup finds the website's TypeScript — the compiler the docs toolchain
  // actually runs on — regardless of the caller's cwd.
  const require = createRequire(fileURLToPath(import.meta.url));
  const pkgJson = require.resolve('typescript/package.json');
  const tsc = join(dirname(pkgJson), 'lib/tsc.js');
  if (!existsSync(tsc)) {
    throw new Error(`Cannot locate tsc CLI for the workspace TypeScript (looked at ${tsc})`);
  }
  return tsc;
}

function runTsc(projectDir: string): RawDiagnostic[] {
  const tsc = resolveTscPath();
  let output = '';
  let stderr = '';
  try {
    output = execFileSync(process.execPath, [tsc, '-p', projectDir, '--pretty', 'false'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180_000,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    const e = err as { stdout?: unknown; stderr?: unknown; status?: unknown; signal?: unknown };
    // tsc exits 1 when diagnostics exist — that IS the result. Any other
    // status (2 = misuse/config error), a signal, or a timeout means the
    // compiler itself failed: never report that as "all snippets clean".
    if (e.signal !== undefined && e.signal !== null) {
      throw new Error(`tsc killed by signal ${String(e.signal)}: ${String(e.stderr ?? '').slice(0, 2000)}`);
    }
    if (e.status !== undefined && e.status !== 0 && e.status !== 1) {
      throw new Error(`tsc exited with status ${String(e.status)}: ${String(e.stderr ?? e.stdout ?? '').slice(0, 2000)}`);
    }
    if (typeof e.stdout === 'string') output = e.stdout;
    else if (Buffer.isBuffer(e.stdout)) output = e.stdout.toString('utf-8');
    if (typeof e.stderr === 'string') stderr = e.stderr;
    else if (Buffer.isBuffer(e.stderr)) stderr = e.stderr.toString('utf-8');
  }
  const diagnostics: RawDiagnostic[] = [];
  for (const line of output.split('\n')) {
    const m = TSC_DIAGNOSTIC_RE.exec(line.trim());
    if (!m) continue;
    diagnostics.push({ fileName: m[1], line: Number(m[2]), code: Number(m[3]), message: m[4] });
  }
  if (diagnostics.length === 0 && stderr.trim() !== '') {
    throw new Error(`tsc produced no parseable diagnostics but wrote to stderr: ${stderr.slice(0, 2000)}`);
  }
  return diagnostics;
}

export interface CompileCheckOptions {
  contentRoot: string;
  packagesRoot: string;
  /** Deterministic sample size (files, not blocks). Default 15. */
  sampleSize?: number;
  docs?: MdxDoc[];
}

interface Snippet {
  /** Absolute path of the snippet file inside the temp project. */
  tmpPath: string;
  code: string;
  sourceFile: string;
  startLine: number;
}

export function checkCompile(options: CompileCheckOptions): CompileFinding[] {
  // Resolve up front: snippet paths, the temp project dir, and typeRoots are
  // all derived from these, and relative inputs would silently mis-resolve
  // them (e.g. typeRoots landing inside the temp dir instead of the website).
  const contentRoot = resolve(options.contentRoot);
  const packagesRoot = resolve(options.packagesRoot);
  const { sampleSize = 15 } = options;
  const docs = (options.docs ?? readMdxDocs(contentRoot))
    .slice()
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .slice(0, sampleSize);

  const websiteRoot = join(contentRoot, '..', '..');
  // Under apps/website so bare third-party imports resolve via its node_modules.
  // (Also listed in tsconfig exclude + .gitignore in case a crash skips cleanup.)
  const projectDir = join(websiteRoot, `.verify-snippets-${process.pid}`);
  mkdirSync(projectDir, { recursive: true });

  try {
    const snippets: Snippet[] = [];
    let index = 0;
    for (const doc of docs) {
      for (const block of extractCodeBlocks(doc.raw, TS_LANGS)) {
        index += 1;
        const tmpPath = join(projectDir, `snippet__${index}.ts`);
        writeFileSync(tmpPath, block.code);
        snippets.push({ tmpPath, code: block.code, sourceFile: doc.relativePath, startLine: block.startLine });
      }
    }

    if (snippets.length === 0) return [];

    // One workspace scan per run: the package set cannot change mid-check,
    // and the scan walks fixture trees (including .next output), so it is
    // the slowest part of this check — never repeat it per pass.
    const paths: Record<string, string[]> = {};
    for (const pkg of resolveWorkspacePackages(packagesRoot)) {
      paths[pkg.name] = [pkg.entryFile];
    }
    const classSubpath = resolveNextrushClassSubpathEntry(packagesRoot);
    if (classSubpath) paths[classSubpath.name] = [classSubpath.entryFile];

    const byTmpPath = new Map(snippets.map((s) => [s.tmpPath, s] as const));
    // tsc reports the path as given in `files`, resolved against the project
    // dir — normalize both sides before matching.
    const byResolvedPath = new Map(snippets.map((s) => [resolve(s.tmpPath), s] as const));
    const toSnippet = (fileName: string) => byTmpPath.get(fileName) ?? byResolvedPath.get(resolve(fileName));

    const toFinding = (snippet: Snippet, d: RawDiagnostic): CompileFinding => ({
      file: snippet.sourceFile,
      startLine: snippet.startLine + (d.line - 1),
      message: `TS${d.code}: ${d.message}`,
    });

    // Pass 1: everything together — find the syntactically-broken files whose
    // syntax errors could suppress siblings' semantic diagnostics.
    writeFileSync(
      join(projectDir, 'tsconfig.json'),
      buildTempTsconfig(
        paths,
        websiteRoot,
        snippets.map((s) => s.tmpPath)
      )
    );
    const pass1 = runTsc(projectDir);
    const syntaxBroken = new Set<string>();
    for (const d of pass1) {
      if (d.code >= 1000 && d.code < 2000) {
        const s = toSnippet(d.fileName);
        if (s) syntaxBroken.add(s.tmpPath);
      }
    }

    const findings: CompileFinding[] = [];
    // Fast path: no syntax errors anywhere means no suppression could have
    // happened — every pass-1 diagnostic is trustworthy, no second pass needed.
    if (syntaxBroken.size === 0) {
      for (const d of pass1) {
        const s = toSnippet(d.fileName);
        if (s) findings.push(toFinding(s, d));
      }
      return findings;
    }
    // Their own breakage is itself a finding — report pass-1 diagnostics.
    for (const d of pass1) {
      const s = toSnippet(d.fileName);
      if (s && syntaxBroken.has(s.tmpPath)) findings.push(toFinding(s, d));
    }

    // Pass 2: only the syntactically-clean files — semantic diagnostics here
    // cannot have been masked by anyone's syntax errors.
    const clean = snippets.filter((s) => !syntaxBroken.has(s.tmpPath));
    if (clean.length > 0) {
      writeFileSync(
        join(projectDir, 'tsconfig.json'),
        buildTempTsconfig(
          paths,
          websiteRoot,
          clean.map((s) => s.tmpPath)
        )
      );
      for (const d of runTsc(projectDir)) {
        const s = toSnippet(d.fileName);
        if (s) findings.push(toFinding(s, d));
      }
    }

    return findings;
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const contentRoot = join(__dirname, '../../content/docs');
  const packagesRoot = join(__dirname, '../../../../packages');

  const findings = checkCompile({ contentRoot, packagesRoot });
  for (const f of findings) {
    console.log(`${f.file}:${f.startLine} — ${f.message}`);
  }
  console.log(`\n${findings.length} code-example compile finding(s).`);
  process.exit(findings.length > 0 ? 1 : 0);
}
