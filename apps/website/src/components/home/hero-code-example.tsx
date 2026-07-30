import { CopyButton } from '@/components/copy-button';

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

export function HeroCodeExample() {
  return (
    <div className="w-full max-w-3xl animate-fade-up animate-delay-500">
      <div className="relative overflow-hidden rounded-xl border border-[var(--code-border)] bg-[var(--code-bg)] code-glow">
        <div className="flex items-center justify-between border-b border-[var(--code-border)] bg-[var(--code-bg-header)] px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="size-3 rounded-full bg-[var(--danger)]" />
              <span className="size-3 rounded-full bg-[var(--warning)]" />
              <span className="size-3 rounded-full bg-[var(--success)]" />
            </div>
            <span className="ml-2 font-mono text-sm text-[var(--code-punctuation)]">src/index.ts</span>
          </div>
          <CopyButton code={codeExample} label="Copy code example" />
        </div>
        <pre className="overflow-x-auto p-4 text-left leading-snug" tabIndex={0}>
          <code className="text-sm font-mono">{highlightedCode}</code>
        </pre>
        <div className="flex items-center gap-2 border-t border-[var(--code-border)] bg-[var(--code-bg-header)] px-4 py-2 font-mono text-sm">
          <span className="text-[var(--success)]">GET /</span>
          <span className="text-[var(--code-punctuation)]">&rarr;</span>
          <span className="rounded bg-[var(--success)]/15 px-1.5 py-0.5 text-xs font-semibold text-[var(--success)]">200 OK</span>
          <span className="text-fd-muted-foreground">{'{'} &quot;message&quot;: &quot;Hello NextRush!&quot; {'}'}</span>
        </div>
      </div>
    </div>
  );
}
