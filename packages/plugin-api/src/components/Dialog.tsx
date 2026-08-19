import type { ReactNode } from 'react';
import { Modal, type PluginModalProps } from './Modal.js';

export type PluginDialogProps = PluginModalProps;

function Title({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <h2 className={['dripnex-plugin-dialog-title', className ?? ''].join(' ').trim()}>
      {children}
    </h2>
  );
}

function Content({
  className,
  children,
  noPadding,
}: {
  className?: string;
  children?: ReactNode;
  noPadding?: boolean;
}) {
  return (
    <div
      className={['dripnex-plugin-dialog-content', className ?? ''].join(' ').trim()}
      style={noPadding ? { padding: 0 } : undefined}
    >
      {children}
    </div>
  );
}

function Actions({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={['dripnex-plugin-dialog-actions', className ?? ''].join(' ').trim()}>
      {children}
    </div>
  );
}

export function Dialog({ children, ...modal }: PluginDialogProps) {
  return <Modal {...modal}>{children}</Modal>;
}

Dialog.Title = Title;
Dialog.Content = Content;
Dialog.Actions = Actions;
