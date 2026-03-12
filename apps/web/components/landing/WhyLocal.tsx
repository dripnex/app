'use client';

import React, { forwardRef, useRef } from 'react';
import {
  FolderOpen,
  FileText,
  Check,
  X,
  WifiOff,
  Lock,
  CloudOff,
  Terminal,
  HardDrive,
  Pen,
  FolderClosed,
} from 'lucide-react';
import { AnimatedBeam } from '@/components/magicui/animated-beam';
import { BorderBeam } from '@/components/magicui/border-beam';
import { cn } from '@/lib/utils';

/* ─── Comparison table ─── */

type Row = { label: string; readied: boolean | string; cloud: boolean | string };

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
  const label = value ? 'Yes' : 'No';
  if (value) {
    return positive ? (
      <>
        <Check className="h-4 w-4 text-accent mx-auto" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </>
    ) : (
      <>
        <Check className="h-4 w-4 text-text-muted mx-auto" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </>
    );
  }
  return positive ? (
    <>
      <X className="h-4 w-4 text-text-muted mx-auto" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  ) : (
    <>
      <X className="h-4 w-4 text-accent mx-auto" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  );
}

/* ─── Bento card ─── */

function BentoCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-surface p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ─── Circle node (matches official Magic UI pattern) ─── */

const Circle = forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
  ({ className, children }, ref) => (
    <div
      ref={ref}
      className={cn(
        'z-10 flex size-12 items-center justify-center rounded-full border-2 border-border bg-surface-elevated p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]',
        className
      )}
    >
      {children}
    </div>
  )
);
Circle.displayName = 'Circle';

/* ─── Data flow: You → Readied → local .md files ─── */

function DataFlowDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const file1Ref = useRef<HTMLDivElement>(null);
  const file2Ref = useRef<HTMLDivElement>(null);
  const file3Ref = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative flex h-[300px] w-full items-center justify-center overflow-hidden p-10"
    >
      <div className="flex size-full max-w-lg flex-row items-stretch justify-between gap-10">
        {/* Left: You */}
        <div className="flex flex-col justify-center">
          <Circle ref={userRef}>
            <Pen className="h-5 w-5 text-text-secondary" />
          </Circle>
        </div>

        {/* Center: Readied */}
        <div className="flex flex-col justify-center">
          <Circle ref={centerRef} className="size-16 border-accent/30 bg-accent/10">
            <span className="font-mono text-sm font-bold text-accent">R</span>
          </Circle>
        </div>

        {/* Right: Local files */}
        <div className="flex flex-col justify-center gap-2">
          <Circle ref={file1Ref}>
            <FileText className="h-5 w-5 text-text-muted" />
          </Circle>
          <Circle ref={file2Ref}>
            <FileText className="h-5 w-5 text-text-muted" />
          </Circle>
          <Circle ref={file3Ref}>
            <FolderClosed className="h-5 w-5 text-text-muted" />
          </Circle>
          <Circle ref={folderRef}>
            <HardDrive className="h-5 w-5 text-text-muted" />
          </Circle>
        </div>
      </div>

      {/* You → Readied */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={userRef}
        toRef={centerRef}
        gradientStartColor="#8b5cf6"
        gradientStopColor="#6d28d9"
        duration={3}
      />

      {/* Readied → files */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={file1Ref}
        gradientStartColor="#8b5cf6"
        gradientStopColor="#6d28d9"
        duration={3}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={file2Ref}
        gradientStartColor="#8b5cf6"
        gradientStopColor="#6d28d9"
        duration={3}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={file3Ref}
        gradientStartColor="#8b5cf6"
        gradientStopColor="#6d28d9"
        duration={3}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={centerRef}
        toRef={folderRef}
        gradientStartColor="#8b5cf6"
        gradientStopColor="#6d28d9"
        duration={3}
      />
    </div>
  );
}

/* ─── Main section ─── */

export default function WhyLocal() {
  return (
    <section className="py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-label">Why Local</span>
          <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl mb-4">
            Your notes should live on <span className="text-accent">your machine</span>
            {' — '}not someone else&apos;s server.
          </h2>
          <p className="mx-auto max-w-xl text-text-secondary">
            Cloud note apps hold your data hostage. Readied takes a different approach: everything
            is local, everything is Markdown, everything is yours.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Row 1: Data flow diagram (span 2) + Offline card */}
          <BentoCard className="md:col-span-2 p-0">
            <div className="px-6 pt-6">
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                Your data never leaves
              </h3>
              <p className="text-xs text-text-muted">
                You write → Readied saves → plain .md files on your disk. No cloud.
              </p>
            </div>
            <DataFlowDiagram />
          </BentoCard>

          <BentoCard className="flex flex-col justify-between">
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <WifiOff className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold text-text-primary mb-1">No internet required</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Everything runs locally. Write on a plane, in a cabin, anywhere.
              </p>
            </div>
          </BentoCard>

          {/* Row 2: Three feature cards */}
          <BentoCard>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Lock className="h-5 w-5 text-accent" />
            </div>
            <h3 className="font-semibold text-text-primary mb-1">Your data stays yours</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Notes live in plain .md files on your filesystem. No cloud sync, no telemetry.
            </p>
          </BentoCard>

          <BentoCard>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <CloudOff className="h-5 w-5 text-accent" />
            </div>
            <h3 className="font-semibold text-text-primary mb-1">No vendor lock-in</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Standard Markdown. Open your files with any editor, any time.
            </p>
          </BentoCard>

          <BentoCard>
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Terminal className="h-5 w-5 text-accent" />
            </div>
            <h3 className="font-semibold text-text-primary mb-1">Open source</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Every line of code is on GitHub. Audit it, fork it, contribute.
            </p>
          </BentoCard>

          {/* Row 3: Comparison table (span 2) + File tree */}
          <BentoCard className="relative md:col-span-2 p-0">
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
            <BorderBeam size={150} duration={10} colorFrom="#8b5cf6" colorTo="#6d28d9" />
          </BentoCard>

          <BentoCard className="p-5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent mb-3 block">
              On your disk
            </span>
            <div className="font-mono text-xs text-text-muted space-y-1">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-accent" />
                <span className="text-text-primary">~/notes/</span>
              </div>
              <div className="flex items-center gap-2 pl-5">
                <FileText className="h-3 w-3 text-text-muted" />
                <span>meeting-notes.md</span>
                <span className="text-[10px] text-text-muted/50 ml-auto">1.2 KB</span>
              </div>
              <div className="flex items-center gap-2 pl-5">
                <FileText className="h-3 w-3 text-text-muted" />
                <span>project-plan.md</span>
                <span className="text-[10px] text-text-muted/50 ml-auto">3.4 KB</span>
              </div>
              <div className="flex items-center gap-2 pl-5">
                <FileText className="h-3 w-3 text-text-muted" />
                <span>ideas.md</span>
                <span className="text-[10px] text-text-muted/50 ml-auto">0.8 KB</span>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-text-muted/60 italic">
              Plain .md files. Open with any editor.
            </p>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
