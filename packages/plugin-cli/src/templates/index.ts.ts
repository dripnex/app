export function indexTemplate(id: string, name: string): string {
  return `/**
 * ${name} — Dripnex Plugin
 */

/** @type {import('@dripnex/plugin-api').PluginManifest} */
module.exports = {
  id: '${id}',
  name: '${name}',
  version: '0.1.0',
  description: 'A Dripnex plugin',

  activate(context) {
    context.log.info('${name} activated');

    const removeCommand = context.registerCommand(
      { id: 'say-hello', name: 'Say Hello' },
      () => {
        context.log.info('Hello from ${name}!');
        return true;
      }
    );

    return {
      dispose() {
        removeCommand();
      },
    };
  },
};
`;
}
