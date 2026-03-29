# Marketing Site Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use `frontend-design:frontend-design` skill for each page/component redesign task.

**Goal:** Complete redesign of the Readied marketing site with a "Code-First Showcase" approach — Raycast-inspired, playful technical, targeting developers.

**Architecture:** Astro static site with React islands for interactivity. Tailwind CSS for styling. All pricing/plan data sourced from `@readied/product-config`. New design system with violet-indigo gradient accent, glassmorphism surfaces, and scroll-triggered animations.

**Tech Stack:** Astro 5, React 18, Tailwind CSS 3, astro-icon (Lucide + SimpleIcons), @headlessui/react

**Design Doc:** `docs/plans/2026-02-18-marketing-site-redesign-design.md`

---

## Task 1: Update Design System (Tailwind + Global CSS)

**Files:**

- Modify: `apps/marketing-site/tailwind.config.mjs`
- Modify: `apps/marketing-site/src/styles/global.css`

**Step 1: Update tailwind.config.mjs**

Replace the entire config with the new design system:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#09090b',
        surface: '#18181b',
        elevated: '#27272a',
        inset: '#0f0f10',
        border: '#3f3f46',
        accent: {
          DEFAULT: '#8b5cf6',
          hover: '#a78bfa',
          muted: 'rgba(139, 92, 246, 0.15)',
          indigo: '#6366f1',
        },
        success: '#22c55e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.2)' },
        },
      },
    },
  },
  plugins: [],
};
```

**Step 2: Update global.css**

Replace with new base styles including glassmorphism utilities:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-base text-zinc-50 font-sans antialiased leading-relaxed overflow-x-hidden;
  }

  ::selection {
    @apply bg-accent/30 text-white;
  }
}

@layer components {
  .glass {
    @apply bg-zinc-950/80 backdrop-blur-xl border border-white/[0.06];
  }

  .glass-card {
    @apply bg-surface border border-zinc-800 rounded-xl;
  }

  .glass-card-glow {
    @apply bg-surface border border-accent/30 rounded-xl;
    box-shadow: 0 0 40px rgba(139, 92, 246, 0.1);
  }

  .gradient-text {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400;
  }

  .section-label {
    @apply inline-block font-mono text-xs font-semibold uppercase tracking-widest text-accent mb-4;
  }

  .section-heading {
    @apply text-3xl font-bold leading-tight tracking-tight lg:text-4xl mb-4;
  }
}
```

**Step 3: Verify build**

Run: `cd apps/marketing-site && pnpm build`
Expected: Build succeeds (pages may have visual changes but no errors)

**Step 4: Commit**

```bash
git add apps/marketing-site/tailwind.config.mjs apps/marketing-site/src/styles/global.css
git commit -m "feat(marketing-site): update design system — new color palette, glassmorphism utilities"
```

---

## Task 2: Redesign Base Layout + Navbar

**Files:**

- Modify: `apps/marketing-site/src/layouts/Base.astro`
- Modify: `apps/marketing-site/src/components/Navbar.astro`
- Modify: `apps/marketing-site/src/components/MobileNav.tsx`
- Modify: `apps/marketing-site/src/components/NavDropdown.tsx`

**Context:**

- Current Navbar is `fixed top-0` with `bg-base border-b`
- New: glassmorphism (`bg-zinc-950/80 backdrop-blur-xl`), dual CTAs
- Nav links change: Features, Pricing, Docs dropdown (Philosophy, FAQ, Plugins), Changelog
- Dual CTA: "Download" (ghost) + "Try Pro Free →" (filled accent gradient)
- Logo: text "readied" in monospace with accent dot, replacing SVG logo
- Mobile: full-screen overlay menu

**Step 1: Update Base.astro**

Update `<meta name="theme-color">` to `#09090b`. Keep everything else the same.

**Step 2: Redesign Navbar.astro**

Key changes:

