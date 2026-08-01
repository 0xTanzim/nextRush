import { baseOptions } from '@/lib/layout.shared';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

export default function SkillsLayout({ children }: LayoutProps<'/skills'>) {
  return (
    <HomeLayout {...baseOptions()} className="min-h-screen bg-fd-background">
      {children}
    </HomeLayout>
  );
}
