'use client';

import { FileCode, Folder, FolderOpen, Star } from 'lucide-react';

interface FileTreeProps {
  /** Root folder name (e.g. "my-api") */
  root: string;
  /** File paths relative to root, forward-slash separated */
  files: string[];
  /** File or folder names to highlight with a star */
  highlight?: string[];
}

interface TreeNode {
  name: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const path of paths) {
    const parts = path.split('/');
    let siblings = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;

      let node = siblings.find((n) => n.name === name && n.isFile === isFile);
      if (!node) {
        node = { name, isFile, children: [] };
        siblings.push(node);
      }

      siblings = node.children;
    }
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({ ...n, children: sortNodes(n.children) }));

  return sortNodes(root);
}

function TreeEntry({
  node,
  depth,
  highlighted,
}: {
  node: TreeNode;
  depth: number;
  highlighted: boolean;
}) {
  return (
    <>
      <div
        className="flex items-center gap-1.5 py-[3px] text-[13px] leading-5"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {node.isFile ? (
          <>
            <FileCode className="size-3.5 shrink-0 text-zinc-500" />
            <span className={highlighted ? 'text-amber-300 font-medium' : 'text-zinc-400'}>
              {node.name}
            </span>
          </>
        ) : (
          <>
            <Folder className="size-3.5 shrink-0 text-sky-400" />
            <span className={highlighted ? 'text-amber-300 font-medium' : 'font-medium text-zinc-200'}>
              {node.name}
            </span>
          </>
        )}
        {highlighted && <Star className="size-3 shrink-0 text-amber-400" />}
      </div>
      {node.children.map((child) => (
        <TreeEntry
          key={`${child.isFile ? 'f' : 'd'}-${child.name}`}
          node={child}
          depth={depth + 1}
          highlighted={highlighted}
        />
      ))}
    </>
  );
}

/**
 * FileTree — renders a VSCode-style file tree from a flat list of paths.
 *
 * @example
 * ```mdx
 * <FileTree
 *   root="my-api"
 *   files={['src/index.ts', 'src/routes/health.ts', 'package.json']}
 *   highlight={['index.ts', 'routes']}
 * />
 * ```
 */
export function FileTree({ root, files, highlight = [] }: FileTreeProps) {
  const tree = buildTree(files);
  const highlighted = new Set(highlight);

  return (
    <div className="not-prose my-4 rounded-lg overflow-hidden border border-[var(--bg-border)] bg-zinc-900 dark:bg-[var(--bg-card)]">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--bg-border)] bg-zinc-800/80 dark:bg-zinc-800/40">
        <FolderOpen className="size-3.5 text-sky-400" />
        <span className="text-[13px] font-medium text-zinc-200">{root}</span>
      </div>

      {/* Tree */}
      <div className="py-1">
        {tree.map((node) => (
          <TreeEntry
            key={`${node.isFile ? 'f' : 'd'}-${node.name}`}
            node={node}
            depth={0}
            highlighted={highlighted.has(node.name)}
          />
        ))}
      </div>
    </div>
  );
}
