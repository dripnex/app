export default function ComparisonTable() {
  const rows = [
    { bad: 'Server dependency', good: 'Works 100% offline' },
    { bad: 'Vendor lock-in', good: 'Standard .md files' },
    { bad: 'Monthly subscription', good: 'Free forever' },
    { bad: 'Privacy concerns', good: 'Your disk, your data' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left: Cloud note apps */}
      <div className="rounded-xl bg-surface border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-[#a1a1aa] mb-5">
          Cloud note apps
        </h3>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.bad}
              className="flex items-center gap-3 text-sm text-[#71717a]"
            >
              <span className="text-red-400 shrink-0">&#10005;</span>
              {r.bad}
            </li>
          ))}
        </ul>
      </div>

      {/* Right: Readied */}
      <div
        className="rounded-xl bg-surface border border-accent/20 p-6"
        style={{ boxShadow: '0 0 40px rgba(139, 92, 246, 0.08)' }}
      >
        <h3 className="text-lg font-semibold text-zinc-50 mb-5">Readied</h3>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.good}
              className="flex items-center gap-3 text-sm text-[#a1a1aa]"
            >
              <span className="text-emerald-400 shrink-0">&#10003;</span>
              {r.good}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
