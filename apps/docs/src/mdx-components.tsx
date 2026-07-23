import {
    ApiDemo,
    ApiDemoRow,
    BenchmarkBars,
    BenchmarkCardGrid,
    Challenge,
    ChallengeList,
    CheckpointItem,
    CompareGrid,
    CompareItem,
    DocHero,
    DocHeroPill,
    DocPageOutline,
    DocPrerequisiteGrid,
    DocSectionEyebrow,
    DocStat,
    DocStatStrip,
    DocTableWrap,
    Feature,
    FeatureGrid,
    GraduationItem,
    HighlightGrid,
    HighlightItem,
    LearningGoal,
    LearningGoals,
    Mermaid,
    MentalModelFlow,
    Mistake,
    MistakeList,
    OpenInStackBlitz,
    PackageCard,
    PackageGrid,
    PackageInstall,
    PackagesAZTable,
    PackageSection,
    RuntimeSupport,
    ScalarApiReference,
    TutorialCheckpoint,
    TutorialGraduation,
    TutorialProgress,
    TypeTable,
    WhatChanged,
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

  // Searchable/filterable A-Z packages lookup table, driven by the package registry
  PackagesAZTable,

  // Feature showcase components
  Feature,
  FeatureGrid,

  // API reference type table
  TypeTable,

  // Per-runtime support badge (Node/Bun/Deno/Edge/Serverless)
  RuntimeSupport,

  // Generated reference table — from real TypeScript source (fumadocs-typescript)
  AutoTypeTable,

  // Interactive OpenAPI reference (Scalar) — reads the build-time public/openapi.json
  ScalarApiReference,

  // Mermaid diagrams with dark/light theme support
  Mermaid,

  // Core Mental Model: the framework-flow anchor (Request → … → Response)
  MentalModelFlow,

  // Runnable sandbox embed (T21) — real "Open in StackBlitz" project link
  OpenInStackBlitz,

  // Onboarding / overview layout
  BenchmarkBars,
  BenchmarkCardGrid,
  DocHero,
  DocHeroPill,
  DocStatStrip,
  DocStat,
  DocPageOutline,
  DocPrerequisiteGrid,
  DocSectionEyebrow,
  CompareGrid,
  CompareItem,
  HighlightGrid,
  HighlightItem,
  DocTableWrap,

  // Tutorial pacing helpers (quick-start and future multi-part tutorials)
  TutorialProgress,
  ApiDemo,
  ApiDemoRow,
  LearningGoals,
  LearningGoal,
  WhatChanged,
  TutorialCheckpoint,
  CheckpointItem,
  TutorialGraduation,
  GraduationItem,
  ChallengeList,
  Challenge,
  MistakeList,
  Mistake,
};

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...customComponents,
    ...components,
  };
}
