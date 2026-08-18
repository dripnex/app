import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, Check, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — Dripnex',
  description: 'How Dripnex protects your privacy. Your notes stay on your device.',
};

const lastUpdated = 'August 2026';

const sections = [
  {
    title: 'Overview',
    content: [
      'Dripnex stores your notes on your device. An account is required to use the app.',
      'Cloud sync is optional. When it is on, the server stores only ciphertext we cannot read.',
    ],
  },
  {
    title: 'What stays on your device',
    content: ['Unless you enable sync, Dripnex does not upload:'],
    list: [
      'Note bodies, titles, tags, or notebooks',
      'Your encryption passphrase or content-encryption key',
      'Local AI chat history',
    ],
  },
  {
    title: 'Account and payments',
    content: [
      'Sign-in uses a magic link to the email you provide. We store that email and session tokens to keep you signed in and check your license.',
      'When you subscribe, Stripe collects payment details:',
    ],
    list: [
      'Email address (account + license)',
      'Payment information (processed by Stripe)',
      'Transaction records (refunds and support)',
    ],
    footer:
      'Stripe handles card data under their privacy policy. We do not see full card numbers.',
  },
  {
    title: 'Optional end-to-end sync',
    content: [
      'If you set an encryption passphrase, the desktop encrypts notes before they leave the device.',
      'api.dripnex.app stores encrypted blobs, device metadata, and sync versions. It does not have the key to decrypt note content.',
      'If you never set a passphrase, sync stays off and nothing from your notes is uploaded.',
    ],
  },
  {
    title: 'Local AI',
    content: [
      'AI features run from the desktop against the provider you configure (Ollama locally, or an API key you paste).',
      'Dripnex does not proxy those prompts through our servers. Whatever that provider logs is between you and them.',
    ],
  },
  {
    title: 'Updates and crash reports',
    content: [
      'The app may check for updates. Those checks do not include note content.',
      'If a Sentry DSN is configured in a build, crash reports may include stack traces and environment data — not note bodies.',
    ],
  },
  {
    title: 'Third-party services',
    content: ['We do not sell data or run advertising SDKs. Services that may see something:'],
    list: [
      'Stripe (payments)',
      'api.dripnex.app (auth, license, optional encrypted sync)',
      'The AI provider you choose, if you use AI',
      'Sentry, only when a DSN is set in that build',
    ],
  },
  {
    title: 'Your rights',
    content: [
      'Your notes live on your computer (and as ciphertext on our sync store if you enabled it).',
      'You can export Markdown at any time.',
      'To delete your account or payment records, email privacy@dripnex.app.',
    ],
  },
  {
    title: 'Changes to This Policy',
    content: [
      'We may update this privacy policy occasionally.',
      'Significant changes will be announced through our changelog and blog.',
      'Continued use of Dripnex after changes constitutes acceptance of the updated policy.',
    ],
  },
  {
    title: 'Contact',
    content: ['For privacy-related questions or concerns:'],
    list: ['Email: privacy@dripnex.app', 'GitHub: github.com/dripnex/readide'],
  },
];

export default function PrivacyPage() {
  return (
    <section className="pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <span className="section-label">Legal</span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-text-primary mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-text-muted">Last updated: {lastUpdated}</p>
        </header>

        {/* TL;DR */}
        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 rounded-xl bg-surface p-5 mb-10 border-l-[3px] border-l-accent">
          <div className="shrink-0 w-11 h-11 flex items-center justify-center bg-accent/10 rounded-lg text-accent">
            <Shield size={24} />
          </div>
          <div className="flex-1">
            <span className="block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-accent mb-1">
              TL;DR
            </span>
            <p className="text-base text-text-secondary leading-7 m-0">
              Notes stay on your device unless you turn on end-to-end sync. Then we only store
              ciphertext. We collect your email for the account and Stripe handles payments.
            </p>
          </div>
        </div>

        <article className="flex flex-col gap-5">
          {sections.map((section, i) => (
            <section key={i} className="rounded-xl bg-surface p-6 sm:p-8">
              <header className="flex items-baseline gap-3 mb-4">
                <span className="text-sm font-semibold text-accent font-mono">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-text-primary">{section.title}</h2>
              </header>
              <div>
                {section.content.map((p, pi) => (
                  <p key={pi} className="text-base text-text-secondary leading-7 mb-3 last:mb-0">
                    {p}
                  </p>
                ))}
                {section.list && (
                  <ul className="list-none my-4 p-4 bg-inset border border-border rounded-lg">
                    {section.list.map((item, li) => (
                      <li
                        key={li}
                        className="flex items-start gap-3 py-2.5 text-base text-text-secondary leading-7"
                      >
                        <Check size={16} className="text-accent shrink-0 mt-1" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {'footer' in section && section.footer && (
                  <p className="mt-4 pt-4 border-t border-border italic text-base text-text-muted leading-7">
                    {section.footer}
                  </p>
                )}
              </div>
            </section>
          ))}
        </article>

        <footer className="mt-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </footer>
      </div>
    </section>
  );
}
