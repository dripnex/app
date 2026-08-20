import themeStyles from '../AppearanceThemes.module.css';

export function PaletteCard({
  name,
  description,
  active,
  tokens,
  onClick,
}: {
  name: string;
  description: string;
  active: boolean;
  tokens: Record<string, string>;
  onClick: () => void;
}) {
  const base = tokens['--bg-base'] ?? '#111';
  const surface = tokens['--bg-surface'] ?? base;
  const elevated = tokens['--bg-elevated'] ?? surface;
  const accent = tokens['--accent'] ?? '#5eead4';
  const text = tokens['--text-primary'] ?? '#f4f4f5';
  const muted = tokens['--text-muted'] ?? 'rgba(255,255,255,0.35)';
  const border = tokens['--border'] ?? 'rgba(255,255,255,0.08)';

  return (
    <button
      type="button"
      className={`${themeStyles.card} ${active ? themeStyles.cardActive : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div
        className={themeStyles.preview}
        style={{ background: base, ['--swatch-border' as string]: border }}
        aria-hidden="true"
      >
        <div className={themeStyles.sidebar} style={{ background: surface }}>
          <i className={themeStyles.dot} style={{ background: accent }} />
          <i className={themeStyles.dot} style={{ background: muted }} />
          <i className={themeStyles.dot} style={{ background: muted }} />
        </div>
        <div className={themeStyles.list} style={{ background: elevated }}>
          <i className={themeStyles.row} style={{ background: accent, opacity: 0.35 }} />
          <i className={themeStyles.line} style={{ background: text, width: '86%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '64%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '72%' }} />
        </div>
        <div className={themeStyles.editor} style={{ background: base }}>
          <i className={themeStyles.line} style={{ background: text, width: '42%', height: 5 }} />
          <i className={themeStyles.line} style={{ background: muted, width: '88%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '74%' }} />
          <i className={themeStyles.line} style={{ background: muted, width: '80%' }} />
        </div>
      </div>
      <span className={themeStyles.meta}>
        <span className={themeStyles.name}>{name}</span>
        <span className={themeStyles.desc}>{description}</span>
      </span>
    </button>
  );
}
