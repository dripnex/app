import { memo } from 'react';

interface SidebarFooterProps {
  readonly appVersion: string;
}

export const SidebarFooter = memo(function SidebarFooter({ appVersion }: SidebarFooterProps) {
  return (
    <footer className="sidebar-footer">
      <span className="sidebar-footer-version" aria-label={`App version ${appVersion}`}>
        v{appVersion}
      </span>
    </footer>
  );
});
