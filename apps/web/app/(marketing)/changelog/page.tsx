import type { Metadata } from 'next';
import { Calendar, Clock, ExternalLink } from 'lucide-react';
import { fetchAllReleases } from '@/lib/github';
import NewsletterForm from '@/components/NewsletterForm';

export const metadata: Metadata = {
  title: 'Changelog — Readied',
  description: 'Release notes and version history for Readied.',
};

function typeColor(type: string): string {
  switch (type) {
    case 'added':
    case 'feat':
    case 'feature':
      return 'text-accent';
    case 'fixed':
    case 'fix':
      return 'text-green-400';
    case 'changed':
    case 'updated':
    case 'improved':
      return 'text-amber-400';
    case 'removed':
    case 'deprecated':
      return 'text-red-400';
    case 'security':
      return 'text-orange-400';
    default:
      return 'text-[#71717a]';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'feat':
    case 'feature':
      return 'added';
    case 'fix':
      return 'fixed';
    case 'updated':
    case 'improved':
      return 'changed';
    default:
      return type;
  }
}

export default async function ChangelogPage() {
  const releases = await fetchAllReleases();

  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-16">
          <span className="section-label">Changelog</span>
          <h1 className="section-heading sm:text-4xl lg:text-5xl">
            Release <span className="text-accent">history</span>
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-[480px] mx-auto">
            Every improvement, fix, and new feature — pulled directly from our releases.
          </p>
        </header>

        {releases.length > 0 && (
          <div className="flex items-center justify-center gap-4 mb-12 text-sm text-[#71717a]">
            <span className="font-mono">
              {releases.length} release{releases.length !== 1 ? 's' : ''}
            </span>
            <span className="text-white/20">&middot;</span>
            <span>
              Latest: <span className="font-mono text-accent">{releases[0].version}</span>
            </span>
          </div>
        )}

        {/* Subscribe CTA */}
        <div className="mb-12 glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-50">Stay in the loop</h3>
            <p className="text-sm text-[#a1a1aa]">Get notified when we ship new features.</p>
          </div>
          <NewsletterForm compact />
        </div>

        {/* Timeline */}
        <div className="relative">
          <div
            className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/[0.06] rounded-full hidden md:block"
            aria-hidden="true"
          ></div>

          <div className="flex flex-col gap-8 md:pl-12">
            {releases.map((release, ri) => (
              <article key={release.version} className="relative glass-card overflow-hidden">
                <div
                  className="absolute -left-12 top-6 w-4 h-4 hidden md:flex items-center justify-center"
                  aria-hidden="true"
                >
                  <span
                    className={`block rounded-full border-2 border-base ${ri === 0 ? 'w-3 h-3 bg-accent' : 'w-2.5 h-2.5 bg-white/20'}`}
                  ></span>
                </div>

                <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-inset border-b border-white/[0.06] gap-2">
                  <div className="flex items-center gap-3">
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-bold text-[#f4f4f5] font-mono tracking-tight hover:text-accent transition-colors"
                    >
                      v{release.version}
                    </a>
                    {ri === 0 && (
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 px-3 py-0.5 rounded-full">
                        latest
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm text-[#71717a]">
                    <Calendar size={14} />
                    {release.date}
                  </span>
                </header>

                {release.changes.length > 0 ? (
                  <ul className="list-none">
                    {release.changes.map((change, ci) => (
                      <li
                        key={ci}
                        className={`flex items-baseline gap-4 px-5 sm:px-6 py-3 sm:py-4 transition-colors hover:bg-white/[0.02] ${ci < release.changes.length - 1 ? 'border-b border-white/[0.06]' : ''}`}
                      >
                        <span
                          className={`font-mono text-xs font-bold uppercase tracking-wider min-w-[76px] shrink-0 ${typeColor(change.type)}`}
                        >
                          {typeLabel(change.type)}
                        </span>
                        <span className="text-sm text-[#a1a1aa] leading-relaxed">
                          {change.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-5 sm:px-6 py-4 text-sm text-[#71717a] italic">
                    See the{' '}
                    <a
                      href={release.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      full release notes on GitHub
                    </a>
                    .
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        {releases.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-surface p-20 text-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-2">
              <Clock size={48} />
            </div>
            <h3 className="text-xl font-bold text-[#f4f4f5]">No releases yet</h3>
            <p className="text-base text-[#a1a1aa]">Check back soon — we ship fast!</p>
          </div>
        )}

        {/* GitHub link */}
        <div className="mt-12 text-center">
          <a
            href="https://github.com/tomymaritano/readide/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            View all releases on GitHub
            <ExternalLink size={14} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
