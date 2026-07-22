import { defineI18n } from 'fumadocs-core/i18n';

/**
 * i18n-ready infrastructure, English-first (design.md D8).
 *
 * `hideLocale: 'default-locale'` means the default language (`en`) never gets a URL
 * prefix — existing `/docs/*` URLs stay exactly as they are today. A future locale
 * added to `languages` would be prefixed (`/cn/docs/*`) without touching a single
 * existing English URL.
 *
 * `languages` is intentionally English-only for now. Adding a locale here is a
 * necessary but not sufficient step — the `app/[lang]/` route restructuring
 * (`generateStaticParams()`, moving every non-route-handler page under the dynamic
 * segment) is deferred until a real locale has a committed maintainer, per D8's own
 * stated trigger. Wiring this config now costs nothing and keeps the door open; the
 * route move is a separate, larger, RFC-gated change once that trigger is met.
 *
 * @see design.md D8
 */
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en'],
  hideLocale: 'default-locale',
});
