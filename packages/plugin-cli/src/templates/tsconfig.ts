export function tsconfigTemplate(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'CommonJS',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: 'dist',
        rootDir: 'src',
        declaration: false,
      },
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2
  );
}
