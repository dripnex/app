import { Code, PenTool, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const audiences = [
  {
    icon: Code,
    title: 'Developers',
    description:
      'Keep technical notes, code snippets, and project docs in Markdown — the format you already know.',
  },
  {
    icon: PenTool,
    title: 'Writers',
    description:
      'Distraction-free writing that works offline. Your drafts stay local until you decide otherwise.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy Advocates',
    description:
      'No telemetry, no cloud requirement, no tracking. Your notes never leave your machine.',
  },
];

export default function Audience() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl text-center">
        <span className="section-label">Built For</span>
        <h2 className="section-heading">Made for people who care about their notes</h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {audiences.map(audience => (
            <Card
              key={audience.title}
              className="animate-fade-in-up p-6 text-left opacity-0 sm:p-8"
            >
              <CardContent className="p-0">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <audience.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-primary">{audience.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {audience.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
