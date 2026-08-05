'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import {
  BunIcon,
  DenoIcon,
  NpmIcon,
  PnpmIcon,
  YarnIcon,
} from '../icons/package-manager-icons';

interface PackageInstallProps {
  packages: string[];
  dev?: string[];
}

// Order matches NextRush's supported-runtime priority (pnpm is the repo's
// own package manager; bun/deno are first-class adapter targets) rather
// than each tool's popularity ranking.
const packageManagers = [
  { name: 'pnpm', icon: PnpmIcon, install: 'pnpm add', devFlag: '-D' },
  { name: 'bun', icon: BunIcon, install: 'bun add', devFlag: '-d' },
  { name: 'npm', icon: NpmIcon, install: 'npm install', devFlag: '--save-dev' },
  { name: 'yarn', icon: YarnIcon, install: 'yarn add', devFlag: '-D' },
  { name: 'deno', icon: DenoIcon, install: 'deno add', devFlag: '--dev' },
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
        {packageManagers.map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.name}
              onClick={() => setActiveTab(p.name)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === p.name
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] border-b-2 border-[var(--brand-link)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/50'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {p.name}
            </button>
          );
        })}
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
