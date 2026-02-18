import { useState, useEffect, useMemo } from 'react';

const MARKDOWN = `# Project Notes

Welcome to the project. This document tracks our key decisions.

## Key Decisions

- Use local-first architecture
- Standard Markdown format only
- No cloud dependency

> Your files, your disk, your rules.`;

const TYPING_SPEED = 40;
const RESTART_DELAY = 2000;

function highlightMarkdown(line: string) {
  // Heading 1
  if (line.startsWith('# ')) {
    return (
      <>
        <span className="font-bold text-accent"># </span>
        <span className="font-bold text-[#f4f4f5]">{line.slice(2)}</span>
      </>
    );
  }
  // Heading 2
  if (line.startsWith('## ')) {
    return (
      <>
        <span className="font-semibold text-accent/80">## </span>
        <span className="font-semibold text-[#e4e4e7]">{line.slice(3)}</span>
      </>
    );
  }
  // List item
  if (line.startsWith('- ')) {
    return (
      <>
        <span className="text-accent/50">- </span>
        <span className="text-[#a1a1aa]">{line.slice(2)}</span>
      </>
    );
  }
  // Blockquote
  if (line.startsWith('> ')) {
    return (
      <>
        <span className="text-[#71717a]">&gt; </span>
        <span className="italic text-[#71717a]">{line.slice(2)}</span>
      </>
    );
  }
  // Empty line
  if (line === '') {
    return <span>&nbsp;</span>;
  }
  // Plain text
  return <span className="text-[#a1a1aa]">{line}</span>;
}

interface PreviewSection {
  type: 'h1' | 'h2' | 'p' | 'li' | 'blockquote' | 'blank';
  text: string;
}

function parsePreview(lines: string[]): PreviewSection[] {
  const sections: PreviewSection[] = [];
  for (const line of lines) {
    if (line.startsWith('# ')) {
      sections.push({ type: 'h1', text: line.slice(2) });
    } else if (line.startsWith('## ')) {
      sections.push({ type: 'h2', text: line.slice(3) });
    } else if (line.startsWith('- ')) {
      sections.push({ type: 'li', text: line.slice(2) });
    } else if (line.startsWith('> ')) {
      sections.push({ type: 'blockquote', text: line.slice(2) });
    } else if (line === '') {
      sections.push({ type: 'blank', text: '' });
    } else {
      sections.push({ type: 'p', text: line });
    }
  }
  return sections;
}

function renderPreview(sections: PreviewSection[]) {
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`ul-${elements.length}`}
          className="text-[10px] sm:text-xs text-[#a1a1aa] space-y-1 pl-4 list-disc marker:text-accent/40"
        >
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (const section of sections) {
    if (section.type === 'li') {
      listItems.push(section.text);
      continue;
    }
    flushList();

    switch (section.type) {
      case 'h1':
        elements.push(
          <h3
            key={`h1-${elements.length}`}
            className="text-sm sm:text-base font-bold text-[#f4f4f5]"
          >
            {section.text}
          </h3>
        );
        break;
      case 'h2':
        elements.push(
          <h4
            key={`h2-${elements.length}`}
            className="text-xs sm:text-sm font-semibold text-[#e4e4e7]"
          >
            {section.text}
          </h4>
        );
        break;
      case 'p':
        elements.push(
          <p
            key={`p-${elements.length}`}
            className="text-[10px] sm:text-xs leading-relaxed text-[#a1a1aa]"
          >
            {section.text}
          </p>
        );
        break;
      case 'blockquote':
        elements.push(
          <blockquote
            key={`bq-${elements.length}`}
            className="border-l-2 border-accent/40 pl-3 text-[10px] sm:text-xs italic text-[#71717a]"
          >
            {section.text}
          </blockquote>
        );
        break;
      case 'blank':
        // skip blank lines in preview
        break;
    }
  }
  flushList();

  return elements;
}

export default function TypewriterDemo() {
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const totalChars = MARKDOWN.length;

    if (charIndex <= totalChars) {
      const timer = setTimeout(
        () => setCharIndex((prev) => prev + 1),
        TYPING_SPEED
      );
      return () => clearTimeout(timer);
    }

    // Finished typing, pause then restart
    const restartTimer = setTimeout(() => setCharIndex(0), RESTART_DELAY);
    return () => clearTimeout(restartTimer);
  }, [charIndex]);

  const visibleText = MARKDOWN.slice(0, charIndex);
  const visibleLines = visibleText.split('\n');

  const previewSections = useMemo(() => parsePreview(visibleLines), [visibleText]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface">
      {/* Window chrome */}
      <div className="flex items-center gap-4 border-b border-white/[0.06] bg-[#0f0f10] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-xs text-[#71717a]">
          notes.md — Readied
        </span>
      </div>

      {/* Editor split */}
      <div className="grid grid-cols-2 min-h-[320px] sm:min-h-[380px]">
        {/* Left: markdown source */}
        <div className="border-r border-white/[0.06] p-4 sm:p-6 font-mono text-[10px] sm:text-xs leading-relaxed overflow-hidden">
          <div className="flex items-center gap-3 mb-3 pb-2 border-b border-white/[0.06]">
            <span className="text-[9px] font-semibold text-accent uppercase tracking-wider">
              Edit
            </span>
            <span className="text-[9px] text-[#71717a] uppercase tracking-wider">
              Preview
            </span>
          </div>
          <div className="space-y-0.5">
            {visibleLines.map((line, i) => (
              <div key={i}>{highlightMarkdown(line)}</div>
            ))}
          </div>
          {/* Blinking cursor */}
          <div className="mt-0.5 inline-block h-3.5 w-0.5 rounded-sm bg-accent animate-pulse" />
        </div>

        {/* Right: rendered preview */}
        <div className="p-4 sm:p-6 bg-[#09090b]/50 overflow-hidden">
          <div className="space-y-3">{renderPreview(previewSections)}</div>
        </div>
      </div>
    </div>
  );
}
