'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { getProductConfig } from '@readied/product-config';
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text';
import { ShimmerButton } from '@/components/magicui/shimmer-button';
import { DotPattern } from '@/components/magicui/dot-pattern';
import { BorderBeam } from '@/components/magicui/border-beam';
import { Button } from '@/components/ui/button';

export default function Hero() {
  const config = getProductConfig();

  return (
    <section className="relative pt-32 sm:pt-40 pb-20 lg:pb-24 overflow-hidden">
      {/* Background pattern */}
      <DotPattern className="[mask-image:radial-gradient(600px_circle_at_center,white,transparent)] opacity-20" />

      {/* Content */}
      <div className="relative z-[2] mx-auto w-full max-w-5xl px-6 lg:px-8">
        <div className="text-center">
          {/* Version badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.03] px-4 py-2 text-xs opacity-0 animate-fade-in-up">
            <AnimatedShinyText>
              <span className="font-mono text-accent">v0.6</span> Early access
            </AnimatedShinyText>
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
          <p className="mx-auto mb-8 max-w-[540px] text-lg leading-relaxed text-text-secondary opacity-0 animate-fade-in-up [animation-delay:200ms]">
            A note app that doesn&apos;t phone home, doesn&apos;t lock you in, and doesn&apos;t need
            an internet connection. Just you, your files, and Markdown.
          </p>

          {/* Dual CTAs */}
          <div className="mb-8 flex flex-col items-center gap-4 opacity-0 animate-fade-in-up [animation-delay:300ms] sm:flex-row sm:justify-center">
            <ShimmerButton
              shimmerColor="#8b5cf6"
              background="rgba(139,92,246,0.1)"
              className="w-full sm:w-auto px-7 py-3.5 text-base font-medium"
            >
              <Link href="/download">Download Free</Link>
            </ShimmerButton>
            <Button variant="ghost" size="lg" asChild>
              <Link href="https://github.com/tomymaritano/readide">View on GitHub</Link>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-col items-center gap-2 text-sm text-text-muted opacity-0 animate-fade-in-up [animation-delay:400ms] sm:flex-row sm:gap-3 sm:justify-center">
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
          <div className="relative overflow-hidden rounded-xl">
            <img
              src="/media/hero-editor.svg"
              alt="Readied editor showing a project roadmap in split Markdown and preview mode"
              className="w-full rounded-xl border border-border shadow-2xl shadow-accent/5"
              width={1280}
              height={720}
              loading="eager"
            />
            <BorderBeam size={200} duration={8} colorFrom="#8b5cf6" colorTo="#6d28d9" />
          </div>
        </div>
      </div>
    </section>
  );
}
