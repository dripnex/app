/**
 * AI Command Definition — the core type for custom AI commands.
 *
 * Plugins and users can define custom AI commands that take the current
 * selection and/or note context and send a templated prompt to the AI.
 *
 * Templates support these placeholders:
 *   {{selection}} — the currently selected text in the editor
 *   {{note}}      — the full content of the current note
 *   {{title}}     — the title of the current note
 */

/** A single AI command that can be registered by plugins or imported from presets */
export interface AiCommandDefinition {
  /** Unique identifier (e.g. "my-plugin:fix-grammar"). Must be alphanumeric + hyphens/colons. */
  id: string;

  /** Human-readable name shown in the command palette (e.g. "Fix Grammar") */
  name: string;

  /** Optional description for tooltips / help text */
  description?: string;

  /** System prompt that sets the AI's behavior for this command */
  systemPrompt: string;

  /**
   * User prompt template. Supports placeholders:
   * - {{selection}} — replaced with editor selection
   * - {{note}} — replaced with full note content
   * - {{title}} — replaced with note title
   */
  userPromptTemplate: string;

  /** Lucide icon name (e.g. "Wand2", "CheckCircle"). Optional. */
  icon?: string;

  /** Where to put the AI response: 'replace' selection, 'insert' at cursor, or 'panel' (chat). Default: 'panel' */
  outputTarget?: 'replace' | 'insert' | 'panel';

  /** Optional category tag for organizing commands (e.g. "writing", "coding", "research") */
  category?: string;
}

/** A shareable collection of AI commands */
export interface AiCommandPreset {
  /** Preset display name */
  name: string;

  /** Preset description */
  description?: string;

  /** Author name */
  author?: string;

  /** Semantic version of the preset (e.g. "1.0.0") */
  version: string;

  /** The commands in this preset */
  commands: AiCommandDefinition[];
}

/** Valid placeholder names for AI command templates */
export const AI_TEMPLATE_PLACEHOLDERS = ['selection', 'note', 'title'] as const;
export type AiTemplatePlaceholder = (typeof AI_TEMPLATE_PLACEHOLDERS)[number];

/** Regex to match template placeholders */
const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

/**
 * Resolve a user prompt template by replacing placeholders with actual values.
 */
export function resolveTemplate(
  template: string,
  context: {
    selection?: string;
    note?: string;
    title?: string;
  }
): string {
  return template.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    switch (key) {
      case 'selection':
        return context.selection ?? '';
      case 'note':
        return context.note ?? '';
      case 'title':
        return context.title ?? '';
      default:
        return match; // Leave unknown placeholders as-is
    }
  });
}

/** Validation errors for AI command definitions */
export interface AiCommandValidationError {
  field: string;
  message: string;
}

/** Validate a single AI command definition. Returns an array of errors (empty = valid). */
export function validateAiCommandDefinition(cmd: unknown): AiCommandValidationError[] {
  const errors: AiCommandValidationError[] = [];

  if (!cmd || typeof cmd !== 'object') {
    return [{ field: 'root', message: 'AI command definition must be an object' }];
  }

  const def = cmd as Record<string, unknown>;

  if (typeof def.id !== 'string' || def.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'id is required and must be a non-empty string' });
  } else if (!/^[\w:.-]+$/.test(def.id)) {
    errors.push({
      field: 'id',
      message: 'id must contain only alphanumeric characters, hyphens, dots, and colons',
    });
  }

  if (typeof def.name !== 'string' || def.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name is required and must be a non-empty string' });
  }

  if (typeof def.systemPrompt !== 'string' || def.systemPrompt.trim().length === 0) {
    errors.push({
      field: 'systemPrompt',
      message: 'systemPrompt is required and must be a non-empty string',
    });
  }

  if (typeof def.userPromptTemplate !== 'string' || def.userPromptTemplate.trim().length === 0) {
    errors.push({
      field: 'userPromptTemplate',
      message: 'userPromptTemplate is required and must be a non-empty string',
    });
  }

  if (def.icon !== undefined && typeof def.icon !== 'string') {
    errors.push({ field: 'icon', message: 'icon must be a string if provided' });
  }

  if (
    def.outputTarget !== undefined &&
    !['replace', 'insert', 'panel'].includes(def.outputTarget as string)
  ) {
    errors.push({
      field: 'outputTarget',
      message: 'outputTarget must be "replace", "insert", or "panel"',
    });
  }

  if (def.description !== undefined && typeof def.description !== 'string') {
    errors.push({ field: 'description', message: 'description must be a string if provided' });
  }

  if (def.category !== undefined && typeof def.category !== 'string') {
    errors.push({ field: 'category', message: 'category must be a string if provided' });
  }

  return errors;
}

/** Validate a full AI command preset file. Returns an array of errors (empty = valid). */
export function validateAiCommandPreset(data: unknown): AiCommandValidationError[] {
  const errors: AiCommandValidationError[] = [];

  if (!data || typeof data !== 'object') {
    return [{ field: 'root', message: 'Preset must be an object' }];
  }

  const preset = data as Record<string, unknown>;

  if (typeof preset.name !== 'string' || preset.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Preset name is required' });
  }

  if (typeof preset.version !== 'string' || preset.version.trim().length === 0) {
    errors.push({ field: 'version', message: 'Preset version is required' });
  }

  if (!Array.isArray(preset.commands)) {
    errors.push({ field: 'commands', message: 'commands must be an array' });
    return errors;
  }

  if (preset.commands.length === 0) {
    errors.push({ field: 'commands', message: 'commands array must not be empty' });
  }

  for (let i = 0; i < preset.commands.length; i++) {
    const cmdErrors = validateAiCommandDefinition(preset.commands[i]);
    for (const err of cmdErrors) {
      errors.push({
        field: `commands[${i}].${err.field}`,
        message: err.message,
      });
    }
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  for (const cmd of preset.commands) {
    if (cmd && typeof cmd === 'object' && typeof (cmd as Record<string, unknown>).id === 'string') {
      const id = (cmd as Record<string, unknown>).id as string;
      if (ids.has(id)) {
        errors.push({ field: 'commands', message: `Duplicate command id: "${id}"` });
      }
      ids.add(id);
    }
  }

  return errors;
}

/**
 * Serialize an array of AI command definitions into a preset JSON string.
 */
export function serializePreset(preset: AiCommandPreset): string {
  return JSON.stringify(preset, null, 2);
}

/**
 * Parse a preset from a JSON string. Returns the preset or throws on invalid JSON.
 * Use validateAiCommandPreset() to validate the parsed object.
 */
export function parsePreset(json: string): unknown {
  return JSON.parse(json);
}
