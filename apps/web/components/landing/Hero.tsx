'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Apple, Github, Play, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getProductConfig } from '@readied/product-config';
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text';
import { BorderBeam } from '@/components/magicui/border-beam';

/* ─── Subtle diagonal light beams ─── */
function LightBeams() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 h-[600px] w-[500px] rounded-full bg-accent/[0.04] blur-[150px]" />
      <div className="absolute -top-[30%] left-[20%] h-[160%] w-[80px] rotate-[35deg] bg-gradient-to-b from-transparent via-accent/[0.12] to-transparent blur-[50px]" />
      <div className="absolute -top-[30%] left-[38%] h-[160%] w-[150px] rotate-[35deg] bg-gradient-to-b from-transparent via-violet-500/[0.07] to-transparent blur-[80px]" />
      <div className="absolute -top-[30%] left-[55%] h-[160%] w-[40px] rotate-[35deg] bg-gradient-to-b from-transparent via-accent/[0.15] to-transparent blur-[25px]" />
      <div className="absolute -top-[30%] right-[15%] h-[160%] w-[100px] rotate-[35deg] bg-gradient-to-b from-transparent via-violet-600/[0.06] to-transparent blur-[60px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

/* ─── Video preview with play button overlay ─── */
/* When you have a real video, swap the TODO values below */
// Video URL will be added when the real demo is recorded
const DEMO_VIDEO_URL = ''; // TODO: replace with real video

function VideoPreview() {
  return <EditorMockWithPlay />;
}

