import { ArrowRight, GitFork, Zap } from 'lucide-react';
import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { appConfig } from '@/config/appConfig';

const codeExample = `import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();
const PORT = Number(process.env.PORT) || 3000;

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
    <span className="text-[var(--code-number)]"> 3000</span>
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
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] bg-[var(--rush-blue)]/15 dark:bg-[var(--rush-blue)]/20 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-1/3 w-[500px] h-[500px] bg-[var(--rush-purple)]/10 dark:bg-[var(--rush-purple)]/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-20 left-1/2 w-[400px] h-[400px] bg-[var(--rush-cyan)]/8 dark:bg-[var(--rush-cyan)]/10 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 py-24 md:py-32">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-fd-border bg-fd-card/50 backdrop-blur-md animate-fade-up">
            <span className="relative flex h-2 w-2" role="status" aria-label="Live">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
            </span>
            <span className="text-sm text-fd-muted-foreground">
              v{appConfig.version} &middot; Node.js 22+, Bun, Deno, Edge
            </span>
          </div>

          <div className="flex items-center gap-3 mb-6 animate-fade-up animate-delay-100">
            <Zap className="size-12 md:size-16 text-[var(--rush-blue)]" aria-hidden="true" />
            <h1 className="text-5xl md:text-7xl font-bold gradient-text">NextRush</h1>
          </div>

          <p className="text-xl md:text-2xl text-fd-muted-foreground mb-4 max-w-2xl animate-fade-up animate-delay-200">
            TypeScript-first HTTP stack for Node.js and other runtimes.
          </p>
          <p className="text-lg text-fd-muted-foreground/70 mb-8 max-w-xl animate-fade-up animate-delay-300">
            Composable middleware, radix routing, optional DI and decorators.{' '}
            <Link href="/docs/performance" className="text-[var(--rush-cyan)] font-medium underline-offset-4 hover:underline">
              Benchmarks
            </Link>{' '}
            use a fixed setup so you can reproduce numbers on your own hardware.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16 animate-fade-up animate-delay-400">
            <Link
              href="/docs/getting-started"
              className="btn-primary inline-flex items-center gap-2 text-lg"
            >
              Get Started
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <a
              href="https://github.com/0xTanzim/nextrush"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline inline-flex items-center gap-2 text-lg"
            >
              <GitFork className="size-5" aria-hidden="true" />
              GitHub
            </a>
          </div>

          <div className="w-full max-w-2xl animate-fade-up animate-delay-500">
            <div className="relative rounded-xl overflow-hidden border border-[var(--code-border)] bg-[var(--code-bg)] code-glow">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--code-border)] bg-[var(--code-bg-header)]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <div className="w-3 h-3 rounded-full bg-[var(--danger)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--warning)]" />
                    <div className="w-3 h-3 rounded-full bg-[var(--success)]" />
                  </div>
                  <span className="ml-2 text-sm text-[var(--code-punctuation)] font-mono">
                    src/index.ts
                  </span>
                </div>
                <CopyButton code={codeExample} label="Copy code example" />
              </div>

              <pre className="p-4 overflow-x-auto text-left" tabIndex={0} role="code">
                <code className="text-sm font-mono">{highlightedCode}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
