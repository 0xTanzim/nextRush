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
          <div className="rounded-xl overflow-hidden border border-[#1e2433] bg-[#0d1117] code-glow">
            {/* Tabs */}
            <div className="flex border-b border-[#1e2433]">
              {packageManagers.map((pm) => (
                <button
                  key={pm.name}
                  onClick={() => setActiveTab(pm.name)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === pm.name
                      ? 'bg-[#141820] text-[#e2e8f0] border-b-2 border-[var(--rush-blue)]'
                      : 'text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#141820]/50'
                  }`}
                >
                  {pm.name}
                </button>
              ))}
            </div>

            {/* Command */}
            <div className="flex items-center justify-between p-4">
              <code className="font-mono text-[#22d3ee]">
                <span className="text-[#94a3b8]">$ </span>
                {activeCommand}
              </code>
              <button
                onClick={copyCommand}
                className="p-2 rounded-md hover:bg-[#1e2433] transition-colors text-[#94a3b8] hover:text-[#e2e8f0]"
                aria-label="Copy command"
              >
                {copied ? (
                  <Check className="size-5 text-[var(--success)]" />
                ) : (
                  <Copy className="size-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
