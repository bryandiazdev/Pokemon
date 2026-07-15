import Link from 'next/link';
import { Radar } from 'lucide-react';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/scanner', label: 'Scan' },
      { href: '/grade-potential', label: 'Grade Potential' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/attribution', label: 'Data Attribution' },
      { href: '/trademarks', label: 'Trademark Notice' },
    ],
  },
];

const TRADEMARK_DISCLAIMER =
  'Pokémon and all related names are trademarks of Nintendo, The Pokémon Company, Game Freak, and Creatures Inc. Pokémon Stock Radar is an independent tool and is not affiliated with, endorsed, sponsored, or approved by them, or by PSA, Beckett, CGC, SGC, TAG, ACE, or any pricing/data provider.';

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 text-content"
              aria-label="Pokémon Stock Radar home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Radar size={18} aria-hidden />
              </span>
              <span className="text-sm font-semibold">Pokémon Stock Radar</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted">
              Identify, value, and track your Pokémon TCG collection — with honest, estimate-based
              grade potential analysis.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-content transition-colors hover:text-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="max-w-4xl text-xs leading-relaxed text-muted">{TRADEMARK_DISCLAIMER}</p>
          <p className="mt-4 text-xs text-muted">
            © {year} Pokémon Stock Radar. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
