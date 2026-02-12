/**
 * Conflict Banner
 *
 * Slim notification bar shown above the editor when sync conflicts exist.
 * Directs users to Settings to resolve them.
 */

import { AlertTriangle } from 'lucide-react';
import { useSyncStore, selectConflicts } from '../../stores/syncStore';

export function ConflictBanner() {
  const conflicts = useSyncStore(selectConflicts);

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        background: 'rgba(245, 158, 11, 0.1)',
        borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
        fontSize: '0.8125rem',
        color: '#f59e0b',
      }}
    >
      <AlertTriangle size={14} />
      <span>
        {conflicts.length} sync conflict{conflicts.length > 1 ? 's' : ''} detected.{' '}
        <button
          type="button"
          onClick={() => window.readied.windows.openSettings()}
          style={{
            background: 'none',
            border: 'none',
            color: '#f59e0b',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
            fontSize: 'inherit',
            fontWeight: 600,
          }}
        >
          Resolve in Settings
        </button>
      </span>
    </div>
  );
}
