import { useRef, useCallback, useEffect, type RefObject, type MutableRefObject } from 'react';
import type { MarkdownEditorHandle } from '../components/MarkdownEditor';
import type { MarkdownPreviewHandle } from '../components/editor';

interface UseScrollSyncOptions {
  isSplitMode: boolean;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
}

interface UseScrollSyncResult {
  masterRef: MutableRefObject<'editor' | 'preview'>;
  handleEditorReady: () => void;
  handlePreviewReady: () => void;
}

/**
 * Hook para sincronizar scroll entre editor y preview en split mode.
 *
 * ## Arquitectura Master-Slave
 *
 * Solo un panel (editor o preview) controla el scroll a la vez:
 * - El panel activo se detecta via mouseenter
 * - Cuando el master hace scroll, el slave se sincroniza
 * - Evita feedback loops y temblores en la UI
 *
 * ## Problema Resuelto
 *
 * Componentes lazy-loaded (MarkdownEditor) o que no remontan entre
 * cambios de modo pueden quedar sin listeners de scroll.
 *
 * Escenarios:
 * - `split → editor → split`: Editor no remonta, preview sí
 * - `split → eye → split`: Preview no remonta, editor sí
 *
 * ## Solución
 *
 * 1. Cada componente notifica via `onReady()` cuando está montado
 * 2. Al entrar a split mode, verificamos si los refs ya son válidos
 *    (componente ya estaba montado) y restauramos los ready flags
 * 3. `attachScrollSync()` se llama desde:
 *    - onReady callbacks (cuando componente monta)
 *    - useEffect de isSplitMode (cuando entramos a split mode)
 *
 * @example
 * ```tsx
 * const { masterRef, handleEditorReady, handlePreviewReady } = useScrollSync({
 *   isSplitMode,
 *   editorRef,
 *   previewRef,
 * });
 *
 * // En el JSX:
 * <div onMouseEnter={() => { masterRef.current = 'editor'; }}>
 *   <MarkdownEditor onReady={handleEditorReady} />
 * </div>
 * ```
 */
export function useScrollSync({
  isSplitMode,
  editorRef,
  previewRef,
}: UseScrollSyncOptions): UseScrollSyncResult {
  const masterRef = useRef<'editor' | 'preview'>('editor');
  const editorReadyRef = useRef(false);
  const previewReadyRef = useRef(false);
  const scrollCleanupRef = useRef<(() => void) | null>(null);

  // Attach scroll sync when both components are ready
  const attachScrollSync = useCallback(() => {
    if (!isSplitMode) return;
    if (!editorReadyRef.current || !previewReadyRef.current) return;

    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    // Cleanup anterior (evita race si ambos onReady disparan casi juntos)
    if (scrollCleanupRef.current) {
      scrollCleanupRef.current();
      scrollCleanupRef.current = null;
    }

    // Reset master to editor
    masterRef.current = 'editor';

    let rafId: number | null = null;

    const sync = (fraction: number, target: 'editor' | 'preview') => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        // Skip if target can't scroll (avoids jumps on short content)
        if (target === 'editor' && !editor.canScroll()) {
          rafId = null;
          return;
        }
        if (target === 'preview' && !preview.canScroll()) {
          rafId = null;
          return;
        }
        if (target === 'editor') {
          editor.setScrollFraction(fraction);
        } else {
          preview.setScrollFraction(fraction);
        }
        rafId = null;
      });
    };

    const unsubEditor = editor.onScroll(fraction => {
      if (masterRef.current !== 'editor') return;
      sync(fraction, 'preview');
    });

    const unsubPreview = preview.onScroll(fraction => {
      if (masterRef.current !== 'preview') return;
      sync(fraction, 'editor');
    });

    scrollCleanupRef.current = () => {
      unsubEditor();
      unsubPreview();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isSplitMode, editorRef, previewRef]);

  // Handle scroll sync when entering/leaving split mode
  useEffect(() => {
    if (isSplitMode) {
      // Entering split mode: components might already be mounted (didn't remount)
      // Restore ready flags if refs are valid
      if (editorRef.current && !editorReadyRef.current) {
        editorReadyRef.current = true;
      }
      if (previewRef.current && !previewReadyRef.current) {
        previewReadyRef.current = true;
      }
      // Try to attach (will succeed if both ready, or wait for onReady callbacks)
      attachScrollSync();
    } else {
      // Leaving split mode: cleanup listeners
      if (scrollCleanupRef.current) {
        scrollCleanupRef.current();
        scrollCleanupRef.current = null;
      }
      // Reset flags - they'll be restored when entering split again if refs valid
      editorReadyRef.current = false;
      previewReadyRef.current = false;
    }
  }, [isSplitMode, attachScrollSync, editorRef, previewRef]);

  // Handlers for onReady callbacks
  const handleEditorReady = useCallback(() => {
    editorReadyRef.current = true;
    attachScrollSync();
  }, [attachScrollSync]);

  const handlePreviewReady = useCallback(() => {
    previewReadyRef.current = true;
    attachScrollSync();
  }, [attachScrollSync]);

  return {
    masterRef,
    handleEditorReady,
    handlePreviewReady,
  };
}
