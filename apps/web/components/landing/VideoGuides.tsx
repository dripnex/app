'use client';

import { useState } from 'react';
import { Play, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

/* ─── Video data (replace with real URLs when recorded) ─── */

const videos = [
  {
    id: 'getting-started',
    title: 'Getting started with Readied',
    description: 'Set up your workspace and write your first note in under 2 minutes.',
    videoSrc: '', // TODO: YouTube embed URL
    duration: '2:30',
  },
  {
    id: 'markdown-workflow',
    title: 'Markdown workflow tips',
    description: 'Keyboard shortcuts, split preview, and Cmd+P navigation.',
    videoSrc: '', // TODO: YouTube embed URL
    duration: '4:15',
  },
  {
    id: 'plugins',
    title: 'Extending with plugins',
    description: 'How to install, configure, and build plugins for Readied.',
    videoSrc: '', // TODO: YouTube embed URL
    duration: '5:00',
  },
];

/* ─── Video card with play overlay ─── */

function VideoCard({
  title,
  description,
  duration,
  videoSrc,
}: {
  title: string;
  description: string;
  duration: string;
  videoSrc: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasVideo = videoSrc.length > 0;

  return (
    <>
      <div
        role={hasVideo ? 'button' : undefined}
        tabIndex={hasVideo ? 0 : undefined}
        onClick={() => hasVideo && setIsOpen(true)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (hasVideo && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={`group relative w-full overflow-hidden rounded-xl border border-border bg-surface text-left transition-all hover:border-accent/30 ${
          hasVideo ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Thumbnail placeholder */}
        <div className="relative aspect-video w-full bg-linear-to-br from-accent/5 via-surface to-surface-elevated">
          {/* Decorative code lines */}
          <div className="absolute inset-0 flex flex-col justify-center gap-2 px-8 opacity-20">
            <div className="h-2 w-3/4 rounded bg-white/20" />
            <div className="h-2 w-1/2 rounded bg-accent/30" />
            <div className="h-2 w-2/3 rounded bg-white/15" />
            <div className="h-2 w-1/3 rounded bg-white/10" />
            <div className="h-2 w-3/5 rounded bg-accent/20" />
          </div>

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
              <div className="flex size-10 items-center justify-center rounded-full bg-linear-to-b from-accent/40 to-accent shadow-lg">
                <Play className="size-4 fill-white text-white" />
              </div>
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/80 backdrop-blur-sm">
            {duration}
          </div>

          {/* "Coming soon" overlay if no video */}
          {!hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-medium text-white/60 backdrop-blur-sm">
                Coming soon
              </span>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-1 group-hover:text-accent transition-colors">
            {title}
          </h3>
          <p className="text-xs text-text-muted leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Video modal */}
      <AnimatePresence>
        {isOpen && hasVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Escape') setIsOpen(false);
            }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative mx-4 aspect-video w-full max-w-4xl md:mx-0"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close video"
                onClick={() => setIsOpen(false)}
                className="absolute -top-14 right-0 rounded-full bg-neutral-900/50 p-2 text-white ring-1 ring-white/10 backdrop-blur-md hover:bg-neutral-800/50"
              >
                <XIcon className="size-5" />
              </button>
              <div className="size-full overflow-hidden rounded-2xl border-2 border-white/10">
                <iframe
                  src={videoSrc}
                  title={title}
                  className="size-full"
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

/* ─── Section ─── */

export default function VideoGuides() {
  return (
    <section className="py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="section-label">Learn</span>
          <h2 className="section-heading">See Readied in action</h2>
          <p className="mx-auto max-w-lg text-text-secondary">
            Short guides to help you get the most out of your writing workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map(video => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      </div>
    </section>
  );
}
