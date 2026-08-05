'use client';

import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  FolderTree,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * The colored badge variants for a `GuideAccordion` icon. Each maps to a
 * tinted circular background + matching foreground so an icon reads as an
 * identity (like Linear's icon chips), not a stray emoji — the icon alone
 * communicates the accordion's intent before the label is read.
 */
type IconColor = 'blue' | 'purple' | 'amber' | 'red' | 'green';

/**
 * Icon names passed from MDX. They are resolved to real lucide components
 * HERE, inside the client component, rather than being passed as a component
 * prop from the server-rendered MDX — functions cannot cross the
 * server→client boundary, so MDX passes a serializable string name instead.
 */
type IconName =
  | 'book-open'
  | 'settings'
  | 'folder-tree'
  | 'alert-triangle'
  | 'refresh-cw'
  | 'sparkles';

const ICONS: Record<
  IconName,
  (props: { className?: string; 'aria-hidden'?: boolean }) => ReactNode
> = {
  'book-open': BookOpen,
  settings: Settings,
  'folder-tree': FolderTree,
  'alert-triangle': AlertTriangle,
  'refresh-cw': RefreshCw,
  sparkles: Sparkles,
};

const ICON_BADGE: Record<IconColor, { bg: string; fg: string }> = {
  blue: {
    bg: 'color-mix(in srgb, var(--brand-link) 14%, transparent)',
    fg: 'var(--brand-link)',
  },
  purple: {
    bg: 'color-mix(in srgb, var(--learning-middleware) 16%, transparent)',
    fg: 'var(--learning-middleware)',
  },
  amber: {
    bg: 'color-mix(in srgb, var(--status-warning) 16%, transparent)',
    fg: 'var(--status-warning-text)',
  },
  red: {
    bg: 'color-mix(in srgb, var(--status-danger) 14%, transparent)',
    fg: 'var(--status-danger)',
  },
  green: {
    bg: 'color-mix(in srgb, var(--status-success) 16%, transparent)',
    fg: 'var(--status-success)',
  },
};

interface GuideAccordionProps {
  /** Icon name, resolved to a lucide icon inside this client component */
  icon: IconName;
  /** Badge color — should match the icon's intent (info/blue, warning/amber…) */
  iconColor?: IconColor;
  /** Accordion title */
  title: ReactNode;
  /** One-line description of what the reader will learn — removes guesswork */
  description?: ReactNode;
  /** Optional metadata, e.g. "Beginner · 6 min" or "Reference" or "Optional" */
  meta?: ReactNode;
  /** Open on first render — set on the first accordion so the pattern is obvious */
  defaultOpen?: boolean;
  /** Expanded content — prose, code, MDX components all render normally */
  children: ReactNode;
}


/**
 * GuideAccordion — a reusable "Learning Card Accordion" for the docs.
 *
 * Replaces bare `<details>/<summary>` blocks so a reader instantly recognizes
 * expandable learning topics (feedback accordion.md: "the accordion is now the
 * weakest component … there's almost no affordance"). The closed state advertises
 * interactivity: icon badge + description + meta + an "Expand" affordance with a
 * chevron; hover lifts the card and shifts the border to brand blue; the open
 * state keeps the blue border and adds a left accent so the border itself is the
 * feedback. Height + opacity + chevron animate over 220ms (respects reduced-motion).
 *
 * Reusable across every guide surface — Quick Start, Installation, Deployment,
 * Runtime guides, Recipes, Troubleshooting, Concepts — so users learn one
 * interaction pattern across the whole documentation (feedback's final ask).
 *
 * Pass `icon` as a STRING name (e.g. "book-open") — the icon is resolved inside
 * this client component because functions can't cross the server→client boundary.
 *
 * @example
 * ```mdx
 * <GuideAccordion
 *   icon="book-open"
 *   iconColor="blue"
 *   title="Why the scaffold works"
 *   description="Understand the six prompts create-nextrush uses."
 *   meta="Beginner · 6 min"
 *   defaultOpen
 * >
 *   Six prompts, every one with a default …
 * </GuideAccordion>
 * ```
 */
export function GuideAccordion({
  icon,
  iconColor = 'blue',
  title,
  description,
  meta,
  defaultOpen = false,
  children,
}: GuideAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0);
  const ref = useRef<HTMLDivElement>(null);
  const isInitial = useRef(true);

  // Animate height on open/close. `auto` can't be animated, so we measure the
  // scrollHeight, animate to that, then release to `auto` so content can reflow.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion: jump to the final state with no transition.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHeight(open ? 'auto' : 0);
      return;
    }

    if (isInitial.current) {
      isInitial.current = false;
      setHeight(open ? 'auto' : 0);
      return;
    }

    if (open) {
      setHeight(el.scrollHeight);
      const t = setTimeout(() => setHeight('auto'), 240);
      return () => clearTimeout(t);
    }
    // Closing: pin to the measured px height first, then animate to 0.
    setHeight(el.scrollHeight);
    requestAnimationFrame(() => setHeight(0));
  }, [open]);

  const badge = ICON_BADGE[iconColor];
  const Icon = ICONS[icon];

  return (
    <div
      className={`guide-accordion ${open ? 'guide-accordion--open' : ''}`}
      data-state={open ? 'open' : 'closed'}
    >
      <button
        type="button"
        className="guide-accordion__trigger"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="guide-accordion__badge" style={{ background: badge.bg, color: badge.fg }}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="guide-accordion__heading">
          <span className="guide-accordion__title">{title}</span>
          {description ? (
            <span className="guide-accordion__desc">{description}</span>
          ) : null}
          {meta ? <span className="guide-accordion__meta">{meta}</span> : null}
        </span>
        <span className="guide-accordion__action" aria-hidden>
          <span className="guide-accordion__action-label">
            {open ? 'Collapse' : 'Expand'}
          </span>
          <ChevronDown
            className={`guide-accordion__chevron size-4 ${open ? 'guide-accordion__chevron--open' : ''}`}
          />
        </span>
      </button>
      <div
        ref={ref}
        className="guide-accordion__panel"
        style={{ height: height === 'auto' ? 'auto' : `${height}px` }}
      >
        <div className="guide-accordion__content">{children}</div>
      </div>
    </div>
  );
}
