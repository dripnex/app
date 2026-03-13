import Link from 'next/link';
import { Github, Twitter, Globe } from 'lucide-react';

export default function CreatorStory() {
  return (
    <section className="py-24 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="section-label">The Story</span>
        <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl mb-6">
          Who&apos;s behind Readied?
        </h2>

        {/* Avatar */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10">
          <span className="text-2xl font-bold text-accent">TM</span>
        </div>

        <p className="text-lg text-text-secondary leading-relaxed mb-4">
          Hi, I&apos;m <strong className="text-text-primary">Tomy Maritano</strong> — a software
          developer from Argentina.
        </p>

        <p className="text-text-secondary leading-relaxed mb-4">
          I built Readied because I was tired of note apps that held my data hostage in proprietary
          formats, required an internet connection, or disappeared when the startup behind them shut
          down.
        </p>

        <p className="text-text-secondary leading-relaxed mb-8">
          I believe your notes should be{' '}
          <strong className="text-text-primary">plain files on your machine</strong>, readable by
          any editor, forever. Readied is open source, offline-first, and built to last — not to
          extract value from your words.
        </p>

        {/* Social links */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href="https://github.com/tomymaritano"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            aria-label="GitHub"
          >
            <Github className="h-4.5 w-4.5" />
          </Link>
          <Link
            href="https://x.com/tomymaritano"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            aria-label="X (Twitter)"
          >
            <Twitter className="h-4.5 w-4.5" />
          </Link>
          <Link
            href="https://medium.com/@tomymaritano"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
            aria-label="Blog"
          >
            <Globe className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
