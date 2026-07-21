/**
 * RuntimeSupport — per-runtime status row for a feature/reference page.
 *
 * Generalizes the Reference identity block's single "Runtime" row into a
 * cross-cutting badge any page can drop in, so a Bun/Deno/Edge/Serverless
 * reader gets a same-glance answer to "does this run on my platform?"
 * without hunting through prose (wave-b0-ia.md §6, wave-b0-final-review.md §2).
 *
 * Status is always icon + text label together — never color alone — per the
 * accessibility standard in EDS-017.
 *
 * @example
 * ```mdx
 * <RuntimeSupport support={{ node: 'full', bun: 'full', deno: 'partial', edge: 'none', serverless: 'partial' }} />
 * ```
 */

export type RuntimeSupportLevel = 'full' | 'partial' | 'none';

export type RuntimeId = 'node' | 'bun' | 'deno' | 'edge' | 'serverless';

export type RuntimeSupportMap = Partial<Record<RuntimeId, RuntimeSupportLevel>>;

export interface RuntimeSupportProps {
  /** Per-runtime support level. Omitted runtimes are not rendered. */
  support: RuntimeSupportMap;
}

interface RuntimeMeta {
  label: string;
  icon: string;
}

const runtimeMeta: Record<RuntimeId, RuntimeMeta> = {
  node: { label: 'Node.js', icon: '/icons/nodejs.svg' },
  bun: { label: 'Bun', icon: '/icons/bun.svg' },
  deno: { label: 'Deno', icon: '/icons/deno-svgrepo-com.svg' },
  edge: { label: 'Edge', icon: '/icons/azure-edge-management.svg' },
  serverless: { label: 'Serverless', icon: '/icons/serverless.svg' },
};

const statusMeta: Record<RuntimeSupportLevel, { symbol: string; text: string; color: string }> = {
  full: { symbol: '✅', text: 'Full support', color: 'var(--rush-green)' },
  partial: { symbol: '⚠', text: 'Partial support', color: 'var(--rush-amber, #d97706)' },
  none: { symbol: '❌', text: 'Not supported', color: 'var(--text-muted)' },
};

const runtimeOrder: RuntimeId[] = ['node', 'bun', 'deno', 'edge', 'serverless'];

/**
 * Compact, accessible per-runtime support row.
 *
 * Each entry renders the runtime's icon, name, and a status symbol + text
 * label (e.g. "✅ Full support") — the text label is what actually conveys
 * status, so the row remains legible without color perception or icon
 * fonts. Runtimes not present in `support` are skipped rather than shown as
 * an implicit "none", so a caller only states what it has verified.
 */
export function RuntimeSupport({ support }: RuntimeSupportProps) {
  const entries = runtimeOrder.filter((id) => support[id] !== undefined);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      role="list"
      aria-label="Runtime support"
      className="not-prose my-6 flex flex-wrap gap-2"
    >
      {entries.map((id) => {
        const level = support[id];
        if (!level) {
          return null;
        }
        const meta = runtimeMeta[id];
        const status = statusMeta[level];

        return (
          <div
            key={id}
            role="listitem"
            className="flex items-center gap-2 rounded-lg border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-3 py-1.5"
          >
            <img src={meta.icon} alt="" width={16} height={16} className="size-4 shrink-0" aria-hidden />
            <span className="text-sm font-medium text-[var(--text-primary)]">{meta.label}</span>
            <span
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: status.color }}
            >
              <span aria-hidden>{status.symbol}</span>
              <span>{status.text}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
