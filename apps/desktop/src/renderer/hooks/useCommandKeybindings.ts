import { useEffect } from 'react';
import type { KeyModifier, KeyBinding } from '@dripnex/command-registry';
import { registry, getEditorView } from './useCommandRegistry';

/**
 * Convert a KeyboardEvent to a KeyBinding for matching.
 */
function eventToKeybinding(e: KeyboardEvent): KeyBinding | null {
  const modifiers: KeyModifier[] = [];

  if (e.metaKey || e.ctrlKey) modifiers.push('Mod');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.altKey) modifiers.push('Alt');

  // Ignore pure modifier key presses
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return null;

  return { key: e.key.toLowerCase(), modifiers };
}

/**
 * Determine current context based on active element.
 */
function getCurrentContext(): 'editor' | 'app' {
  const active = document.activeElement;
  if (!active) return 'app';

  // Check if focus is inside a CodeMirror editor
  const cmEditor = active.closest('.cm-editor');
  if (cmEditor) return 'editor';

  return 'app';
}

/**
 * Check if the event target is a form input (text field, textarea, select).
 * App commands should not fire when the user is typing in a form.
 */
function isFormInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

interface UseCommandKeybindingsOptions {
  /** Handler for Escape key cascading behavior */
  onEscape?: () => void;
}

/**
 * Global keyboard handler that routes keybindings through the CommandRegistry.
 * Replaces useKeyboardShortcuts.
 *
 * - Editor commands only fire when CodeMirror is focused
 * - App commands skip form inputs (except when coming from CM editor)
 * - Global commands fire everywhere
 */
export function useCommandKeybindings(options?: UseCommandKeybindingsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape separately (cascading behavior)
      if (e.key === 'Escape') {
        options?.onEscape?.();
        return;
      }

      const kb = eventToKeybinding(e);
      if (!kb || kb.modifiers.length === 0) return; // Only handle modified shortcuts

      const context = getCurrentContext();

      // Try context-specific command first
      let command = registry.findByKeybinding(kb, context);

      // If in editor context and command is editor-specific, check view exists
      if (command?.context === 'editor') {
        const view = getEditorView();
        if (!view) command = undefined;
      }

      // For app commands, skip if user is in a form input (but not CodeMirror)
      if (command?.context === 'app' && context !== 'editor' && isFormInput(e.target)) {
        return;
      }

      if (command) {
        e.preventDefault();
        e.stopPropagation();
        void registry.dispatch(command.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [options]);
}
