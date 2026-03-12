import Link from 'next/link';
import { Download, ArrowRight, Heart, Zap, WifiOff } from 'lucide-react';
import { getProductConfig } from '@readied/product-config';

export default function Audience() {
  const config = getProductConfig();

  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        {/* CTA */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-50 mb-4">
            Give it a try. It&apos;s free.
          </h2>
          <p className="text-lg text-[#a1a1aa] mb-8 max-w-[48ch] mx-auto">
            No account needed. No credit card. Download the app, point it at a folder of .md files,
            and start writing. That&apos;s it.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center mb-8">
            <Link
              href="/download"
              className="group inline-flex w-full items-center justify-center gap-3 rounded-lg bg-accent px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Download Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex w-full items-center justify-center rounded-lg border border-white/[0.08] px-7 py-3.5 text-base font-medium text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-white sm:w-auto"
            >
              View pricing
            </Link>
          </div>

          {/* Trust signals */}
          <div className="flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-[#71717a]">
              <Heart className="h-3.5 w-3.5 text-accent" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-[#71717a]">
              <Zap className="h-3.5 w-3.5 text-accent" />
              <span>{config.trialDays}-day Pro trial</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-[#71717a]">
              <WifiOff className="h-3.5 w-3.5 text-accent" />
              <span>100% offline</span>
            </div>
          </div>
        </div>

        {/* Indie developer card */}
        <div className="rounded-xl bg-surface p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8">
            {/* Photo */}
            <div className="shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-xl bg-inset border border-white/[0.06] overflow-hidden flex items-center justify-center">
                <img
                  src="https://avatars.githubusercontent.com/u/7626025?v=4"
                  alt="Tomy Maritano"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-3 flex-1">
              <span className="font-mono text-sm font-bold uppercase tracking-[0.05em] text-accent">
                Built by an indie developer
              </span>
              <p className="text-lg leading-relaxed text-[#a1a1aa]">
                Readied is made by{' '}
                <strong className="text-[#f4f4f5] font-semibold">Tomy Maritano</strong>, a developer
                who cares about software longevity. No investors. No growth targets. Just a tool
                that works.
              </p>
              <Link
                href="/philosophy"
                className="group mt-1 inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
              >
                Read the philosophy
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
