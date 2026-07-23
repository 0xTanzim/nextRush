import { CollapsePreservingFolder } from '@/components/sidebar/collapse-preserving-folder';
import { SkillsSidebarPromo } from '@/components/skills-sidebar-promo';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import Link from 'next/link';

function SidebarFooterLinks() {
  return (
    <div className="mt-3 flex flex-col gap-3">
      <SkillsSidebarPromo />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fd-muted-foreground">
        <Link href="/" className="hover:text-fd-accent-foreground">
          Home
        </Link>
        <Link href="/skills" className="hover:text-fd-accent-foreground">
          Skills
        </Link>
        <Link
          href="https://github.com/0xTanzim/nextrush"
          target="_blank"
          rel="noreferrer"
          className="hover:text-fd-accent-foreground"
        >
          GitHub
        </Link>
      </div>
    </div>
  );
}

/**
 * Documentation Mode boundary (Phase 4 of docs-design-system-rollout,
 * DESIGN.md "Hybrid design strategy"): this layout renders every `/docs/**`
 * page. Fumadocs gives its root the stable id `#nd-docs-layout` (already the
 * scoping hook for global.css's docs-only rules — see Phase 2's blob
 * removal), so that id is the enforcement point, not a second, redundant
 * `data-mode` attribute `DocsLayout` doesn't accept as a passthrough prop.
 * Brand-Mode decorative utilities (`.gradient-*`, `.glow*`, `.dot-grid`,
 * `.noise-overlay`) must never be applied inside this tree or `content/docs/**`
 * — confirmed absent as of this phase (grep audit, MIGRATION.md Phase 4).
 */
export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      sidebar={{
        footer: <SidebarFooterLinks />,
        components: { Folder: CollapsePreservingFolder },
      }}
    >
      {children}
    </DocsLayout>
  );
}
