# Readied — Marketing Content

> Content and copy for the marketing site. Update this before the site.

---

## Brand Voice

| Attribute | Guideline |
|-----------|-----------|
| Tone | Calm, trustworthy, opinionated |
| Avoid | Hype, "revolutionary", "game-changer", emojis, feature lists |
| Focus | Decisions, durability, trade-offs |
| Audience | Developers, writers, and anyone who's been burned by note apps before |

---

## Landing Page (/)

### Hero Section

**Headline:**
> Built for people who don't trust note apps anymore.

**Subhead:**
> Local files. Standard Markdown. No platform to outgrow its purpose.

**CTA Button:** "Download"

**Secondary CTA:** "Why we stopped adding features"

---

### Why Readied Exists

**Intro paragraph:**

You've seen this before. You invest months into a note app. Then they pivot to AI. Or raise prices. Or shut down. Or break your export.

Readied exists because we got tired of that cycle too.

---

### Our Decisions (not features)

Three columns, each explaining a decision and its trade-off.

#### 1. No Cloud Required

**Decision:** Your notes live on your machine. Period.

**Trade-off:** No automatic sync between devices. You handle that yourself (Dropbox, iCloud, Git, whatever you trust).

**Why:** Cloud features die. Sync breaks. Servers shut down. Your local files don't.

---

#### 2. No Markdown "Improvements"

**Decision:** We never modify your text. What you type is what gets saved.

**Trade-off:** No auto-formatting, no "smart" corrections, no normalization.

**Why:** Every app that "improves" your Markdown eventually breaks compatibility. We'd rather be boring and reliable.

---

#### 3. No Subscription

**Decision:** One payment. You own it forever.

**Trade-off:** Updates require annual renewal. But the app keeps working regardless.

**Why:** Subscriptions create pressure to ship features. Features create complexity. Complexity breaks things.

---

### How Longevity Works

**Heading:** Built to outlast us

Three points:

1. **Standard Markdown** — No proprietary format. Your `.md` files work in any editor, forever.

2. **SQLite index** — We build a search index for speed, but your files remain the source of truth. Delete the database? We rebuild it from your files.

3. **No server dependency** — License validation happens once. After that, the app works offline indefinitely.

---

### Honest Comparison

**Heading:** What we don't do (and why)

**Intro:** Readied is not trying to be a platform. Platforms optimize for extensibility. We optimize for survivability.

| Feature | Readied | Why not |
|---------|---------|---------|
| Cloud sync | No | Servers die. Local files don't. |
| Plugins | No | Plugin ecosystems break with updates. |
| Mobile app | No | Mobile encourages cloud dependency. |
| AI features | No | AI requires servers. Servers require trust. |
| Real-time collab | No | Collab requires infrastructure we'd have to maintain. |

**Bottom note:** We'd rather do less and keep doing it for decades.

---

### Who This Is For

**Heading:** Readied is for people who:

- Have exported "Markdown" from Notion and found it wasn't quite Markdown
- Watched their favorite app pivot to enterprise features they don't need
- Keep backups because they've learned not to trust sync
- Want an app that works the same way in 10 years

**Closing:** If that sounds excessive, you may not need Readied yet. If it sounds familiar, you already know why it exists.

---

### Footer

**Links:**
- Download
- Pricing
- Changelog
- Documentation

**Transparency:**
- Source available on GitHub (for inspection, not as primary distribution)

**Legal:**
- Privacy Policy
- Terms of Service

**Copyright:** "© 2025 Readied."

---

## Pricing Page (/pricing)

### Why This Pricing Model

**Intro:**

Most note apps charge subscriptions because subscriptions fund growth. Growth demands features. Features create complexity. Complexity breaks things.

We chose a different model.

---

### Pricing Card

**Plan Name:** Pro License

**Price:** $79 one-time

**What you get:**
- The app, forever
- 12 months of updates
- No feature restrictions
- No usage limits

