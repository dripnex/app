// packages/ai-core/tests/context-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildContext, estimateTokens, estimateMessageTokens } from '../src/context-builder';
import type { ChatMessage } from '../src/types';

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('hello world')).toBe(3); // 11 chars / 4 = 2.75 → 3
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('estimateMessageTokens', () => {
  it('handles string content', () => {
    expect(estimateMessageTokens('hello world')).toBe(3);
  });

  it('handles ContentPart array with text', () => {
    expect(estimateMessageTokens([{ type: 'text', text: 'hello world' }])).toBe(3);
  });

  it('handles image parts with fixed estimate', () => {
    expect(
      estimateMessageTokens([
        { type: 'text', text: 'hi' },
        { type: 'image', url: 'data:...' },
      ])
    ).toBe(1 + 1000); // 1 token for "hi" + 1000 for image
  });

  it('counts tool_use and tool_result parts', () => {
    const tokens = estimateMessageTokens([
      { type: 'tool_use', id: '1', name: 'search_notes', input: { query: 'hello' } },
      { type: 'tool_result', tool_use_id: '1', content: 'found two notes' },
    ]);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe('buildContext', () => {
  const systemPrompt = 'You are a helpful assistant.';

  it('includes system prompt always', () => {
    const result = buildContext(
      { systemPrompt, history: [], relevantNotes: [] },
      { maxContextTokens: 1000, maxResponseTokens: 100 }
    );
    expect(result.system).toContain(systemPrompt);
    expect(result.truncated).toBe(false);
  });

  it('includes current note in system prompt', () => {
    const result = buildContext(
      {
        systemPrompt,
        currentNote: { id: '1', title: 'Test Note', content: 'Some content here' },
        history: [],
        relevantNotes: [],
      },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.system).toContain('Test Note');
    expect(result.system).toContain('Some content here');
  });

  it('surfaces instruction: from the current note', () => {
    const result = buildContext(
      {
        systemPrompt,
        currentNote: {
          id: '1',
          title: 'Meeting',
          content: '---\ninstruction: Capture attendees and next actions.\n---\n# Meeting\n',
        },
        history: [],
        relevantNotes: [],
      },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.system).toContain('Template instruction for the current note:');
    expect(result.system).toContain('Capture attendees and next actions.');
  });

  it('includes conversation history newest-first priority', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'first message' },
      { role: 'assistant', content: 'first reply' },
      { role: 'user', content: 'second message' },
      { role: 'assistant', content: 'second reply' },
    ];
    const result = buildContext(
      { systemPrompt, history, relevantNotes: [] },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.messages).toHaveLength(4);
  });

  it('drops oldest history messages when budget exceeded', () => {
    const longMsg = 'x'.repeat(400); // ~100 tokens each
    const history: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: longMsg,
    }));
    const result = buildContext(
      { systemPrompt, history, relevantNotes: [] },
      { maxContextTokens: 500, maxResponseTokens: 100 } // only ~400 tokens available
    );
    expect(result.messages.length).toBeLessThan(20);
    expect(result.truncated).toBe(true);
    // Newest messages should be kept
    expect(result.messages[result.messages.length - 1]?.content).toBe(longMsg);
  });

  it('includes relevant notes filling remaining budget', () => {
    const result = buildContext(
      {
        systemPrompt,
        history: [],
        relevantNotes: [
          { id: '1', title: 'Note A', content: 'Content A' },
          { id: '2', title: 'Note B', content: 'Content B' },
        ],
      },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.system).toContain('Note A');
    expect(result.system).toContain('Note B');
    expect(result.notesIncluded).toBe(2);
    expect(result.citations).toHaveLength(2);
  });

  it('packs higher-score passages first and labels headings', () => {
    const result = buildContext(
      {
        systemPrompt,
        history: [],
        relevantNotes: [
          { id: '1', title: 'Alpha', content: 'low', heading: 'Intro', score: 1 },
          { id: '2', title: 'Beta', content: 'high', heading: 'Recipe', score: 9 },
        ],
      },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.system.indexOf('Beta › Recipe')).toBeLessThan(
      result.system.indexOf('Alpha › Intro')
    );
    expect(result.system).toContain('Source [1]: "Beta › Recipe"');
    expect(result.system).toContain('Source [2]: "Alpha › Intro"');
    expect(result.citations[0]).toMatchObject({ id: '2', title: 'Beta', heading: 'Recipe' });
  });

  it('drops notes that exceed budget', () => {
    const hugeContent = 'x'.repeat(40000); // ~10K tokens
    const result = buildContext(
      {
        systemPrompt,
        history: [],
        relevantNotes: [
          { id: '1', title: 'Small', content: 'small' },
          { id: '2', title: 'Huge', content: hugeContent },
        ],
      },
      { maxContextTokens: 500, maxResponseTokens: 100 }
    );
    expect(result.notesIncluded).toBe(1);
    expect(result.system).toContain('Small');
    expect(result.truncated).toBe(true);
  });

  it('returns token estimate', () => {
    const result = buildContext(
      { systemPrompt, history: [], relevantNotes: [] },
      { maxContextTokens: 10000, maxResponseTokens: 100 }
    );
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('reserves query tokens against the budget', () => {
    const hugeQuery = 'q'.repeat(800); // ~200 tokens
    const result = buildContext(
      {
        systemPrompt,
        history: [],
        relevantNotes: [{ id: '1', title: 'Note', content: 'x'.repeat(4000) }],
        query: hugeQuery,
      },
      { maxContextTokens: 400, maxResponseTokens: 100 }
    );
    expect(result.tokenEstimate).toBeLessThanOrEqual(300);
    expect(result.truncated).toBe(true);
  });
});
