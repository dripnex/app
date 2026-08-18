import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-mono text-base font-bold tracking-tight">
          <img src="/logo.png" alt="" width={20} height={20} className="rounded-[4px]" />
          <span>
            dripnex<span className="text-[var(--color-accent)]">.</span>
          </span>
          <span className="text-[11px] font-normal text-fd-muted-foreground">docs</span>
        </span>
      ),
      transparentMode: 'top',
    },
    githubUrl: 'https://github.com/dripnex/readide',
    links: [
      {
        text: 'Home',
        url: '/',
      },
      {
        text: 'Download',
        url: '/download',
      },
    ],
  };
}
