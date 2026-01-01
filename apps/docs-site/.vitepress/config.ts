import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Readied',
  description: 'Technical documentation for Readied - Markdown-first, offline-forever note app',
  base: '/readide/',

  head: [
    ['link', { rel: 'icon', href: '/readide/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#0d9488' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Readied Documentation' }],
    ['meta', { property: 'og:description', content: 'Markdown-first, offline-forever note app for developers' }],
    ['meta', { property: 'og:image', content: '/readide/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Readied',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Decisions', link: '/decisions/' },
      { text: 'Roadmap', link: '/roadmap/mvp' },
      {
        text: 'Releases',
        link: 'https://github.com/tomymaritano/readide/releases',
      },
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
      message: 'Released under the MIT License. <a href="https://github.com/tomymaritano/readide/issues/new" target="_blank">Report an issue</a>',
      copyright: 'Copyright © 2025 Readied',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/tomymaritano/readide/edit/main/apps/docs-site/:path',
      text: 'Edit this page on GitHub',
    },

    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short',
      },
    },
  },

  lastUpdated: true,
});
