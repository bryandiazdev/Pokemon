import type { Metadata } from 'next';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Pokémon Stock Radar handles your data: what we collect, private-by-default storage, no training on your images without consent, no selling data, export and deletion rights, cookies, and processors.',
};

/*
 * TEMPLATE NOTICE: This Privacy Policy is a placeholder template and is NOT
 * legal advice. It must be reviewed and adapted by qualified legal counsel and
 * kept in sync with actual data practices before production use.
 */

export default function PrivacyPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Legal"
          title="Privacy Policy"
          lead="Last updated 2026. This is a template pending review by legal counsel."
        />
      </Section>

      <Section className="pt-0">
        <Prose>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account information</strong> — such as your email address and authentication
              details.
            </li>
            <li>
              <strong>Collection data</strong> — the cards, binders, quantities, conditions, and
              notes you add.
            </li>
            <li>
              <strong>Uploaded card images</strong> — the photos you capture for identification and
              Grade Potential analysis.
            </li>
            <li>
              <strong>Usage &amp; diagnostics</strong> — limited technical data used to keep the
              Service working and to fix problems.
            </li>
          </ul>

          <h2>Private by default</h2>
          <p>
            Your collection and uploaded images are private to your account by default. We do not
            make your collection public unless you explicitly choose to share it.
          </p>

          <h2>Your images and model training</h2>
          <p>
            We do not use your uploaded card images to train models without your explicit consent,
            and that consent is revocable at any time. Withdrawing consent stops future use.
          </p>

          <h2>We do not sell your data</h2>
          <p>
            We do not sell your personal information or your collection data to third parties.
          </p>

          <h2>Export &amp; deletion</h2>
          <p>
            You can export your data at any time and delete your account. Deleting your account
            removes your associated personal data, subject to limited retention required for legal,
            security, or accounting purposes.
          </p>

          <h2>Cookies</h2>
          <p>
            We use cookies and similar technologies that are necessary for authentication and core
            functionality, and limited analytics to understand and improve the Service. Where
            required, non-essential cookies are used only with your consent.
          </p>

          <h2>Processors we use</h2>
          <p>
            We rely on trusted third-party processors to operate the Service, each handling data
            only as needed to provide their function:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — database, authentication, and file storage.
            </li>
            <li>
              <strong>Stripe</strong> — subscription billing and payments.
            </li>
            <li>
              <strong>Resend</strong> — transactional email delivery.
            </li>
            <li>
              <strong>Sentry</strong> — error monitoring and diagnostics.
            </li>
            <li>
              <strong>PostHog</strong> — product analytics.
            </li>
          </ul>

          <h2>Contact</h2>
          <p>
            For privacy questions or requests, email{' '}
            <a href="mailto:privacy@pokemonstockradar.com">privacy@pokemonstockradar.com</a>.
          </p>
        </Prose>
      </Section>
    </>
  );
}
