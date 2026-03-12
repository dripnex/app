# Website Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full rebuild of the marketing site with shadcn/ui + Magic UI, establishing a modern dark-mode brand identity with violet accent.

**Architecture:** Replace all current marketing components and globals.css with shadcn/ui-based components + Magic UI effects. Keep Fumadocs docs/, product-config, routes, and static export unchanged. Remove @headlessui/react.

**Tech Stack:** Next.js 15, React 19, shadcn/ui (new-york style), Magic UI (copied source), Tailwind CSS v4, framer-motion, Inter + JetBrains Mono fonts

---

## Task 1: Install Dependencies and Create Utilities

**Files:**

- Modify: `apps/web/package.json`
- Create: `apps/web/lib/utils.ts`
- Create: `apps/web/components/ui/.gitkeep` (placeholder, shadcn CLI populates this)

**Step 1: Install new dependencies**

Run from repo root:

```bash
cd apps/web
pnpm add framer-motion class-variance-authority clsx tailwind-merge tailwindcss-animate
pnpm add -D @fontsource/inter @fontsource-variable/jetbrains-mono
```

Note: `class-variance-authority`, `clsx`, `tailwind-merge` are shadcn/ui peer requirements.

**Step 2: Create `cn()` utility**

Create `apps/web/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3: Verify build**

```bash
cd apps/web && pnpm exec next build
```

Expected: Build succeeds with no new errors.

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/lib/utils.ts pnpm-lock.yaml
git commit -m "feat(web): add shadcn/ui dependencies and cn() utility"
```

---

## Task 2: Copy Magic UI Components

Magic UI components are copied as source files (not npm). Copy only the free components needed per the design doc.

**Files:**

- Create: `apps/web/components/magicui/animated-shiny-text.tsx`
- Create: `apps/web/components/magicui/border-beam.tsx`
- Create: `apps/web/components/magicui/dot-pattern.tsx`
- Create: `apps/web/components/magicui/marquee.tsx`
- Create: `apps/web/components/magicui/number-ticker.tsx`
- Create: `apps/web/components/magicui/shimmer-button.tsx`
- Create: `apps/web/components/magicui/text-reveal.tsx`
- Create: `apps/web/components/magicui/animated-grid-pattern.tsx`

**Step 1: Create each Magic UI component**

