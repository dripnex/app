import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Readied',
  description: 'Technical documentation for Readied - Markdown-first, offline-forever note app',

  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Decisions', link: '/decisions/' },
      { text: 'Roadmap', link: '/roadmap/mvp' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Principles', link: '/guide/principles' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'Core Package', link: '/architecture/core' },
            { text: 'Storage', link: '/architecture/storage' },
            { text: 'IPC Contract', link: '/architecture/ipc' },
            { text: 'Editor', link: '/architecture/editor' },
            { text: 'Theming', link: '/architecture/theming' },
          ],
        },
      ],
      '/decisions/': [
        {
          text: 'Architecture Decisions',
          items: [
            { text: 'Index', link: '/decisions/' },
            { text: 'ADR-001: Runtime Contract', link: '/decisions/adr-001-runtime-contract' },
            { text: 'ADR-002: Markdown Model', link: '/decisions/adr-002-markdown-model' },
            { text: 'ADR-003: Storage', link: '/decisions/adr-003-storage' },
          ],
        },
      ],
      '/roadmap/': [
        {
          text: 'Roadmap',
          items: [
            { text: 'MVP', link: '/roadmap/mvp' },
            { text: 'v0.1', link: '/roadmap/v0.1' },
            { text: 'v0.2+', link: '/roadmap/v0.2' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/tomymaritano/readide' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Readied',
    },

    search: {
      provider: 'local',
    },
  },
});