- Header class: `glass` utility (backdrop-blur, semi-transparent)
- Replace logo SVG with text logo: `<span class="font-mono text-lg font-bold text-zinc-50">readied<span class="text-accent">.</span></span>`
- Nav links: Features (anchor to #features on homepage), Pricing, Docs dropdown, Changelog
- Dual CTAs: Download (outline/ghost button) + Try Pro Free (filled accent button with arrow)
- Update MobileNav props to match new nav structure

**Step 3: Update NavDropdown.tsx**

Update styling to use glassmorphism for the dropdown panel. Keep the Headless UI logic.

**Step 4: Update MobileNav.tsx**

Update styling: full-screen overlay with glassmorphism background, larger touch targets, accent colors.

**Step 5: Verify**

Run: `cd apps/marketing-site && pnpm build`

**Step 6: Commit**

```bash
git add apps/marketing-site/src/layouts/Base.astro apps/marketing-site/src/components/Navbar.astro apps/marketing-site/src/components/MobileNav.tsx apps/marketing-site/src/components/NavDropdown.tsx
git commit -m "feat(marketing-site): redesign navbar — glassmorphism, dual CTAs, text logo"
```

---

## Task 3: Redesign Footer

**Files:**

- Modify: `apps/marketing-site/src/components/Footer.astro`

**Context:**

- Current: logo + newsletter top row, 4-column nav, bottom bar
- New: larger brand section with tagline, 4-column links (Product, Resources, Legal, Connect), newsletter, "Built with love for developers"
- Max width stays max-w-4xl

**Step 1: Redesign Footer.astro**

Key changes:

- Replace logo img with text logo: `readied.` in monospace
- Update tagline: "The note app that stays out of your way."
- Add "Features" link to Product column
- Bottom bar: copyright + newsletter input inline
- Keep NewsletterForm component (client:idle)

**Step 2: Verify and commit**

```bash
git add apps/marketing-site/src/components/Footer.astro
git commit -m "feat(marketing-site): redesign footer — text logo, updated layout"
```

---

## Task 4: Create New Interactive Components

**Files:**

- Create: `apps/marketing-site/src/components/TypewriterDemo.tsx`
- Create: `apps/marketing-site/src/components/WorkflowTabs.tsx`
- Create: `apps/marketing-site/src/components/ComparisonTable.tsx`
- Create: `apps/marketing-site/src/components/SocialProof.astro`

**Step 1: Create TypewriterDemo.tsx**

React component that shows a split-screen: left side types markdown text character by character, right side renders the result in real-time. Uses `useState` + `useEffect` with `setInterval`.

Markdown content to type:

```
# Project Notes

Welcome to the project.

## Key Decisions

- Use local-first architecture
- Standard Markdown format only
- No cloud dependency

> Your files, your disk, your rules.
```

Left pane: monospace, syntax-highlighted markdown text appearing character by character
Right pane: rendered HTML preview updating as text appears

**Step 2: Create WorkflowTabs.tsx**

React component with 3 tabs: Write | Organize | Search
Each tab shows a different editor mockup:

- Write: markdown editor with preview (similar to current Features mockup)
- Organize: file tree with notebooks/folders
- Search: search results with highlighted matches

Uses Headless UI Tab component for accessibility.

**Step 3: Create ComparisonTable.tsx**

Static comparison: "Cloud note apps" vs "Readied"
4 rows with animated checkmarks/crosses:

- Server dependency → Works offline
- Vendor lock-in → Standard .md files
- Monthly subscription → Free forever
- Privacy concerns → 100% local

**Step 4: Create SocialProof.astro**

Server-rendered bar with:

- GitHub stars count (fetched at build time from existing `lib/github.ts`)
- "Works 100% offline" badge
- "Standard Markdown" badge
- Platform icons (macOS, Windows, Linux)

**Step 5: Verify and commit**

```bash
git add apps/marketing-site/src/components/TypewriterDemo.tsx apps/marketing-site/src/components/WorkflowTabs.tsx apps/marketing-site/src/components/ComparisonTable.tsx apps/marketing-site/src/components/SocialProof.astro
git commit -m "feat(marketing-site): add interactive components — typewriter demo, workflow tabs, comparison table"
```

---

## Task 5: Redesign Homepage (Hero + All Sections)

**Files:**

- Modify: `apps/marketing-site/src/pages/index.astro`
- Modify: `apps/marketing-site/src/components/Hero.astro`
- Modify: `apps/marketing-site/src/components/Features.astro`
- Modify: `apps/marketing-site/src/components/WhyLocal.astro`
- Modify: `apps/marketing-site/src/components/Audience.astro`

**Context from design doc:**

Homepage sections in order:

1. Hero — badge, headline "Your Markdown. Your Machine. Your Rules.", dual CTAs, TypewriterDemo
2. SocialProof bar
3. Features grid — 6 cards with code snippets
4. ComparisonTable — "Why Local?"
5. WorkflowTabs — tabbed editor showcase
6. Final CTA — "Ready to own your notes?"
7. Footer

**Step 1: Update index.astro**

New section order:

```astro
<Hero />
<SocialProof />
<Features />
<ComparisonTable />  <!-- replaces WhyLocal -->
<WorkflowTabs />     <!-- replaces Audience use-case section -->
<CTA section />      <!-- inline final CTA -->
<Footer />
```

Note: Keep Audience.astro for the indie developer card, integrate it into the final CTA section.

**Step 2: Redesign Hero.astro**

- New headline: "Your Markdown. Your Machine. Your Rules." (each line on its own, "Your Machine" has gradient-text class)
- Subtext: "The note app that respects your files, your privacy, and your workflow. No cloud. No lock-in. Just Markdown."
- Dual CTAs: "Download Free" (filled, with download icon) + "Start Pro Trial →" (outline)
- Below CTAs: trust badges (Offline-first, Cross-platform, Free forever)
- Below everything: TypewriterDemo component (client:load)
- Version badge at top: "v0.6.2 — Now with AI assist" (fetch from product-config or hardcode)

**Step 3: Redesign Features.astro**

- 6 feature cards in 3x2 grid
- Each card has: icon area with code snippet/mockup (not generic icons), title, description
- Features: Local Files, Offline First, Fast & Light, Backlinks, CodeMirror Editor, AI Assist (Pro badge)
- Code snippets show real use: file paths, markdown syntax, search queries, etc.

**Step 4: Redesign WhyLocal.astro → now uses ComparisonTable**

Replace the 3-step "how it works" with the ComparisonTable component. Keep the section header but update copy:

- Header: "Why local-first?"
- Subtext: "Most note apps treat your data like their business asset. We don't."

**Step 5: Redesign Audience.astro → Final CTA section**

Replace use-case cards with a clean CTA section:

- "Ready to own your notes?"
- Brief description
- Dual CTAs
- Trust signals (Free forever, 14-day Pro trial, 100% offline)
- Keep indie developer card below as social proof

**Step 6: Verify and commit**

```bash
git add apps/marketing-site/src/pages/index.astro apps/marketing-site/src/components/Hero.astro apps/marketing-site/src/components/Features.astro apps/marketing-site/src/components/WhyLocal.astro apps/marketing-site/src/components/Audience.astro
git commit -m "feat(marketing-site): redesign homepage — hero with typewriter demo, new features grid, comparison table"
```

---

## Task 6: Redesign Pricing Page

**Files:**

- Modify: `apps/marketing-site/src/pages/pricing.astro`

**Context:**

- Current: app preview mockup + two pricing cards + FAQ
- New: remove app preview, glassmorphism cards, Pro card with glow border, toggleable feature checklist, trust signals, FAQ accordion

**Step 1: Redesign pricing.astro**

Key changes:

- Remove the app preview mockup at top (it's now in the homepage hero)
- Free card: `glass-card` class, check icons for features
- Pro card: `glass-card-glow` class (glowing accent border), "Most popular" badge
- Pricing display: monthly + annual toggle or side-by-side with savings badge
- Pro CTA: "Start 14-day free trial" — prominent, filled accent
- Below cards: trust signals row (No credit card, Data stays local, Cancel anytime)
- FAQ section stays, update styling to match new design

**Step 2: Verify and commit**

```bash
git add apps/marketing-site/src/pages/pricing.astro
git commit -m "feat(marketing-site): redesign pricing page — glassmorphism cards, glow effect on Pro"
```

---

## Task 7: Redesign Download Page

**Files:**

- Modify: `apps/marketing-site/src/pages/download.astro`

**Context:**

- Current: header + app preview + 3 platform cards + system requirements + verification
- New: auto-detect OS, highlight correct platform, collapsible other platforms, installation code blocks, remove large app preview (already in homepage)

**Step 1: Redesign download.astro**

Key changes:

- Detect user OS via `navigator.userAgent` (client-side, progressively enhanced)
- Primary: large download button for detected OS
- Secondary: collapsible section "Other platforms" with the remaining OS options
- Add installation instructions as code blocks:
  - macOS: `brew install --cask readied` (if applicable) or DMG instructions
  - Windows: installer steps
  - Linux: AppImage chmod instructions
- "Free forever" badge prominent
- Version + link to changelog
- Remove the large app mockup (duplicated from homepage)
- Keep system requirements section, style with glass-card

**Step 2: Verify and commit**

```bash
git add apps/marketing-site/src/pages/download.astro
git commit -m "feat(marketing-site): redesign download page — OS auto-detect, installation instructions"
```

---

## Task 8: Redesign Changelog Page

**Files:**

- Modify: `apps/marketing-site/src/pages/changelog.astro`

**Context:**

- Current: timeline with color-coded change types
- New: add category filters, visual diff indicators, subscribe CTA

**Step 1: Redesign changelog.astro**

Key changes:

- Add filter buttons at top: All | Features | Fixes | Breaking (client-side filtering)
- Keep timeline visualization but enhance:
  - Larger version badges
  - Better spacing between releases
  - Collapsible older releases (show last 5 expanded, rest collapsed)
- "Subscribe to updates" CTA at top with newsletter form
- Better empty state if no releases
- Style updates to match new design system

**Step 2: Verify and commit**

```bash
git add apps/marketing-site/src/pages/changelog.astro
git commit -m "feat(marketing-site): redesign changelog — category filters, subscribe CTA"
```

---

## Task 9: Redesign Philosophy Page

**Files:**

- Modify: `apps/marketing-site/src/pages/philosophy.astro`

**Context:**

- Current: numbered sections as cards
- New: narrative scroll with full-viewport sections, large typography, code examples

**Step 1: Redesign philosophy.astro**

Key changes:

- Each section takes more vertical space (not cards, but full sections with large text)
- Large pull quotes with gradient-text for highlights
- Code examples showing what Readied does vs doesn't do:
  ```
  // What happens when you delete Readied:
  ~/notes/
    project.md     ← still here
    ideas.md       ← still here
    journal/       ← still here
  // Your files never depended on us.
  ```
- Scroll-triggered animations (fade-in-up on each section)
- End with strong CTA: "Ready to try software that respects your files?"

**Step 2: Verify and commit**

```bash
git add apps/marketing-site/src/pages/philosophy.astro
git commit -m "feat(marketing-site): redesign philosophy — narrative scroll, code examples"
```

---

## Task 10: Redesign FAQ Page

**Files:**

- Modify: `apps/marketing-site/src/pages/faq.astro`
- Modify: `apps/marketing-site/src/components/FaqAccordion.tsx`

**Context:**

- Current: 2-column grid with category sections + FaqAccordion component
- New: searchable, tabbed categories, single-column for readability

**Step 1: Redesign faq.astro**

Key changes:

- Category tabs at top (General, Features, Pricing, Technical) — clickable, highlight active
- Single-column accordion below (filtered by selected category)
- Search input at top with instant filtering
- Better styling: glass-card for each FAQ item, smooth open/close animation

**Step 2: Update FaqAccordion.tsx**

Add search prop and filter logic. Update styling to match new design.

**Step 3: Verify and commit**

```bash
git add apps/marketing-site/src/pages/faq.astro apps/marketing-site/src/components/FaqAccordion.tsx
git commit -m "feat(marketing-site): redesign FAQ — searchable, tabbed categories"
```

---

## Task 11: Redesign Plugins Page

**Files:**

- Modify: `apps/marketing-site/src/pages/plugins.astro`
- Modify: `apps/marketing-site/src/components/PluginFilter.tsx`

**Context:**

- Current: header + PluginFilter component
- New: featured plugins section, card grid with better styling, install command per plugin

**Step 1: Redesign plugins.astro + PluginFilter.tsx**

Key changes:

- "Featured" plugins row at top (2-3 highlighted plugins with larger cards)
- Search/filter bar with category buttons
- Plugin cards: glass-card style, icon, name, description, install command (copyable code block)
- Better empty state when no plugins match filter

**Step 2: Verify and commit**

```bash
git add apps/marketing-site/src/pages/plugins.astro apps/marketing-site/src/components/PluginFilter.tsx
git commit -m "feat(marketing-site): redesign plugins page — featured section, install commands"
```

---

## Task 12: Redesign Terms & Privacy Pages

**Files:**

- Modify: `apps/marketing-site/src/pages/terms.astro`
- Modify: `apps/marketing-site/src/pages/privacy.astro`

**Context:**

- Current: standard text pages
- New: same design system, wider content area, table of contents sidebar

**Step 1: Update terms.astro and privacy.astro**

Key changes:

- Wider max-width (max-w-5xl instead of max-w-4xl)
- Grid layout: sticky TOC sidebar (left, 200px) + content (right)
- TOC auto-generated from h2 headings
- Better typography for legal text: larger line-height, clear heading hierarchy
- Mobile: TOC collapses to horizontal scroll or dropdown

**Step 2: Verify and commit**

```bash
git add apps/marketing-site/src/pages/terms.astro apps/marketing-site/src/pages/privacy.astro
git commit -m "feat(marketing-site): redesign terms & privacy — TOC sidebar, wider layout"
```

---

## Task 13: Final Verification & Polish

**Files:**

- All modified files

**Step 1: Full build test**

Run: `cd apps/marketing-site && pnpm build`
Expected: Clean build, no errors

**Step 2: Visual review**

Run: `cd apps/marketing-site && pnpm preview`
Check every page manually:

- [ ] Homepage: hero, social proof, features, comparison, workflow tabs, CTA, footer
- [ ] Pricing: cards, trust signals, FAQ
- [ ] Download: OS detection, platform cards
- [ ] Changelog: timeline, filters
- [ ] Philosophy: scroll sections, code examples
- [ ] FAQ: tabs, search, accordion
- [ ] Plugins: featured, filter, cards
- [ ] Terms & Privacy: TOC, content
- [ ] 404: styled correctly
- [ ] Mobile responsive on all pages

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A apps/marketing-site/
git commit -m "feat(marketing-site): complete Code-First Showcase redesign"
```

---

## Execution Notes

- **Each task should use the `frontend-design:frontend-design` skill** for the actual component/page code generation
- Tasks 1-3 (design system, navbar, footer) must be done first — they affect all other pages
- Tasks 4-5 (interactive components + homepage) depend on Tasks 1-3
- Tasks 6-12 (other pages) can be done in parallel after Tasks 1-5
- Task 13 (verification) must be last
- All data should continue to come from `@readied/product-config` — never hardcode pricing or plan features
