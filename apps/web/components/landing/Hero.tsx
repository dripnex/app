import Link from 'next/link';
import { Download, ArrowRight, Shield } from 'lucide-react';
import { getProductConfig } from '@readied/product-config';

export default function Hero() {
  const config = getProductConfig();

  return (
    <section className="relative pt-32 sm:pt-40 pb-20 lg:pb-24">
      <div className="relative z-[2] mx-auto w-full max-w-5xl px-6 lg:px-8">
        <div className="text-center">
          {/* Version badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-medium text-[#a1a1aa] opacity-0 animate-fade-in-up">
            <span className="font-mono text-accent">v0.6</span>
            Early access
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-[clamp(2.5rem,5vw,4rem)] font-extrabold leading-[1.08] tracking-tight opacity-0 animate-fade-in-up [animation-delay:100ms]">
            Your Markdown.
            <br />
            <span className="gradient-text">Your Machine.</span>
            <br />
            Your Rules.
          </h1>

          {/* Subtext */}
          <p className="mx-auto mb-8 max-w-[540px] text-lg leading-relaxed text-[#a1a1aa] opacity-0 animate-fade-in-up [animation-delay:200ms]">
            A note app that doesn&apos;t phone home, doesn&apos;t lock you in, and doesn&apos;t need
            an internet connection. Just you, your files, and Markdown.
          </p>

          {/* Dual CTAs */}
          <div className="mb-8 flex flex-col items-center gap-4 opacity-0 animate-fade-in-up [animation-delay:300ms] sm:flex-row sm:justify-center">
            <Link
              href="/download"
              className="group inline-flex w-full items-center justify-center gap-3 rounded-lg bg-accent px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-hover sm:w-auto"
            >
              <Download className="h-5 w-5" />
              Download Free
            </Link>
            <Link
              href="/pricing"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-7 py-3.5 text-base font-medium text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-white sm:w-auto"
            >
              Start Pro Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-col items-center gap-2 text-sm text-[#71717a] opacity-0 animate-fade-in-up [animation-delay:400ms] sm:flex-row sm:gap-3 sm:justify-center">
            <span className="inline-flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              Offline-first
            </span>
            <span className="hidden text-white/20 sm:inline">&middot;</span>
            <span>macOS, Windows &amp; Linux</span>
            <span className="hidden text-white/20 sm:inline">&middot;</span>
            <span>Free forever &middot; Pro {config.trialDays}-day trial</span>
          </div>
        </div>

        {/* Editor screenshot */}
        <div className="mt-16 opacity-0 animate-fade-in-up [animation-delay:500ms]">
          <div className="relative">
            <img
              src="/media/hero-editor.svg"
              alt="Readied editor showing a project roadmap in split Markdown and preview mode"
              className="w-full rounded-xl border border-white/[0.06] shadow-2xl shadow-accent/5"
              width={1280}
              height={720}
              loading="eager"
            />
            {/* Glow effect behind image */}
            <div className="absolute -inset-4 -z-10 bg-accent/5 blur-3xl rounded-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
