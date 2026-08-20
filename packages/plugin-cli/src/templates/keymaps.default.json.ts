export function keymapsTemplate(_id: string): string {
  return `${JSON.stringify(
    {
      'say-hello': 'Mod+Shift+H',
    },
    null,
    2
  )}\n`;
}