/* Editor mock that doubles as a clickable video thumbnail */
function EditorMockWithPlay() {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const hasVideo = DEMO_VIDEO_URL.length > 0;

  return (
    <>
      <button
        type="button"
        aria-label="Watch demo video"
        className="group relative w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        onClick={() => hasVideo && setIsVideoOpen(true)}
      >
        <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c0e] shadow-2xl shadow-accent/5 transition-all duration-200 group-hover:brightness-[0.85]">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-white/[0.06]" />
              <span className="h-3 w-3 rounded-full bg-white/[0.06]" />
              <span className="h-3 w-3 rounded-full bg-white/[0.06]" />
            </div>
            <span className="ml-2 font-mono text-[11px] text-text-muted">project-roadmap.md</span>
            <span className="ml-auto font-mono text-[10px] text-text-muted/50">readied</span>
          </div>

          {/* Editor body — two panes */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="border-b border-white/[0.06] p-5 md:border-b-0 md:border-r">
              <div className="font-mono text-xs leading-[1.8] text-text-muted sm:text-[13px]">
                <div>
                  <span className="text-accent font-semibold"># </span>
                  <span className="text-text-primary font-semibold">Project Roadmap</span>
                </div>
                <div className="h-1" />
                <div>
                  <span className="text-accent/60">## </span>
                  <span className="text-text-secondary">Q1 2026</span>
                </div>
                <div>
                  <span className="text-accent/40">- </span>
                  <span className="text-text-secondary">[x] Core editor with CodeMirror 6</span>
                </div>
                <div>
                  <span className="text-accent/40">- </span>
                  <span className="text-text-secondary">[x] SQLite local storage</span>
                </div>
                <div>
                  <span className="text-accent/40">- </span>
                  <span className="text-text-secondary">[ ] Plugin system v1</span>
                </div>
                <div className="h-1" />
                <div>
                  <span className="text-accent/60">## </span>
                  <span className="text-text-secondary">Q2 2026</span>
                </div>
                <div>
                  <span className="text-accent/40">- </span>
                  <span className="text-text-secondary">[ ] Sync between devices</span>
                </div>
                <div>
                  <span className="text-accent/40">- </span>
                  <span className="text-text-secondary">[ ] Mobile companion app</span>
                </div>
                <div>
                  <span className="text-accent/40">- </span>
                  <span className="text-text-secondary">[ ] </span>
                  <span className="text-accent/70">**</span>
                  <span className="text-text-primary">Tables &amp; diagrams</span>
                  <span className="text-accent/70">**</span>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs leading-[1.8] sm:text-[13px]">
                <h3 className="mb-1 text-sm font-bold text-text-primary sm:text-base">
                  Project Roadmap
                </h3>
                <h4 className="mb-1 text-xs font-semibold text-text-secondary sm:text-sm">
                  Q1 2026
                </h4>
                <div className="space-y-0.5 mb-2">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-accent/40 bg-accent/10 text-[8px] text-accent">
                      &#10003;
                    </span>
                    Core editor with CodeMirror 6
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-accent/40 bg-accent/10 text-[8px] text-accent">
                      &#10003;
                    </span>
                    SQLite local storage
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-white/10 text-[8px]" />
                    Plugin system v1
                  </div>
                </div>
                <h4 className="mb-1 text-xs font-semibold text-text-secondary sm:text-sm">
                  Q2 2026
                </h4>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-white/10 text-[8px]" />
                    Sync between devices
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-white/10 text-[8px]" />
                    Mobile companion app
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-white/10 text-[8px]" />
                    <strong className="text-text-primary">Tables &amp; diagrams</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <BorderBeam size={200} duration={8} colorFrom="#8b5cf6" colorTo="#6d28d9" />
        </div>

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out">
          <div className="flex size-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-transform duration-200 group-hover:scale-110 sm:size-24">
            <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-b from-accent/40 to-accent shadow-lg sm:size-16">
              <Play className="size-6 fill-white text-white sm:size-7" />
            </div>
          </div>
        </div>
      </button>

      {/* Video modal */}
      <AnimatePresence>
        {isVideoOpen && hasVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                setIsVideoOpen(false);
              }
            }}
            onClick={() => setIsVideoOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative mx-4 aspect-video w-full max-w-4xl md:mx-0"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsVideoOpen(false)}
                className="absolute -top-14 right-0 rounded-full bg-neutral-900/50 p-2 text-white ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-neutral-800/50"
              >
                <XIcon className="size-5" />
              </button>
              <div className="relative size-full overflow-hidden rounded-2xl border-2 border-white/10">
                <iframe
                  src={DEMO_VIDEO_URL}
                  title="Readied demo video"
                  className="size-full rounded-2xl"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function Hero() {
  const config = getProductConfig();

  return (
    <section className="relative overflow-hidden pt-16">
      <LightBeams />

      {/* Text content — centered in viewport */}
      <div className="relative z-[2] mx-auto flex min-h-[85dvh] w-full max-w-5xl flex-col items-center justify-center px-6 lg:px-8 text-center">
        {/* Version badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.03] px-4 py-2 text-xs opacity-0 animate-fade-in-up">
          <AnimatedShinyText>
            <span className="font-mono text-accent">v0.6</span> Early access
          </AnimatedShinyText>
        </div>

        {/* Headline */}
        <h1 className="mb-6 text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.08] tracking-tight opacity-0 animate-fade-in-up [animation-delay:100ms]">
          Your Markdown.
          <br />
          <span className="gradient-text">Your Machine.</span>
          <br />
          Your Rules.
        </h1>

        {/* Subtext */}
        <p className="mx-auto mb-10 max-w-[540px] text-base leading-relaxed text-text-secondary sm:text-lg opacity-0 animate-fade-in-up [animation-delay:200ms]">
          A note app that doesn&apos;t phone home, doesn&apos;t lock you in, and doesn&apos;t need
          an internet connection. Just you, your files, and Markdown.
        </p>

        {/* CTAs */}
        <div className="mb-6 flex flex-col items-center gap-3 opacity-0 animate-fade-in-up [animation-delay:300ms] sm:flex-row sm:justify-center">
          <Link
            href="/download"
            className="inline-flex items-center gap-2.5 rounded-xl border border-white/[0.12] bg-white/[0.06] px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/[0.1] hover:border-white/[0.2]"
          >
            <Apple className="h-4 w-4" />
            Download for Mac
          </Link>
          <Link
            href="https://github.com/tomymaritano/readide"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-sm font-medium text-text-secondary backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:text-white"
          >
            <Github className="h-4 w-4" />
            View on GitHub
          </Link>
        </div>

        {/* Version info */}
        <p className="mb-6 font-mono text-xs text-text-muted opacity-0 animate-fade-in-up [animation-delay:350ms]">
          v0.6.2 &nbsp;|&nbsp; macOS 13+ &nbsp;|&nbsp; Windows &amp; Linux coming soon
        </p>

        {/* Trust line */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-text-muted opacity-0 animate-fade-in-up [animation-delay:400ms]">
          <span>Offline-first</span>
          <span className="text-white/15">|</span>
          <span>Open source</span>
          <span className="text-white/15">|</span>
          <span>Free forever &middot; Pro {config.trialDays}-day trial</span>
        </div>
      </div>

      {/* Video / Editor preview */}
      <div className="relative z-[2] mx-auto w-full max-w-4xl px-6 lg:px-8 pb-20 opacity-0 animate-fade-in-up [animation-delay:500ms]">
        {/*
          TODO: Replace with real video once recorded.
          1. Upload video to YouTube, get embed URL
          2. Take a screenshot for thumbnailSrc
          3. Swap videoSrc and thumbnailSrc below
        */}
        <VideoPreview />
      </div>
    </section>
  );
}
