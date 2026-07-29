'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

const packageManagers = [
  { name: 'pnpm', command: 'pnpm add nextrush' },
  { name: 'npm', command: 'npm install nextrush' },
  { name: 'yarn', command: 'yarn add nextrush' },
  { name: 'bun', command: 'bun add nextrush' },
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
    <section className="relative py-24">
      <hr className="section-divider absolute top-0 left-0 right-0" />
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Start building in seconds</h2>
          <p className="text-lg text-fd-muted-foreground">Install the package and follow the getting-started guide.</p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="rounded-xl overflow-hidden border border-fd-border bg-fd-card code-glow">
            <div className="flex border-b border-fd-border">
              {packageManagers.map((pm) => (
                <button
                  key={pm.name}
                  onClick={() => setActiveTab(pm.name)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === pm.name
                      ? 'bg-fd-muted text-fd-foreground border-b-2 border-[var(--rush-blue)]'
                      : 'text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-muted/50'
                  }`}
                >
                  {pm.name}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between p-4">
              <code className="font-mono text-[var(--rush-cyan)]">
                <span className="text-fd-muted-foreground">$ </span>
                {activeCommand}
              </code>
              <button
                onClick={copyCommand}
                className="p-2 rounded-md hover:bg-fd-border transition-colors text-fd-muted-foreground hover:text-fd-foreground"
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
