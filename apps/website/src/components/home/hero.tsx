import { ArrowRight, GitFork, Package, ShieldCheck, Star, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { HeroCodeExample } from '@/components/home/hero-code-example';
import { appConfig } from '@/config/appConfig';
import { DOCS_GETTING_STARTED } from '@/lib/docs-links';

const runtimeBadges = [
  { name: 'Node.js', icon: '/icons/nodejs.svg' },
  { name: 'Bun', icon: '/icons/bun.svg' },
  { name: 'Deno', icon: '/icons/deno-svgrepo-com.svg' },
  { name: 'Edge', icon: '/icons/azure-edge-management.svg' },
  { name: 'TypeScript', icon: '/icons/typescript.svg' },
] as const;

const codeExample = `import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();
const PORT = Number(process.env.PORT) || 8080;

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.route('/', router);
await listen(app, PORT);`;

const highlightedCode = (
  <>
    <span className="text-[var(--code-keyword)]">import</span>
    <span className="text-[var(--code-variable)]"> {'{ '}</span>
    <span className="text-[var(--code-property)]">createApp</span>
    <span className="text-[var(--code-variable)]">, </span>
    <span className="text-[var(--code-property)]">createRouter</span>
    <span className="text-[var(--code-variable)]">, </span>
    <span className="text-[var(--code-property)]">listen</span>
    <span className="text-[var(--code-variable)]"> {'}'} </span>
    <span className="text-[var(--code-keyword)]">from</span>
    <span className="text-[var(--code-string)]"> &apos;nextrush&apos;</span>
    <span className="text-[var(--code-punctuation)]">;</span>
    {'\n\n'}
    <span className="text-[var(--code-keyword)]">const</span>
    <span className="text-[var(--code-variable)]"> app = </span>
    <span className="text-[var(--code-function)]">createApp</span>
    <span className="text-[var(--code-punctuation)]">();</span>
    {'\n'}
    <span className="text-[var(--code-keyword)]">const</span>
    <span className="text-[var(--code-variable)]"> router = </span>
    <span className="text-[var(--code-function)]">createRouter</span>
    <span className="text-[var(--code-punctuation)]">();</span>
    {'\n'}
    <span className="text-[var(--code-keyword)]">const</span>
    <span className="text-[var(--code-variable)]"> PORT = </span>
    <span className="text-[var(--code-function)]">Number</span>
    <span className="text-[var(--code-punctuation)]">(</span>
    <span className="text-[var(--code-variable)]">process.</span>
    <span className="text-[var(--code-property)]">env</span>
    <span className="text-[var(--code-punctuation)]">.</span>
    <span className="text-[var(--code-variable)]">PORT</span>
    <span className="text-[var(--code-punctuation)]">) </span>
    <span className="text-[var(--code-operator)]">||</span>
    <span className="text-[var(--code-number)]"> 8080</span>
    <span className="text-[var(--code-punctuation)]">;</span>
    {'\n\n'}
    <span className="text-[var(--code-variable)]">router.</span>
    <span className="text-[var(--code-function)]">get</span>
    <span className="text-[var(--code-punctuation)]">(</span>
    <span className="text-[var(--code-string)]">&apos;/&apos;</span>
    <span className="text-[var(--code-variable)]">, (ctx) {'=> {'}</span>
    {'\n'}
    <span className="text-[var(--code-variable)]"> ctx.</span>
    <span className="text-[var(--code-function)]">json</span>
    <span className="text-[var(--code-punctuation)]">({'{ '}</span>
    <span className="text-[var(--code-property)]">message</span>
    <span className="text-[var(--code-punctuation)]">: </span>
    <span className="text-[var(--code-string)]">&apos;Hello NextRush!&apos;</span>
    <span className="text-[var(--code-punctuation)]"> {'}'});</span>
    {'\n'}
    <span className="text-[var(--code-punctuation)]">{'}'});</span>
    {'\n\n'}
    <span className="text-[var(--code-keyword)]">await</span>
    <span className="text-[var(--code-variable)]"> </span>
    <span className="text-[var(--code-function)]">listen</span>
    <span className="text-[var(--code-punctuation)]">(</span>
    <span className="text-[var(--code-variable)]">app</span>
    <span className="text-[var(--code-punctuation)]">, </span>
    <span className="text-[var(--code-variable)]">PORT</span>
    <span className="text-[var(--code-punctuation)]">);</span>
  </>
);

export function Hero() {
  return (
    <section aria-label="Why NextRush" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 size-[600px] rounded-full bg-[var(--rush-blue)]/15 blur-[120px] dark:bg-[var(--rush-blue)]/20" />
        <div className="absolute right-1/3 top-0 size-[500px] rounded-full bg-[var(--rush-purple)]/10 blur-[120px] dark:bg-[var(--rush-purple)]/15" />
        <div className="absolute -bottom-20 left-1/2 size-[400px] rounded-full bg-[var(--rush-cyan)]/8 blur-[120px] dark:bg-[var(--rush-cyan)]/10" />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {/* Group 1: identity — badge sits tight against the logo */}
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/50 px-4 py-1.5 backdrop-blur-md animate-fade-up">
            <span className="relative flex size-2" role="status" aria-label="Live">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--success)]" />
            </span>
            <span className="text-sm text-fd-muted-foreground">
              v{appConfig.version} &middot; Node.js 22+, Bun, Deno, Edge
            </span>
          </div>

          <div className="mb-5 flex items-center gap-2.5 animate-fade-up animate-delay-100">
            <Zap className="size-10 text-[var(--rush-blue)] md:size-14" aria-hidden="true" />
            <h1 className="text-4xl font-bold gradient-text md:text-6xl">NextRush</h1>
          </div>

          {/* Group 2: message — headline, description, and trust row read as one unit */}
          <p className="mb-3 max-w-2xl text-2xl text-fd-muted-foreground md:text-3xl animate-fade-up animate-delay-200">
            Explicit architecture. Zero hidden behavior.
          </p>
          <p className="mb-5 max-w-2xl text-lg text-fd-muted-foreground animate-fade-up animate-delay-300">
            NextRush is the backend framework for developers who want to reason about every request, not guess what a
            framework did for them. Start with a small functional core; add segment-trie routing, middleware, and the
            class runtime only when your application needs them.{' '}
            <Link href="/docs/getting-started/benchmarking" className="font-medium text-[var(--rush-cyan)] underline-offset-4 hover:underline">
              Benchmarks
            </Link>{' '}
            publish the methodology so you can reproduce results on your own hardware.
          </p>

          <div className="mb-8 flex max-w-3xl flex-col items-center gap-3 animate-fade-up animate-delay-300">
            <div aria-label="Runtime support" className="flex flex-wrap items-center justify-center gap-2">
              {runtimeBadges.map((runtime) => (
                <span
                  key={runtime.name}
                  className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/60 px-3 py-1.5 text-sm text-fd-muted-foreground transition-transform hover:-translate-y-0.5 hover:border-[var(--rush-blue)]/40"
                >
                  <Image src={runtime.icon} alt="" width={16} height={16} className="size-4" aria-hidden="true" />
                  {runtime.name}
                </span>
              ))}
            </div>
            <div aria-label="Framework guarantees" className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fd-border bg-fd-card/40 px-3 py-1 text-xs text-fd-muted-foreground">
                <ShieldCheck className="size-3.5 text-[var(--success)]" aria-hidden="true" />
                <strong className="font-semibold text-fd-foreground">Zero</strong> runtime deps
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-fd-border bg-fd-card/40 px-3 py-1 text-xs text-fd-muted-foreground">
                <Package className="size-3.5 text-[var(--rush-purple)]" aria-hidden="true" />
                <strong className="font-semibold text-fd-foreground">MIT</strong> licensed
              </span>
            </div>
          </div>

          {/* Group 3: action — CTAs stay visually attached to the code proof below them */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row animate-fade-up animate-delay-400">
            <Link
              href={DOCS_GETTING_STARTED}
              className="btn-primary inline-flex items-center justify-center gap-2 text-lg transition-shadow hover:shadow-[0_0_24px_-4px_var(--rush-blue)]"
            >
              Get started
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <a
              href="https://github.com/0xTanzim/nextrush"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-base font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground"
            >
              <GitFork className="size-5" aria-hidden="true" />
              View on GitHub
              <Star className="size-4" aria-hidden="true" />
            </a>
          </div>

          <HeroCodeExample />
        </div>
      </div>
    </section>
  );
}
