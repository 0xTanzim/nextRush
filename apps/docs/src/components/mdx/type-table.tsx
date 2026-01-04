interface TypeDefinition {
  type: string;
  description: string;
  optional?: boolean;
  default?: string;
}

interface TypeTableProps {
  title?: string;
  types: Record<string, TypeDefinition>;
}

/**
 * TypeTable - Display API type definitions in a readable table format
 *
 * @example
 * ```mdx
 * <TypeTable
 *   title="Context Properties"
 *   types={{
 *     method: { type: 'HttpMethod', description: 'HTTP request method' },
 *     path: { type: 'string', description: 'Request path' },
 *     params: { type: 'Record<string, string>', description: 'Route parameters', optional: true },
 *     query: { type: 'Record<string, string>', description: 'Query parameters', default: '{}' },
 *   }}
 * />
 * ```
 */
export function TypeTable({ title, types }: TypeTableProps) {
  const entries = Object.entries(types);

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-[var(--bg-border)]">
      {title && (
        <div className="px-4 py-3 bg-[var(--bg-hover)] border-b border-[var(--bg-border)]">
          <h4 className="font-semibold text-[var(--text-primary)]">{title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-card)]">
              <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] border-b border-[var(--bg-border)]">
                Property
              </th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] border-b border-[var(--bg-border)]">
                Type
              </th>
              <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] border-b border-[var(--bg-border)]">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, def], index) => (
              <tr
                key={name}
                className={index % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-card)]/50'}
              >
                <td className="px-4 py-3 border-b border-[var(--bg-border)]">
                  <code className="font-mono text-[var(--rush-cyan)]">
                    {name}
                    {def.optional && (
                      <span className="text-[var(--text-muted)]">?</span>
                    )}
                  </code>
                </td>
                <td className="px-4 py-3 border-b border-[var(--bg-border)]">
                  <code className="font-mono text-[var(--rush-purple)] text-xs px-1.5 py-0.5 rounded bg-[var(--rush-purple)]/10">
                    {def.type}
                  </code>
                  {def.default && (
                    <span className="ml-2 text-[var(--text-muted)] text-xs">
                      = {def.default}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 border-b border-[var(--bg-border)] text-[var(--text-secondary)]">
                  {def.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
