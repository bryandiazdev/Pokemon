import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Data Attribution',
  description:
    'Where Pokémon Stock Radar data may come from. We use licensed or official provider APIs under their terms with attribution, and clearly label demo data used in development.',
};

const PROVIDERS = [
  'Pokémon TCG API',
  'TCGdex',
  'PriceCharting',
  'PSA public API',
  'eBay Browse API',
];

export default function AttributionPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Legal"
          title="Data Attribution"
          lead="We are transparent about where card and pricing data may come from — and about what is real versus demo."
        />
      </Section>

      <Section className="pt-0">
        <Prose>
          <h2>How we source data</h2>
          <p>
            Card catalog and pricing information may be provided by licensed or official third-party
            provider APIs. Each provider&apos;s data is used under that provider&apos;s terms of
            service, with attribution where required. We do not scrape data.
          </p>

          <h2>Providers we may use</h2>
          <p>
            Depending on configuration, data may come from providers such as those listed below.
            Listing a provider here does not imply any partnership, endorsement, or affiliation —
            these names are shown neutrally for transparency, and each remains the trademark of its
            owner.
          </p>
        </Prose>
        <div className="mt-4 flex max-w-3xl flex-wrap gap-2">
          {PROVIDERS.map((provider) => (
            <Badge key={provider} tone="neutral">
              {provider}
            </Badge>
          ))}
        </div>
        <Prose className="mt-8">
          <h2>Demo and fixture data</h2>
          <p>
            In development and demo environments, the Service uses clearly labeled sample data. Demo
            prices and grades are illustrative only and do not reflect live market values. Live
            environments use provider data as described above.
          </p>

          <h2>Corrections</h2>
          <p>
            If you believe attribution is missing or incorrect, contact{' '}
            <a href="mailto:hello@pokemonstockradar.com">hello@pokemonstockradar.com</a> and we will
            review it.
          </p>
        </Prose>
      </Section>
    </>
  );
}
