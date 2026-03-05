'use client';

import { ArrowRight, Check, Copy, Github, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const codeExample = `import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.route('/', router);
listen(app, 3000);`;

export function Hero() {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(codeExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient effects — large, diffused aurora blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] bg-[var(--rush-blue)]/15 dark:bg-[var(--rush-blue)]/20 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-[var(--rush-purple)]/10 dark:bg-[var(--rush-purple)]/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-20 left-1/2 w-[400px] h-[400px] bg-[var(--rush-cyan)]/8 dark:bg-[var(--rush-cyan)]/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 py-24 md:py-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-fd-border bg-fd-card/50 backdrop-blur-md animate-fade-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
            </span>
            <span className="text-sm text-fd-muted-foreground">
              v3.0.0-alpha.2 — Now with Multi-Runtime Support
            </span>
          </div>

          {/* Logo and Title */}
          <div className="flex items-center gap-3 mb-6 animate-fade-up animate-delay-100">
            <Zap className="size-12 md:size-16 text-[var(--rush-blue)]" />
            <h1 className="text-5xl md:text-7xl font-bold gradient-text">NextRush</h1>
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-fd-muted-foreground mb-4 max-w-2xl animate-fade-up animate-delay-200">
            The backend framework that doesn&apos;t get in your way.
          </p>
          <p className="text-lg text-fd-muted-foreground/70 mb-8 max-w-xl animate-fade-up animate-delay-300">
            Minimal. Modular. High performance.{' '}
            <span className="text-[var(--rush-cyan)] font-medium">30,000+ RPS.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16 animate-fade-up animate-delay-400">
            <Link
              href="/docs/getting-started"
              className="btn-primary inline-flex items-center gap-2 text-lg"
            >
              Get Started
              <ArrowRight className="size-5" />
            </Link>
            <a
              href="https://github.com/0xtanzim/nextrush"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex items-center gap-2 text-lg"
            >
              <Github className="size-5" />
              GitHub
            </a>
          </div>

          {/* Code Example */}
          <div className="w-full max-w-2xl animate-fade-up animate-delay-500">
            <div className="relative rounded-xl overflow-hidden border border-[#1e2433] bg-[#0d1117] code-glow">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2433] bg-[#141820]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[var(--danger)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--warning)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--success)]" />
                  </div>
                  <span className="ml-2 text-sm text-[#94a3b8] font-mono">src/index.ts</span>
                </div>
                <button
                  onClick={copyCode}
                  className="p-1.5 rounded-md hover:bg-[#1e2433] transition-colors text-[#94a3b8] hover:text-[#e2e8f0]"
                  aria-label="Copy code"
                >
                  {copied ? (
                    <Check className="size-4 text-[var(--success)]" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>

              {/* Code */}
              <pre className="p-4 overflow-x-auto text-left">
                <code className="text-sm font-mono">
                  <span className="text-[#c084fc]">import</span>
                  <span className="text-[#e2e8f0]"> {'{ '}</span>
                  <span className="text-[#22d3ee]">createApp</span>
                  <span className="text-[#e2e8f0]">, </span>
                  <span className="text-[#22d3ee]">createRouter</span>
                  <span className="text-[#e2e8f0]">, </span>
                  <span className="text-[#22d3ee]">listen</span>
                  <span className="text-[#e2e8f0]"> {'}'} </span>
                  <span className="text-[#c084fc]">from</span>
                  <span className="text-[#a5d6ff]"> &apos;nextrush&apos;</span>
                  <span className="text-[#94a3b8]">;</span>
                  {'\n\n'}
                  <span className="text-[#c084fc]">const</span>
                  <span className="text-[#e2e8f0]"> app = </span>
                  <span className="text-[#79c0ff]">createApp</span>
                  <span className="text-[#94a3b8]">();</span>
                  {'\n'}
                  <span className="text-[#c084fc]">const</span>
                  <span className="text-[#e2e8f0]"> router = </span>
                  <span className="text-[#79c0ff]">createRouter</span>
                  <span className="text-[#94a3b8]">();</span>
                  {'\n\n'}
                  <span className="text-[#e2e8f0]">router.</span>
                  <span className="text-[#79c0ff]">get</span>
                  <span className="text-[#94a3b8]">(</span>
                  <span className="text-[#a5d6ff]">&apos;/&apos;</span>
                  <span className="text-[#e2e8f0]">, (ctx) {'=> {'}</span>
                  {'\n'}
                  <span className="text-[#e2e8f0]"> ctx.</span>
                  <span className="text-[#79c0ff]">json</span>
                  <span className="text-[#94a3b8]">({'{ '}</span>
                  <span className="text-[#22d3ee]">message</span>
                  <span className="text-[#94a3b8]">: </span>
                  <span className="text-[#a5d6ff]">&apos;Hello NextRush!&apos;</span>
                  <span className="text-[#94a3b8]"> {'}'});</span>
                  {'\n'}
                  <span className="text-[#94a3b8]">{'}'});</span>
                  {'\n\n'}
                  <span className="text-[#e2e8f0]">app.</span>
                  <span className="text-[#79c0ff]">route</span>
                  <span className="text-[#94a3b8]">(</span>
                  <span className="text-[#a5d6ff]">&apos;/&apos;</span>
                  <span className="text-[#e2e8f0]">, router);</span>
                  {'\n'}
                  <span className="text-[#79c0ff]">listen</span>
                  <span className="text-[#e2e8f0]">(app, </span>
                  <span className="text-[#f59e0b]">3000</span>
                  <span className="text-[#94a3b8]">);</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
