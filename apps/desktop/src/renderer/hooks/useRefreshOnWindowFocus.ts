import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { noteKeys } from './useNotes';
import { notebookKeys } from './useNotebooks';

/** Re-read SQLite when the window is focused (MCP/other processes can mutate the DB). */
export function useRefreshOnWindowFocus(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: noteKeys.all });
      void queryClient.invalidateQueries({ queryKey: notebookKeys.all });
    };
    window.addEventListener('focus', refresh);
    const stop = window.dripnex?.ipc?.on('data:external-change', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      stop?.();
    };
  }, [queryClient]);
}
