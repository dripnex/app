/** Pre-filled command to auto-execute on mount (ai:summarize, ai:rewrite, ai:tweet). */
export interface AiInitialCommand {
  systemPrompt: string;
  userPrompt: string;
  outputTarget: 'replace' | 'insert' | 'panel';
}

export type ToolCallStatus =
  | 'pending_confirmation'
  | 'executing'
  | 'complete'
  | 'rejected'
  | 'error';

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: { ok: boolean; content: string; error?: string };
}

export interface AiCitation {
  id: string;
  title: string;
  heading?: string | null;
}
