export interface PluginMetadata {
  name: string;
  version: string;
  pluginId: string;
}

/**
 * Wraps a remark/rehype plugin so failures don't crash the entire preview.
 *
 * Strategy: Wrap the transformer function returned by the plugin.
 * If the transformer throws, log the error and inject an error marker
 * node into the AST.
 */
export function safePluginWrapper(
  plugin: unknown,
  metadata: PluginMetadata,
): unknown {
  // If plugin is not a function, return it as-is (let unified handle the error)
  if (typeof plugin !== 'function') return plugin;

  // Return a new plugin function that wraps the original
  return function safePlugin(...args: unknown[]) {
    let transformer: unknown;
    try {
      transformer = (plugin as Function)(...args);
    } catch (error) {
      console.warn(
        `[PluginPipeline] ${metadata.name}@${metadata.version} failed to initialize:`,
        error,
      );
      // Return no-op transformer
      return () => {};
    }

    if (typeof transformer !== 'function') return transformer;

    // Wrap the transformer
    return (tree: unknown, file: unknown) => {
      try {
        return (transformer as Function)(tree, file);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `[PluginPipeline] ${metadata.name}@${metadata.version} failed:`,
          message,
        );

        // Inject error marker node into the tree (at the end)
        // The tree is a hast/mdast root node with children array
        if (
          tree &&
          typeof tree === 'object' &&
          'children' in tree &&
          Array.isArray((tree as Record<string, unknown>).children)
        ) {
          const children = (tree as Record<string, unknown>).children as unknown[];
          children.push({
            type: 'html',
            value: `<div class="plugin-error-block" data-plugin="${metadata.name}" data-error="${message.replace(/"/g, '&quot;')}">⚠ ${metadata.name} plugin failed: ${message.replace(/</g, '&lt;')}</div>`,
          });
        }

        return tree;
      }
    };
  };
}
