---
layout: home

hero:
  name: Readied
  text: Developer Note-Taking
  tagline: Markdown-first, offline-forever note app built for developers who value their data
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
    title: Offline Forever
    details: 100% functional without internet. Your notes live on your machine in a local SQLite database you control.
    link: /architecture/storage
    linkText: See storage architecture
  - icon: 🏗️
    title: Clean Architecture
    details: Core domain logic runs without Electron, React, or UI dependencies. Testable, portable, future-proof.
    link: /architecture/overview
    linkText: Explore the architecture
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
  - icon: 🔒
    title: Privacy First
    details: No telemetry. No accounts required. No cloud sync. Your notes stay on your device.
    link: /decisions/
    linkText: See our decisions
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
