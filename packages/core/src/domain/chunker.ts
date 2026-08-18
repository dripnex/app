/**
 * Markdown-aware note chunker. Pure: never mutates the input, no I/O.
 * Used by the local embeddings index — the user's markdown stays the source.
 */

export const DEFAULT_CHUNK_MAX_TOKENS = 400;
export const DEFAULT_CHUNK_OVERLAP_TOKENS = 50;

export interface MarkdownChunk {
  index: number;
  content: string;
  tokenCount: number;
  heading: string | null;
}

export interface ChunkMarkdownOptions {
  /** Soft max size of a chunk. Oversized fenced code stays unsplit. */
  maxTokens?: number;
  /** Suffix of the previous chunk prepended to the next (not the first). */
  overlapTokens?: number;
}

interface Block {
  text: string;
  heading: string | null;
  atomic: boolean;
}

/** Same estimator as ai-core (`ceil(len/4)`). Kept here so core stays free of ai-core. */
export function estimateChunkTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function chunkMarkdown(
  markdown: string,
  options: ChunkMarkdownOptions = {}
): MarkdownChunk[] {
  const maxTokens = options.maxTokens ?? DEFAULT_CHUNK_MAX_TOKENS;
  const overlapTokens = Math.min(
    options.overlapTokens ?? DEFAULT_CHUNK_OVERLAP_TOKENS,
    Math.max(0, maxTokens)
  );

  if (!markdown.trim() || maxTokens <= 0) return [];

  const packed = packBlocks(splitMarkdownBlocks(markdown), maxTokens);
  if (packed.length === 0) return [];

  const chunks: MarkdownChunk[] = [];
  let previous = '';

  for (const part of packed) {
    const overlap = chunks.length === 0 ? '' : overlapSuffix(previous, overlapTokens);
    const content = overlap ? `${overlap}\n\n${part.text}` : part.text;
    chunks.push({
      index: chunks.length,
      content,
      tokenCount: estimateChunkTokens(content),
      heading: part.heading,
    });
    previous = part.text;
  }

  return chunks;
}

function splitMarkdownBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let current: string[] = [];
  let heading: string | null = null;
  let inFence = false;
  let fenceMarker = '';

  const flush = (atomic: boolean) => {
    const text = current.join('\n').trimEnd();
    current = [];
    if (!text.trim()) return;
    blocks.push({ text, heading, atomic });
  };

  for (const line of lines) {
    const fence = line.match(/^(`{3,}|~{3,})/);
    if (inFence) {
      current.push(line);
      if (fence && line.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = '';
        flush(true);
      }
      continue;
    }
    if (fence) {
      flush(false);
      inFence = true;
      fenceMarker = fence[1] ?? '```';
      current = [line];
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      flush(false);
      heading = (headingMatch[2] ?? '').trim() || null;
      current = [line];
      continue;
    }

    if (line.trim() === '') {
      flush(false);
      continue;
    }

    current.push(line);
  }

  if (inFence) flush(true);
  else flush(false);

  return blocks;
}

function packBlocks(
  blocks: Block[],
  maxTokens: number
): Array<{ text: string; heading: string | null }> {
  const packed: Array<{ text: string; heading: string | null }> = [];
  let acc: string[] = [];
  let accTokens = 0;
  let accHeading: string | null = null;

  const flushAcc = () => {
    if (acc.length === 0) return;
    packed.push({ text: acc.join('\n\n'), heading: accHeading });
    acc = [];
    accTokens = 0;
    accHeading = null;
  };

  for (const block of blocks) {
    const pieces = splitOversized(block, maxTokens);
    for (const piece of pieces) {
      const tokens = estimateChunkTokens(piece.text);
      if (acc.length > 0 && accTokens + tokens > maxTokens) flushAcc();
      if (acc.length === 0) accHeading = piece.heading;
      acc.push(piece.text);
      accTokens += tokens;
    }
  }

  flushAcc();
  return packed;
}

function splitOversized(block: Block, maxTokens: number): Block[] {
  if (block.atomic || estimateChunkTokens(block.text) <= maxTokens) return [block];

  const sentences = block.text.split(/(?<=[.!?])\s+/).filter(part => part.length > 0);
  const parts: Block[] = [];
  let acc: string[] = [];
  let accTokens = 0;

  const flush = () => {
    if (acc.length === 0) return;
    parts.push({ text: acc.join(' '), heading: block.heading, atomic: false });
    acc = [];
    accTokens = 0;
  };

  for (const sentence of sentences) {
    const tokens = estimateChunkTokens(sentence);
    if (tokens > maxTokens) {
      flush();
      for (const wordChunk of splitByWords(sentence, maxTokens)) {
        parts.push({ text: wordChunk, heading: block.heading, atomic: false });
      }
      continue;
    }
    if (acc.length > 0 && accTokens + tokens > maxTokens) flush();
    acc.push(sentence);
    accTokens += tokens;
  }

  flush();
  return parts.length > 0 ? parts : [block];
}

function splitByWords(text: string, maxTokens: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let acc: string[] = [];

  for (const word of words) {
    const next = acc.length === 0 ? word : `${acc.join(' ')} ${word}`;
    const tokens = estimateChunkTokens(next);
    if (acc.length > 0 && tokens > maxTokens) {
      parts.push(acc.join(' '));
      acc = [word];
      continue;
    }
    acc.push(word);
  }

  if (acc.length > 0) parts.push(acc.join(' '));
  return parts.length > 0 ? parts : [text];
}

function overlapSuffix(text: string, tokens: number): string {
  if (tokens <= 0) return '';
  const chars = tokens * 4;
  if (text.length <= chars) return text.trim();
  const slice = text.slice(-chars);
  const cut = slice.search(/\s/);
  return (cut > 0 ? slice.slice(cut) : slice).trim();
}
