/**
 * @nextrush/openapi - Docs UI
 *
 * Minimal Swagger UI page loaded from a CDN, pointed at the JSON spec route.
 * Kept tiny and dependency-free; swap for Scalar or a self-hosted bundle later.
 */

/** Escape a string for safe interpolation into an HTML attribute/text node. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render a Swagger UI HTML page for the given spec URL. */
export function swaggerUiHtml(specUrl: string, title: string): string {
  const safeTitle = escapeHtml(title);
  // specUrl is injected into a <script> as a JS string literal — JSON.stringify
  // is the correct (JS-context) escaping. HTML-escaping it here would corrupt
  // URLs containing '&' (query params). Title is HTML text → escapeHtml.
  const specLiteral = JSON.stringify(specUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — API Reference</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({ url: ${specLiteral}, dom_id: '#swagger-ui' });
  </script>
</body>
</html>`;
}
