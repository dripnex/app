import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="font-mono text-base font-bold tracking-tight">
          readied<span className="text-[var(--color-accent)]">.</span>
          <span className="ml-2 text-[11px] font-normal text-fd-muted-foreground">docs</span>
        </span>
      ),
      transparentMode: 'top',
    },
    githubUrl: 'https://github.com/tomymaritano/readide',
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
