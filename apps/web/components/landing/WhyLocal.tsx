'use client';

import { FolderOpen, FileText, Check, X } from 'lucide-react';
import { TextReveal } from '@/components/magicui/text-reveal';
import { Card, CardContent } from '@/components/ui/card';

type Row = {
  label: string;
  readied: boolean | string;
  cloud: boolean | string;
};

const rows: Row[] = [
  { label: 'Data Location', readied: 'Your machine', cloud: 'Their servers' },
  { label: 'Works Offline', readied: true, cloud: false },
  { label: 'Export Anytime', readied: true, cloud: 'Maybe' },
  { label: 'Open Source', readied: true, cloud: false },
  { label: 'Vendor Lock-in', readied: false, cloud: true },
];

function CellValue({ value, positive }: { value: boolean | string; positive: boolean }) {
  if (typeof value === 'string') {
    return (
      <span className={positive ? 'text-accent font-medium' : 'text-text-muted'}>{value}</span>
    );
  }
  if (value) {
    return positive ? (
      <Check className="h-4 w-4 text-accent mx-auto" />
    ) : (
      <Check className="h-4 w-4 text-text-muted mx-auto" />
    );
  }
  return positive ? (
    <X className="h-4 w-4 text-text-muted mx-auto" />
  ) : (
    <X className="h-4 w-4 text-accent mx-auto" />
  );
}

export default function WhyLocal() {
  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section label */}
        <span className="section-label">Why Local</span>

        {/* TextReveal heading — scroll-based word reveal */}
        <TextReveal>Your notes should live on your machine not someone else's server</TextReveal>

        {/* Comparison card */}
        <div className="max-w-2xl mx-auto">
          <Card className="p-0 overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-left text-text-muted font-medium">Feature</th>
                    <th className="p-4 text-center text-accent font-semibold">Readied</th>
                    <th className="p-4 text-center text-text-muted font-medium">Cloud Apps</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <td className="p-4 text-text-secondary">{row.label}</td>
                      <td className="p-4 text-center">
                        <CellValue value={row.readied} positive />
                      </td>
                      <td className="p-4 text-center">
                        <CellValue value={row.cloud} positive={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Navigation demo */}
        <div className="mt-12">
          <img
            src="/media/demo-navigation.svg"
            alt="Quick-open navigation between notes"
            className="w-full max-w-3xl mx-auto rounded-xl border border-white/[0.06]"
            width={800}
            height={500}
            loading="lazy"
          />
          <p className="text-center text-sm text-[#71717a] mt-3">
            Quick-open: jump between notes with Cmd+P
          </p>
        </div>

        {/* Visual: file format proof */}
        <div className="mt-10 rounded-xl bg-surface overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left: what you write */}
            <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/[0.06]">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                  What you write
                </span>
              </div>
              <div className="font-mono text-xs sm:text-sm leading-relaxed text-[#a1a1aa] space-y-1 bg-inset rounded-lg p-4 border border-white/[0.06]">
                <div>
                  <span className="text-accent font-bold"># </span>
                  <span className="text-[#f4f4f5] font-bold">Meeting Notes</span>
                </div>
                <div className="h-1" />
                <div>
                  <span className="text-accent/50">- </span>Decided on local-first architecture
                </div>
                <div>
                  <span className="text-accent/50">- </span>Launch timeline: Q2 2026
                </div>
                <div>
                  <span className="text-accent/50">- </span>Next step: prototype by Friday
                </div>
              </div>
            </div>

            {/* Right: what's on disk */}
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                  What&apos;s on your disk
                </span>
              </div>
              <div className="font-mono text-xs sm:text-sm text-[#a1a1aa] space-y-0.5 bg-inset rounded-lg p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-accent" />
                  <span className="text-[#f4f4f5]">~/notes/</span>
                </div>
                <div className="flex items-center gap-2 pl-5">
                  <FileText className="h-3.5 w-3.5 text-[#71717a]" />
                  <span>meeting-notes.md</span>
                  <span className="text-[10px] text-[#71717a] ml-auto">1.2 KB</span>
                </div>
                <div className="flex items-center gap-2 pl-5">
                  <FileText className="h-3.5 w-3.5 text-[#71717a]" />
                  <span>project-plan.md</span>
                  <span className="text-[10px] text-[#71717a] ml-auto">3.4 KB</span>
                </div>
                <div className="flex items-center gap-2 pl-5">
                  <FileText className="h-3.5 w-3.5 text-[#71717a]" />
                  <span>ideas.md</span>
                  <span className="text-[10px] text-[#71717a] ml-auto">0.8 KB</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#71717a] italic">
                Plain .md files. Open with any editor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
