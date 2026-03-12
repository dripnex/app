'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface NoteData {
  title?: string;
  content?: string;
  createdAt: string;
}

const API_BASE = 'https://api.readied.app';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SharedNoteContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');
  const [state, setState] = useState<'loading' | 'error' | 'success'>('loading');
  const [note, setNote] = useState<NoteData | null>(null);
  const [errorInfo, setErrorInfo] = useState({ title: '', message: '' });

  useEffect(() => {
    if (!slug) {
      setState('error');
      setErrorInfo({ title: 'No note specified', message: 'This link appears to be incomplete.' });
      return;
    }

    async function fetchNote() {
      try {
        const res = await fetch(`${API_BASE}/share/${slug}`);

        if (!res.ok) {
          if (res.status === 404) {
            setErrorInfo({
              title: 'Note not found',
              message: 'This shared note may have been removed.',
            });
          } else {
            setErrorInfo({ title: 'Something went wrong', message: 'Please try again later.' });
          }
          setState('error');
          return;
        }

        const data = await res.json();
        setNote(data);
        setState('success');
      } catch {
        setErrorInfo({
          title: 'Connection error',
          message: 'Could not load the note. Please check your connection.',
        });
        setState('error');
      }
    }

    fetchNote();
  }, [slug]);

  if (state === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-8 h-8 border-[3px] border-white/[0.06] border-t-accent rounded-full animate-spin" />
        <p className="text-[#a1a1aa]">Loading note...</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold text-[#f4f4f5]">{errorInfo.title}</h1>
        <p className="text-[#a1a1aa]">{errorInfo.message}</p>
      </div>
    );
  }

  // Content comes from Readied's own API (shared notes rendered as markdown).
  // This matches the original Astro page which uses marked.parse() with innerHTML.
  return (
    <div className="max-w-[720px] mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-3xl font-bold text-[#f4f4f5] leading-tight tracking-tight mb-2">
        {note?.title || 'Untitled'}
      </h1>
      <div className="text-sm text-[#71717a] mb-8 pb-6 border-b border-white/[0.06]">
        Shared on {note?.createdAt ? formatDate(note.createdAt) : ''}
      </div>
      <div
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: note?.content || '' }}
      />
      <footer className="mt-12 pt-6 border-t border-white/[0.06] text-center text-sm text-[#71717a]">
        Shared with{' '}
        <a href="https://readied.app" className="text-accent hover:underline">
          Readied
        </a>
      </footer>
    </div>
  );
}
