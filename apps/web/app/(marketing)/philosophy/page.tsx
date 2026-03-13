import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Philosophy — Readied',
  description: 'Why Readied refuses to become a platform.',
};

const sections = [
  {
    title: 'The pattern',
    highlight: 'Every successful note app follows the same arc.',
    content: [
      'It starts simple. Then it adds sync. Then it adds extensibility — not as optional tools, but as dependencies. Eventually, the app becomes a platform.',
      'Somewhere along the way, exports break. Incentives shift. Trust erodes.',
      'Readied was built to avoid that cycle.',
    ],
  },
  {
    title: 'Growth changes incentives',
    highlight: "This isn't malice. It's gravity.",
    content: [
      'Growth demands features.',
      'Features demand infrastructure.',
      'Infrastructure demands revenue.',
      'Revenue demands lock-in.',
      'The only way to escape it is to stop optimizing for growth.',
    ],
  },
  {
    title: 'Our constraint',
    highlight: 'Readied is constrained by design.',
    content: [],
    list: [
      'No servers to maintain',
      'No ecosystem that your notes depend on',
      'No dependency graph outside your disk',
    ],
    footer:
      "The app works entirely offline. Your files are standard Markdown. If we disappear tomorrow, your notes don't.",
  },
  {
    title: 'The trade',
    highlight: "Readied is not ambitious software. It's careful software.",
    content: [
      'We optimize for decades, not quarters.',
      'We ship less, not more.',
      'We say no by default.',
    ],
  },
  {
    title: 'Features that are allowed',
    highlight: "We're not against features. We're against features that create dependencies.",
    content: [],
    list: [
      'Backlinks — computed from your files',
      'Search — an index rebuilt from your files',
      'Graph view — visualization, not storage',
    ],
    footer: "The rule: if deleting our database doesn't lose your data, the feature is allowed.",
  },
];

export default function PhilosophyPage() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6">
      <div className="relative max-w-5xl mx-auto z-10">
        <header className="text-center mb-16 md:mb-20">
          <span className="section-label">Our Philosophy</span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-6">
            Why Readied refuses to
            <br />
            <span className="gradient-text">become a platform</span>
          </h1>
          <p className="text-lg text-text-secondary max-w-[50ch] mx-auto leading-relaxed">
            A manifesto for software that respects your files, your time, and your trust.
          </p>
        </header>

        <article className="flex flex-col gap-6 md:gap-8">
          {sections.map((section, i) => (
            <section key={i} className="rounded-xl bg-surface p-6 sm:p-8 md:p-10">
              <header className="flex items-baseline gap-4 mb-6 flex-col sm:flex-row sm:gap-4">
                <span className="text-lg font-extrabold text-accent font-mono leading-none shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
                  {section.title}
                </h2>
              </header>
              <div>
                <p className="text-xl sm:text-2xl font-semibold gradient-text leading-snug mb-5">
                  {section.highlight}
                </p>
                {section.content.map((p, pi) => (
                  <p
                    key={pi}
                    className="text-base text-text-secondary leading-relaxed mb-3 last:mb-0"
                  >
                    {p}
                  </p>
                ))}
                {section.list && (
                  <ul className="list-none my-6 p-4 sm:p-6 bg-inset border border-border rounded-lg">
                    {section.list.map((item, li) => (
                      <li
                        key={li}
                        className="flex items-start gap-3 py-2 text-sm text-text-secondary leading-relaxed"
                      >
                        <Check size={16} className="text-accent shrink-0 mt-[3px]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.footer && (
                  <p className="mt-6 pt-6 border-t border-border italic text-sm text-text-muted">
                    {section.footer}
                  </p>
                )}
              </div>
              {i === 2 && (
                <div className="mt-6 rounded-xl bg-inset border border-border p-6 font-mono text-sm leading-relaxed">
                  <div className="text-text-muted mb-2">
                    {'// What happens when you delete Readied:'}
                  </div>
                  <div className="text-text-secondary">~/notes/</div>
                  <div className="text-text-secondary pl-4">
                    project.md <span className="text-emerald-400">&larr; still here</span>
                  </div>
                  <div className="text-text-secondary pl-4">
                    ideas.md <span className="text-emerald-400">&larr; still here</span>
                  </div>
                  <div className="text-text-secondary pl-4">
                    journal/ <span className="text-emerald-400">&larr; still here</span>
                  </div>
                  <div className="text-text-muted mt-2">
                    {'// Your files never depended on us.'}
                  </div>
                </div>
              )}
            </section>
          ))}
        </article>

        <footer className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-text-primary mb-3">
            Ready to try software that respects your files?
          </h3>
          <p className="text-base text-text-secondary mb-8 max-w-[44ch] mx-auto">
            Download for free. No account needed.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/download"
              className="inline-flex items-center gap-3 rounded-lg bg-accent px-7 py-3.5 text-base font-medium text-white hover:bg-accent-hover"
            >
              Download Free
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-7 py-3.5 text-base font-medium text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
            >
              Back to home
            </Link>
          </div>
        </footer>
      </div>
    </section>
  );
}
