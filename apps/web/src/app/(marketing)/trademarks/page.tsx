import type { Metadata } from 'next';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Trademark Notice',
  description:
    'Pokémon and related marks belong to their respective owners. Pokémon Stock Radar is an independent, unaffiliated tool, and grading-company names are used only for identification and comparison.',
};

export default function TrademarksPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Legal"
          title="Trademark Notice"
          lead="A clear statement of who owns what — and our independence."
        />
      </Section>

      <Section className="pt-0">
        <Prose>
          <h2>Pokémon trademarks</h2>
          <p>
            Pokémon and all related names, characters, logos, and marks are trademarks of Nintendo,
            The Pokémon Company, Game Freak, and Creatures Inc. These marks belong to their
            respective owners.
          </p>

          <h2>Independence &amp; no affiliation</h2>
          <p>
            Pokémon Stock Radar is an independent tool and is not affiliated with, endorsed,
            sponsored, or approved by Nintendo, The Pokémon Company, Game Freak, Creatures Inc., or
            by PSA, Beckett, CGC, SGC, TAG, ACE, or any pricing or data provider.
          </p>

          <h2>Grading-company and provider names</h2>
          <p>
            PSA, Beckett, CGC, SGC, TAG, ACE, and the names of any data or pricing providers are
            trademarks of their respective owners. We reference these names only to identify
            products and to describe the grading scales or data sources an estimate or value refers
            to — never to imply any relationship, endorsement, or approval.
          </p>

          <h2>Nominative use</h2>
          <p>
            Any use of third-party trademarks on this site is nominative — that is, for
            identification and comparison — and does not suggest a partnership. If you own a mark and
            have a concern about its use here, contact{' '}
            <a href="mailto:hello@pokemonstockradar.com">hello@pokemonstockradar.com</a>.
          </p>
        </Prose>
      </Section>
    </>
  );
}
