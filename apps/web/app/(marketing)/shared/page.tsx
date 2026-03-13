import { Suspense } from 'react';
import type { Metadata } from 'next';
import SharedNoteContent from './SharedNoteContent';

export const metadata: Metadata = {
  title: 'Shared Note — Readied',
  description: 'A note shared via Readied.',
};

export default function SharedNotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-8 h-8 border-[3px] border-white/6 border-t-accent rounded-full animate-spin" />
          <p className="text-[#a1a1aa]">Loading note...</p>
        </div>
      }
    >
      <SharedNoteContent />
    </Suspense>
  );
}
