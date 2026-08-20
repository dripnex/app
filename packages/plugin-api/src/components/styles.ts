const STYLE_ID = 'dripnex-plugin-components';

const CSS = `
.dripnex-plugin-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border, #3f3d39);
  border-radius: var(--radius-md, 6px);
  background: transparent;
  color: var(--text-secondary, #c8c3bc);
  font: inherit;
  font-size: var(--text-sm, 12px);
  font-weight: 500;
  cursor: pointer;
}
.dripnex-plugin-btn:hover:not(:disabled) {
  background: var(--bg-hover, rgba(255,255,255,0.06));
  color: var(--text-primary, #f4f1ea);
}
.dripnex-plugin-btn:focus-visible {
  outline: 2px solid var(--accent, #5eead4);
  outline-offset: 2px;
}
.dripnex-plugin-btn:disabled { opacity: 0.5; cursor: default; }
.dripnex-plugin-btn--primary {
  background: var(--accent, #5eead4);
  border-color: var(--accent, #5eead4);
  color: var(--bg-base, #141311);
}
.dripnex-plugin-btn--danger {
  color: var(--danger, #f87171);
  border-color: color-mix(in srgb, var(--danger, #f87171) 40%, transparent);
}

.dripnex-plugin-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, #000 45%, transparent);
}
.dripnex-plugin-modal {
  min-width: 280px;
  max-width: min(480px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: var(--bg-elevated, #1c1b19);
  border: 1px solid var(--border, #3f3d39);
  border-radius: var(--radius-lg, 10px);
  box-shadow: var(--shadow-xl, 0 16px 40px rgba(0,0,0,0.35));
  color: var(--text-primary, #f4f1ea);
}
.dripnex-plugin-modal--large { max-width: min(720px, calc(100vw - 32px)); }
.dripnex-plugin-dialog-title {
  margin: 0;
  padding: 14px 16px 0;
  font-size: var(--text-sm, 12px);
  font-weight: 600;
}
.dripnex-plugin-dialog-content { padding: 12px 16px; font-size: var(--text-sm, 12px); color: var(--text-secondary, #c8c3bc); }
.dripnex-plugin-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 16px 14px;
}
`;

export function ensurePluginComponentStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
