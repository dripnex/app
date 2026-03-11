export function packageJsonTemplate(id: string, name: string): string {
  return JSON.stringify(
    {
      name: `readied-plugin-${id}`,
      version: '0.1.0',
      private: true,
      description: `A Readied plugin: ${name}`,
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
      },
      devDependencies: {
        '@readied/plugin-api': '^0.1.0',
        typescript: '^5.0.0',
      },
    },
    null,
    2
  );
}
