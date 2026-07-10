/**
 * Check 2 — MDX code-example compile check.
 *
 * Extracts fenced ```ts / ```typescript blocks from .mdx files and typechecks
 * each one for real, using the TypeScript Language Service API with a shared
 * `DocumentRegistry` — path-mapped so every NextRush workspace package
 * resolves to its `src/index.ts` (source, not `dist`; packages don't need to
 * be built for this check to run).
 *
 * WHY the Language Service API, not `tsc --noEmit` on one shared project:
 *   Two approaches were tried and rejected before this one (see git history /
 *   task report for the full trace):
 *     1. `ts.transpileModule` — single-file syntax transform only. It does
 *        NOT type-check, so it would silently pass a type error like
 *        `ctx.status = "not-a-number"`. Too weak to be a meaningful gate.
 *     2. `tsc --noEmit` against ONE shared tsconfig `include`-ing every
 *        extracted snippet as a sibling file. This is what a first pass of
 *        this check used, but it has a correctness bug proven while building
 *        this check: many doc snippets are intentionally-partial fragments
 *        (e.g. a single `@Body(...)` parameter decorator shown outside a
 *        class body, to illustrate one decorator in isolation) that produce
 *        cascading SYNTAX errors. When enough syntactically-broken sibling
 *        files share one `tsc` program, TypeScript's checker can suppress
 *        semantic diagnostics for files compiled after them — a real,
 *        reproduced bug, not a hypothetical: a seeded `ctx.status = "x"`
 *        type error was silently swallowed by 67 unrelated syntax errors in
 *        a different snippet in the same shared project. That is
 *        unacceptable for a gate whose entire job is not-missing defects.
 *   The Language Service API with `ts.createDocumentRegistry()` checks each
 *   snippet as an independent root file (so one file's syntax errors cannot
 *   mask another's semantic errors) while reusing parsed ASTs for the shared
 *   dependency graph (NextRush source, `@types/node`, lib files) across every
 *   snippet checked in the same process — this is what keeps it fast (~2s for
 *   30 files in local testing vs ~60s+ spawning `tsc` once per file, and it
 *   would silently mis-report defects if snippets were merged into one
 *   program). This is the documented, deliberate design for this check.
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
 *     `node:http`) resolve via `apps/docs`'s own `node_modules` — if a sample
 *     imports something not installed there, that IS a real finding (the doc
 *     claims a dependency the docs site can't actually demonstrate).
 *   - Top-level `await` requires `module: ESNext`, set in the shared options.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { extractCodeBlocks, readMdxDocs, type MdxDoc } from './lib/fs-walk.js';
import { resolveNextrushClassSubpathEntry, resolveWorkspacePackages } from './lib/package-resolver.js';

export interface CompileFinding {
  file: string;
  startLine: number;
  message: string;
}

const TS_LANGS = ['ts', 'typescript'] as const;

function buildCompilerOptions(packagesRoot: string): ts.CompilerOptions {
  const paths: Record<string, string[]> = {};
  for (const pkg of resolveWorkspacePackages(packagesRoot)) {
    paths[pkg.name] = [pkg.entryFile];
  }
  const classSubpath = resolveNextrushClassSubpathEntry(packagesRoot);
  if (classSubpath) paths[classSubpath.name] = [classSubpath.entryFile];

  const { options, errors } = ts.convertCompilerOptionsFromJson(
    {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022', 'DOM'],
      types: ['node'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      resolveJsonModule: true,
      ignoreDeprecations: '6.0',
      paths,
    },
    packagesRoot
  );
  if (errors.length > 0) {
    throw new Error(`Invalid TS compiler options: ${errors.map((e) => e.messageText).join('; ')}`);
  }
  return options;
}

export interface CompileCheckOptions {
  contentRoot: string;
  packagesRoot: string;
  /** Deterministic sample size (files, not blocks). Default 15. */
  sampleSize?: number;
  docs?: MdxDoc[];
}

interface Snippet {
  /** Absolute virtual path used as the Language Service root file name. */
  virtualPath: string;
  code: string;
  sourceFile: string;
  startLine: number;
}

export function checkCompile(options: CompileCheckOptions): CompileFinding[] {
  const { contentRoot, packagesRoot, sampleSize = 15 } = options;
  const docs = (options.docs ?? readMdxDocs(contentRoot))
    .slice()
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .slice(0, sampleSize);

  const snippets: Snippet[] = [];
  let index = 0;
  for (const doc of docs) {
    for (const block of extractCodeBlocks(doc.raw, TS_LANGS)) {
      index += 1;
      const safeName = doc.relativePath.replace(/[/\\]/g, '__').replace(/\.mdx$/, '');
      // Virtual paths live alongside real content so relative package `paths`
      // resolve exactly as they would for a real file at that location.
      const virtualPath = join(contentRoot, `.snippet__${safeName}__${index}.ts`);
      snippets.push({ virtualPath, code: block.code, sourceFile: doc.relativePath, startLine: block.startLine });
    }
  }

  if (snippets.length === 0) return [];

  const compilerOptions = buildCompilerOptions(packagesRoot);
  const registry = ts.createDocumentRegistry();
  const contentCache = new Map<string, string>();
  const snippetByPath = new Map(snippets.map((s) => [s.virtualPath, s]));
  let currentRoot = snippets[0].virtualPath;

  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [currentRoot],
    getScriptVersion: () => '1',
    getScriptSnapshot: (fileName) => {
      const snippet = snippetByPath.get(fileName);
      if (snippet) return ts.ScriptSnapshot.fromString(snippet.code);

      if (!contentCache.has(fileName)) {
        if (!existsSync(fileName)) return undefined;
        contentCache.set(fileName, readFileSync(fileName, 'utf-8'));
      }
      return ts.ScriptSnapshot.fromString(contentCache.get(fileName)!);
    },
    getCurrentDirectory: () => resolve(packagesRoot),
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
    fileExists: (fileName) => snippetByPath.has(fileName) || ts.sys.fileExists(fileName),
    readFile: (fileName) => snippetByPath.get(fileName)?.code ?? ts.sys.readFile(fileName),
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  };

  const service = ts.createLanguageService(host, registry);
  const findings: CompileFinding[] = [];

  for (const snippet of snippets) {
    currentRoot = snippet.virtualPath;
    const diagnostics = [
      ...service.getSyntacticDiagnostics(currentRoot),
      ...service.getSemanticDiagnostics(currentRoot),
    ];
    for (const diag of diagnostics) {
      const messageText = ts.flattenDiagnosticMessageText(diag.messageText, ' ');
      const lineWithinSnippet =
        diag.start !== undefined
          ? snippet.code.slice(0, diag.start).split('\n').length - 1
          : 0;
      findings.push({
        file: snippet.sourceFile,
        startLine: snippet.startLine + lineWithinSnippet,
        message: `TS${diag.code}: ${messageText}`,
      });
    }
  }

  return findings;
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
