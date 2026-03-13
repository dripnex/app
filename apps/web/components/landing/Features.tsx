'use client';

import { FileText, Puzzle, WifiOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { BorderBeam } from '@/components/magicui/border-beam';

const features = [
  {
    icon: FileText,
    title: 'Markdown Sacred',
    description:
      'Your markdown is never auto-modified. What you type is exactly what gets saved. No hidden transformations.',
  },
  {
    icon: Puzzle,
    title: 'Plugin Ecosystem',
    description:
      '8 built-in plugins with an extensible architecture. Load community plugins to make Readied yours.',
  },
  {
    icon: WifiOff,
    title: 'Offline First',
    description:
      'Works 100% offline by default. Optional cloud sync keeps notes across devices when you want it.',
  },
];

export default function Features() {
  return (
    <section className="relative py-24" id="features">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <header className="mb-16 text-center">
          <span className="section-label">Features</span>
          <h2 className="section-heading">Tools that get out of your way.</h2>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map(feature => (
            <Card key={feature.title} className="group relative overflow-hidden p-6 sm:p-8">
              <CardContent className="p-0">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-primary">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{feature.description}</p>
              </CardContent>
              <BorderBeam
                size={150}
                duration={8}
                colorFrom="#8b5cf6"
                colorTo="#6d28d9"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
