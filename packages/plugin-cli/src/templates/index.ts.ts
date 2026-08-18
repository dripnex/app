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

    const removeMenu = context.menu.add({
      label: 'Say Hello',
      click: () => {
        context.log.info('Hello from ${name}!');
        return true;
      },
    });

    return {
      dispose() {
        removeMenu();
      },
    };
  },
};
`;
}
