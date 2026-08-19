export function menusTemplate(_id: string): string {
  return `${JSON.stringify(
    {
      menu: [{ label: 'Say Hello', command: 'say-hello' }],
      'context-menu': {
        'note-list-item': [{ label: 'Say Hello', command: 'say-hello' }],
      },
    },
    null,
    2
  )}\n`;
}
