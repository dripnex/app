import type { Metadata } from 'next';
import { Calendar, Clock, ExternalLink } from 'lucide-react';
import { marked } from 'marked';
import { fetchAllReleases } from '@/lib/github';
import { loadWhatsNew } from '@/lib/whatsNew';
import NewsletterForm from '@/components/NewsletterForm';

export const metadata: Metadata = {
  title: 'What’s New — Dripnex',
  description: 'What changed in Dripnex, written for humans — not a commit dump.',
};

export default async function ChangelogPage() {
  const stories = loadWhatsNew();
  const engineering = await fetchAllReleases();

  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-16">
          <span className="section-label">What’s New</span>
          <h1 className="section-heading sm:text-4xl lg:text-5xl">
            Written for <span className="text-accent">humans</span>
          </h1>
          <p className="text-lg text-text-secondary max-w-[480px] mx-auto">
            The story of each version. Engineering notes live on GitHub.
          </p>
        </header>

        <div className="mb-12 glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Stay in the loop</h3>
            <p className="text-sm text-text-secondary">Get notified when we ship.</p>
          </div>
          <NewsletterForm compact />
        </div>

        {stories.length === 0 && engineering.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-surface p-20 text-center">
            <Clock size={48} className="text-accent" />
            <h3 className="text-xl font-bold text-text-primary">No releases yet</h3>
          </div>
        )}

        <div className="flex flex-col gap-16">
          {stories.map(story => (
            <article key={story.version} className="glass-card overflow-hidden">
              <header className="px-6 py-5 bg-inset border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-text-primary tracking-tight">
                    {story.title}
                  </h2>
                  <span className="font-mono text-sm text-accent">v{story.version}</span>
                  {story.status === 'draft' && (
                    <span className="font-mono text-xs uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                      upcoming
                    </span>
                  )}
                </div>
                {story.date && (
                  <span className="inline-flex items-center gap-2 text-sm text-text-muted">
                    <Calendar size={14} />
                    {story.date}
                  </span>
                )}
              </header>
              <div
                className="px-6 py-6 prose prose-invert prose-sm max-w-none text-text-secondary [&_h2]:text-text-primary [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1 [&_code]:font-mono [&_code]:text-accent [&_a]:text-accent"
                dangerouslySetInnerHTML={{ __html: marked.parse(story.body, { async: false }) }}
              />
            </article>
          ))}
        </div>

        {engineering.length > 0 && (
          <details className="mt-16 group">
            <summary className="cursor-pointer text-sm text-text-muted hover:text-text-secondary list-none flex items-center justify-between border-t border-border pt-8">
              <span>Engineering log ({engineering.length} GitHub releases)</span>
              <span className="text-xs uppercase tracking-wider">show</span>
            </summary>
            <ul className="mt-6 space-y-3">
              {engineering.map(release => (
                <li key={release.version} className="flex items-baseline justify-between gap-4">
                  <a
                    href={release.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-accent hover:underline"
                  >
                    v{release.version}
                  </a>
                  <span className="text-xs text-text-muted">{release.date}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-12 text-center">
          <a
            href="https://github.com/dripnex/readide/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            GitHub releases
            <ExternalLink size={14} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
