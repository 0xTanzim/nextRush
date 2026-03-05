import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import {
  defineCollections,
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config';
import { z } from 'zod';

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export const skills = defineCollections({
  type: 'doc',
  dir: 'content/skills',
  schema: frontmatterSchema.extend({
    skillName: z.string(),
    package: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
    tags: z.array(z.string()).default([]),
  }),
});

export default defineConfig({
  mdxOptions: {
    // Enable mermaid diagrams in markdown code blocks
    remarkPlugins: [remarkMdxMermaid],
  },
});
