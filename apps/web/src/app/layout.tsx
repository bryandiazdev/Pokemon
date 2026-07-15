import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  metadataBase: new URL('https://pokemonstockradar.com'),
  title: {
    default: 'Pokémon Stock Radar — Scan it. Grade-check it. Track it.',
    template: '%s · Pokémon Stock Radar',
  },
  description:
    'Your entire Pokémon TCG collection, identified, valued, and tracked in one place. Estimate grade potential before submitting.',
  applicationName: 'Pokémon Stock Radar',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Stock Radar' },
  openGraph: {
    title: 'Pokémon Stock Radar',
    description: 'Scan, value, and track your Pokémon TCG collection. Estimate grade potential.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0b0e12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
