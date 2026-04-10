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
    default: `${appConfig.name} - The Backend Framework That Doesn't Get in Your Way`,
    template: `%s | ${appConfig.name}`,
  },
  description: `${appConfig.name} is a minimal, modular, high-performance Node.js backend framework. Build APIs with 30,000+ RPS, full TypeScript support, and zero configuration overhead.`,
  keywords: [
    'nextrush',
    'node.js framework',
    'backend framework',
    'typescript',
    'api framework',
    'fast backend',
    'modular framework',
    'bun',
    'deno',
    'edge runtime',
  ],
  authors: [{ name: appConfig.teamName }],
  creator: appConfig.name,
  metadataBase: new URL(appConfig.siteUrl),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: appConfig.siteUrl,
    title: `${appConfig.name} - High-Performance Backend Framework`,
    description: `Build production-ready APIs with ${appConfig.name}. Minimal core, modular design, 30,000+ RPS performance.`,
    siteName: appConfig.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appConfig.name} - High-Performance Backend Framework`,
    description: `Build production-ready APIs with ${appConfig.name}. Minimal core, modular design, 30,000+ RPS performance.`,
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
