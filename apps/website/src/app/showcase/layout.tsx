import { baseOptions } from '@/lib/layout.shared';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

export default function ShowcaseLayout({ children }: LayoutProps<'/showcase'>) {
  return (
    <HomeLayout {...baseOptions()} className="min-h-screen bg-fd-background">
      {children}
    </HomeLayout>
  );
}
