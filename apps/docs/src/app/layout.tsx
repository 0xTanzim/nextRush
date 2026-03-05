import { Provider } from '@/components/provider';
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
    default: "NextRush - The Backend Framework That Doesn't Get in Your Way",
    template: '%s | NextRush',
  },
  description:
    'NextRush is a minimal, modular, high-performance Node.js backend framework. Build APIs with 30,000+ RPS, full TypeScript support, and zero configuration overhead.',
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
  authors: [{ name: 'NextRush Team' }],
  creator: 'NextRush',
  metadataBase: new URL('https://nextrush.dev'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nextrush.dev',
    title: 'NextRush - High-Performance Backend Framework',
    description:
      'Build production-ready APIs with NextRush. Minimal core, modular design, 30,000+ RPS performance.',
    siteName: 'NextRush',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NextRush - High-Performance Backend Framework',
    description:
      'Build production-ready APIs with NextRush. Minimal core, modular design, 30,000+ RPS performance.',
    creator: '@nextrush',
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
