'use client';

import { CopyButton } from '@/components/copy-button';

/**
 * Docs-style proof — compact, request→response story.
 * Explicit architecture (createRouter + app.route). Idiomatic API is app.route, not app.use.
 */
const codeExample = `import { createApp, createRouter, listen } from "nextrush";

const app = createApp();
const users = createRouter();
users.get("/", (ctx) => ctx.json({ message: "Hello NextRush!" }));
app.route("/users", users);
await listen(app, 8080);`;

/** Soft docs highlighting — slightly less “IDE neon” than full token saturation. */
const soft = {
  kw: 'text-[color-mix(in_srgb,var(--code-keyword)_88%,transparent)]',
  fn: 'text-[color-mix(in_srgb,var(--code-function)_88%,transparent)]',
  prop: 'text-[color-mix(in_srgb,var(--code-property)_88%,transparent)]',
  str: 'text-[color-mix(in_srgb,var(--code-string)_88%,transparent)]',
  num: 'text-[color-mix(in_srgb,var(--code-number)_88%,transparent)]',
  var: 'text-[color-mix(in_srgb,var(--code-variable)_90%,transparent)]',
  punc: 'text-[color-mix(in_srgb,var(--code-punctuation)_85%,transparent)]',
} as const;

const highlightedCode = (
  <>
    <span className={soft.kw}>import</span>
    <span className={soft.var}> {'{ '}</span>
    <span className={soft.prop}>createApp</span>
    <span className={soft.var}>, </span>
    <span className={soft.prop}>createRouter</span>
    <span className={soft.var}>, </span>
    <span className={soft.prop}>listen</span>
    <span className={soft.var}> {'}'} </span>
    <span className={soft.kw}>from</span>
    <span className={soft.str}> &quot;nextrush&quot;</span>
    <span className={soft.punc}>;</span>
    {'\n\n'}
    <span className={soft.kw}>const</span>
    <span className={soft.var}> app = </span>
    <span className={soft.fn}>createApp</span>
    <span className={soft.punc}>();</span>
    {'\n'}
    <span className={soft.kw}>const</span>
    <span className={soft.var}> users = </span>
    <span className={soft.fn}>createRouter</span>
    <span className={soft.punc}>();</span>
    {'\n'}
    <span className={soft.var}>users.</span>
    <span className={soft.fn}>get</span>
    <span className={soft.punc}>(</span>
    <span className={soft.str}>&quot;/&quot;</span>
    <span className={soft.var}>, (ctx) {'=> '}ctx.</span>
    <span className={soft.fn}>json</span>
    <span className={soft.punc}>({'{ '}</span>
    <span className={soft.prop}>message</span>
    <span className={soft.punc}>: </span>
    <span className={soft.str}>&quot;Hello NextRush!&quot;</span>
    <span className={soft.punc}> {'}'}));</span>
    {'\n'}
    <span className={soft.var}>app.</span>
    <span className={soft.fn}>route</span>
    <span className={soft.punc}>(</span>
    <span className={soft.str}>&quot;/users&quot;</span>
    <span className={soft.var}>, users</span>
    <span className={soft.punc}>);</span>
    {'\n'}
    <span className={soft.kw}>await</span>
    <span className={soft.var}> </span>
    <span className={soft.fn}>listen</span>
    <span className={soft.punc}>(</span>
    <span className={soft.var}>app</span>
    <span className={soft.punc}>, </span>
    <span className={soft.num}>8080</span>
    <span className={soft.punc}>);</span>
  </>
);

/** Shared horizontal padding so header / code / footer share one left edge. */
const PAD = 'px-4 sm:px-5';

export function HeroCodeExample() {
  return (
    <div className="w-full animate-fade-up animate-delay-500">
      <div className="group relative overflow-hidden rounded-[12px] border border-black/[0.08] bg-[var(--code-bg)] shadow-[0_12px_36px_-12px_rgba(0,0,0,0.22)] dark:border-white/[0.08] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.55)]">
        {/* Header: name semibold · TypeScript is quiet metadata */}
        <div className={`flex items-center justify-between gap-3 border-b border-black/[0.08] bg-[var(--code-bg-header)] py-1.5 dark:border-white/[0.08] ${PAD}`}>
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold leading-snug tracking-tight text-fd-foreground">
              Hello, NextRush
            </p>
            <p className="text-[12px] font-normal leading-snug text-fd-muted-foreground/55">
              TypeScript
            </p>
          </div>
          <span className="shrink-0 transition-opacity duration-200 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
            <CopyButton code={codeExample} label="Copy code example" />
          </span>
        </div>

        {/* Code — +1px type scale, same left edge as header */}
        <pre className={`overflow-x-auto py-2 text-left leading-[1.5] sm:py-2.5 ${PAD}`} tabIndex={0}>
          <code className="text-sm font-mono">{highlightedCode}</code>
        </pre>

        {/* Output = the request the example serves — completes the story */}
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-black/[0.08] bg-[var(--code-bg-header)] py-1.5 font-mono text-sm dark:border-white/[0.08] ${PAD}`}
          aria-label="Example response"
        >
          <span className="font-medium text-fd-foreground">GET /users</span>
          <span className="text-fd-muted-foreground/50" aria-hidden="true">
            →
          </span>
          <span className="rounded bg-[var(--success)]/18 px-1.5 py-0.5 text-xs font-bold text-[var(--success)]">
            200 OK
          </span>
          <span className="hidden text-fd-muted-foreground sm:inline">
            {'{ "message": "Hello NextRush!" }'}
          </span>
        </div>
      </div>
    </div>
  );
}
