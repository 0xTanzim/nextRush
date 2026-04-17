import { SkillsSidebarPromo } from '@/components/skills-sidebar-promo';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import Link from 'next/link';

function SidebarFooterLinks() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-fd-muted-foreground">
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
  );
}

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      links={[]}
      sidebar={{
        banner: <SkillsSidebarPromo />,
        footer: <SidebarFooterLinks />,
      }}
    >
      {children}
    </DocsLayout>
  );
}
