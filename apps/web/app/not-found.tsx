import Link from 'next/link';
import { Frown, Home } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-[480px]">
            <div className="text-center rounded-xl bg-surface p-8 sm:p-12">
              <div className="flex items-center justify-center mb-6 text-[#71717a]">
                <Frown size={80} />
              </div>

              <span className="block font-mono text-6xl sm:text-[6rem] font-extrabold leading-none mb-4 text-accent">
                404
              </span>

              <h1 className="text-xl sm:text-2xl font-bold text-[#f4f4f5] mb-3">
                Oops, this page wandered off
              </h1>
              <p className="text-base text-[#a1a1aa] leading-relaxed mb-8">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
              </p>

              <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 mb-8">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-accent text-white font-medium text-sm transition-colors hover:bg-accent-hover"
                >
                  <Home size={18} />
                  Go home
                </Link>
                <Link
                  href="/faq"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/[0.08] text-[#a1a1aa] font-medium text-sm transition-colors hover:bg-white/5 hover:text-white"
                >
                  View FAQ
                </Link>
              </div>

              <div className="pt-6 border-t border-white/[0.06]">
                <span className="block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-[#71717a] mb-3">
                  Or try these:
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link
                    href="/download"
                    className="px-3 py-2 text-sm text-[#a1a1aa] border border-white/[0.08] rounded-lg transition-colors hover:text-accent hover:bg-white/5"
                  >
                    Download
                  </Link>
                  <Link
                    href="/pricing"
                    className="px-3 py-2 text-sm text-[#a1a1aa] border border-white/[0.08] rounded-lg transition-colors hover:text-accent hover:bg-white/5"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/changelog"
                    className="px-3 py-2 text-sm text-[#a1a1aa] border border-white/[0.08] rounded-lg transition-colors hover:text-accent hover:bg-white/5"
                  >
                    Changelog
                  </Link>
                  <a
                    href="https://medium.com/@tomymaritano"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-sm text-[#a1a1aa] border border-white/[0.08] rounded-lg transition-colors hover:text-accent hover:bg-white/5"
                  >
                    Blog
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