**After 12 months:**
- App keeps working exactly the same
- Renew for $39/year to get new versions
- Don't renew? Keep using what you have

**CTA Button:** "Buy License"

**Secondary:** "Try free for 14 days"

---

### The Trade-off

**Heading:** What this model means

**For you:**
- No pressure to cancel before renewal
- No lost access if you stop paying
- Your notes don't depend on our business

**For us:**
- Less revenue than subscriptions
- Slower feature development
- More sustainable long-term

**Bottom note:** We think that's a fair trade.

**Temporal anchor:** Most people use the same notes for 5-10 years. Over that time, Readied costs less than a single year of most subscriptions.

---

### FAQ

**Q: What if you stop developing Readied?**
A: Your app keeps working. Your files are standard Markdown. Nothing depends on us existing.

**Q: Why not open source?**
A: Open source note apps struggle to sustain development. This model lets us work on Readied full-time without VC pressure.

**Q: Is there a subscription option?**
A: No. We believe one-time purchases align our incentives better. We only make money when we ship something worth paying for.

**Q: Can I export my data?**
A: Your data is already exported. It's Markdown files on your disk. There's nothing to export.

**Q: What about refunds?**
A: 14-day money-back guarantee. No questions asked.

**Q: Mac and Windows?**
A: Both. Apple Silicon, Intel Mac, and Windows x64.

---

## Download Page (/download)

### Platforms

**macOS:**
- Apple Silicon (M1/M2/M3) — `Readied-x.x.x-arm64.dmg`
- Intel — `Readied-x.x.x-x64.dmg`
- Requires macOS 11+

**Windows:**
- Windows 10/11 (x64) — `Readied-x.x.x-win-x64.exe`
- Portable version available (no install required)

---

### System Requirements

| Platform | Minimum |
|----------|---------|
| macOS | 11 Big Sur or later |
| Windows | Windows 10 (64-bit) |
| RAM | 4 GB |
| Disk | 200 MB |

---

### Verification

Each release includes SHA256 checksums:

```
SHA256 (Readied-x.x.x-arm64.dmg) = abc123...
SHA256 (Readied-x.x.x-x64.dmg) = def456...
SHA256 (Readied-x.x.x-win-x64.exe) = ghi789...
```

**Source inspection:** Code is available on GitHub for security review.

---

## Changelog Page (/changelog)

### Format

```
## v0.2.0 — January 15, 2025

### Added
- Graph view for visualizing connections
- Tag filtering in sidebar

### Fixed
- Search performance with large vaults
- Window position not saving on quit

### Changed
- Improved startup time by 40%
```

### Source

Pull automatically from GitHub Releases API.

---

## Meta & SEO

### Page Titles

- Landing: "Readied — Your notes survive the app"
- Pricing: "Pricing — Readied"
- Download: "Download — Readied"
- Changelog: "Changelog — Readied"

### Meta Description

> Readied is a Markdown editor for people who don't trust note apps. No cloud. No subscription. No lock-in. Your files, your machine, forever.

### Open Graph

- Image: App screenshot (editor view, not marketing graphics)
- Type: website
- Site name: Readied

---

## Messaging Principles

**Core thesis:** Readied is an app that refuses to outgrow its purpose.

Every section should read as a consequence of that principle.

1. **Explain decisions, not features** — Every capability reflects a choice with trade-offs
2. **Acknowledge what we don't do** — Honesty builds trust
3. **No hype, no urgency** — Calm confidence over aggressive marketing
4. **Durability over convenience** — We optimize for decades, not quarters
5. **Respect skepticism** — Our audience has been burned before. Validate that.

---

## GitHub Policy

GitHub is mentioned for:
- Transparency (source inspection)
- Issue tracking
- Changelog source

GitHub is NOT:
- Primary download source
- Alternative to buying a license
- Positioned as "open source" selling point

**Rationale:** Positioning GitHub as primary CTA attracts users who won't pay. We want users who value the product enough to support it.
