import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ContactForm } from '@/components/marketing/contact-form';
import { Section, SectionHeader } from '@/components/marketing/section';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the Pokémon Stock Radar team. Email us directly or send a message and we will get back to you.',
};

export default function ContactPage() {
  return (
    <>
      <Section>
        <SectionHeader
          as="h1"
          eyebrow="Contact"
          title="Get in touch"
          lead="Questions, feedback, or something not working? We would love to hear from you."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Mail size={22} aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-content">Email us</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              The fastest way to reach us is by email. We read every message.
            </p>
            <a
              href="mailto:hello@pokemonstockradar.com"
              className="mt-4 inline-flex text-sm font-semibold text-accent underline underline-offset-2 hover:text-accent-strong"
            >
              hello@pokemonstockradar.com
            </a>
          </Card>

          <Card className="lg:col-span-3">
            <h2 className="text-lg font-semibold text-content">Send a message</h2>
            <p className="mb-5 mt-1 text-sm text-muted">
              Fill this out and we&apos;ll get back to you.
            </p>
            <ContactForm />
          </Card>
        </div>
      </Section>
    </>
  );
}
