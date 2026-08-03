import type { ReactNode } from 'react';
import { CopyButton } from '@/components/copy-button';
import { OpenInStackBlitz } from './open-in-stackblitz';

const TK = {
  k: 'text-[var(--code-keyword)]',
  p: 'text-[var(--code-punctuation)]',
  v: 'text-[var(--code-variable)]',
  s: 'text-[var(--code-string)]',
  num: 'text-[var(--code-number)]',
  blue: 'text-[var(--rush-blue)]',
  purple: 'text-[var(--rush-purple)]',
  green: 'text-[var(--rush-green)]',
  cyan: 'text-[var(--rush-cyan)]',
};

const code = `import { createApp, createRouter, listen } from 'nextrush';

const app = createApp();
const router = createRouter();

router.get('/', (ctx) => {
  ctx.json({ message: 'Hello NextRush!' });
});

app.route('/', router);
await listen(app, 8080);`;

const NOTE_COLORS = ['var(--rush-blue)', 'var(--rush-purple)', 'var(--rush-green)'];
const BADGES = ['\u2460', '\u2461', '\u2462'];

type Row = { h: ReactNode; note?: string; badge?: number };

const rows: Row[] = [
  {
    h: (
      <>
        <span className={TK.k}>import</span>
        <span className={TK.p}> {'{ '}</span>
        <span className={TK.blue}>createApp</span>
        <span className={TK.p}>, </span>
        <span className={TK.purple}>createRouter</span>
        <span className={TK.p}>, </span>
        <span className={TK.green}>listen</span>
        <span className={TK.p}> {'}'} </span>
        <span className={TK.k}>from</span>
        <span className={TK.s}> &apos;nextrush&apos;</span>
        <span className={TK.p}>;</span>
      </>
    ),
  },
  { h: <>&nbsp;</> },
  {
    h: (
      <>
        <span className={TK.k}>const</span>
        <span className={TK.v}> app </span>
        <span className={TK.p}>= </span>
        <span className={TK.blue}>createApp</span>
        <span className={TK.p}>();</span>
      </>
    ),
    badge: 1,
    note: 'create application',
  },
  {
    h: (
      <>
        <span className={TK.k}>const</span>
        <span className={TK.v}> router </span>
        <span className={TK.p}>= </span>
        <span className={TK.purple}>createRouter</span>
        <span className={TK.p}>();</span>
      </>
    ),
  },
  { h: <>&nbsp;</> },
  {
    h: (
      <>
        <span className={TK.purple}>router</span>
        <span className={TK.cyan}>.get</span>
        <span className={TK.p}>(</span>
        <span className={TK.s}>&apos;/&apos;</span>
        <span className={TK.p}>, (ctx) =&gt; {'{'}</span>
      </>
    ),
    badge: 2,
    note: 'register route',
  },
  {
    h: (
      <>
        <span className={TK.v}>  ctx.</span>
        <span className={TK.cyan}>json</span>
        <span className={TK.p}>({'{ '}</span>
        <span className={TK.v}>message</span>
        <span className={TK.p}>: </span>
        <span className={TK.s}>&apos;Hello NextRush!&apos;</span>
        <span className={TK.p}> {'}'});</span>
      </>
    ),
  },
  { h: <span className={TK.p}>{'});'}</span> },
  { h: <>&nbsp;</> },
  {
    h: (
      <>
        <span className={TK.v}>app.</span>
        <span className={TK.cyan}>route</span>
        <span className={TK.p}>(</span>
        <span className={TK.s}>&apos;/&apos;</span>
        <span className={TK.p}>, </span>
        <span className={TK.v}>router</span>
        <span className={TK.p}>);</span>
      </>
    ),
  },
  {
    h: (
      <>
        <span className={TK.k}>await</span>
        <span className={TK.v}> </span>
        <span className={TK.green}>listen</span>
        <span className={TK.p}>(</span>
        <span className={TK.v}>app</span>
        <span className={TK.p}>, </span>
        <span className={TK.num}>8080</span>
        <span className={TK.p}>);</span>
      </>
    ),
    badge: 3,
    note: 'start server',
  },
];

export function CodeShowcase() {
  return (
    <figure className="code-showcase not-prose">
      <div className="code-showcase__window">
        <div className="code-showcase__header">
          <div className="flex items-center gap-2" aria-hidden="true">
            <span className="size-3 rounded-full bg-[var(--danger)]" />
            <span className="size-3 rounded-full bg-[var(--warning)]" />
            <span className="size-3 rounded-full bg-[var(--success)]" />
          </div>
          <span className="code-showcase__title">src/index.ts</span>
          <span className="code-showcase__copy">
            <CopyButton code={code} label="Copy code example" />
          </span>
        </div>

        <pre className="code-showcase__pre font-mono">
          <code>
            {rows.map((row, i) => (
              <span key={i} className="code-showcase__line">
                <span className="code-showcase__line-no" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="code-showcase__line-text">{row.h}</span>
                {row.note ? (
                  <span className="code-showcase__note">
                    <span className="code-showcase__note-tick" aria-hidden="true" />
                    <span
                      className="code-showcase__note-badge"
                      style={{ color: NOTE_COLORS[(row.badge ?? 1) - 1] }}
                      aria-hidden="true"
                    >
                      {BADGES[(row.badge ?? 1) - 1]}
                    </span>
                    {row.note}
                  </span>
                ) : null}
              </span>
            ))}
          </code>
        </pre>

        <div className="code-showcase__output">
          <span className={TK.p} aria-hidden="true">
            &darr;
          </span>
          <span className="font-semibold text-[var(--success)]">GET /</span>
          <span className={TK.p} aria-hidden="true">
            &nbsp;&rarr;&nbsp;
          </span>
          <span className="rounded bg-[var(--success)]/15 px-1.5 py-0.5 text-xs font-semibold text-[var(--success)]">
            200 OK
          </span>
          <span className="font-medium text-[var(--code-variable)]">{'{ "message": "Hello NextRush!" }'}</span>
        </div>
      </div>

      <figcaption className="code-showcase__caption">
        <span>No decorators</span>
        <span className="code-showcase__dot">&middot;</span>
        <span>No configuration</span>
        <span className="code-showcase__dot">&middot;</span>
        <span>One route</span>
        <span className="code-showcase__dot">&middot;</span>
        <span>Node &middot; Bun &middot; Deno &middot; Edge &middot; Serverless</span>
        <span className="code-showcase__run">
          <OpenInStackBlitz
            title="NextRush — first API"
            dependencies={{ nextrush: 'latest' }}
            files={[{ path: 'src/index.ts', content: code }]}
            openFile="src/index.ts"
            label="Run in StackBlitz"
          />
        </span>
      </figcaption>
    </figure>
  );
}