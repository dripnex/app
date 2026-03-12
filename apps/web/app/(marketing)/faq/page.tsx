import type { Metadata } from 'next';
import { MessageCircle } from 'lucide-react';
import { getProductConfig, URLS } from '@readied/product-config';
import FaqAccordion from '@/components/FaqAccordion';

export const metadata: Metadata = {
  title: 'FAQ — Readied',
  description: 'Frequently asked questions about Readied.',
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
          question: 'What is Readied?',
          answer:
            'Readied is a Markdown editor designed for developers who want to own their notes. It works offline, stores files locally, and uses standard Markdown format.',
        },
        {
          question: 'Is my data stored in the cloud?',
          answer:
            'No. All files stay on your local disk. We have no servers, no accounts, and no way to access your data.',
        },
        {
          question: 'Does Readied work offline?',
          answer: 'Yes, 100%. Readied works entirely offline. No internet connection required.',
        },
        {
          question: 'What file format does Readied use?',
          answer:
            'Standard Markdown (.md files). You can open your notes with any text editor, now or 20 years from now.',
        },
      ],
    },
    {
      category: 'Features',
      questions: [
        {
          question: 'Can I sync between devices?',
          answer:
            'Not built-in. We intentionally avoid cloud features. You can use Dropbox, iCloud, Google Drive, or git to sync your folder.',
        },
        {
          question: 'Does Readied support backlinks?',
          answer: 'Yes. Backlinks are computed from your files on-the-fly. No database dependency.',
        },
        {
          question: 'Can I use plugins?',
          answer:
            'No. Plugins that modify your files create lock-in. We keep the app simple and your Markdown standard.',
        },
        {
          question: 'Does Readied have AI features?',
          answer: 'No. AI features require servers and trust. We keep everything local.',
        },
      ],
    },
    {
      category: 'Pricing',
      questions: [
        {
          question: 'How much does Readied cost?',
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
            'Your data is already Markdown files on your disk. Nothing to export. Open them with any editor.',
        },
        {
          question: 'What if Readied stops being developed?',
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
          <p className="text-lg text-[#a1a1aa]">Everything you need to know about Readied.</p>
        </header>

        <FaqAccordion categories={faqs} />

        <div className="text-center rounded-xl bg-surface p-8 sm:p-12 mt-16">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-5 bg-accent/10 rounded-lg text-accent">
            <MessageCircle size={28} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Still have questions?</h3>
          <p className="text-base text-[#a1a1aa] mb-8 max-w-md mx-auto">
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/[0.08] text-[#a1a1aa] font-medium text-sm transition-colors hover:bg-white/5 hover:text-white"
            >
              @readiedapp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
