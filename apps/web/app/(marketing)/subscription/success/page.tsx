import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Download } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Welcome to Readied Pro!',
  description: 'Your subscription is active. Download the app to get started.',
};

export default function SubscriptionSuccessPage() {
  return (
    <section className="min-h-screen pt-24 sm:pt-32 pb-16 px-4 sm:px-6 text-center">
      <div className="max-w-3xl mx-auto">
        {/* Success icon */}
        <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-accent/10 flex items-center justify-center">
          <Check size={40} className="text-accent" />
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-accent">
          Welcome to Readied Pro!
        </h1>
        <p className="text-lg sm:text-xl text-[#a1a1aa] mb-12">Your subscription is now active</p>

        {/* Next steps */}
        <div className="my-12 text-left">
          <h2 className="text-xl sm:text-2xl font-bold text-[#f4f4f5] text-center mb-8">
            What&apos;s next?
          </h2>
          <ol className="list-none flex flex-col gap-4 sm:gap-6">
            <li className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 p-6 rounded-xl bg-surface text-center sm:text-left">
              <span className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-accent text-white font-mono font-bold">
                1
              </span>
              <div>
                <strong className="block text-lg text-[#f4f4f5] mb-1">Download Readied</strong>
                <p className="text-[#a1a1aa] m-0">Get the app for your platform</p>
              </div>
            </li>
            <li className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 p-6 rounded-xl bg-surface text-center sm:text-left">
              <span className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-accent text-white font-mono font-bold">
                2
              </span>
              <div>
                <strong className="block text-lg text-[#f4f4f5] mb-1">
                  Sign in with your email
                </strong>
                <p className="text-[#a1a1aa] m-0">Use the same email you just subscribed with</p>
              </div>
            </li>
            <li className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 p-6 rounded-xl bg-surface text-center sm:text-left">
              <span className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-accent text-white font-mono font-bold">
                3
              </span>
              <div>
                <strong className="block text-lg text-[#f4f4f5] mb-1">Start taking notes</strong>
                <p className="text-[#a1a1aa] m-0">All Pro features are unlocked and ready to use</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Download CTA */}
        <div className="my-12">
          <Link
            href="/download"
            className="inline-flex items-center gap-2 px-8 sm:px-10 py-4 sm:py-5 text-base sm:text-lg font-semibold rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover"
          >
            <Download size={20} />
            Download Readied
          </Link>
        </div>

        {/* Pro features info */}
        <div className="my-12 rounded-xl bg-accent/6 border border-accent/20 p-6 sm:p-8 text-left">
          <h3 className="text-lg sm:text-xl font-bold text-[#f4f4f5] text-center mb-6">
            What&apos;s included in Pro
          </h3>
          <ul className="list-none grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Cloud sync across all your devices',
              'Backlinks and graph view',
              'Advanced search capabilities',
              'Priority support',
              'Early access to new features',
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-[#a1a1aa] py-2">
                <Check size={16} className="text-accent shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-12 text-[#a1a1aa]">
          Need help?{' '}
          <a href="mailto:support@readied.app" className="text-accent hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </section>
  );
}
