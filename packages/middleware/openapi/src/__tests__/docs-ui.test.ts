import { describe, expect, it } from 'vitest';
import { swaggerUiHtml } from '../docs-ui.js';

describe('swaggerUiHtml', () => {
  it('renders a Swagger UI page pointed at the spec URL', () => {
    const html = swaggerUiHtml('/openapi.json', 'My API');

    expect(html).toContain('<div id="swagger-ui"></div>');
    expect(html).toContain('swagger-ui-bundle.js');
    // spec URL is a JS string literal inside the <script>
    expect(html).toContain('url: "/openapi.json"');
    expect(html).toContain('My API');
  });

  it('HTML-escapes the title (HTML text context)', () => {
    const html = swaggerUiHtml('/openapi.json', '<script>alert(1)</script>');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('preserves & in the spec URL (JS-string context, not HTML-escaped)', () => {
    const html = swaggerUiHtml('/openapi.json?v=1&flavor=full', 'API');

    // JSON.stringify keeps the raw URL; HTML-escaping would corrupt it to &amp;
    expect(html).toContain('url: "/openapi.json?v=1&flavor=full"');
    expect(html).not.toContain('&amp;flavor');
  });
});
