'use client';

import { usePathname } from 'fumadocs-core/framework';
import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  useFolder,
  useFolderDepth,
} from 'fumadocs-ui/components/sidebar/base';
import { cva } from 'class-variance-authority';
import type { ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';

// `isActive` isn't part of fumadocs-ui's public export map (it's an
// internal utils/urls.ts helper) — reproduced here rather than reaching
// into an unpublished dist path.
function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function isLinkActive(href: string, pathname: string): boolean {
  return normalizePath(href) === normalizePath(pathname);
}

// Fumadocs' styled row classes (fumadocs-ui/layouts/docs/slots/sidebar.tsx)
// are never exported publicly — only the unstyled base primitives are. This
// reproduces them exactly (same class list, same `getItemOffset` indent
// formula) so a folder rendered through our override is pixel-identical to
// one rendered through Fumadocs' own `Sidebar` — a single flex row with the
// label and chevron on one baseline, not the unstyled fallback which
// rendered as a bare `<button>` with the chevron wrapping onto its own line.
const itemVariants = cva(
  'relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        link:
          'transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors',
        button: 'transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none',
      },
      highlight: {
        true:
          "data-[active=true]:before:content-[''] data-[active=true]:before:bg-fd-primary data-[active=true]:before:absolute data-[active=true]:before:w-px data-[active=true]:before:inset-y-2.5 data-[active=true]:before:inset-s-2.5",
      },
    },
  },
);

function getItemOffset(depth: number): string {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

/**
 * Sidebar folder renderer that treats "contains the active page" as an
 * initial hint, not a permanent lock.
 *
 * Fumadocs' default folder computes `defaultOpen = active || ...` fresh on
 * every render and force-syncs `open` back to `true` whenever that flips
 * true (page-tree.js + base.js's `SidebarFolder`) — so collapsing a folder
 * while reading one of its pages snaps back open on the very next
 * navigation or reload. We still want the *first* visit to a page inside a
 * folder to reveal it open (that part is good UX), so `containsActivePath`
 * always wins when true; a folder's own `defaultOpen: false` in meta.json
 * only sets the fallback for when it does *not* contain the active page —
 * after mount, the folder is an ordinary uncontrolled collapsible and only
 * the user's own click changes it.
 */
export function CollapsePreservingFolder({
  item,
  children,
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const containsActivePath = usePathContainsFolder(item, pathname);

  return (
    <SidebarFolder
      defaultOpen={containsActivePath || (item.defaultOpen ?? false)}
      collapsible={item.collapsible}
    >
      {item.index ? (
        <StyledFolderLink href={item.index.url} external={item.index.external} pathname={pathname}>
          {item.icon}
          {item.name}
        </StyledFolderLink>
      ) : (
        <StyledFolderTrigger>
          {item.icon}
          {item.name}
        </StyledFolderTrigger>
      )}
      <StyledFolderContent>{children}</StyledFolderContent>
    </SidebarFolder>
  );
}

function StyledFolderTrigger({ children }: { children: ReactNode }) {
  const { depth, collapsible } = useFolder() ?? { depth: 1, collapsible: true };
  return (
    <SidebarFolderTrigger
      className={itemVariants({ variant: collapsible ? 'button' : undefined, className: 'w-full' })}
      style={{ paddingInlineStart: getItemOffset(depth - 1) }}
    >
      {children}
    </SidebarFolderTrigger>
  );
}

function StyledFolderLink({
  href,
  external,
  pathname,
  children,
}: {
  href: string;
  external?: boolean;
  pathname: string;
  children: ReactNode;
}) {
  const depth = useFolderDepth();
  return (
    <SidebarFolderLink
      href={href}
      external={external}
      active={isLinkActive(href, pathname)}
      className={itemVariants({ variant: 'link', highlight: depth > 1, className: 'w-full' })}
      style={{ paddingInlineStart: getItemOffset(depth - 1) }}
    >
      {children}
    </SidebarFolderLink>
  );
}

function StyledFolderContent({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();
  return (
    <SidebarFolderContent
      className={
        depth === 1
          ? "relative before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-fd-border before:inset-s-2.5"
          : 'relative'
      }
    >
      <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>
    </SidebarFolderContent>
  );
}

/** True if any descendant page/index URL under this folder matches the current path. */
function usePathContainsFolder(item: PageTree.Folder, pathname: string): boolean {
  const normalized = normalizePath(pathname);

  function walk(node: PageTree.Folder): boolean {
    if (node.index && normalizePath(node.index.url) === normalized) return true;
    return node.children.some((child) => {
      if (child.type === 'folder') return walk(child);
      if (child.type === 'page') return normalizePath(child.url) === normalized;
      return false;
    });
  }

  return walk(item);
}
