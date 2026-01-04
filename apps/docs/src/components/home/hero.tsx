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
      {/* Background gradient effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#3b82f6]/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-[#8b5cf6]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-[#22d3ee]/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-24 md:py-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-[#3f3f46] bg-[#18181b]/80 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
            </span>
            <span className="text-sm text-[#a1a1aa]">
              v3.0.0-alpha.2 — Now with Multi-Runtime Support
            </span>
          </div>

          {/* Logo and Title */}
          <div className="flex items-center gap-3 mb-6">
            <Zap className="size-12 md:size-16 text-[#3b82f6]" />
            <h1 className="text-5xl md:text-7xl font-bold gradient-text">NextRush</h1>
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-[#a1a1aa] mb-4 max-w-2xl">
            The backend framework that doesn&apos;t get in your way.
          </p>
          <p className="text-lg text-[#71717a] mb-8 max-w-xl">
            Minimal. Modular. Blazing fast. <span className="text-[#22d3ee]">30,000+ RPS.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
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
          <div className="w-full max-w-2xl animate-fade-in">
            <div className="relative rounded-xl overflow-hidden border border-[#3f3f46] bg-[#18181b]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#3f3f46] bg-[#27272a]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                    <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                  </div>
                  <span className="ml-2 text-sm text-[#71717a] font-mono">src/index.ts</span>
                </div>
                <button
                  onClick={copyCode}
                  className="p-1.5 rounded-md hover:bg-[#3f3f46] transition-colors text-[#71717a] hover:text-[#fafafa]"
                  aria-label="Copy code"
                >
                  {copied ? <Check className="size-4 text-[#22c55e]" /> : <Copy className="size-4" />}
                </button>
              </div>

              {/* Code */}
              <pre className="p-4 overflow-x-auto">
                <code className="text-sm font-mono">
                  <span className="text-[#c084fc]">import</span>
                  <span className="text-[#fafafa]"> {'{ '}</span>
                  <span className="text-[#22d3ee]">createApp</span>
                  <span className="text-[#fafafa]">, </span>
                  <span className="text-[#22d3ee]">createRouter</span>
                  <span className="text-[#fafafa]">, </span>
                  <span className="text-[#22d3ee]">listen</span>
                  <span className="text-[#fafafa]"> {'}'} </span>
                  <span className="text-[#c084fc]">from</span>
                  <span className="text-[#a5d6ff]"> &apos;nextrush&apos;</span>
                  <span className="text-[#fafafa]">;</span>
                  {'\n\n'}
                  <span className="text-[#c084fc]">const</span>
                  <span className="text-[#fafafa]"> app = </span>
                  <span className="text-[#79c0ff]">createApp</span>
                  <span className="text-[#fafafa]">();</span>
                  {'\n'}
                  <span className="text-[#c084fc]">const</span>
                  <span className="text-[#fafafa]"> router = </span>
                  <span className="text-[#79c0ff]">createRouter</span>
                  <span className="text-[#fafafa]">();</span>
                  {'\n\n'}
                  <span className="text-[#fafafa]">router.</span>
                  <span className="text-[#79c0ff]">get</span>
                  <span className="text-[#fafafa]">(</span>
                  <span className="text-[#a5d6ff]">&apos;/&apos;</span>
                  <span className="text-[#fafafa]">, (ctx) {'=> {'}</span>
                  {'\n'}
                  <span className="text-[#fafafa]">  ctx.</span>
                  <span className="text-[#79c0ff]">json</span>
                  <span className="text-[#fafafa]">({'{ '}</span>
                  <span className="text-[#22d3ee]">message</span>
                  <span className="text-[#fafafa]">: </span>
                  <span className="text-[#a5d6ff]">&apos;Hello NextRush!&apos;</span>
                  <span className="text-[#fafafa]"> {'}'});</span>
                  {'\n'}
                  <span className="text-[#fafafa]">{'}'});</span>
                  {'\n\n'}
                  <span className="text-[#fafafa]">app.</span>
                  <span className="text-[#79c0ff]">route</span>
                  <span className="text-[#fafafa]">(</span>
                  <span className="text-[#a5d6ff]">&apos;/&apos;</span>
                  <span className="text-[#fafafa]">, router);</span>
                  {'\n'}
                  <span className="text-[#79c0ff]">listen</span>
                  <span className="text-[#fafafa]">(app, </span>
                  <span className="text-[#f59e0b]">3000</span>
                  <span className="text-[#fafafa]">);</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
