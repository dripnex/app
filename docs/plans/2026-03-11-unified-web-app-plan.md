# Unified Web App Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `apps/docs-site` (VitePress) and `apps/marketing-site` (Astro) with a single Next.js + Fumadocs app at `apps/web/`.

**Architecture:** Single Next.js 15 app with App Router. Marketing pages are server components at root routes. Docs are MDX files under `content/docs/`, rendered by Fumadocs at `/docs/*`. Shared Navbar + Footer in the root layout.

**Tech Stack:** Next.js 15, React 19, Fumadocs (core + mdx + ui), Tailwind CSS 4, next-themes, lucide-react, @headlessui/react

---

## Task 1: Scaffold Next.js + Fumadocs app

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/source.ts`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/docs/[[...slug]]/page.tsx`
- Create: `apps/web/app/docs/layout.tsx`
- Create: `apps/web/mdx-components.tsx`

**Step 1: Create package.json**

```json
{
  "name": "@readied/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "fumadocs-core": "latest",
    "fumadocs-mdx": "latest",
    "fumadocs-ui": "latest",
    "next-themes": "latest",
    "lucide-react": "latest",
    "@headlessui/react": "^2.2.9",
    "@readied/product-config": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

**Step 2: Create next.config.mjs**

```js
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {};

export default withMDX(config);
```

**Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", "**/*.mdx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create postcss.config.mjs**

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
export default config;
```

**Step 5: Create tailwind.config.ts and app/globals.css**

The `app/globals.css` should import tailwind and define the Readied brand tokens (teal palette from marketing site). Use the same color values: accent `#0d9488`, accent-hover `#0f766e`, backgrounds `#09090b`, `#131417`.

**Step 6: Create source.ts** (Fumadocs content source)

```ts
import { docs, meta } from '@/.source';

export const source = createMDXSource(docs, meta);
```

Follow Fumadocs docs for the exact import pattern based on their latest version.

**Step 7: Create app/layout.tsx** (root layout)

Minimal root layout with `<html>`, `<body>`, Tailwind globals import, and a `{children}` slot. Add metadata export with Readied title/description. Add `next-themes` ThemeProvider. Do NOT add Navbar/Footer yet (Task 3).

**Step 8: Create app/docs/layout.tsx** (docs layout)

```tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/source';

export default function Layout({ children }: { children: ReactNode }) {
  return <DocsLayout tree={source.pageTree}>{children}</DocsLayout>;
}
```

**Step 9: Create app/docs/[[...slug]]/page.tsx**

```tsx
import { source } from '@/source';
import { notFound } from 'next/navigation';
import defaultMdxComponents from 'fumadocs-ui/mdx';

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return <MDX components={{ ...defaultMdxComponents }} />;
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
```

**Step 10: Create mdx-components.tsx** at project root (Next.js MDX requirement)

```tsx
import type { MDXComponents } from 'mdx/types';
import defaultComponents from 'fumadocs-ui/mdx';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...defaultComponents, ...components };
}
```

**Step 11: Install deps and verify dev server starts**

Run: `cd apps/web && pnpm install`
Run: `pnpm --filter @readied/web dev`
Expected: Next.js dev server starts without errors (no content yet, just the shell)

