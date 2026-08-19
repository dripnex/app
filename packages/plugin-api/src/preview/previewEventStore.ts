import { createStore } from 'zustand/vanilla';

export type PreviewEventName = 'a:click' | 'checkbox:change';

export interface PreviewLinkClickDetail {
  href: string;
  text: string;
}

export interface PreviewCheckboxChangeDetail {
  index: number;
  checked: boolean;
}

export type PreviewEventDetail = PreviewLinkClickDetail | PreviewCheckboxChangeDetail;

export type PreviewEventHandler = (detail: PreviewEventDetail) => boolean | void;

interface PreviewEventRegistration {
  id: string;
  pluginId: string;
  event: PreviewEventName;
  handler: PreviewEventHandler;
}

interface PreviewEventState {
  registrations: PreviewEventRegistration[];
  on(pluginId: string, event: PreviewEventName, handler: PreviewEventHandler): () => void;
  removeAll(pluginId: string): void;
}

let seq = 0;

export const previewEventStore = createStore<PreviewEventState>(set => ({
  registrations: [],

  on(pluginId, event, handler) {
    const id = `${pluginId}:preview:${event}:${++seq}`;
    set(state => ({
      registrations: [...state.registrations, { id, pluginId, event, handler }],
    }));
    return () => {
      set(state => ({
        registrations: state.registrations.filter(r => r.id !== id),
      }));
    };
  },

  removeAll(pluginId) {
    set(state => ({
      registrations: state.registrations.filter(r => r.pluginId !== pluginId),
    }));
  },
}));

/** Returns false if any handler returns false (Inkdrop preventDefault). */
export function emitPreviewEvent(event: PreviewEventName, detail: PreviewEventDetail): boolean {
  let allowed = true;
  for (const reg of previewEventStore.getState().registrations) {
    if (reg.event !== event) continue;
    if (reg.handler(detail) === false) allowed = false;
  }
  return allowed;
}
