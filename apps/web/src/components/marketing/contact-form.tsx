'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * A no-op contact form: it does NOT submit anything to a server. It only shows
 * a confirmation state so the page is interactive. Real delivery is wired up
 * elsewhere; use the mailto link for guaranteed delivery.
 */
export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-positive/30 bg-positive/10 p-5"
      >
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-positive" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-content">Thanks — we&apos;ll get back to you.</p>
          <p className="mt-1 text-sm text-muted">
            We received your message. For anything time-sensitive, email us directly at{' '}
            <a
              href="mailto:hello@pokemonstockradar.com"
              className="text-accent underline underline-offset-2 hover:text-accent-strong"
            >
              hello@pokemonstockradar.com
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-content">
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-content placeholder:text-muted focus-visible:border-accent"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-content">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-content placeholder:text-muted focus-visible:border-accent"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-content">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-muted focus-visible:border-accent"
          placeholder="How can we help?"
        />
      </div>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-strong"
      >
        Send message
      </button>
    </form>
  );
}
