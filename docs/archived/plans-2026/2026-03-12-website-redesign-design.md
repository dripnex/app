# Website Redesign — shadcn/ui + Magic UI

## Goal

Full rebuild of the marketing site with shadcn/ui as component system and Magic UI for animated effects. Establish a cohesive, modern, minimal brand identity from scratch.

## Design Decisions

- **Aesthetic:** Minimal & Clean (Linear/Vercel/Raycast style)
- **Color:** Neutral Cool + Violet accent
- **Theme:** Dark mode only
- **Motion:** Moderate — fade-ins, shimmer, border beams, subtle backgrounds
- **Logo:** Text-based "dripnex." in JetBrains Mono, violet dot
- **Approach:** Full rebuild of all marketing components

## Color Palette

| Token                | Value                   | Use                   |
| -------------------- | ----------------------- | --------------------- |
| `--background`       | `#09090b`               | Page background       |
| `--surface`          | `#111113`               | Cards, sections       |
| `--surface-elevated` | `#1a1a1f`               | Hover, elevated cards |
| `--border`           | `#27272a`               | Subtle borders        |
| `--border-accent`    | `rgba(139,92,246,0.3)`  | Highlighted borders   |
| `--text-primary`     | `#fafafa`               | Headings              |
| `--text-secondary`   | `#a1a1aa`               | Body text             |
| `--text-muted`       | `#52525b`               | Captions, hints       |
| `--accent`           | `#8b5cf6`               | Primary (violet-500)  |
| `--accent-hover`     | `#7c3aed`               | Hover (violet-600)    |
| `--accent-glow`      | `rgba(139,92,246,0.15)` | Glow effects          |

## Typography

- **Headings:** Inter (tight tracking, semibold/bold)
- **Body:** Inter (regular, relaxed line height)
- **Mono:** JetBrains Mono (code, badges, logo)

## Component Stack

### shadcn/ui (base system)

- Button, Card, Badge, Separator, Accordion, Sheet

### Magic UI (free effects)

- AnimatedShinyText — Hero badge
- BorderBeam — Card glow on hover, screenshot frame
- DotPattern — Hero background
- AnimatedGridPattern — Alternative background
- Marquee — Social proof horizontal scroll
- NumberTicker — Animated pricing number
- ShimmerButton — Primary CTA
- TextReveal — "Why Local" heading animation

## Page Structure

### Navbar

- Fixed, backdrop-blur glassmorphism
- Logo left, links center, CTA right
- Mobile: shadcn Sheet as side drawer

### Hero

- AnimatedShinyText version badge
- Large heading: "Your markdown, your machine, your rules."
- Two CTAs: ShimmerButton "Download" + ghost "View on GitHub"
- DotPattern background
- Editor screenshot with BorderBeam frame

### Social Proof

- Marquee with trust badges (Offline, Local, Open Source, Plugins, Cross-platform)

### Features

- 3 large cards with icon + title + description
- BorderBeam on hover
- Core features: Markdown Sacred, Plugin Ecosystem, Offline First

### Why Local

- Split: text left, comparison table right
- TextReveal animated heading
- shadcn Card for comparison table

### Pricing

- Two Cards (Free / Pro)
- Pro card with permanent BorderBeam + "Popular" Badge
- NumberTicker for price
- Accordion FAQs below

### Download

- Auto-detect OS, primary card for current OS
- Secondary cards for other platforms
- AnimatedShinyText version badge

### Footer

- Minimal: logo, link columns, social icons, newsletter
- Separator top, DotPattern background

## Technical Architecture

### New Dependencies

- shadcn/ui (CLI init, "new-york" style)
- framer-motion (Magic UI requirement)
- @fontsource/inter + @fontsource/jetbrains-mono
- tailwindcss-animate

### File Structure

```
apps/web/
├── components/
│   ├── ui/              ← shadcn/ui (Button, Card, Badge, etc.)
│   ├── magicui/         ← Magic UI (copied source, not npm)
│   ├── layout/          ← Navbar, Footer, MobileNav
│   └── landing/         ← Hero, Features, WhyLocal, Pricing, etc.
├── lib/
│   └── utils.ts         ← cn() helper
├── app/
│   ├── globals.css      ← Design tokens + shadcn CSS vars
│   ├── layout.tsx       ← Root layout with fonts
│   ├── (marketing)/     ← Same routes
│   └── docs/            ← Fumadocs (untouched)
```

### Unchanged

- Fumadocs docs/ — inherits dark theme
- Marketing routes — same paths
- product-config — source of truth for pricing
- Static export to Cloudflare Pages

### Removed

- @headlessui/react — replaced by shadcn Sheet/Accordion
- Current landing/ components — rewritten
- Current globals.css — rewritten with shadcn vars
- Custom glassmorphism classes — replaced

## Out of Scope

- Docs styling changes (Fumadocs handles this)
- New marketing pages (only redesign existing)
- Backend/API changes
- Desktop app changes
