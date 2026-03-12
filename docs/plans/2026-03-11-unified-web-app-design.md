# Unified Web App — VitePress + Astro → Next.js + Fumadocs

## Goal

Replace both `apps/docs-site` (VitePress/Vue) and `apps/marketing-site` (Astro/React) with a single Next.js app using Fumadocs for documentation. Unifies the frontend stack to React + Next.js + Tailwind everywhere.

## Architecture

Single Next.js app at `apps/web/` serving:

- Marketing pages at `/` (migrated from Astro)
- Documentation at `/docs/*` (migrated from VitePress, powered by Fumadocs)

### Directory Structure

```
apps/web/
  app/
    layout.tsx                  # Root layout (shared Navbar + Footer)
    page.tsx                    # Landing (Hero, Features, etc.)
    pricing/page.tsx
    faq/page.tsx
    download/page.tsx
    plugins/page.tsx
    changelog/page.tsx
    philosophy/page.tsx
    privacy/page.tsx
    terms/page.tsx
    subscribe/page.tsx
    shared/page.tsx
    auth/verify/page.tsx
    subscription/success/page.tsx
    subscription/cancel/page.tsx
    docs/[[...slug]]/page.tsx   # Fumadocs catch-all
  content/docs/                 # MDX content (21 pages)
    index.mdx
    guide/
    architecture/
    plugins/
    decisions/
    roadmap/
  components/
    marketing/                  # Astro → React server components
    shared/                     # Already React (move as-is)
    docs/                       # ProjectBoard (Vue → React)
  source.ts                     # Fumadocs source config
  next.config.mjs
  tailwind.config.ts
  package.json
```

### Key Decisions

- **Marketing pages**: Next.js server components (static, fast)
- **Interactive components**: Client components with `"use client"` (FaqAccordion, SubscribeFlow, etc.)
- **Docs**: Fumadocs handles routing, search, sidebar, ToC
- **Styling**: Tailwind CSS with Readied brand tokens (teal #0d9488 / #55E4CF)
- **Dark mode**: `next-themes` (consistent with Fumadocs)
- **Product config**: `@readied/product-config` imported directly
- **Deployment**: Single deploy, marketing at `/`, docs at `/docs`

### Migration Scope

| Source                          | Count | Migration                         |
| ------------------------------- | ----- | --------------------------------- |
| Doc pages (.md → .mdx)          | 21    | Rename + add frontmatter          |
| Marketing pages (.astro → .tsx) | 14    | Rewrite as server components      |
| React components                | 9     | Move as-is                        |
| Astro components → React        | 7     | Rewrite (static, straightforward) |
| Vue component → React           | 1     | Rewrite ProjectBoard              |
| VitePress config → Fumadocs     | 1     | New source.ts + meta.json files   |

### What Gets Deleted

- `apps/docs-site/` (entire VitePress app)
- `apps/marketing-site/` (entire Astro app)
- `.github/labeler.yml` entries for old paths (update to `app:web`)

### Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "fumadocs-core": "latest",
    "fumadocs-mdx": "latest",
    "fumadocs-ui": "latest",
    "next-themes": "latest",
    "@readied/product-config": "workspace:*",
    "@headlessui/react": "^2.2.9",
    "tailwindcss": "^4"
  }
}
```
