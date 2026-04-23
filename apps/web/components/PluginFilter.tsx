'use client';

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
  downloads?: number;
}

interface PluginFilterProps {
  plugins: Plugin[];
}

type SortOption = 'popular' | 'newest' | 'name';

export default function PluginFilter({ plugins }: PluginFilterProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('name');

  const categories = useMemo(() => {
    const cats = new Set(plugins.map(p => p.category));
    return ['All', ...Array.from(cats).sort()];
  }, [plugins]);

  const filteredPlugins = useMemo(() => {
    let result = plugins;

    if (activeCategory !== 'All') {
      result = result.filter(p => p.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      if (sort === 'popular') return (b.downloads ?? 0) - (a.downloads ?? 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [plugins, activeCategory, search, sort]);

  return (
    <div>
      {/* Search + Sort bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search plugins..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/8 bg-surface px-3 py-2.5 pl-10 text-sm text-[#f4f4f5] placeholder-[#71717a] outline-none transition-colors focus:border-accent"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-white/8 bg-surface px-3 py-2.5 text-sm text-[#a1a1aa] outline-none transition-colors focus:border-accent cursor-pointer"
        >
          <option value="name">Sort: A-Z</option>
          <option value="popular">Sort: Popular</option>
          <option value="newest">Sort: Newest</option>
        </select>
      </div>

      {/* Category filter buttons */}
      <div
        className="mb-8 flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Filter plugins by category"
      >
        {categories.map(category => {
          const isActive = activeCategory === category;
          const count =
            category === 'All'
              ? plugins.length
              : plugins.filter(p => p.category === category).length;

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
                  : 'border border-white/8 bg-surface text-[#a1a1aa] hover:bg-white/5 hover:text-white'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-[#71717a]'
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
        {filteredPlugins.map(plugin => {
          const installCmd = plugin.builtin
            ? `readied plugin enable ${plugin.id}`
            : `readied plugin install ${plugin.id}`;

          return (
            <div
              key={plugin.id}
              className="glass-card overflow-hidden p-5 transition-colors hover:border-zinc-700"
            >
              <div className="mb-3 flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-inset text-xl"
                  aria-hidden="true"
                >
                  {plugin.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-[#f4f4f5]">{plugin.name}</h3>
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

              <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-[#a1a1aa]">
                {plugin.description}
              </p>

              <div className="mb-3 group relative">
                <pre className="rounded-lg bg-zinc-950 border border-white/6 px-3 py-2 text-xs font-mono text-[#a1a1aa] overflow-x-auto">
                  <code>{installCmd}</code>
                </pre>
                <button
                  type="button"
                  className="absolute top-1.5 right-1.5 rounded-md bg-white/5 p-1 text-[#71717a] opacity-0 transition-opacity group-hover:opacity-100 hover:text-white focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Copy install command for ${plugin.name}`}
                  onClick={() => {
                    void navigator.clipboard.writeText(installCmd);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>

              {plugin.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {plugin.tags.map(tag => (
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
          );
        })}
      </div>

      {/* Empty state */}
      {filteredPlugins.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="mb-3 text-4xl" aria-hidden="true">
            {search ? '\uD83D\uDD0D' : '\uD83D\uDCE6'}
          </div>
          <p className="text-sm font-medium text-[#f4f4f5] mb-1">No plugins found</p>
          <p className="text-sm text-[#71717a]">
            {search ? (
              <>
                No plugins match &ldquo;<span className="font-medium text-accent">{search}</span>
                &rdquo;. Try a different search term.
              </>
            ) : (
              <>
                No plugins match the{' '}
                <span className="font-medium text-accent">{activeCategory}</span> category. Try
                selecting a different filter above.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
