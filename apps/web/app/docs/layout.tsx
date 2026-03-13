import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions()}
      sidebar={{
        banner: (
          <div className="rounded-lg border border-[var(--color-border-accent)] bg-[var(--color-accent-glow)] px-3 py-2">
            <p className="text-xs font-medium text-fd-foreground">
              Readied is in active development.{' '}
              <a
                href="https://github.com/tomymaritano/readide"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-hover)]"
              >
                Star on GitHub
              </a>
            </p>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
