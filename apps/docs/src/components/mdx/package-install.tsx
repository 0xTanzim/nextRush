'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface PackageInstallProps {
  packages: string[];
  dev?: string[];
}

const packageManagers = [
  { name: 'pnpm', install: 'pnpm add', devFlag: '-D' },
  { name: 'npm', install: 'npm install', devFlag: '--save-dev' },
  { name: 'yarn', install: 'yarn add', devFlag: '-D' },
  { name: 'bun', install: 'bun add', devFlag: '-d' },
] as const;

type PackageManager = (typeof packageManagers)[number]['name'];

/**
 * PackageInstall - A tabbed package installer component for MDX
 *
 * @example
 * ```mdx
 * <PackageInstall packages={["@nextrush/core", "@nextrush/router"]} />
 *
 * <PackageInstall
 *   packages={["@nextrush/core"]}
 *   dev={["@nextrush/dev", "typescript"]}
 * />
 * ```
 */
export function PackageInstall({ packages, dev = [] }: PackageInstallProps) {
  const [activeTab, setActiveTab] = useState<PackageManager>('pnpm');
  const [copied, setCopied] = useState(false);

  const pm = packageManagers.find((p) => p.name === activeTab)!;

  const mainCommand = packages.length > 0 ? `${pm.install} ${packages.join(' ')}` : '';
  const devCommand = dev.length > 0 ? `${pm.install} ${pm.devFlag} ${dev.join(' ')}` : '';

  const fullCommand = [mainCommand, devCommand].filter(Boolean).join('\n');

  const copyCommand = async () => {
    await navigator.clipboard.writeText(fullCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-[var(--bg-border)] bg-[var(--bg-card)]">
      {/* Tabs */}
      <div className="flex border-b border-[var(--bg-border)]">
        {packageManagers.map((p) => (
          <button
            key={p.name}
            onClick={() => setActiveTab(p.name)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === p.name
                ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border-b-2 border-[var(--rush-blue)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/50'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Command */}
      <div className="relative p-4 bg-zinc-900 dark:bg-[var(--bg-card)]">
        <pre className="font-mono text-sm overflow-x-auto">
          {mainCommand && (
            <div>
              <span className="text-zinc-500">$ </span>
              <span className="text-cyan-400">{mainCommand}</span>
            </div>
          )}
          {devCommand && (
            <div className="mt-1">
              <span className="text-zinc-500">$ </span>
              <span className="text-cyan-400">{devCommand}</span>
            </div>
          )}
        </pre>

        <button
          onClick={copyCommand}
          className="absolute top-4 right-4 p-2 rounded-md hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          aria-label="Copy command"
        >
          {copied ? (
            <Check className="size-4 text-green-400" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
