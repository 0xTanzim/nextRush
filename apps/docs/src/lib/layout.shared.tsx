import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Zap } from 'lucide-react';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-bold">
          <Zap className="size-5 text-[#3b82f6]" />
          <span className="gradient-text">NextRush</span>
        </span>
      ),
    },
    links: [
      {
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'Skills',
        url: '/skills',
        active: 'nested-url',
      },
    ],
    githubUrl: 'https://github.com/0xtanzim/nextrush',
  };
}
