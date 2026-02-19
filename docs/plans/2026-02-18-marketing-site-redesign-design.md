# Marketing Site Redesign — Code-First Showcase

**Date:** 2026-02-18
**Status:** Approved
**Approach:** Code-First Showcase (Raycast-inspired, playful technical)

## Brief

| Dimension | Decision |
|-----------|----------|
| Audience | Developers & engineers |
| Tone | Playful technical — smart, fun, interactive demos |
| Primary CTA | Dual funnel: Download Free + Start Pro Trial |
| Scope | Complete redesign of all existing pages |
| Reference | Raycast — clean, premium, great typography, subtle animations |
| Problems solved | Low conversions, unclear messaging, dated design, wrong audience targeting |

## Design System

### Colors

```
Background:     #09090b  (zinc-950)
Surface:        #18181b  (zinc-900)
Elevated:       #27272a  (zinc-800)
Border:         #3f3f46  (zinc-700)
Accent:         gradient #8b5cf6 → #6366f1 (violet → indigo)
Accent glow:    rgba(139, 92, 246, 0.15)
Text primary:   #fafafa  (zinc-50)
Text secondary: #a1a1aa  (zinc-400)
Text muted:     #71717a  (zinc-500)
Success:        #22c55e  (green-500, for "free" badges)
```

### Typography

- **Headlines:** Inter, weight 800, tracking -0.02em
- **Body:** Inter, weight 400/500
- **Code/technical:** JetBrains Mono, weight 400/500
- **Scale:** fluid `clamp(2.5rem, 5vw, 4rem)` for hero down

### Surfaces & Effects

- Cards: 1px border zinc-800, border-radius xl, subtle backdrop-blur
- Glassmorphism: `bg-zinc-900/80 backdrop-blur-xl`
- Glow on hover: `box-shadow: 0 0 40px rgba(139, 92, 246, 0.1)`

### Animations

- Scroll-triggered fade-up (intersection observer)
- Staggered delays (0.1s per child)
- Code typing effect in hero (typewriter)
- Smooth transitions: `transition-all duration-300 ease-out`

## Pages

### Homepage

**Sections in order:**

1. **Navbar** — Sticky, glassmorphism, dual CTAs (Download outline + Try Pro filled)
2. **Hero** — Badge with version, headline "Your Markdown. Your Machine. Your Rules.", subtext, dual CTAs, live markdown demo (typewriter left, rendered right)
3. **Social Proof Bar** — GitHub stars, downloads count, "Works offline" badge
4. **Features Grid** — 6 cards (Local Files, Offline First, Fast & Light, Backlinks, CodeMirror Editor, AI Assist Pro), each with code snippet instead of generic icon
5. **"Why Local?" Comparison** — Side-by-side: Cloud note apps (❌) vs Readied (✅)
6. **Workflow Showcase** — Tabbed interface: Write | Organize | Search — each shows editor mockup
7. **Final CTA** — "Ready to own your notes?" with Download + Pricing buttons
8. **Footer** — 4-column links, newsletter input, tagline

### Pricing

- Two glassmorphism cards: Free vs Pro
- Pro card has glowing border accent
- Toggleable feature checklist (not static table)
- "No credit card required" on Pro trial CTA
- FAQ accordion at bottom

### Download

- Auto-detect OS, highlight correct download
- Other platforms in collapsible section
- Version + "What's new" link
- "Free forever" badge
- Installation code blocks per platform

### Changelog

- Automated timeline (keep existing approach)
- Add category filters (Features, Fixes, Breaking)
- Visual diff indicators (green added, red removed)
- "Subscribe to updates" CTA

### Philosophy

- Narrative scroll, large typography
- Each principle = full viewport section
- Code examples showing what Readied does/doesn't do
- Ends with download CTA

### FAQ

- Searchable accordion
- Category tabs at top
- Quick-answer + expandable detail format

### Plugins

- Card grid with search/filter
- Plugin cards: icon, name, description, install command
- Featured plugins section

### Terms & Privacy

- Same design system, wider content area
- Table of contents sidebar

## Navbar

```
[Logo]  Features  Pricing  Docs ▾  Changelog     [Download]  [Try Pro Free →]
```

- Sticky, glassmorphism (`backdrop-blur-xl bg-zinc-950/80`)
- "Docs" dropdown: Philosophy, FAQ, Plugins
- Mobile: hamburger → full-screen slide-down
- Logo: "readied" lowercase, monospace, with accent dot

## Footer

```
readied.
"The note app that stays out of your way."

Product      Resources      Legal       Connect
Features     Docs           Terms       GitHub
Pricing      Changelog      Privacy     Twitter
Download     Philosophy                 Discord
             FAQ

────────────────────────────────────────────────
© 2025 Readied. Built with ♥ for developers.
[Newsletter: "Get updates"]   [→]
```

## Technical Approach

- Framework: Astro (keep existing)
- Styling: Tailwind CSS (keep, update config for new design system)
- Interactive: React components (client:load for demos, client:idle for non-critical)
- Animations: CSS + Intersection Observer (no heavy JS animation library)
- Data: Continue using @readied/product-config as single source of truth
