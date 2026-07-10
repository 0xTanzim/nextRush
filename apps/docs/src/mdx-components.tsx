import {
    BenchmarkBars,
    BenchmarkCardGrid,
    CompareGrid,
    CompareItem,
    DocHero,
    DocPageOutline,
    DocPrerequisiteGrid,
    DocStat,
    DocStatStrip,
    DocTableWrap,
    Feature,
    FeatureGrid,
    HighlightGrid,
    HighlightItem,
    Mermaid,
    OpenInStackBlitz,
    PackageCard,
    PackageGrid,
    PackageInstall,
    PackageSection,
    TypeTable,
} from '@/components/mdx';
import { typeTableGenerator } from '@/lib/type-table-generator';
import { AutoTypeTable as BaseAutoTypeTable, type AutoTypeTableProps } from 'fumadocs-typescript/ui';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import path from 'node:path';

/**
 * Generated reference table — renders a type's shape straight from its
 * TypeScript source file. Distinct from the hand-authored `TypeTable`
 * component: this one takes `path` + `name` and can never drift from the code.
 *
 * `path` is resolved relative to the monorepo root (`process.cwd()` is the
 * `apps/docs` app root under Next.js dev/build) rather than passed through
 * as the upstream `cwd` prop — `cwd` gets spread onto the rendered `<div>` by
 * `fumadocs-typescript/ui`'s `AutoTypeTable` as a stray boolean DOM attribute.
 *
 * @example
 * ```mdx
 * <AutoTypeTable path="packages/types/src/context.ts" name="Context" />
 * ```
 */
function AutoTypeTable({
  path: relativePath,
  ...props
}: Omit<AutoTypeTableProps, 'generator' | 'cwd'> & { path?: string }) {
  const resolvedPath = relativePath
    ? path.resolve(process.cwd(), '../../', relativePath)
    : undefined;

  return <BaseAutoTypeTable generator={typeTableGenerator} path={resolvedPath} {...props} />;
}

// Custom MDX components for NextRush documentation
const customComponents = {
  // Tabs from Fumadocs
  Tabs,
  Tab,

  // Steps from Fumadocs
  Steps,
  Step,

  // Package installation with multiple package manager tabs
  PackageInstall,

  // Package grid with category sections
  PackageCard,
  PackageGrid,
  PackageSection,

  // Feature showcase components
  Feature,
  FeatureGrid,

  // API reference type table
  TypeTable,

  // Generated reference table — from real TypeScript source (fumadocs-typescript)
  AutoTypeTable,

  // Mermaid diagrams with dark/light theme support
  Mermaid,

  // Runnable sandbox embed (T21) — real "Open in StackBlitz" project link
  OpenInStackBlitz,

  // Onboarding / overview layout
  BenchmarkBars,
  BenchmarkCardGrid,
  DocHero,
  DocStatStrip,
  DocStat,
  DocPageOutline,
  DocPrerequisiteGrid,
  CompareGrid,
  CompareItem,
  HighlightGrid,
  HighlightItem,
  DocTableWrap,
};

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...customComponents,
    ...components,
  };
}
