import type { ReactNode } from 'react';

interface PackageCardProps {
  name: string;
  description: string;
  install?: string;
  href?: string;
  npmUrl?: string;
  essential?: boolean;
  icon?: string;
}

interface PackageSectionProps {
  title: string;
  icon?: string;
  description?: string;
  children: ReactNode;
}

interface PackageGridProps {
  children: ReactNode;
}

const accentColors = [
  '--rush-blue',
  '--rush-cyan',
  '--rush-purple',
  '--rush-green',
] as const;

export function PackageCard({ name, description, install, href, npmUrl, essential, icon }: PackageCardProps) {
  const atIndex = name.indexOf('/');
  const scope = atIndex > 0 ? name.slice(0, atIndex + 1) : null;
  const shortName = scope ? name.slice(atIndex + 1) : name;

  const hash = (icon ?? shortName).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const accent = accentColors[hash % accentColors.length];
  const link = href ?? npmUrl ?? `https://www.npmjs.com/package/${name}`;
  const external = !href;

  return (
    <a
      href={link}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="group relative block rounded-xl border border-[var(--color-fd-border)] bg-[var(--color-fd-card)] px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--card-accent)_35%,var(--color-fd-border))] hover:shadow-[0_12px_40px_-12px_color-mix(in_srgb,var(--rush-blue)_20%,transparent)] no-underline!"
      style={
        {
          '--card-accent': `var(${accent})`,
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 shrink-0 text-base" style={{ color: `var(${accent})` }}>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {scope ? (
            <p className="text-[0.6rem] font-medium leading-tight text-[var(--text-muted)]">
              {scope}
            </p>
          ) : null}
          <p
            className={
              scope
                ? 'text-sm font-bold leading-tight text-[var(--color-fd-foreground)]'
                : 'text-sm font-bold leading-tight text-[var(--color-fd-foreground)]'
            }
          >
            {icon ? name : shortName}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-normal text-[var(--text-secondary)]">
        {description}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {essential ? (
          <span className="rounded bg-[color-mix(in_srgb,var(--card-accent)_10%,transparent)] px-1.5 py-[1px] text-[0.55rem] font-medium uppercase tracking-wider text-[var(--card-accent)] opacity-70">
            Essential
          </span>
        ) : null}
        {install ? (
          <span className="rounded bg-[var(--color-fd-muted)] px-1.5 py-[1px] text-[0.55rem] font-mono text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
            {install}
          </span>
        ) : null}
      </div>
    </a>
  );
}

export function PackageSection({ title, icon, description, children }: PackageSectionProps) {
  return (
    <section className="mb-10 last:mb-0 not-prose">
      <div className="mb-4">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-primary)]">
          {icon ? <span className="text-base">{icon}</span> : null}
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

export function PackageGrid({ children }: PackageGridProps) {
  return <div className="my-6 not-prose">{children}</div>;
}
