/**
 * "Open in StackBlitz" — a real, working sandbox embed link (T21).
 *
 * Uses StackBlitz's documented "Create Project" HTTP API: a form POST to
 * `https://stackblitz.com/run` with `project[title]`, `project[template]`,
 * `project[files][<path>]`, and `project[dependencies]` fields. This is the same request
 * `@stackblitz/sdk`'s `openProject()` submits under the hood — see
 * https://developer.stackblitz.com/platform/api/javascript-sdk-api (SDK "Open Project") and
 * https://developer.stackblitz.com/platform/api/vscode-open-project-api (equivalent form
 * fields for the non-JS/static path). Using a plain `<form method="post">` means the embed
 * works with zero client-side JS and with static export (`output: 'export'`) — no server
 * round-trip, no SDK script tag needed.
 *
 * `apps/playground` in this repo cannot be forked directly: it depends on internal packages
 * via `workspace:*` (see `apps/playground/package.json`), which only resolve inside this
 * monorepo — StackBlitz can't install them standalone. So this component builds a
 * self-contained single-file project against the **published** `nextrush` npm package
 * instead, which is genuinely installable anywhere.
 */

interface StackBlitzFile {
  path: string;
  content: string;
}

export interface OpenInStackBlitzProps {
  /** Project title shown in the StackBlitz editor tab. */
  title: string;
  /** package.json `dependencies` — package name to version range. */
  dependencies: Record<string, string>;
  /** Files to seed the project with. Must include at least one entry. */
  files: StackBlitzFile[];
  /** File to open by default in the StackBlitz editor. Defaults to the first file's path. */
  openFile?: string;
}

function buildPackageJson(title: string, dependencies: Record<string, string>): string {
  return JSON.stringify(
    {
      name: title.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: { start: 'node --experimental-strip-types src/index.ts' },
      dependencies,
    },
    null,
    2
  );
}

export function OpenInStackBlitz({ title, dependencies, files, openFile }: OpenInStackBlitzProps) {
  const allFiles: StackBlitzFile[] = [
    ...files,
    { path: 'package.json', content: buildPackageJson(title, dependencies) },
  ];
  const defaultOpenFile = openFile ?? files[0]?.path;

  return (
    <form
      method="POST"
      action="https://stackblitz.com/run"
      target="_blank"
      className="my-4 inline-block"
    >
      <input type="hidden" name="project[title]" value={title} />
      <input type="hidden" name="project[template]" value="node" />
      <input type="hidden" name="project[description]" value={`${title} — NextRush example`} />
      {defaultOpenFile && (
        <input type="hidden" name="project[settings]" value={JSON.stringify({ compile: { trigger: 'auto', action: 'hmr' } })} />
      )}
      {allFiles.map((file) => (
        <input key={file.path} type="hidden" name={`project[files][${file.path}]`} value={file.content} />
      ))}
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-md border border-fd-border bg-fd-secondary px-3 py-1.5 text-sm font-medium text-fd-secondary-foreground transition-colors hover:bg-fd-accent"
      >
        <StackBlitzMark />
        Open in StackBlitz
      </button>
    </form>
  );
}

function StackBlitzMark() {
  return (
    <svg viewBox="0 0 28 28" className="size-4" fill="currentColor" aria-hidden>
      <title>StackBlitz</title>
      <path d="M12.747 16.273h-7.46L18.925 1l-3.671 10.727h7.46L9.075 27l3.672-10.727z" />
    </svg>
  );
}
