---
layout: home

hero:
  name: Readied
  text: Developer Note-Taking
  tagline: Markdown-first desktop note app for developers who value their data
  image:
    src: /readide/logo.svg
    alt: Readied Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/tomymaritano/readide

features:
  - icon: 📝
    title: Markdown Sacred
    details: Your markdown is never auto-modified. What you type is exactly what gets saved. No hidden transformations.
    link: /guide/principles
    linkText: Learn about our principles
  - icon: 🔌
    title: Plugin System
    details: 8 built-in plugins with an extensible architecture. Load community plugins from ~/.config/readied/plugins.
    link: /architecture/overview
    linkText: Explore the architecture
  - icon: 🌐
    title: Offline First
    details: Works 100% offline by default. Optional cloud sync via Supabase keeps your notes in sync across devices when you want it.
    link: /architecture/storage
    linkText: See storage architecture
  - icon: 📦
    title: Portable Data
    details: Export anytime as markdown files. Import from Obsidian. Your notes survive the app - always.
    link: /guide/getting-started#data-portability
    linkText: Data portability guide
  - icon: ⚡
    title: Fast & Native
    details: Built with Electron for cross-platform support. CodeMirror 6 editor for blazing fast editing.
    link: /architecture/editor
    linkText: Editor details
  - icon: 🎨
    title: Theme System
    details: Customizable color palettes with dark/light awareness. Ships with Solarized built-in. Make Readied yours.
    link: /guide/getting-started
    linkText: Get started
---

<style>
.badges {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 24px;
  flex-wrap: wrap;
}
</style>

<div class="badges">
  <a href="https://github.com/tomymaritano/readide/actions/workflows/ci.yml">
    <img src="https://github.com/tomymaritano/readide/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <a href="https://github.com/tomymaritano/readide/releases/latest">
    <img src="https://img.shields.io/github/v/release/tomymaritano/readide?label=latest" alt="Latest Release" />
  </a>
</div>
