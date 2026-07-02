import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Check, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service — Dripnex',
  description: 'Terms of Service for Dripnex software.',
};

const lastUpdated = 'January 2026';

const sections = [
  {
    title: 'Acceptance of Terms',
    content: [
      'By downloading, installing, or using Dripnex, you agree to be bound by these Terms of Service.',
      'If you do not agree to these terms, do not use the software.',
    ],
  },
  {
    title: 'License Grant',
    content: [
      'Dripnex offers a Free tier and a Pro subscription. Free tier grants perpetual access to core features. Pro subscription grants access to advanced features while active.',
      'This license is for personal or commercial use by the licensee only.',
      'You may install Dripnex on multiple devices that you own. Pro subscriptions are tied to your account, not individual devices.',
    ],
  },
  {
    title: 'Subscription and Updates',
    content: [
      'Free tier includes all core features and receives updates indefinitely.',
      'Pro subscription is billed monthly or annually. Cancel anytime through your account.',
      'Upon cancellation, you retain access to Free tier features and all your local files.',
    ],
    list: [
      'Free tier receives ongoing updates and improvements',
      'Pro features require an active subscription',
      'Your notes are local files you always control',
    ],
  },
  {
    title: 'Restrictions',
    content: ['You may not:'],
    list: [
      'Redistribute, sell, or sublicense the software',
      'Reverse engineer, decompile, or disassemble the software',
      'Remove or alter any proprietary notices or labels',
      'Use the software to develop a competing product',
      'Share your license key with others',
    ],
  },
  {
    title: 'Intellectual Property',
    content: [
      'Dripnex and its original content, features, and functionality are owned by Dripnex and are protected by international copyright, trademark, and other intellectual property laws.',
      'Your content (notes, files, etc.) remains entirely yours. We claim no ownership or rights to anything you create.',
    ],
  },
  {
    title: 'Disclaimer of Warranties',
    content: [
      'Dripnex is provided "as is" and "as available" without warranties of any kind, either express or implied.',
      'We do not warrant that the software will be uninterrupted, error-free, or completely secure.',
      'You are responsible for backing up your data. While Dripnex stores files locally in standard formats, we recommend regular backups of important content.',
    ],
  },
  {
    title: 'Limitation of Liability',
    content: [
      'In no event shall Dripnex, its developers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, or goodwill.',
      'Our total liability shall not exceed the amount you paid for the software.',
    ],
  },
  {
    title: 'Refund Policy',
    content: [
      'We offer a 14-day money-back guarantee from the date of purchase.',
      'To request a refund, contact support with your order details.',
      'Refunds are processed through the original payment method.',
    ],
    list: [
      '14-day refund period from purchase date',
      'No questions asked',
      'Full refund of purchase price',
    ],
  },
  {
    title: 'Termination',
    content: [
      'We reserve the right to terminate or suspend your license immediately, without prior notice, for conduct that we believe violates these terms or is harmful to other users or to us.',
      'Upon termination, your right to use the software ceases, but your existing files remain yours (they are standard Markdown files on your device).',
    ],
  },
  {
    title: 'Governing Law',
    content: [
      'These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law provisions.',
      'Any disputes arising under these terms shall be resolved through good-faith negotiation first.',
    ],
  },
  {
    title: 'Changes to Terms',
    content: [
      'We reserve the right to modify these terms at any time.',
      'Significant changes will be announced through our changelog and blog.',
      'Continued use of Dripnex after changes constitutes acceptance of the new terms.',
    ],
  },
  {
    title: 'Contact',
    content: ['For questions about these terms:'],
    list: ['Email: legal@dripnex.app', 'GitHub: github.com/dripnex/readide'],
  },
];

export default function TermsPage() {
  return (
    <section className="pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <span className="section-label">Legal</span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight text-text-primary mb-3">
            Terms of Service
          </h1>
          <p className="text-sm text-text-muted">Last updated: {lastUpdated}</p>
        </header>

        {/* TL;DR */}
        <div className="flex items-start gap-4 rounded-xl bg-surface p-5 mb-10 border-l-[3px] border-l-accent">
          <div className="shrink-0 w-11 h-11 flex items-center justify-center bg-accent/10 rounded-lg text-accent">
            <FileText size={24} />
          </div>
          <div className="flex-1">
            <span className="block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-accent mb-1">
              TL;DR
            </span>
            <p className="text-base text-text-secondary leading-7 m-0">
              Free tier forever. Pro subscription for sync and advanced features. Your files are
              always yours. Cancel anytime.
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
