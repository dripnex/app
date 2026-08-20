import { Button } from './Button.js';
import { Dialog } from './Dialog.js';
import { Modal } from './Modal.js';

/** Stock UI for plugins (Inkdrop Component Manager, without Redux). */
export const pluginComponents = {
  Button,
  Modal,
  Dialog,
  get(name: string) {
    if (name === 'Button') return Button;
    if (name === 'Modal') return Modal;
    if (name === 'Dialog') return Dialog;
    return undefined;
  },
  /** Inkdrop `components.getComponentClass`. */
  getComponentClass(name: string) {
    return pluginComponents.get(name);
  },
};

export type PluginComponents = typeof pluginComponents;
