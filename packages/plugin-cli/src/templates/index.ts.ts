export function indexTemplate(id: string, name: string): string {
  return `/**
 * ${name} — Readied Plugin
 */

module.exports = {
  id: '${id}',
  name: '${name}',
  version: '0.1.0',

  activate(ctx) {
    console.log('[${id}] activated');

    // Example: register a command
    // ctx.registerCommand({
    //   id: '${id}:hello',
    //   title: 'Say Hello',
    //   handler: () => console.log('Hello from ${name}!'),
    // });

    // Return a disposable to clean up on deactivation
    return {
      dispose() {
        console.log('[${id}] deactivated');
      },
    };
  },
};
`;
}
