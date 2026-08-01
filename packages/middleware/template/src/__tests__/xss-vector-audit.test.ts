/**
 * @nextrush/template - XSS escaping surface, direct vector tests
 * (`audit-unreviewed-security-surface`, area 4 — the review's own
 * highest-priority area).
 *
 * `template.test.ts`'s existing "XSS Prevention" describe block already
 * covers `<script>` tags, ampersands, quotes, and the raw-output opt-in
 * (`{{{ }}}` / `{{& }}`). This file adds the two vectors design.md names
 * explicitly that the existing suite does not cover directly: an
 * `onerror`-attribute-breakout attempt, and a `javascript:` URL. Both are
 * tested against the REAL compiler (not asserted from reading code).
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../compiler';

describe('XSS Prevention — attribute-breakout vector', () => {
  it('a value attempting to break out of a quoted attribute and inject onerror is escaped, staying inside the attribute', () => {
    const template = compile('<img src="{{url}}">');
    const malicious = 'x.png" onerror="alert(1)"';
    const result = template.render({ url: malicious });

    // The injected double-quotes are entity-escaped, so `onerror` can never
    // become a new attribute — it stays as literal text inside `src`'s
    // value, which the browser will simply fail to load as an image.
    expect(result).toBe('<img src="x.png&quot; onerror=&quot;alert(1)&quot;">');
    expect(result).not.toMatch(/"\s*onerror=/);
  });
});

describe('XSS Prevention — javascript: URL vector (documented limitation, not a NextRush defect)', () => {
  it('FINDING: a javascript: URL in an href-bound value passes through HTML-escaping unchanged', () => {
    // HTML-entity escaping (the compiler's ONLY escaping mechanism — it has
    // no concept of "this interpolation sits inside a URL-valued
    // attribute") only encodes `&<>"'` ` `. None of those characters
    // appear in a bare `javascript:alert(1)` string, so it passes through
    // completely unescaped. This is the same property every mustache-style
    // string templating engine has (Handlebars, Mustache, EJS's `<%=%>`)
    // — URL-scheme sanitization for href/src values is conventionally the
    // APPLICATION's responsibility, not the template engine's, and this
    // package's own README (§Security) makes no claim otherwise. Recorded
    // here as a real, tested, but industry-standard limitation — not a
    // NextRush-specific bug — per this review's evidence discipline.
    const template = compile('<a href="{{url}}">click</a>');
    const result = template.render({ url: 'javascript:alert(1)' });

    expect(result).toBe('<a href="javascript:alert(1)">click</a>');
  });

  it('confirms the escape function itself never touches the colon character (root cause of the above)', () => {
    const template = compile('{{value}}');
    expect(template.render({ value: 'javascript:alert(1)' })).toBe('javascript:alert(1)');
  });
});
