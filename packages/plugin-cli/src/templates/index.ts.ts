export function indexTemplate(id: string, name: string): string {
  return `import type { PluginManifest } from '@readied/plugin-api';

/**
 * ${name} — Readied Plugin
 */
export const plugin: PluginManifest = {
  id: '${id}',
  name: '${name}',
  version: '0.1.0',
  description: 'A Readied plugin',

  activate(context) {
    context.log.info('${name} activated');

    // Register a command in the command palette
    const unregisterHello = context.registerCommand(
      {
        id: 'hello',
        name: 'Say Hello',
        icon: 'Smile',
      },
      () => {
        context.log.info('Hello from ${name}!');
        return true;
      }
    );

    // Clean up when the plugin is deactivated
    return {
      dispose() {
        unregisterHello();
      },
    };
  },
};
`;
}
