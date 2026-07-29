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
    default: `${appConfig.name} — TypeScript HTTP framework`,
    template: `%s | ${appConfig.name}`,
  },
  description: `${appConfig.name} is a modular TypeScript framework for HTTP APIs on Node.js, Bun, Deno, and Edge. Small core, strict types, explicit middleware and routing.`,
  keywords: [
    'nextrush',
    'node.js framework',
    'backend framework',
    'typescript',
    'api framework',
    'http server',
    'modular framework',
    'bun',
    'deno',
    'edge runtime',
  ],
  authors: [{ name: appConfig.teamName }],
  creator: appConfig.name,
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
    title: `${appConfig.name} — documentation`,
    description: `Modular TypeScript HTTP stack for Node.js and other runtimes. Documentation, API reference, and guides.`,
    siteName: appConfig.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appConfig.name} — documentation`,
    description: `Modular TypeScript HTTP stack for Node.js and other runtimes.`,
    creator: appConfig.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen font-sans antialiased">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
