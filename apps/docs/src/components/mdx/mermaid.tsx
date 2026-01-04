'use client';

import { useTheme } from 'next-themes';
import { use, useEffect, useId, useState } from 'react';

/**
 * Mermaid diagram component with dark/light theme support.
 * Renders diagrams client-side with dynamic theme switching.
 */
export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch by waiting for mount
  if (!mounted) {
    return (
      <div className="flex items-center justify-center p-8 bg-muted/30 rounded-lg">
        <div className="animate-pulse text-muted-foreground">Loading diagram...</div>
      </div>
    );
  }

  return <MermaidContent chart={chart} />;
}

// Cache for mermaid rendering promises to avoid duplicate renders
const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(key: string, setPromise: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();

  const { default: mermaid } = use(
    cachePromise('mermaid', () => import('mermaid')),
  );

  // Initialize mermaid with theme-aware configuration
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    fontFamily: 'inherit',
    themeCSS: 'margin: 1.5rem auto 0;',
    theme: resolvedTheme === 'dark' ? 'dark' : 'default',
  });

  // Render the chart with cache key including theme for proper re-render
  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () => {
      // Normalize newlines for consistent rendering
      return mermaid.render(id.replace(/:/g, ''), chart.replaceAll('\\n', '\n'));
    }),
  );

  return (
    <div
      className="my-6 overflow-x-auto"
      ref={(container) => {
        if (container) bindFunctions?.(container);
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
