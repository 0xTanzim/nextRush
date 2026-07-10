import { AskAiTrigger } from '@/components/ask-ai-trigger';
import { VersionSwitcher } from '@/components/version-switcher';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Zap } from 'lucide-react';

/**
 * Shared nav/layout options consumed by every top-level route group
 * ((home), docs, skills, blog) — see apps/docs/src/app/**\/layout.tsx.
 *
 * Destinations follow the Phase 1 nav shell (T7, docs/documentation-rebuild/PLAN.md):
 * Documentation, Packages, Reference, Recipes, Blog + search + version affordance + Ask AI
 * slot + GitHub. "Packages" and "Blog" both get real "coming soon" pages (T13/T20 build the
 * real content) rather than reusing another nav item's URL or a dead link.
 */
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
        text: 'Documentation',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'Packages',
        url: '/packages',
        active: 'nested-url',
      },
      {
        text: 'Reference',
        url: '/docs/reference',
        active: 'nested-url',
      },
      {
        text: 'Recipes',
        url: '/docs/recipes',
        active: 'nested-url',
      },
      {
        text: 'Blog',
        url: '/blog',
        active: 'nested-url',
      },
      {
        text: 'Skills',
        url: '/skills',
        active: 'nested-url',
      },
      {
        type: 'custom',
        secondary: true,
        children: <VersionSwitcher />,
      },
      {
        type: 'custom',
        secondary: true,
        children: <AskAiTrigger />,
      },
    ],
    githubUrl: 'https://github.com/0xTanzim/nextrush',
  };
}
