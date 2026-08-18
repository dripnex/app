import type { CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete';

/** Common GitHub-style shortcodes. Enough to type `:ta` and see taco / tada / taxi. */
const SHORTCODES: Array<[name: string, emoji: string]> = [
  ['+1', '👍'],
  ['-1', '👎'],
  ['smile', '😄'],
  ['laughing', '😆'],
  ['wink', '😉'],
  ['heart', '❤️'],
  ['fire', '🔥'],
  ['star', '⭐'],
  ['sparkles', '✨'],
  ['tada', '🎉'],
  ['taco', '🌮'],
  ['tangerine', '🍊'],
  ['taxi', '🚕'],
  ['tea', '🍵'],
  ['tamale', '🫔'],
  ['takeout_box', '🥡'],
  ['tanabata_tree', '🎋'],
  ['table_tennis_paddle_and_ball', '🏓'],
  ['taurus', '♉'],
  ['tram', '🚊'],
  ['santa', '🎅'],
  ['rocket', '🚀'],
  ['warning', '⚠️'],
  ['white_check_mark', '✅'],
  ['x', '❌'],
  ['bulb', '💡'],
  ['book', '📖'],
  ['memo', '📝'],
  ['link', '🔗'],
  ['lock', '🔒'],
  ['key', '🔑'],
  ['mag', '🔍'],
  ['calendar', '📅'],
  ['hourglass', '⌛'],
  ['computer', '💻'],
  ['iphone', '📱'],
  ['email', '📧'],
  ['eyes', '👀'],
  ['brain', '🧠'],
  ['speech_balloon', '💬'],
  ['thought_balloon', '💭'],
  ['zap', '⚡'],
  ['boom', '💥'],
  ['wave', '👋'],
  ['ok_hand', '👌'],
  ['clap', '👏'],
  ['pray', '🙏'],
  ['muscle', '💪'],
  ['eyes', '👀'],
  ['coffee', '☕'],
  ['beer', '🍺'],
  ['pizza', '🍕'],
  ['apple', '🍎'],
  ['sunny', '☀️'],
  ['cloud', '☁️'],
  ['umbrella', '☔'],
  ['snowflake', '❄️'],
  ['earth_americas', '🌎'],
  ['moon', '🌙'],
  ['dog', '🐶'],
  ['cat', '🐱'],
  ['bug', '🐛'],
  ['hammer', '🔨'],
  ['wrench', '🔧'],
  ['package', '📦'],
  ['file_folder', '📁'],
  ['page_facing_up', '📄'],
  ['chart_with_upwards_trend', '📈'],
  ['pushpin', '📌'],
  ['round_pushpin', '📍'],
  ['bookmark', '🔖'],
  ['inbox_tray', '📥'],
  ['outbox_tray', '📤'],
  ['pencil2', '✏️'],
  ['black_nib', '✒️'],
];

export const emojiShortcodeCompletions: CompletionSource = (
  context: CompletionContext
): CompletionResult | null => {
  const match = context.matchBefore(/(^|[\s(])(:[a-z0-9_+-]*)$/i);
  if (!match) return null;
  if (match.text === ':' && !context.explicit) return null;

  const typed = match.text.trimStart();
  const query = typed.slice(1).toLowerCase();
  const options = SHORTCODES.filter(([name]) => name.includes(query))
    .slice(0, 20)
    .map(([name, emoji]) => ({
      label: `:${name}:`,
      detail: emoji,
      apply: emoji,
      type: 'text' as const,
    }));

  if (options.length === 0) return null;

  const from = match.to - typed.length;
  return { from, options, filter: false };
};
