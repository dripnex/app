import './globals.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource-variable/jetbrains-mono';
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Readied — Offline-first Markdown editor for developers',
    template: '%s | Readied',
  },
  description:
    'A beautiful Markdown editor that works offline, stores files locally, and never locks you in.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="bg-background text-text-primary antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
