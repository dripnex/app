export type AskNotesMatchMode = 'words' | 'meaning';

export function askNotesMatchMode(embedded: number | null | undefined): AskNotesMatchMode {
  return (embedded ?? 0) > 0 ? 'meaning' : 'words';
}

export function askNotesEmptyCopy(mode: AskNotesMatchMode): string {
  if (mode === 'meaning') {
    return 'Ask a question. Matching uses words and meaning from your notes.';
  }
  return 'Ask a question. Matching uses words in your notes until the local index has embeddings — Settings → AI.';
}

export function askNotesPlaceholder(mode: AskNotesMatchMode): string {
  return mode === 'meaning' ? 'Ask your notes a question...' : 'Search notes by words...';
}

export function askNotesWordsHint(): string {
  return 'Words only';
}

export function kbStatusLabel(
  kb: { embedded: number; pending: number } | null,
  preloadMissing: boolean
): string {
  if (preloadMissing) return 'Preload missing — restart Dripnex';
  if (!kb) return 'No passages indexed yet · Ask Notes matches words only';
  const parts = [`${kb.embedded} embedded`];
  if (kb.pending > 0) parts.push(`${kb.pending} waiting`);
  if (kb.embedded === 0) parts.push('Ask Notes matches words only');
  return parts.join(' · ');
}

export function kbIndexDescription(embedded: number): string {
  return embedded > 0
    ? 'Passages stay on this machine. Vectors never leave it.'
    : 'Passages stay on this machine. Ask Notes matches words until embeddings exist.';
}
