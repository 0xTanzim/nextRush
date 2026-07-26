import { transformerTwoslash } from '@shikijs/twoslash';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import {
  defineCollections,
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config';
import { remarkAutoTypeTable } from 'fumadocs-typescript';
import { z } from 'zod';
import { typeTableGenerator } from './src/lib/type-table-generator';

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // `package` is an optional npm package name a Reference page documents. The sidebar
    // label / H1 comes from `title` (a human capability name, e.g. "CORS"); `package`
    // renders as an eyebrow above the title so the page still shows its `@nextrush/*`
    // identity without the raw package name being the primary label (Recognition over
    // Recall). Mirrors the same optional field on the `skills` collection below.
    schema: frontmatterSchema.extend({
      package: z.string().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: {
        headingIds: true,
        filterElement: (node) => {
          if (node.type === 'mdxjsEsm') {
            return false;
          }

          if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
            return 'children-only';
          }

          return true;
        },
      },
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

// Blog collection (T20, Phase 4, docs/documentation-rebuild/PLAN.md) — release
// announcements and design-decision deep dives. Author/date metadata is required so the
// listing page can sort and attribute every post; `tags` mirrors the skills collection's
// pattern for lightweight categorization.
export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: frontmatterSchema.extend({
    author: z.string(),
    date: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

export default defineConfig({
  mdxOptions: {
    // Enable mermaid diagrams in markdown code blocks.
    // remarkAutoTypeTable compiles `<auto-type-table>` into a JSX element — the
    // project already has a custom `TypeTable` MDX component (manual props-based
    // table), so the generated output is aliased to `AutoTypeTable` to avoid a
    // name collision. Register `AutoTypeTable` from `fumadocs-typescript/ui` in
    // `mdx-components.tsx` under that same name.
    remarkPlugins: [
      remarkMdxMermaid,
      [remarkAutoTypeTable, { generator: typeTableGenerator, outputName: 'AutoTypeTable' }],
    ],
    rehypeCodeOptions: {
      // Shiki's default github-light/github-dark themes render code comments at
      // #6A737D, which fails WCAG AA contrast (3.98:1 against this site's dark
      // background, 4.39-4.65:1 against the light background — both below the
      // 4.5:1 minimum for normal text; confirmed via lighthouse a11y audit +
      // manual relative-luminance calculation, T22 launch hardening). Override
      // only the comment scope with colors verified >=4.5:1 against both actual
      // page backgrounds (#8b949e vs dark #0c0f17/#151923 = 6.23/5.71:1;
      // #57606a vs light #fafbfc = 6.17:1) rather than swapping the whole theme.
      themes: { light: 'github-light', dark: 'github-dark' },
      transformers: [
        transformerTwoslash({ explicitTrigger: true }),
        {
          name: 'a11y-comment-contrast',
          tokens(tokens) {
            for (const line of tokens) {
              for (const token of line) {
                const isComment =
                  typeof token.htmlStyle === 'object' &&
                  (token.htmlStyle?.['--shiki-light'] === '#6A737D' ||
                    token.htmlStyle?.['--shiki-dark'] === '#6A737D');
                if (!isComment) continue;
                token.htmlStyle = {
                  ...token.htmlStyle,
                  '--shiki-light': '#57606A',
                  '--shiki-dark': '#8B949E',
                };
              }
            }
            return tokens;
          },
        },
      ],
    },
  },
});
