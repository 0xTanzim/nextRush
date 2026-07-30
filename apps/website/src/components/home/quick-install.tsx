'use client';

import { Check, Copy } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

const packageManagers = [
  { name: 'pnpm', icon: '/icons/pnpm.svg', command: 'pnpm add nextrush' },
  { name: 'npm', icon: '/icons/npm.svg', command: 'npm install nextrush' },
  { name: 'yarn', icon: '/icons/yarn-svgrepo-com.svg', command: 'yarn add nextrush' },
  { name: 'bun', icon: '/icons/bun.svg', command: 'bun add nextrush' },
] as const;

export function QuickInstall() {
  const [activeTab, setActiveTab] = useState<(typeof packageManagers)[number]['name']>('pnpm');
  const [copied, setCopied] = useState(false);
  const activeCommand = packageManagers.find((pm) => pm.name === activeTab)?.command ?? '';

  const copyCommand = async () => {
    await navigator.clipboard.writeText(activeCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section aria-labelledby="install-first-app" className="relative py-24">
      <hr className="section-divider absolute inset-x-0 top-0" />
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 id="install-first-app" className="mb-4 text-3xl font-bold md:text-4xl">
            Install your first app
          </h2>
          <p className="text-lg text-fd-muted-foreground">Choose a package manager, install the core, then follow the introduction.</p>
        </div>

        <div className="mx-auto max-w-xl">
          <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card code-glow">
            <div role="group" aria-label="Package manager" className="flex border-b border-fd-border">
              {packageManagers.map((pm) => {
                const isActive = activeTab === pm.name;
                return (
                  <button
                    key={pm.name}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveTab(pm.name)}
                    className={`min-h-11 flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-b-2 border-[var(--rush-blue)] bg-fd-muted text-fd-foreground'
                        : 'text-fd-muted-foreground hover:bg-fd-muted/50 hover:text-fd-foreground'
                    }`}
                  >
                    <Image
                      src={pm.icon}
                      alt=""
                      width={16}
                      height={16}
                      className="mr-1.5 inline-block size-4 align-text-bottom"
                      aria-hidden="true"
                    />
                    {pm.name}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 p-4">
              <code aria-live="polite" className="overflow-x-auto font-mono text-[var(--rush-cyan)]">
                <span className="text-fd-muted-foreground">$ </span>
                {activeCommand}
              </code>
              <button
                type="button"
                onClick={copyCommand}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-border hover:text-fd-foreground"
                aria-label="Copy command"
              >
                {copied ? (
                  <Check className="size-5 text-[var(--success)]" aria-hidden="true" />
                ) : (
                  <Copy className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
