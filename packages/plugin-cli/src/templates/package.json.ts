export function packageJsonTemplate(id: string, name: string): string {
  return JSON.stringify(
    {
      name: `dripnex-plugin-${id}`,
      version: '0.1.0',
      private: true,
      description: `A Dripnex plugin: ${name}`,
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
      },
      devDependencies: {
        '@dripnex/plugin-api': '^0.1.0',
        typescript: '^5.0.0',
      },
    },
    null,
    2
  );
}