**Step 12: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold Next.js + Fumadocs app"
```

---

## Task 2: Migrate documentation content (21 MDX pages)

**Files:**

- Create: `apps/web/content/docs/index.mdx`
- Create: `apps/web/content/docs/guide/*.mdx` (4 files)
- Create: `apps/web/content/docs/architecture/*.mdx` (6 files)
- Create: `apps/web/content/docs/plugins/*.mdx` (5 files)
- Create: `apps/web/content/docs/decisions/*.mdx` (4 files)
- Create: `apps/web/content/docs/roadmap/index.mdx`
- Create: `apps/web/content/docs/meta.json` (root)
- Create: `apps/web/content/docs/guide/meta.json`
- Create: `apps/web/content/docs/architecture/meta.json`
- Create: `apps/web/content/docs/plugins/meta.json`
- Create: `apps/web/content/docs/decisions/meta.json`
- Create: `apps/web/content/docs/roadmap/meta.json`

**Step 1: Create meta.json files for sidebar structure**

Each `meta.json` defines the sidebar order and titles. Map from the VitePress sidebar config in `.vitepress/config.ts`.

Root `content/docs/meta.json`:

```json
{
  "title": "Documentation",
  "pages": [
    "---Guide---",
    "guide",
    "---Architecture---",
    "architecture",
    "---Plugins---",
    "plugins",
    "---Decisions---",
    "decisions",
    "---Roadmap---",
    "roadmap"
  ]
}
```

Each section meta.json lists pages in order:

```json
// content/docs/guide/meta.json
{
  "title": "Guide",
  "pages": ["getting-started", "principles", "sync", "built-in-plugins"]
}
```

**Step 2: Copy and convert .md files to .mdx**

For each of the 21 files:

1. Copy from `apps/docs-site/<path>.md` to `apps/web/content/docs/<path>.mdx`
2. Update frontmatter: ensure `title` and `description` fields exist
3. Remove VitePress-specific frontmatter (`layout: home`, `hero:`, `features:` etc.)
4. Replace VitePress-specific syntax (e.g., `:::tip` → standard markdown callouts or Fumadocs `<Callout>`)

The landing page (`index.md`) with hero/features config becomes a simple `index.mdx` with a title and intro text (the hero content lives in the marketing pages now).

**Step 3: Verify docs render**

Run: `pnpm --filter @readied/web dev`
Navigate to `http://localhost:3000/docs`
Expected: All 21 pages render with sidebar navigation

**Step 4: Commit**

```bash
git add apps/web/content/
git commit -m "feat(web): migrate 21 doc pages from VitePress to MDX"
```

---

## Task 3: Migrate shared layout (Navbar + Footer)

**Files:**

- Create: `apps/web/components/marketing/Navbar.tsx`
- Create: `apps/web/components/marketing/MobileNav.tsx` (copy from marketing-site, already React)
- Create: `apps/web/components/marketing/NavDropdown.tsx` (copy from marketing-site, already React)
- Create: `apps/web/components/marketing/Footer.tsx`
- Create: `apps/web/components/marketing/NewsletterForm.tsx` (copy from marketing-site, already React)
- Modify: `apps/web/app/layout.tsx`

**Step 1: Convert Navbar.astro → Navbar.tsx**

Rewrite as a React server component. Replace `astro-icon` `<Icon>` with `lucide-react` icons. The nav links, CTAs, and structure stay identical. Update docs link from external GitHub Pages URL to internal `/docs`.

**Step 2: Copy React components as-is**

Copy these files directly from `apps/marketing-site/src/components/`:

- `MobileNav.tsx` → `apps/web/components/marketing/MobileNav.tsx`
- `NavDropdown.tsx` → `apps/web/components/marketing/NavDropdown.tsx`
- `NewsletterForm.tsx` → `apps/web/components/marketing/NewsletterForm.tsx`

Add `"use client"` directive to each since they use state/effects.

Update docs link in MobileNav from external to `/docs`.

**Step 3: Convert Footer.astro → Footer.tsx**

Rewrite as React server component. Replace `astro-icon` with `lucide-react`. Import `NewsletterForm`. Update docs link from external GitHub Pages to `/docs`.

**Step 4: Wire Navbar + Footer into root layout**

Update `apps/web/app/layout.tsx` to import and render Navbar at top and Footer at bottom, wrapping `{children}`.

**Step 5: Verify layout renders**

Run: `pnpm --filter @readied/web dev`
Expected: Navbar and Footer appear on all pages

**Step 6: Commit**

```bash
git add apps/web/components/marketing/ apps/web/app/layout.tsx
git commit -m "feat(web): add Navbar + Footer (migrated from Astro)"
```

---

## Task 4: Migrate marketing landing page

**Files:**

- Create: `apps/web/app/page.tsx`
- Create: `apps/web/components/marketing/Hero.tsx`
- Create: `apps/web/components/marketing/Features.tsx`
- Create: `apps/web/components/marketing/SocialProof.tsx`
- Create: `apps/web/components/marketing/WhyLocal.tsx`
- Create: `apps/web/components/marketing/Audience.tsx`
- Copy: `apps/web/public/` (static assets from marketing-site: favicon, og-image, media/)

**Step 1: Copy static assets**

Copy `apps/marketing-site/public/*` → `apps/web/public/`
Copy `apps/docs-site/.vitepress/public/logo.svg` → `apps/web/public/logo.svg`

**Step 2: Convert Hero.astro → Hero.tsx**

Rewrite as React server component. Replace `<Icon>` with lucide-react. Import `getProductConfig` from `@readied/product-config`. Keep all Tailwind classes identical.

**Step 3: Convert remaining Astro components → React**

Convert each: Features.astro, SocialProof.astro, WhyLocal.astro, Audience.astro → React server components. Same pattern: replace astro-icon with lucide-react, keep Tailwind classes.

**Step 4: Create app/page.tsx**

```tsx
import { Hero } from '@/components/marketing/Hero';
import { SocialProof } from '@/components/marketing/SocialProof';
import { Features } from '@/components/marketing/Features';
import { WhyLocal } from '@/components/marketing/WhyLocal';
import { Audience } from '@/components/marketing/Audience';

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <Features />
      <WhyLocal />
      <Audience />
    </>
  );
}
```

**Step 5: Verify landing page renders**

Run: `pnpm --filter @readied/web dev`
Navigate to `http://localhost:3000`
Expected: Landing page renders with Hero, Features, etc.

**Step 6: Commit**

```bash
git add apps/web/app/page.tsx apps/web/components/marketing/ apps/web/public/
git commit -m "feat(web): migrate landing page from Astro"
```

---

## Task 5: Migrate remaining marketing pages (13 pages)

**Files:**

- Create: `apps/web/app/pricing/page.tsx`
- Create: `apps/web/app/faq/page.tsx`
- Create: `apps/web/app/download/page.tsx`
- Create: `apps/web/app/plugins/page.tsx`
- Create: `apps/web/app/changelog/page.tsx`
- Create: `apps/web/app/philosophy/page.tsx`
- Create: `apps/web/app/privacy/page.tsx`
- Create: `apps/web/app/terms/page.tsx`
- Create: `apps/web/app/subscribe/page.tsx`
- Create: `apps/web/app/shared/page.tsx`
- Create: `apps/web/app/auth/verify/page.tsx`
- Create: `apps/web/app/subscription/success/page.tsx`
- Create: `apps/web/app/subscription/cancel/page.tsx`
- Copy: `apps/web/components/shared/FaqAccordion.tsx`
- Copy: `apps/web/components/shared/ComparisonTable.tsx`
- Copy: `apps/web/components/shared/PluginFilter.tsx`
- Copy: `apps/web/components/shared/SubscribeFlow.tsx`
- Copy: `apps/web/components/shared/TypewriterDemo.tsx`
- Copy: `apps/web/components/shared/WorkflowTabs.tsx`

**Step 1: Copy existing React components**

Copy all React components from `apps/marketing-site/src/components/` that are already `.tsx`:

- FaqAccordion, ComparisonTable, PluginFilter, SubscribeFlow, TypewriterDemo, WorkflowTabs

Add `"use client"` directive where needed (components using state, effects, or event handlers).

**Step 2: Convert each Astro page → Next.js page**

For each of the 13 pages, convert from Astro to Next.js:

- Remove `---` frontmatter and Astro imports
- Replace `<Base title="...">` wrapper with a `metadata` export
- Replace `<Footer />` (now in root layout)
- Replace `astro-icon` `<Icon>` with lucide-react
- Import `@readied/product-config` where pricing/config data is used

The pricing page is the most complex (uses product-config extensively). Keep all Tailwind classes identical.

**Step 3: Verify all pages render**

Navigate to each route and verify content renders correctly.

**Step 4: Commit**

```bash
git add apps/web/app/ apps/web/components/shared/
git commit -m "feat(web): migrate 13 marketing pages from Astro"
```

---

## Task 6: Migrate ProjectBoard (Vue → React) + Tailwind globals

**Files:**

- Create: `apps/web/components/docs/ProjectBoard.tsx`
- Create: `apps/web/app/globals.css`

**Step 1: Rewrite ProjectBoard as React component**

Convert the Vue `<script setup>` + `<template>` + `<style scoped>` to a React functional component with Tailwind classes (replacing the scoped CSS). Keep the same kanban board layout with Todo/In Progress/Done columns and progress bar.

Mark as `"use client"` if it uses any client features, or keep as server component if it's purely data-driven.

**Step 2: Register ProjectBoard as MDX component**

Add it to the docs page component so it's available in MDX:

```tsx
// In app/docs/[[...slug]]/page.tsx
import { ProjectBoard } from '@/components/docs/ProjectBoard';

<MDX components={{ ...defaultMdxComponents, ProjectBoard }} />;
```

**Step 3: Create globals.css with Readied brand tokens**

Combine the marketing site's `global.css` Tailwind setup with the brand colors. Define CSS custom properties for the accent palette. Import Fumadocs UI styles.

**Step 4: Commit**

```bash
git add apps/web/components/docs/ apps/web/app/globals.css
git commit -m "feat(web): add ProjectBoard (Vue→React) + global styles"
```

---

## Task 7: Update monorepo config + cleanup

**Files:**

- Modify: `package.json` (root — update turborepo references)
- Modify: `.github/labeler.yml` (replace old paths)
- Modify: `.github/workflows/ci.yml` (add web build step)
- Modify: `CLAUDE.md` (update Structure section)
- Delete: `apps/docs-site/` (entire directory)
- Delete: `apps/marketing-site/` (entire directory)

**Step 1: Update root package.json / turbo.json**

If there are turbo pipeline references to `@readied/docs` or `@readied/marketing-site`, update to `@readied/web`.

**Step 2: Update .github/labeler.yml**

Replace:

```yaml
'app:docs': apps/docs-site/**
'app:marketing': apps/marketing-site/**
```

With:

```yaml
'app:web': apps/web/**
```

**Step 3: Update CI workflow**

Add build step for `@readied/web` if not covered by turbo.

**Step 4: Update CLAUDE.md**

Replace the `apps/docs-site/` and `apps/marketing-site/` entries in the Structure section with `apps/web/`.

**Step 5: Delete old apps**

```bash
rm -rf apps/docs-site apps/marketing-site
```

**Step 6: Run full build to verify nothing is broken**

Run: `pnpm install && pnpm build`
Expected: All packages build successfully

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove old docs-site + marketing-site, update monorepo config"
```

---

## Summary

| Task | Description                 | Effort |
| ---- | --------------------------- | ------ |
| 1    | Scaffold Next.js + Fumadocs | Medium |
| 2    | Migrate 21 doc pages        | Medium |
| 3    | Navbar + Footer             | Small  |
| 4    | Landing page                | Medium |
| 5    | 13 marketing pages          | Large  |
| 6    | ProjectBoard + styles       | Small  |
| 7    | Cleanup + config            | Small  |

Tasks 1-2 must be sequential. Tasks 3-6 can be partially parallelized after Task 1. Task 7 comes last.
