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
    <section className="py-24 border-t border-[#27272a]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Start building in seconds</h2>
          <p className="text-lg text-[#a1a1aa]">One command. Zero configuration.</p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="rounded-xl overflow-hidden border border-[#3f3f46] bg-[#18181b]">
            {/* Tabs */}
            <div className="flex border-b border-[#3f3f46]">
              {packageManagers.map((pm) => (
                <button
                  key={pm.name}
                  onClick={() => setActiveTab(pm.name)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === pm.name
                      ? 'bg-[#27272a] text-[#fafafa] border-b-2 border-[#3b82f6]'
                      : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#27272a]/50'
                  }`}
                >
                  {pm.name}
                </button>
              ))}
            </div>

            {/* Command */}
            <div className="flex items-center justify-between p-4">
              <code className="font-mono text-[#22d3ee]">
                <span className="text-[#71717a]">$ </span>
                {activeCommand}
              </code>
              <button
                onClick={copyCommand}
                className="p-2 rounded-md hover:bg-[#27272a] transition-colors text-[#71717a] hover:text-[#fafafa]"
                aria-label="Copy command"
              >
                {copied ? (
                  <Check className="size-5 text-[#22c55e]" />
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
