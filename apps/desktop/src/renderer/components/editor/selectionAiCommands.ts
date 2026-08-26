/**
 * Edit with AI — selection toolbar command list.
 *
 * Built-ins are local inline edits. Plugin / init.js commands come from
 * `aiCommandStore` (filled by `registerAiCommand`).
 */

import { resolveTemplate } from '@dripnex/ai-core';
import type { AiCommandRegistration } from '@dripnex/plugin-api';

export const BUILTIN_SELECTION_AI_ACTIONS = [
  {
    id: 'mermaid',
    label: 'Create a Mermaid diagram',
    instruction: 'Convert the selection into a mermaid diagram.',
    keepFence: true,
  },
  {
    id: 'table',
    label: 'Convert to Markdown table',
    instruction: 'Convert the selection into a GitHub-flavored markdown table.',
  },
  {
    id: 'proofread',
    label: 'Proofread',
    instruction: 'Fix grammar and spelling. Keep the meaning and markdown.',
  },
  {
    id: 'reformat',
    label: 'Reformat',
    instruction: 'Clean the markdown structure. Do not change meaning.',
  },
  {
    id: 'improve',
    label: 'Improve writing',
    instruction: 'Improve clarity and rhythm. Keep the author voice and markdown.',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    instruction: 'Condense the selection into a concise summary.',
  },
  {
    id: 'bullets',
    label: 'Convert to bullet list',
    instruction: 'Rewrite the selection as a Markdown bulleted list.',
  },
  {
    id: 'tasks',
    label: 'Convert to task list',
    instruction: 'Rewrite the selection as a Markdown task list (- [ ] items).',
  },
  {
    id: 'headings',
    label: 'Add headings',
    instruction: 'Reorganize the selection with appropriate Markdown headings.',
  },
] as const;

export type BuiltinSelectionAiAction = {
  kind: 'builtin';
  id: string;
  label: string;
  instruction: string;
  keepFence?: boolean;
};

export type RegisteredSelectionAiAction = {
  kind: 'registered';
  id: string;
  label: string;
  registration: AiCommandRegistration;
};

export type SelectionAiAction = BuiltinSelectionAiAction | RegisteredSelectionAiAction;

export type EditorAiContext = {
  selection: string;
  note: string;
  title: string;
};

export function editorAiContext(note: string, from: number, to: number): EditorAiContext {
  const start = Math.max(0, Math.min(from, note.length));
  const end = Math.max(start, Math.min(to, note.length));
  const firstLine = note.split('\n')[0] ?? '';
  const title = firstLine.startsWith('# ') ? firstLine.slice(2).trim() : '';
  return {
    selection: note.slice(start, end),
    note,
    title,
  };
}

export function listSelectionAiCommands(
  registrations: readonly AiCommandRegistration[]
): SelectionAiAction[] {
  const builtins: BuiltinSelectionAiAction[] = BUILTIN_SELECTION_AI_ACTIONS.map(action => ({
    kind: 'builtin',
    id: action.id,
    label: action.label,
    instruction: action.instruction,
    keepFence: 'keepFence' in action ? action.keepFence : undefined,
  }));

  const registered: RegisteredSelectionAiAction[] = registrations.map(registration => ({
    kind: 'registered',
    id: registration.id,
    label: registration.name,
    registration,
  }));

  return [...builtins, ...registered];
}

export function selectionAiInstruction(
  action: SelectionAiAction,
  ctx: EditorAiContext
): { instruction: string; keepFence: boolean } {
  if (action.kind === 'builtin') {
    return { instruction: action.instruction, keepFence: Boolean(action.keepFence) };
  }

  const userPrompt = resolveTemplate(action.registration.userPromptTemplate, ctx);
  const parts = [action.registration.systemPrompt, userPrompt].filter(
    part => part.trim().length > 0
  );
  return { instruction: parts.join('\n\n'), keepFence: false };
}
