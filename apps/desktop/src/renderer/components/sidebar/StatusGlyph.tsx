import type { NoteStatus } from '../../../preload/index';

const glyphs: Record<NoteStatus, { fill: string; path: string }> = {
  active: {
    fill: 'var(--status-active)',
    path: 'M9.6 7.6v8.8c0 .5.5.8 1 .5l7-4.4a.6.6 0 0 0 0-1l-7-4.4a.6.6 0 0 0-1 .5z',
  },
  on_hold: {
    fill: 'var(--status-on-hold)',
    path: 'M8.6 7.4h2.2v9.2H8.6zm4.6 0h2.2v9.2h-2.2z',
  },
  completed: {
    fill: 'var(--status-completed)',
    path: 'M9.3 15.1 6.6 12.4l1.2-1.2 1.5 1.5 5.1-5.1 1.2 1.2z',
  },
  dropped: {
    fill: 'var(--status-dropped)',
    path: 'M8.1 8.1 9.2 7l2.8 2.8L14.8 7l1.1 1.1-2.8 2.8 2.8 2.8-1.1 1.1-2.8-2.8-2.8 2.8-1.1-1.1 2.8-2.8z',
  },
};

export function StatusGlyph({ status }: { status: NoteStatus }) {
  const glyph = glyphs[status];
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill={glyph.fill} />
      <path d={glyph.path} fill="#fff" />
    </svg>
  );
}
