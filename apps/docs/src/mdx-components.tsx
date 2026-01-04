import { Feature, FeatureGrid, Mermaid, PackageInstall, TypeTable } from '@/components/mdx';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

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

  // Feature showcase components
  Feature,
  FeatureGrid,

  // API reference type table
  TypeTable,

  // Mermaid diagrams with dark/light theme support
  Mermaid,
};

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...customComponents,
    ...components,
  };
}
