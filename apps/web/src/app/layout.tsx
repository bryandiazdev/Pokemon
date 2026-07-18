import type { Metadata, Viewport } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { PwaRegister } from '@/components/pwa-register';

// Editorial display serif (headlines + large values), a warm UI grotesk, and a
// monospace for market data / prices / cert numbers — the "terminal for
// collectors" pairing that reads as bespoke, not a stock template.
const display = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const sans = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

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
  themeColor: '#0a0b12',
  width: 'device-width',
  initialScale: 1,
  // App-like: lock the page scale so focusing inputs can't zoom the viewport
  // (paired with ≥16px input font on mobile, which removes iOS's reason to
  // zoom in the first place).
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
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