Copy source from the Magic UI docs (https://magicui.design/docs/components/). Each component is a single file that uses `framer-motion` and the `cn()` utility. Adapt imports to use `@/lib/utils`.

Key patterns:

- All components import `cn` from `@/lib/utils`
- All animation components use `framer-motion`
- Components are `'use client'` where they use hooks or framer-motion

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

Expected: Build succeeds. Magic UI components compile without errors.

**Step 3: Commit**

```bash
git add apps/web/components/magicui/
git commit -m "feat(web): add Magic UI components (source copy)"
```

---

## Task 3: Create shadcn/ui Base Components

Manually create the shadcn/ui components needed by the design (Button, Card, Badge, Separator, Accordion, Sheet). Since we use Tailwind v4 CSS-first config (no tailwind.config.js), we create these manually following shadcn/ui "new-york" style patterns.

**Files:**

- Create: `apps/web/components/ui/button.tsx`
- Create: `apps/web/components/ui/card.tsx`
- Create: `apps/web/components/ui/badge.tsx`
- Create: `apps/web/components/ui/separator.tsx`
- Create: `apps/web/components/ui/accordion.tsx`
- Create: `apps/web/components/ui/sheet.tsx`

**Step 1: Create Button component**

```tsx
// apps/web/components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]',
        ghost:
          'border border-[var(--border)] text-[var(--text-secondary)] hover:bg-white/5 hover:text-white',
        link: 'text-[var(--accent)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-7 py-3 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

Install Radix primitives needed:

```bash
cd apps/web && pnpm add @radix-ui/react-slot @radix-ui/react-accordion @radix-ui/react-dialog @radix-ui/react-separator
```

**Step 2: Create remaining UI components**

Create Card, Badge, Separator, Accordion, Sheet following shadcn/ui new-york patterns. Each uses `cn()` and CSS custom properties from our design tokens.

- **Card**: Surface background, border, rounded-xl
- **Badge**: Small label with accent/neutral variants
- **Separator**: Thin border line, horizontal/vertical
- **Accordion**: Radix-based, animated with chevron rotation
- **Sheet**: Radix Dialog-based side drawer for mobile nav

**Step 3: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 4: Commit**

```bash
git add apps/web/components/ui/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add shadcn/ui base components (Button, Card, Badge, Separator, Accordion, Sheet)"
```

---

## Task 4: Rewrite Design System (globals.css + Root Layout)

Replace current teal-accent globals.css with the violet-accent design system. Add Inter + JetBrains Mono fonts to root layout.

**Files:**

- Rewrite: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`

**Step 1: Rewrite globals.css**

Replace entire contents of `apps/web/app/globals.css`:

```css
@import 'tailwindcss';
@import 'fumadocs-ui/css/neutral.css';
@import 'fumadocs-ui/css/preset.css';

@theme {
  /* Brand colors — violet accent on dark zinc */
  --color-background: #09090b;
  --color-surface: #111113;
  --color-surface-elevated: #1a1a1f;
  --color-inset: #0c0c0e;
  --color-border: #27272a;
  --color-border-accent: rgba(139, 92, 246, 0.3);

  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #52525b;

  --color-accent: #8b5cf6;
  --color-accent-hover: #7c3aed;
  --color-accent-glow: rgba(139, 92, 246, 0.15);

  /* Font families */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
}

/* Marketing page utilities */
@layer components {
  .glass {
    @apply bg-zinc-950/80 backdrop-blur-xl border border-white/[0.06];
  }

  .glass-card {
    @apply bg-surface border border-border rounded-xl;
  }

  .glass-card-glow {
    @apply bg-surface border border-accent/30 rounded-xl;
    box-shadow: 0 0 40px var(--color-accent-glow);
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

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@utility animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out forwards;
}
```

**Step 2: Update root layout with fonts**

Modify `apps/web/app/layout.tsx` to import fonts:

```tsx
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
```

Note: `className="dark"` enforces dark-only per design. `antialiased` for crisp text.

**Step 3: Verify build**

```bash
cd apps/web && pnpm exec next build
```

Expected: Build succeeds. Page renders with new font stack and violet tokens. Fumadocs docs inherit dark theme automatically.

**Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat(web): rewrite design system — violet accent, Inter + JetBrains Mono fonts"
```

---

## Task 5: Rebuild Navbar

Replace current Navbar + NavDropdown + MobileNav (using @headlessui) with shadcn/ui-based Navbar using Sheet for mobile.

**Files:**

- Rewrite: `apps/web/components/Navbar.tsx`
- Delete: `apps/web/components/NavDropdown.tsx`
- Delete: `apps/web/components/MobileNav.tsx`

**Step 1: Rewrite Navbar**

Create new `apps/web/components/Navbar.tsx`:

- Fixed header with `backdrop-blur-xl` glassmorphism
- Logo left: `font-mono text-lg font-bold` "readied" + violet dot
- Center: nav links (Features, Pricing, Docs dropdown, Changelog)
- Right: ghost "Download" + accent "Try Pro Free" buttons using `<Button>` component
- Mobile: hamburger triggers shadcn `<Sheet>` side drawer (replaces @headlessui Dialog)
- All navigation data stays identical to current Navbar

Key differences from current:

- Uses `<Button variant="ghost">` and `<Button>` from shadcn
- Mobile uses `<Sheet>` from `components/ui/sheet.tsx` instead of `@headlessui/react` Dialog
- Dropdown uses simple hover/focus state instead of `NavDropdown` component
- Border color uses `border-border` token instead of `border-white/[0.06]`

**Step 2: Update marketing layout**

Verify `apps/web/app/(marketing)/layout.tsx` still imports from `@/components/Navbar` — no change needed since path stays the same.

**Step 3: Verify build and visual check**

```bash
cd apps/web && pnpm dev
```

Visually verify: navbar renders with violet accent, mobile sheet works, links navigate correctly.

**Step 4: Commit**

```bash
git add apps/web/components/Navbar.tsx
git rm apps/web/components/NavDropdown.tsx apps/web/components/MobileNav.tsx
git commit -m "feat(web): rebuild Navbar with shadcn Sheet for mobile"
```

---

## Task 6: Rebuild Footer

Replace current Footer with new design: logo, link columns, social icons, newsletter form, DotPattern background.

**Files:**

- Rewrite: `apps/web/components/Footer.tsx`

**Step 1: Rewrite Footer**

Create new `apps/web/components/Footer.tsx`:

- DotPattern background from Magic UI (subtle, behind content)
- Separator top border
- Logo + tagline
- 4 navigation columns (Product, Resources, Legal, Connect) — same links as current
- Bottom bar: copyright + compact NewsletterForm
- Social icons: GitHub, Twitter (keep inline SVGs, style with accent hover)
- All colors use design token CSS variables

Structure matches current Footer but with:

- DotPattern behind the content (absolute positioned, low opacity)
- `<Separator />` component at top instead of raw `border-t`
- Hover states use accent color consistently

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/components/Footer.tsx
git commit -m "feat(web): rebuild Footer with DotPattern background"
```

---

## Task 7: Rebuild Hero Section

Replace current Hero with Magic UI effects: AnimatedShinyText badge, ShimmerButton CTA, DotPattern background, BorderBeam on screenshot frame.

**Files:**

- Rewrite: `apps/web/components/landing/Hero.tsx`

**Step 1: Rewrite Hero**

Create new `apps/web/components/landing/Hero.tsx`:

```
Structure:
├── DotPattern (absolute, behind everything)
├── AnimatedShinyText badge ("v0.6 · Early access")
├── h1: "Your markdown, your machine, your rules."
│   └── gradient-text on middle line
├── Subtitle paragraph
├── CTAs row:
│   ├── ShimmerButton "Download" (primary)
│   └── Button variant="ghost" "View on GitHub"
├── Trust badges row (Offline, Cross-platform, Free/Pro trial)
└── Editor screenshot
    ├── <img> (same hero-editor.svg)
    └── BorderBeam frame (animated glow border)
```

Key implementation details:

- `DotPattern` with `className="[mask-image:radial-gradient(...)]"` for fade-out edges
- `AnimatedShinyText` wraps the version badge text
- `ShimmerButton` replaces plain accent button for primary CTA
- `BorderBeam` wraps the screenshot `<div>` for animated border glow
- Keep `getProductConfig()` for trial days
- Add `'use client'` since Magic UI components use framer-motion

**Step 2: Verify visually**

```bash
cd apps/web && pnpm dev
```

Check: DotPattern renders, ShimmerButton animates, BorderBeam glows around screenshot.

**Step 3: Commit**

```bash
git add apps/web/components/landing/Hero.tsx
git commit -m "feat(web): rebuild Hero with Magic UI effects"
```

---

## Task 8: Rebuild Social Proof with Marquee

Replace current SocialProof badges with Magic UI Marquee for horizontal scroll.

**Files:**

- Rewrite: `apps/web/components/landing/SocialProof.tsx`

**Step 1: Rewrite SocialProof**

Create new `apps/web/components/landing/SocialProof.tsx`:

- `<Marquee>` component wrapping trust badges
- Badges: Offline First, Local Storage, Open Source, Plugin System, Cross-platform
- Each badge is a `glass-card` styled pill with icon + text
- Marquee auto-scrolls horizontally with pause on hover
- Gradient fade on edges via Marquee's built-in mask

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/components/landing/SocialProof.tsx
git commit -m "feat(web): rebuild SocialProof with Marquee scroll"
```

---

## Task 9: Rebuild Features Section with BorderBeam

Replace current Features grid with 3 large cards that show BorderBeam on hover.

**Files:**

- Rewrite: `apps/web/components/landing/Features.tsx`

**Step 1: Rewrite Features**

Create new `apps/web/components/landing/Features.tsx`:

- Section label + heading
- 3 large cards in responsive grid (1 col mobile, 3 col desktop)
- Each card: icon (lucide-react), title, description
- Cards use `<Card>` from shadcn/ui with glass-card styling
- `<BorderBeam>` rendered inside each card, visible on hover via group hover state
- Features:
  1. **Markdown Sacred** — FileText icon — Your markdown is never auto-modified
  2. **Plugin Ecosystem** — Puzzle icon — 8 built-in plugins, extensible architecture
  3. **Offline First** — WifiOff icon — Works 100% offline, optional cloud sync

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/components/landing/Features.tsx
git commit -m "feat(web): rebuild Features with BorderBeam hover cards"
```

---

## Task 10: Rebuild WhyLocal Section with TextReveal

Replace current WhyLocal with split layout: TextReveal heading left, comparison table right.

**Files:**

- Rewrite: `apps/web/components/landing/WhyLocal.tsx`
- Delete: `apps/web/components/landing/ComparisonTable.tsx` (inline into WhyLocal)

**Step 1: Rewrite WhyLocal**

Create new `apps/web/components/landing/WhyLocal.tsx`:

- Split layout: text content left, comparison card right
- Left side:
  - Section label "Why Local"
  - TextReveal animated heading: "Your notes should live on your machine"
  - Body text explaining offline-first philosophy
- Right side:
  - `<Card>` with comparison table
  - Rows: Data Location, Internet Required, Export, Sync, Vendor Lock-in
  - Columns: Readied vs Cloud Apps
  - Readied column highlights with accent color checks

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/components/landing/WhyLocal.tsx
git rm apps/web/components/landing/ComparisonTable.tsx
git commit -m "feat(web): rebuild WhyLocal with TextReveal animation"
```

---

## Task 11: Rebuild Audience Section

Replace current Audience component. This was a "who is this for" section — redesign as a clean card grid.

**Files:**

- Rewrite: `apps/web/components/landing/Audience.tsx`

**Step 1: Rewrite Audience**

Minimal glass-card grid showing target audiences:

- Developers, Writers, Privacy advocates
- Each card: icon + title + one-liner
- Simple fade-in animation, no Magic UI (keeps section lightweight)

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/components/landing/Audience.tsx
git commit -m "feat(web): rebuild Audience section"
```

---

## Task 12: Rebuild Pricing Page with NumberTicker + Accordion

Replace current pricing page with shadcn/ui Card + Badge + Accordion + Magic UI NumberTicker.

**Files:**

- Rewrite: `apps/web/app/(marketing)/pricing/page.tsx`
- Delete: `apps/web/components/FaqAccordion.tsx` (use shadcn Accordion inline)

**Step 1: Rewrite pricing page**

Create new `apps/web/app/(marketing)/pricing/page.tsx`:

- Keep all data from `getProductConfig()` — same source of truth
- Two `<Card>` components (Free / Pro)
- Pro card: permanent `<BorderBeam>` + `<Badge>` "Popular"
- `<NumberTicker>` for animated price display
- FAQ section uses shadcn `<Accordion>` component instead of raw `<details>`
- Trust signals row: no credit card, data local, cancel anytime
- Same links and CTAs, restyled with `<Button>` variants

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/app/(marketing)/pricing/page.tsx
git rm apps/web/components/FaqAccordion.tsx
git commit -m "feat(web): rebuild Pricing with NumberTicker and shadcn Accordion"
```

---

## Task 13: Rebuild Download Page

Restyle the Download page with new design system. Keep the async data fetching and platform detection.

**Files:**

- Rewrite: `apps/web/app/(marketing)/download/page.tsx`

**Step 1: Rewrite download page**

Create new `apps/web/app/(marketing)/download/page.tsx`:

- Keep `fetchLatestRelease()` and `PlatformAsset` logic unchanged
- `<AnimatedShinyText>` for version badge
- Platform cards use `<Card>` from shadcn/ui
- Download buttons use `<Button>` variants
- System requirements use `<Card>` + `<Separator>`
- Same platform icons (inline SVGs), restyled with accent color

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/app/(marketing)/download/page.tsx
git commit -m "feat(web): rebuild Download page with shadcn Cards"
```

---

## Task 14: Restyle Remaining Pages

Apply new design tokens and component styles to secondary pages that don't need full rebuilds.

**Files:**

- Modify: `apps/web/app/(marketing)/faq/page.tsx` — use shadcn Accordion
- Modify: `apps/web/app/(marketing)/philosophy/page.tsx` — update colors to design tokens
- Modify: `apps/web/app/(marketing)/changelog/page.tsx` — update colors
- Modify: `apps/web/app/(marketing)/plugins/page.tsx` — update colors, use Card
- Modify: `apps/web/app/(marketing)/terms/page.tsx` — update colors
- Modify: `apps/web/app/(marketing)/privacy/page.tsx` — update colors
- Modify: `apps/web/app/(marketing)/subscribe/page.tsx` — update colors

**Step 1: Update each page**

For each page:

- Replace hardcoded color values (`text-[#a1a1aa]`) with Tailwind token classes (`text-text-secondary`)
- Replace raw `<details>` with shadcn `<Accordion>` where applicable (faq page)
- Replace raw button styles with `<Button>` component
- Replace raw card styles with `<Card>` component
- Keep all logic, data fetching, and product-config usage identical

**Step 2: Verify build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit**

```bash
git add apps/web/app/(marketing)/
git commit -m "feat(web): restyle secondary pages with new design tokens"
```

---

## Task 15: Update Homepage Composition

Update the homepage to include the new section order if needed.

**Files:**

- Modify: `apps/web/app/(marketing)/page.tsx`

**Step 1: Verify homepage composition**

Current order: Hero → SocialProof → Features → WhyLocal → Audience

This matches the design doc. No structural change needed — the individual components were already rebuilt in Tasks 7–11. Just verify the imports still work.

**Step 2: Verify full build**

```bash
cd apps/web && pnpm exec next build
```

**Step 3: Commit (only if changes needed)**

```bash
git add apps/web/app/(marketing)/page.tsx
git commit -m "feat(web): update homepage section composition"
```

---

## Task 16: Cleanup — Remove @headlessui and Dead Code

Remove deprecated dependencies and unused files.

**Files:**

- Modify: `apps/web/package.json` — remove `@headlessui/react`
- Delete: `apps/web/components/NavDropdown.tsx` (if not already deleted in Task 5)
- Delete: `apps/web/components/MobileNav.tsx` (if not already deleted in Task 5)
- Delete: `apps/web/components/FaqAccordion.tsx` (if not already deleted in Task 12)
- Delete: `apps/web/components/SubscribeFlow.tsx` (if unused after redesign)
- Delete: `apps/web/components/PluginFilter.tsx` (verify if still needed by plugins page)

**Step 1: Remove @headlessui**

```bash
cd apps/web && pnpm remove @headlessui/react
```

**Step 2: Verify no remaining imports**

```bash
grep -r "@headlessui" apps/web/
```

Expected: No results.

**Step 3: Full build verification**

```bash
cd apps/web && pnpm exec next build
```

Expected: Clean build, no errors.

**Step 4: Commit**

```bash
git add -A apps/web/
git commit -m "chore(web): remove @headlessui/react and dead components"
```

---

## Task 17: Final Verification

Full end-to-end verification of the redesigned site.

**Step 1: Clean build**

```bash
cd apps/web && rm -rf .next out && pnpm exec fumadocs-mdx && pnpm exec next build
```

Expected: Build succeeds, `out/` directory generated for static export.

**Step 2: Visual verification checklist**

```bash
cd apps/web && pnpm dev
```

Verify each page:

- [ ] `/` — Hero with DotPattern, ShimmerButton, BorderBeam screenshot, Marquee social proof, Features with hover BorderBeam, WhyLocal with TextReveal, Audience cards
- [ ] `/pricing` — NumberTicker prices, BorderBeam on Pro card, Accordion FAQs
- [ ] `/download` — AnimatedShinyText version badge, platform Cards
- [ ] `/docs` — Fumadocs renders correctly with dark theme
- [ ] `/faq` — Accordion works
- [ ] `/philosophy` — Restyled with new tokens
- [ ] `/changelog` — Restyled
- [ ] `/plugins` — Restyled
- [ ] `/terms`, `/privacy` — Legal pages render
- [ ] Mobile nav — Sheet opens/closes, all links work
- [ ] Fonts — Inter for headings/body, JetBrains Mono for code/logo/badges

**Step 3: Commit any fixes**

```bash
git add -A apps/web/
git commit -m "fix(web): final polish and visual fixes"
```

---

## Dependency Summary

| Package                               | Purpose                    | Task |
| ------------------------------------- | -------------------------- | ---- |
| `framer-motion`                       | Magic UI animations        | 1    |
| `class-variance-authority`            | shadcn/ui variant system   | 1    |
| `clsx`                                | Class name composition     | 1    |
| `tailwind-merge`                      | Tailwind class merging     | 1    |
| `tailwindcss-animate`                 | Animation utilities        | 1    |
| `@fontsource/inter`                   | Inter font (headings/body) | 1    |
| `@fontsource-variable/jetbrains-mono` | JetBrains Mono (code/logo) | 1    |
| `@radix-ui/react-slot`                | shadcn Button asChild      | 3    |
| `@radix-ui/react-accordion`           | shadcn Accordion           | 3    |
| `@radix-ui/react-dialog`              | shadcn Sheet               | 3    |
| `@radix-ui/react-separator`           | shadcn Separator           | 3    |

## Files Removed

| File                                     | Replaced By                     | Task |
| ---------------------------------------- | ------------------------------- | ---- |
| `components/NavDropdown.tsx`             | Inline hover dropdown in Navbar | 5    |
| `components/MobileNav.tsx`               | shadcn Sheet in Navbar          | 5    |
| `components/FaqAccordion.tsx`            | shadcn Accordion                | 12   |
| `components/landing/ComparisonTable.tsx` | Inlined into WhyLocal           | 10   |
| `@headlessui/react` (dep)                | shadcn Sheet + Accordion        | 16   |

## Files Unchanged

- `apps/web/app/docs/` — Fumadocs (inherits dark theme)
- `apps/web/lib/github.ts` — Release fetching
- `apps/web/lib/source.ts` — Fumadocs source
- `apps/web/next.config.mjs` — Static export config
- `apps/web/postcss.config.mjs` — Tailwind PostCSS
- `packages/product-config/` — Pricing source of truth
- `apps/web/components/NewsletterForm.tsx` — Newsletter (restyle only)
