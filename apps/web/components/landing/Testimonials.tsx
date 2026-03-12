'use client';

import { Star } from 'lucide-react';
import { Marquee } from '@/components/magicui/marquee';
import { cn } from '@/lib/utils';

/* ─── Review data (replace with real reviews when available) ─── */

const reviews = [
  {
    name: 'Alex C.',
    role: 'Senior Developer',
    stars: 5,
    text: 'Finally a note app that respects my workflow. Plain Markdown, no sync drama, just works. Exactly what I needed.',
    date: 'Mar 2026',
  },
  {
    name: 'Maria G.',
    role: 'Technical Writer',
    stars: 5,
    text: "I switched from Notion and haven't looked back. Readied is fast, offline, and my files are just .md on disk. Love it.",
    date: 'Mar 2026',
  },
  {
    name: 'James W.',
    role: 'Indie Hacker',
    stars: 5,
    text: 'The plugin system is surprisingly powerful for such an early product. Built a custom snippet plugin in an afternoon.',
    date: 'Feb 2026',
  },
  {
    name: 'Yuki T.',
    role: 'Software Engineer',
    stars: 5,
    text: 'Open source, local-first, Markdown — checks all my boxes. The CodeMirror 6 editor is buttery smooth.',
    date: 'Feb 2026',
  },
  {
    name: 'Sarah M.',
    role: 'Privacy Researcher',
    stars: 5,
    text: 'Zero telemetry, zero cloud. I audited the source. This is the real deal for people who care about data ownership.',
    date: 'Jan 2026',
  },
  {
    name: 'Daniel P.',
    role: 'Full-Stack Developer',
    stars: 5,
    text: 'Cmd+P to jump between notes is addictive. I organize everything in Markdown now — meeting notes, journals, code docs.',
    date: 'Jan 2026',
  },
];

const firstRow = reviews.slice(0, reviews.length / 2);
const secondRow = reviews.slice(reviews.length / 2);

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

function ReviewCard({
  name,
  role,
  stars,
  text,
  date,
}: {
  name: string;
  role: string;
  stars: number;
  text: string;
  date: string;
}) {
  return (
    <figure
      className={cn(
        'relative w-80 shrink-0 overflow-hidden rounded-xl border border-border bg-surface p-5'
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar placeholder */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
          {name
            .split(' ')
            .map(n => n[0])
            .join('')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
          <p className="text-xs text-text-muted truncate">{role}</p>
        </div>
      </div>

      <Stars count={stars} />

      <blockquote className="mt-3 text-sm leading-relaxed text-text-secondary">{text}</blockquote>

      <p className="mt-3 text-[10px] text-text-muted">{date}</p>
    </figure>
  );
}

export default function Testimonials() {
  return (
    <section className="py-24 overflow-hidden">
      <div className="text-center mb-12 px-4">
        <span className="section-label">Reviews</span>
        <h2 className="section-heading">What developers are saying</h2>
        <p className="mx-auto max-w-lg text-text-secondary">
          Early feedback from our beta community.
        </p>
      </div>

      {/* Two-row marquee like Inkdrop's masonry */}
      <Marquee pauseOnHover className="[--duration:40s] mb-4">
        {firstRow.map(review => (
          <ReviewCard key={review.name} {...review} />
        ))}
      </Marquee>

      <Marquee pauseOnHover reverse className="[--duration:40s]">
        {secondRow.map(review => (
          <ReviewCard key={review.name} {...review} />
        ))}
      </Marquee>
    </section>
  );
}
