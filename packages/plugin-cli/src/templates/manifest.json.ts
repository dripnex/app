export function manifestTemplate(id: string, name: string): string {
  return JSON.stringify(
    {
      id,
      name,
      version: '0.1.0',
      description: `A Dripnex plugin: ${name}`,
      main: 'dist/index.js',
    },
    null,
    2
  );
}
