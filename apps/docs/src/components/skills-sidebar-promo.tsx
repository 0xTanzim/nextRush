import { Sparkles } from 'lucide-react';
import Link from 'next/link';

/**
 * Prominent Skills entry in the docs sidebar (above the page tree).
 */
export function SkillsSidebarPromo() {
  return (
    <div className="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--color-fd-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--color-fd-muted)_45%,var(--color-fd-card))] p-3 shadow-[inset_0_1px_0_0_hsla(220,20%,100%,0.04)]">
      <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-fd-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 text-[var(--rush-cyan)]" aria-hidden />
        Agent skills
      </div>
      <Link
        href="/skills"
        className="mt-2 block text-sm font-semibold text-fd-foreground transition-colors hover:text-fd-primary"
      >
        Browse skills
      </Link>
      <p className="mt-1 text-xs leading-snug text-fd-muted-foreground">
        Installable guides for AI tools — same content as{' '}
        <Link href="/skills.json" className="font-medium text-fd-primary underline underline-offset-2">
          /skills.json
        </Link>
        .
      </p>
    </div>
  );
}
