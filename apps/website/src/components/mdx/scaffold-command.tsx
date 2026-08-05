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

interface ScaffoldCommandProps {
  /**
   * Map of package manager name to the command string.
   * Keys must be one of: 'pnpm', 'bun', 'npm', 'yarn'.
   *
   * @example
   * ```mdx
   * <ScaffoldCommand
   *   commands={{
   *     pnpm: 'pnpm create nextrush@latest my-api',
   *     bun: 'bun create nextrush my-api',
   *     npm: 'npm create nextrush my-api',
   *     yarn: 'yarn create nextrush my-api',
   *   }}
   * />
   * ```
   */
  commands: Partial<Record<'pnpm' | 'bun' | 'npm' | 'yarn' | 'deno', string>>;
}

const packageManagers = [
  { name: 'pnpm', icon: PnpmIcon },
  { name: 'bun', icon: BunIcon },
  { name: 'npm', icon: NpmIcon },
  { name: 'yarn', icon: YarnIcon },
  { name: 'deno', icon: DenoIcon },
] as const;

type PackageManager = (typeof packageManagers)[number]['name'];

export function ScaffoldCommand({ commands }: ScaffoldCommandProps) {
  const [activeTab, setActiveTab] = useState<PackageManager>('pnpm');
  const [copied, setCopied] = useState(false);

  const command = commands[activeTab] ?? '';

  const copyCommand = async () => {
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-[var(--bg-border)] bg-[var(--bg-card)]">
      {/* Tabs */}
      <div className="flex border-b border-[var(--bg-border)]">
        {packageManagers.map((p) => {
          const Icon = p.icon;
          const hasCommand = p.name in commands;
          return (
            <button
              key={p.name}
              onClick={() => hasCommand && setActiveTab(p.name)}
              disabled={!hasCommand}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                !hasCommand
                  ? 'opacity-40 cursor-not-allowed'
                  : activeTab === p.name
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
          <span className="text-zinc-500">$ </span>
          <span className="text-cyan-400">{command}</span>
        </pre>

        {command && (
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
        )}
      </div>
    </div>
  );
}
