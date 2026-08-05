'use client';

import { Check, Copy } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

const packageManagers = [
  { name: 'pnpm', icon: '/icons/pnpm.svg', create: 'pnpm create nextrush@latest my-api', dev: 'cd my-api && pnpm dev' },
  { name: 'npm', icon: '/icons/npm.svg', create: 'npm create nextrush my-api', dev: 'cd my-api && npm run dev' },
  { name: 'yarn', icon: '/icons/yarn-svgrepo-com.svg', create: 'yarn create nextrush my-api', dev: 'cd my-api && yarn dev' },
  { name: 'bun', icon: '/icons/bun.svg', create: 'bun create nextrush my-api', dev: 'cd my-api && bun dev' },
] as const;

export function QuickInstall() {
  const [activeTab, setActiveTab] = useState<(typeof packageManagers)[number]['name']>('pnpm');
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const active = packageManagers.find((pm) => pm.name === activeTab) ?? packageManagers[0];

  const copy = async (text: string, step: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const steps = [
    { number: 1, label: 'Create', command: active.create },
    { number: 2, label: 'Start', command: active.dev },
  ] as const;

  return (
    <section aria-labelledby="install-first-app" className="relative bg-fd-muted/40 py-24">
      <hr className="section-divider absolute inset-x-0 top-0" />
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 id="install-first-app" className="mb-4 text-3xl font-bold md:text-4xl">
            Install your first app
          </h2>
          <p className="text-lg text-fd-muted-foreground">Three commands. One running server.</p>
        </div>

        <div className="mx-auto max-w-2xl">
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
                        ? 'border-b-2 border-[var(--brand-link)] bg-fd-muted text-fd-foreground'
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

            <div className="divide-y divide-fd-border" aria-live="polite">
              {steps.map((step) => (
                <div key={step.number} className="flex items-center gap-3 p-4 sm:gap-4">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-link)]/15 text-sm font-semibold text-[var(--brand-link)]">
                    {step.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-fd-muted-foreground">
                      {step.label}
                    </p>
                    <code className="block overflow-x-auto font-mono text-sm text-[#057088] dark:text-[var(--learning-context)]">
                      <span className="text-fd-muted-foreground">$ </span>
                      {step.command}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(step.command, step.number)}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-fd-muted-foreground transition-colors hover:bg-fd-border hover:text-fd-foreground"
                    aria-label={`Copy ${step.label} command`}
                  >
                    {copiedStep === step.number ? (
                      <Check className="size-4 text-[var(--success)]" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[var(--code-bg-header)] px-4 py-3 font-mono text-sm sm:gap-4">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/15 text-sm font-semibold text-[var(--success)]">
                  3
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-fd-muted-foreground">Visit</span>
                <span className="text-[#057088] dark:text-[var(--learning-context)]">http://localhost:8080</span>
                <span className="text-[var(--code-punctuation)]" aria-hidden="true">&rarr;</span>
                <span className="font-semibold text-[var(--success)]">✓ Hello NextRush!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
