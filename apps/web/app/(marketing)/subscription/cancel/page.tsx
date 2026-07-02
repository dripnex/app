import type { Metadata } from 'next';
import Link from 'next/link';
import { Undo2, Download, Zap, Cloud, LinkIcon, Search, GitBranch } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Checkout Canceled',
  description: 'Your checkout was canceled. You can still use Dripnex for free.',
};

export default function SubscriptionCancelPage() {
  return (
    <section className="min-h-screen pt-24 sm:pt-32 pb-16 px-4 sm:px-6 text-center">
      <div className="max-w-4xl mx-auto">
        {/* Cancel icon */}
        <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-surface flex items-center justify-center text-[#71717a]">
          <Undo2 size={36} />
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f4f4f5] mb-4">
          Checkout Canceled
        </h1>
        <p className="text-lg sm:text-xl text-[#a1a1aa] mb-12">
          No worries! You can still use Dripnex for free
        </p>

        {/* Option cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 my-12">
          {/* Free option */}
          <div className="p-6 sm:p-8 rounded-xl bg-surface text-left">
            <h3 className="text-xl sm:text-2xl font-bold text-[#f4f4f5] mb-4">Try Dripnex Free</h3>
            <p className="text-[#a1a1aa] mb-6">
              Get started with unlimited local notes, full markdown editor, and 100% offline
              functionality.
            </p>
            <Link
              href="/download"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/8 text-[#a1a1aa] font-medium text-sm transition-colors hover:bg-white/5 hover:text-white"
            >
              <Download size={18} />
              Download Free
            </Link>
          </div>

          {/* Pro option */}
          <div className="p-6 sm:p-8 rounded-xl bg-surface border border-accent/20 text-left">
            <h3 className="text-xl sm:text-2xl font-bold text-[#f4f4f5] mb-4">
              Changed your mind?
            </h3>
            <p className="text-[#a1a1aa] mb-6">
              Pro includes cloud sync, backlinks, graph view, and advanced search. Start with a
              14-day free trial.
            </p>
            <Link
              href="/subscribe"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-accent text-white font-medium text-sm transition-colors hover:bg-accent-hover"
            >
              <Zap size={18} />
              Try Pro
            </Link>
          </div>
        </div>

        {/* Why upgrade */}
        <div className="my-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#f4f4f5] mb-8">
            Why upgrade to Pro?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center p-4 sm:p-6 rounded-xl bg-surface">
              <div className="flex items-center justify-center mb-4">
                <Cloud size={32} className="text-accent" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-[#f4f4f5] mb-2">Cloud Sync</h4>
              <p className="text-sm text-[#a1a1aa]">
                Access your notes from any device with automatic sync
              </p>
            </div>
            <div className="text-center p-4 sm:p-6 rounded-xl bg-surface">
              <div className="flex items-center justify-center mb-4">
                <LinkIcon size={32} className="text-accent" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-[#f4f4f5] mb-2">Backlinks</h4>
              <p className="text-sm text-[#a1a1aa]">
                See connections between your notes automatically
              </p>
            </div>
            <div className="text-center p-4 sm:p-6 rounded-xl bg-surface">
              <div className="flex items-center justify-center mb-4">
                <Search size={32} className="text-accent" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-[#f4f4f5] mb-2">
                Advanced Search
              </h4>
              <p className="text-sm text-[#a1a1aa]">Find anything instantly with powerful search</p>
            </div>
            <div className="text-center p-4 sm:p-6 rounded-xl bg-surface">
              <div className="flex items-center justify-center mb-4">
                <GitBranch size={32} className="text-accent" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-[#f4f4f5] mb-2">Graph View</h4>
              <p className="text-sm text-[#a1a1aa]">
                Visualize relationships in your knowledge base
              </p>
            </div>
          </div>
        </div>

        <p className="mt-16 text-[#a1a1aa]">
          Questions?{' '}
          <a href="mailto:support@dripnex.app" className="text-accent hover:underline">
            Contact support
          </a>{' '}
          or check out our{' '}
          <Link href="/faq" className="text-accent hover:underline">
            FAQ
          </Link>
        </p>
      </div>
    </section>
  );
}
