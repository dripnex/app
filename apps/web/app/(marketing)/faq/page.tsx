import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { getProductConfig, URLS } from '@dripnex/product-config';
import FaqAccordion from '@/components/FaqAccordion';

export const metadata: Metadata = {
  title: 'FAQ — Dripnex',
  description: 'Frequently asked questions about Dripnex.',
};

export default function FaqPage() {
  const config = getProductConfig();
  const { plans, guarantees, trialDescription } = config;
  const proPricing = plans.pro.pricing!;

  const faqs = [
    {
      category: 'General',
      questions: [
        {
          question: 'What is Dripnex?',
          answer:
            'Dripnex is a desktop Markdown notetaker. Notes live in a local SQLite database as Markdown. An account is required; cloud sync is optional and end-to-end encrypted.',
        },
        {
          question: 'Is my data stored in the cloud?',
          answer:
            'By default, no. Notes stay on your machine. If you turn on sync, only encrypted blobs go to api.dripnex.app. We cannot read the contents.',
        },
        {
          question: 'Does Dripnex work offline?',
          answer:
            'Yes. Reading and writing notes works offline. Sign-in, license checks, and optional sync need the network.',
        },
        {
          question: 'What file format does Dripnex use?',
          answer:
            'Note bodies are standard Markdown stored in local SQLite. You can export Markdown any time and open it in another editor.',
        },
      ],
    },
    {
      category: 'Features',
      questions: [
        {
          question: 'Can I sync between devices?',
          answer:
            'Yes, optionally. Sync is end-to-end encrypted: you set a passphrase, and the server only stores ciphertext. Sync will not start until that key is set up.',
        },
        {
          question: 'Does Dripnex support backlinks?',
          answer: 'Yes. Wikilinks and backlinks are computed from your notes.',
        },
        {
          question: 'Can I use plugins?',
          answer:
            'Built-in plugins ship with the app (Mermaid, Vim, KaTeX, tables). There is no third-party plugin marketplace in v1.',
        },
        {
          question: 'Does Dripnex have AI features?',
          answer:
            'Yes, on the desktop. AI talks to the provider you configure (local Ollama or your own API key). Notes are not sent to Dripnex servers for generation.',
        },
      ],
    },
    {
      category: 'Pricing',
      questions: [
        {
          question: 'How much does Dripnex cost?',
          answer: `Free tier is free forever. Pro is ${proPricing.intervals.monthly.label} or ${proPricing.intervals.annual.label} (${proPricing.annualSavings} off).`,
        },
        { question: 'Is there a free tier?', answer: guarantees.freeTierForever.description },
        {
          question: 'Can I try Pro before subscribing?',
          answer: `Yes! ${trialDescription}. No credit card needed.`,
        },
        { question: 'What about refunds?', answer: guarantees.refund.description },
        { question: 'Can I cancel anytime?', answer: guarantees.cancelAnytime.description },
      ],
    },
    {
      category: 'Technical',
      questions: [
        {
          question: 'What platforms are supported?',
          answer: 'macOS 11+ (Apple Silicon and Intel) and Windows 10+ (64-bit).',
        },
        {
          question: 'Can I export my data?',
          answer:
            'Yes. Export notes as Markdown. The local database is also on your disk if you want a raw backup.',
        },
        {
          question: 'What if Dripnex stops being developed?',
          answer: guarantees.freeTierForever.description,
        },
        {
          question: 'Is the source code available?',
          answer:
            'Yes, the source is available on GitHub for transparency. The license is source-available, not open-source.',
        },
      ],
    },
  ];

  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="relative max-w-5xl mx-auto z-10">
        <header className="text-center mb-16">
          <span className="section-label">FAQ</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-4">
            Frequently asked <span className="text-accent">questions</span>
          </h1>
          <p className="text-lg text-text-secondary">Everything you need to know about Dripnex.</p>
        </header>

        <FaqAccordion categories={faqs} />

        <div className="text-center rounded-xl bg-surface p-8 sm:p-12 mt-16">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-5 bg-accent/10 rounded-lg text-accent">
            <MessageCircle size={28} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Still have questions?</h3>
          <p className="text-base text-text-secondary mb-8 max-w-md mx-auto">
            Join our community forum or reach out on Twitter.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href={URLS.discussions}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-accent text-white font-medium text-sm transition-colors hover:bg-accent-hover"
            >
              Visit Forum
            </a>
            <a
              href={URLS.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border text-text-secondary font-medium text-sm transition-colors hover:bg-white/5 hover:text-white"
            >
              @dripnexapp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
