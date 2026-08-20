/**
 * YAML frontmatter on notes. Templates use `instruction:` (and later `skill:`)
 * so Ask Notes and MCP can file work the way the user would.
 *
 * Only key: value and `|` / `>` blocks. Not a full YAML parser.
 */

export interface NoteFrontmatter {
  fields: Record<string, string>;
  body: string;
  hasFrontmatter: boolean;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;
const KEY = /^[A-Za-z_][\w-]*$/;
const BLOCK = /^[|>][+-]?$/;

export function parseNoteFrontmatter(content: string): NoteFrontmatter {
  const match = content.match(FENCE);
  if (!match || match[1] === undefined) {
    return { fields: {}, body: content, hasFrontmatter: false };
  }
  return {
    fields: parseSimpleYaml(match[1]),
    body: match[2] ?? '',
    hasFrontmatter: true,
  };
}

export function noteInstruction(content: string): string | null {
  return fieldOrNull(parseNoteFrontmatter(content).fields.instruction);
}

export function noteSkill(content: string): string | null {
  return fieldOrNull(parseNoteFrontmatter(content).fields.skill);
}

/** Keep instruction/skill from a template and use `body` as the new note. */
export function applyTemplateFrontmatter(templateContent: string, body: string): string {
  const source = parseNoteFrontmatter(templateContent);
  const instruction = source.fields.instruction;
  const skill = source.fields.skill;
  if (!instruction && !skill) return body;

  const dest = parseNoteFrontmatter(body);
  const fields = { ...dest.fields };
  if (instruction) fields.instruction = instruction;
  if (skill) fields.skill = skill;
  return serializeFrontmatter(fields, dest.hasFrontmatter ? dest.body : body);
}

export function serializeFrontmatter(fields: Record<string, string>, body: string): string {
  const keys = Object.keys(fields);
  if (keys.length === 0) return body;
  const yaml = keys
    .map(key => {
      const value = fields[key] ?? '';
      if (value.includes('\n')) {
        const indented = value
          .split('\n')
          .map(line => `  ${line}`)
          .join('\n');
        return `${key}: |\n${indented}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');
  const rest = body.replace(/^\r?\n/, '');
  return `---\n${yaml}\n---\n${rest}`;
}

function fieldOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseSimpleYaml(yaml: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    i += 1;
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    if (!KEY.test(key)) continue;
    const raw = line.slice(colon + 1).trim();
    if (BLOCK.test(raw)) {
      const block: string[] = [];
      while (i < lines.length) {
        const next = lines[i] ?? '';
        if (next.trim() === '') {
          block.push('');
          i += 1;
          continue;
        }
        if (/^\s/.test(next)) {
          block.push(next.replace(/^\s+/, ''));
          i += 1;
          continue;
        }
        break;
      }
      fields[key] = block.join('\n').trim();
      continue;
    }
    fields[key] = unquoteYaml(raw);
  }
  return fields;
}

function unquoteYaml(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
