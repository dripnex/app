import { useState, useMemo } from 'react';

interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  icon: string;
  builtin: boolean;
  tags: string[];
}

interface PluginFilterProps {
  plugins: Plugin[];
}

export default function PluginFilter({ plugins }: PluginFilterProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Derive unique categories from plugin data
  const categories = useMemo(() => {
    const cats = new Set(plugins.map((p) => p.category));
    return ['All', ...Array.from(cats).sort()];
  }, [plugins]);

  // Filter plugins by active category
  const filteredPlugins = useMemo(() => {
    if (activeCategory === 'All') return plugins;
    return plugins.filter((p) => p.category === activeCategory);
  }, [plugins, activeCategory]);

  return (
    <div>
      {/* Category filter buttons */}
      <div
        className="mb-8 flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Filter plugins by category"
      >
        {categories.map((category) => {
          const isActive = activeCategory === category;
          const count =
            category === 'All'
              ? plugins.length
              : plugins.filter((p) => p.category === category).length;

          return (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveCategory(category)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'bg-accent text-white'
                  : 'border border-white/[0.08] bg-surface text-[#a1a1aa] hover:bg-white/5 hover:text-white'
              }`}
            >
              {category}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-[#71717a]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Plugin card grid */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="tabpanel"
        aria-label={`Plugins in ${activeCategory} category`}
      >
        {filteredPlugins.map((plugin) => (
          <div
            key={plugin.id}
            className="rounded-xl bg-surface p-5 transition-colors hover:bg-elevated"
          >
            {/* Header: icon + name + version */}
            <div className="mb-3 flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-inset text-xl"
                aria-hidden="true"
              >
                {plugin.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-[#f4f4f5]">
                    {plugin.name}
                  </h3>
                  {plugin.builtin && (
                    <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      Built-in
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-[#71717a]">
                  by {plugin.author} &middot; <span className="font-mono">v{plugin.version}</span>
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-[#a1a1aa]">
              {plugin.description}
            </p>

            {/* Tags */}
            {plugin.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {plugin.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-inset px-2 py-0.5 text-[11px] text-[#71717a]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredPlugins.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-[#71717a]">
            No plugins found in this category.
          </p>
        </div>
      )}
    </div>
  );
}
