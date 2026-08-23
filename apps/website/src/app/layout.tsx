import { Provider } from '@/components/provider';
import { appConfig } from '@/config/appConfig';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: `${appConfig.name} — TypeScript Backend Framework`,
    template: `%s | ${appConfig.name}`,
  },
  description:
    'NextRush is a TypeScript-first backend framework for building production-ready systems, focused on modular architecture, performance, developer experience, and multi-runtime support.',
  keywords: [
    'nextrush',
    'typescript backend framework',
    'node.js framework',
    'backend framework',
    'typescript',
    'api framework',
    'http server',
    'modular framework',
    'bun',
    'deno',
    'edge runtime',
    'serverless',
    'scalable systems',
  ],
  authors: [{ name: appConfig.teamName }],
  creator: appConfig.name,
  publisher: appConfig.organization.name,
  metadataBase: new URL(appConfig.siteUrl),
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: 'any' },
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/favicon/apple-touch-icon.png',
  },
  manifest: '/favicon/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: appConfig.siteUrl,
    siteName: appConfig.name,
    title: `${appConfig.name} — TypeScript Backend Framework`,
    description:
      'TypeScript-first backend framework for building production-ready systems — modular architecture, performance, developer experience, and multi-runtime support (Node.js, Bun, Deno, Edge).',
    images: [
      {
        url: appConfig.og.defaultImageAbsolute,
        width: appConfig.og.width,
        height: appConfig.og.height,
        alt: appConfig.og.alt,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: appConfig.twitterHandle,
    creator: appConfig.twitterHandle,
    title: `${appConfig.name} — TypeScript Backend Framework`,
    description:
      'TypeScript-first backend framework for building production-ready systems — modular APIs, performance, and multi-platform support.',
    // No `images` here on purpose: Next.js derives `twitter:image` from each
    // page's `openGraph.images`, so docs/blog keep their per-page cards instead
    // of being forced back to the site default by this root-level metadata.
  },
  robots: {
    index: true,
    follow: true,
  },
  // Theme color mirrors the brand surfaces in DESIGN/TOKENS.md (`--surface-page`).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFCF8' },
    { media: '(prefers-color-scheme: dark)', color: '#0D1117' },
  ],
};

/** JSON-LD entity graph — Organization + WebSite + founder Person (schema.org). */
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${appConfig.siteUrl}/#organization`,
      name: appConfig.organization.name,
      url: appConfig.organization.url,
      logo: appConfig.organization.logo,
      sameAs: appConfig.organization.sameAs,
      founder: {
        '@type': appConfig.organization.founder['@type'],
        name: appConfig.organization.founder.name,
        alternateName: appConfig.organization.founder.alternateName,
        url: appConfig.organization.founder.url,
        sameAs: appConfig.organization.founder.sameAs,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${appConfig.siteUrl}/#website`,
      url: `${appConfig.siteUrl}/`,
      name: appConfig.organization.name,
      publisher: { '@id': `${appConfig.siteUrl}/#organization` },
      inLanguage: 'en',
    },
  ],
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen font-sans antialiased">
        <script
          type="application/ld+json"
          // JSON-LD goes to the DOM unparsed; unlike HTML, there is no XSS vector from
          // app constants here, so Next is told not to bypass the hydration diff.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Provider>{children}</Provider>
        <script src="/webmcp.js" defer />
      </body>
    </html>
  );
}
