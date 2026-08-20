export function themeJsonTemplate(id: string, name: string): string {
  return `${JSON.stringify(
    {
      id,
      name,
      description:
        'A token layer over the Dripnex base. Same contract as Parchment / Wave / Night.',
      author: '',
      colorScheme: 'light',
      tokens: {
        '--bg-base': '#f3ead4',
        '--bg-surface': '#ebe0c4',
        '--bg-elevated': '#faf3e3',
        '--text-primary': '#3a3224',
        '--text-secondary': 'rgba(58, 50, 36, 0.74)',
        '--text-muted': 'rgba(58, 50, 36, 0.52)',
        '--border': 'rgba(58, 50, 36, 0.12)',
        '--accent': '#2a7d6f',
      },
    },
    null,
    2
  )}\n`;
}

export function themeManifestTemplate(id: string, name: string): string {
  return `${JSON.stringify(
    {
      id,
      name,
      version: '0.1.0',
      description: `A Dripnex theme: ${name}`,
    },
    null,
    2
  )}\n`;
}
