/**
 * @nextrush/dev - Serverless Entrypoint Static Analysis
 *
 * Scans serverless entrypoints for top-level await statements.
 * AWS Lambda Node runtimes and Vercel Serverless loaders invoke user modules
 * synchronously using CommonJS require() / loadESMFromCJS.
 * Any top-level await in the module evaluation graph aborts with
 * Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await.
 *
 * @packageDocumentation
 */

export interface TopLevelAwaitCheckResult {
  hasTopLevelAwait: boolean;
  lines: number[];
}

/**
 * Detect top-level await expressions at module evaluation scope.
 *
 * @param content - Source code of the entrypoint file.
 * @returns Result with matched line numbers.
 */
export function detectTopLevelAwait(content: string): TopLevelAwaitCheckResult {
  const lines = content.split('\n');
  const matchingLines: number[] = [];
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const trimmed = rawLine.trim();

    // Skip empty lines and single-line comments
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // If at root scope (braceDepth === 0) and contains await
    if (braceDepth === 0 && /\bawait\s+/.test(trimmed)) {
      // Ignore if line defines an inline async function
      const isAsyncDeclaration = /async\s+(function|\([^)]*\)\s*=>|[a-zA-Z0-9_$]+\s*=>)/.test(trimmed);
      if (!isAsyncDeclaration) {
        matchingLines.push(i + 1);
      }
    }

    // Update block brace depth
    for (const char of rawLine) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      }
    }
  }

  return {
    hasTopLevelAwait: matchingLines.length > 0,
    lines: matchingLines,
  };
}

/**
 * Format actionable diagnostic warning for top-level await in serverless targets.
 */
export function formatTopLevelAwaitWarning(entryFile: string, lines: number[]): string {
  return (
    `[nextrush/dev] Potential top-level await detected at line ${lines.join(', ')} in "${entryFile}".\n` +
    `AWS Lambda and Vercel Node runtimes load ESM synchronously using require(), which throws ` +
    `ERR_REQUIRE_ASYNC_MODULE at cold start when top-level await is present.\n\n` +
    `Remedy: Pass an async factory to your handler instead of using top-level await:\n` +
    `  export const handler = createLambdaHandler(async () => {\n` +
    `    const app = createApp();\n` +
    `    await registerControllers(app, ...);\n` +
    `    return app;\n` +
    `  });\n`
  );
}
