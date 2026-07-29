'use client';

import '@scalar/api-reference-react/style.css';
import dynamic from 'next/dynamic';

/**
 * Read-only interactive OpenAPI reference (docs-v4-rebuild §2.2).
 *
 * Renders the static build-time spec (`public/openapi.json`, produced by
 * `scripts/generate-openapi.ts` via `@nextrush/openapi`) with Scalar. Loaded
 * client-only (`ssr: false`) because the docs site is a **static export** —
 * Scalar is a browser widget and must not run during prerender. "Try it out"
 * has no live target in a static deploy; point `servers` at a demo API if one
 * is ever stood up.
 *
 * @example
 * ```mdx
 * <ScalarApiReference url="/openapi.json" />
 * ```
 */
const ApiReferenceReact = dynamic(
  () => import('@scalar/api-reference-react').then((m) => m.ApiReferenceReact),
  {
    ssr: false,
    loading: () => <p className="text-fd-muted-foreground">Loading API reference…</p>,
  }
);

export function ScalarApiReference({ url = '/openapi.json' }: { url?: string }) {
  return <ApiReferenceReact configuration={{ url }} />;
}
