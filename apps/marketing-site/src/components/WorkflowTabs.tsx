import { useState } from 'react';

/* ---------- Write Tab ---------- */
function WriteTab() {
  return (
    <div className="grid grid-cols-2 gap-4 min-h-[200px]">
      {/* Markdown source */}
      <div className="rounded-lg bg-inset border border-white/[0.06] p-4 font-mono text-[10px] sm:text-xs leading-relaxed overflow-hidden">
        <div className="space-y-1">
          <div>
            <span className="font-bold text-accent"># </span>
            <span className="font-bold text-[#f4f4f5]">Meeting Notes</span>
          </div>
          <div className="h-1" />
          <div className="text-[#a1a1aa]">Discussed the roadmap for Q2.</div>
          <div className="h-1" />
          <div>
            <span className="font-semibold text-accent/80">## </span>
            <span className="font-semibold text-[#e4e4e7]">Action Items</span>
          </div>
          <div className="h-1" />
          <div>
            <span className="text-accent/50">- </span>
            <span className="text-[#a1a1aa]">Finalize design specs</span>
          </div>
          <div>
            <span className="text-accent/50">- </span>
            <span className="text-[#a1a1aa]">Review pull requests</span>
          </div>
          <div>
            <span className="text-accent/50">- </span>
            <span className="text-[#a1a1aa]">Ship v1.0 by Friday</span>
          </div>
        </div>
        <div className="mt-1 h-3 w-0.5 rounded-sm bg-accent animate-pulse" />
      </div>

      {/* Preview */}
      <div className="rounded-lg bg-[#09090b]/50 border border-white/[0.06] p-4 overflow-hidden">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[#f4f4f5]">Meeting Notes</h3>
          <p className="text-[10px] sm:text-xs text-[#a1a1aa] leading-relaxed">
            Discussed the roadmap for Q2.
          </p>
          <h4 className="text-xs font-semibold text-[#e4e4e7]">Action Items</h4>
          <ul className="text-[10px] sm:text-xs text-[#a1a1aa] space-y-1 pl-4 list-disc marker:text-accent/40">
            <li>Finalize design specs</li>
            <li>Review pull requests</li>
            <li>Ship v1.0 by Friday</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------- Organize Tab ---------- */
function OrganizeTab() {
  const items = [
    { icon: 'folder', label: 'work/', indent: 0, active: false, isFolder: true },
    { icon: 'file', label: 'standup.md', indent: 1, active: false, isFolder: false },
    { icon: 'file', label: 'roadmap.md', indent: 1, active: true, isFolder: false },
    { icon: 'file', label: 'retro-q1.md', indent: 1, active: false, isFolder: false },
    { icon: 'folder', label: 'personal/', indent: 0, active: false, isFolder: true },
    { icon: 'file', label: 'journal.md', indent: 1, active: false, isFolder: false },
    { icon: 'file', label: 'goals-2026.md', indent: 1, active: false, isFolder: false },
    { icon: 'folder', label: 'archive/', indent: 0, active: false, isFolder: true },
  ];

  return (
    <div className="min-h-[200px]">
      <div className="rounded-lg bg-inset border border-white/[0.06] p-4 max-w-sm">
        {/* Search bar */}
        <div className="flex items-center gap-2 rounded-md bg-white/[0.03] border border-white/[0.06] px-3 py-2 mb-3">
          <svg
            className="h-3 w-3 text-[#71717a]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <span className="text-[10px] text-[#71717a]">Filter notes...</span>
        </div>

        {/* File tree */}
        <div className="space-y-0.5 font-mono text-[10px] sm:text-[11px]">
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                item.active
                  ? 'bg-accent/10 text-accent'
                  : item.isFolder
                    ? 'text-[#a1a1aa]'
                    : 'text-[#71717a] hover:bg-white/[0.03]'
              }`}
              style={{ paddingLeft: `${item.indent * 16 + 8}px` }}
            >
              {/* Drag handle */}
              <svg
                className="h-3 w-3 text-[#3f3f46] shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 9h16.5m-16.5 6.75h16.5"
                />
              </svg>
              {/* Icon */}
              {item.isFolder ? (
                <svg
                  className={`h-3 w-3 shrink-0 ${item.active ? 'text-accent' : 'text-accent/60'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-3 w-3 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              )}
              <span className="truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[10px] text-[#71717a]">
        Drag to reorder. Folders and files live on your disk.
      </p>
    </div>
  );
}

/* ---------- Search Tab ---------- */
function SearchTab() {
  const results = [
    {
      file: 'roadmap.md',
      snippet: '...reviewed the architecture decisions we made...',
      highlight: 'architecture decisions',
      primary: true,
    },
    {
      file: 'standup.md',
      snippet: '...discussed architecture patterns with the team...',
      highlight: 'architecture',
      primary: false,
    },
    {
      file: 'retro-q1.md',
      snippet: '...rethink our architecture approach for scalability...',
      highlight: 'architecture',
      primary: false,
    },
  ];

  return (
    <div className="min-h-[200px]">
      {/* Search input */}
      <div className="rounded-lg bg-inset border border-accent/20 mb-4 max-w-md">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <svg
            className="h-3.5 w-3.5 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <span className="font-mono text-xs text-[#f4f4f5]">
            architecture decisions
          </span>
          <span className="ml-auto text-[9px] text-[#71717a] font-mono">
            3 results
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-2 max-w-md">
        {results.map((r, i) => (
          <div
            key={i}
            className={`rounded-lg bg-inset px-3 py-2.5 text-[11px] ${
              r.primary ? 'border-l-2 border-accent' : ''
            }`}
          >
            <div
              className={`font-semibold mb-0.5 ${
                r.primary ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]'
              }`}
            >
              {r.file}
            </div>
            <div className="text-[#71717a] truncate">
              {r.snippet.split(r.highlight).map((part, j, arr) => (
                <span key={j}>
                  {part}
                  {j < arr.length - 1 && (
                    <span className="text-accent">{r.highlight}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Main Component ---------- */
export default function WorkflowTabs() {
  const [active, setActive] = useState(0);
  const tabs = ['Write', 'Organize', 'Search'];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/[0.06] mb-0">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActive(i)}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              active === i
                ? 'text-accent'
                : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
          >
            {tab}
            {active === i && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="rounded-b-xl bg-surface p-6 min-h-[240px]">
        {active === 0 && <WriteTab />}
        {active === 1 && <OrganizeTab />}
        {active === 2 && <SearchTab />}
      </div>
    </div>
  );
}
