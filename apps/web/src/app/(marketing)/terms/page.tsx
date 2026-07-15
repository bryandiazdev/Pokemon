import type { Metadata } from 'next';
import { Section, SectionHeader, Prose } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern use of Pokémon Stock Radar, including subscriptions, acceptable use, estimate disclaimers, no-affiliation, and limitation of liability.',
};

/*
 * TEMPLATE NOTICE: This Terms of Service is a placeholder template and is NOT
 * legal advice. It must be reviewed and adapted by qualified legal counsel
 * before Pokémon Stock Radar relies on it in production.
 */

export default function TermsPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Legal"
          title="Terms of Service"
          lead="Last updated 2026. This is a template pending review by legal counsel."
        />
      </Section>

      <Section className="pt-0">
        <Prose>
          <h2>1. Acceptance of terms</h2>
          <p>
            By creating an account or using Pokémon Stock Radar (the &quot;Service&quot;), you agree
            to these Terms of Service. If you do not agree, do not use the Service.
          </p>

          <h2>2. Subscriptions &amp; billing</h2>
          <p>
            Paid plans are billed through Stripe, our payment processor. Your plan, entitlements,
            and limits are determined and enforced on our servers. Prices shown in marketing are for
            reference; the price and terms presented at checkout govern. You may cancel at any time
            and retain access through the end of your current billing period. We do not store your
            full payment card details.
          </p>

          <h2>3. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Abuse, overload, scrape, or attempt to circumvent limits or protections;</li>
            <li>Upload unlawful content or content you do not have rights to;</li>
            <li>Reverse engineer or interfere with the Service&apos;s security; or</li>
            <li>Use the Service to infringe any third party&apos;s rights.</li>
          </ul>

          <h2>4. Estimates disclaimer</h2>
          <p>
            Grade Potential results are computer-vision estimates presented as ranges with a
            confidence level. They are not guaranteed grades and are not financial advice. A grading
            company may return a different result, and pricing information may be delayed or
            inaccurate. You are solely responsible for decisions you make using the Service.
          </p>

          <h2>5. No affiliation</h2>
          <p>
            Pokémon Stock Radar is an independent tool. It is not affiliated with, endorsed,
            sponsored, or approved by Nintendo, The Pokémon Company, Game Freak, Creatures Inc., PSA,
            Beckett, CGC, SGC, TAG, ACE, or any pricing or data provider. All trademarks belong to
            their respective owners.
          </p>

          <h2>6. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, the Service is provided &quot;as is&quot; without
            warranties of any kind, and we are not liable for indirect, incidental, or consequential
            damages, or for losses arising from decisions made using estimates or pricing shown in
            the Service.
          </p>

          <h2>7. Termination</h2>
          <p>
            You may stop using the Service and delete your account at any time. We may suspend or
            terminate access for violations of these terms or to protect the Service and its users.
          </p>

          <h2>8. Changes</h2>
          <p>
            We may update these terms from time to time. Material changes will be communicated
            through the Service. Continued use after changes take effect constitutes acceptance.
          </p>
        </Prose>
      </Section>
    </>
  );
}
