# ADR 001: Git-Backed Notes

**Status:** Proposed
**Date:** 2026-01-09
**Deciders:** Tomas Maritano, Claude Sonnet 4.5
**Context:** Product differentiation strategy for Dripnex vs Inkdrop/Obsidian

---

## Context

Dripnex is entering a crowded market of note-taking apps for developers:

- **Inkdrop:** Solid sync, no git integration, $4.99/mo
- **Obsidian:** Local-first, no reliable sync, plugins ecosystem
- **Notion:** Cloud-first, not developer-focused
- **VS Code with extensions:** Too generic, not purpose-built

**Problem:** Why would a developer choose Dripnex over these alternatives?

Without clear differentiation, we become "yet another Inkdrop clone" but more expensive ($9/mo vs $4.99/mo).

**User Pain Points (from competitive analysis):**

1. **Trust:** Developers don't trust proprietary sync (data loss fear)
2. **Control:** Want real version history, not just "undo"
3. **Collaboration:** Want to share notes via GitHub, not proprietary systems
4. **Backup:** Want git push as backup, not relying on vendor
5. **Portability:** Want plain markdown in git, not locked-in formats

**Inkdrop's weakness:** No git integration, sync is a black box
**Obsidian's weakness:** Sync is weak/unreliable, git plugins are janky
**Our opportunity:** Make git a first-class citizen

---

## Decision

**We will implement Git-backed notebooks as a core feature**, allowing each notebook to optionally be a Git repository with full version control capabilities.

### How It Works

1. **Opt-in per notebook**
   - User can "Enable Git" for any notebook
   - Creates `.git` repo in notebook's filesystem location
   - Not forced - local-only notebooks still work

2. **Automatic or manual commits**
   - Option 1: Auto-commit on save (toggle)
   - Option 2: Manual commit with custom messages
   - User choice, not dictated by us

3. **Full git operations in UI**
   - View commit history
   - Revert to previous commit
   - Diff between versions
   - (Phase 2) Branch support
   - (Phase 2) Merge notes

4. **Coexistence with cloud sync**
   - Git = local version history (truth)
   - Cloud sync = multi-device sync
   - Git commits sync via cloud (encrypted)
   - Conflicts: Git history wins

5. **GitHub/GitLab integration**
   - User can `git remote add` their own repo
   - Push to GitHub for backup
   - Collaborate via PRs (markdown files)
   - Use existing git tools (GitKraken, etc.)

### What It Enables

**Trust through transparency:**

- Full commit history visible
- Can inspect `.git` folder
- Standard git, not proprietary

**Developer workflow integration:**

- Push notes to personal GitHub
- Share via git (not proprietary share links)
- Use git for collaboration

**Free backup:**

- `git push origin main` = free backup
- No reliance on our servers
- Can clone from GitHub if we shut down

**Power user features:**

- Branching for different versions of ideas
- Merge notes from different contexts
- Cherry-pick commits
- Use git tooling ecosystem

---

## Status

**Proposed** - Awaiting implementation (Phase 1, Sprint 2)

Timeline:

- **Semana 5-7:** Implement git integration
- **Semana 8-10:** Knowledge graph (differentiator #2)
- **Semana 11-12:** CLI/API (differentiator #3)

---

## Consequences

### Positive

**✅ Unique selling proposition**

- No competitor has git-backed notes at this level
- Justifies higher price ($9 vs $4.99)
- Appeals to developer's love of git

**✅ Trust & security**

- Users control their data (git repo is theirs)
- Backup doesn't depend on us staying alive
- Open format (markdown + .git)

**✅ Collaboration enabled**

- Share notes via GitHub (public or private repos)
- Collaborate via PRs (review, comments, merge)
- Team notes in shared org repos

**✅ Marketing angle**

- "Git-backed notes" is catchy
- Differentiates from "yet another sync"
- HackerNews appeal

**✅ Network effects**

- Users publish notes to GitHub → free marketing
- Public knowledge graphs visible
- Community can fork/contribute

### Negative

**❌ Complexity for non-technical users**

- Git concepts are hard (commit, branch, merge)
- Can't simplify too much or lose power
- **Mitigation:** Make it optional, sane defaults

**❌ Performance concerns**

- Git operations can be slow (large repos)
- Indexing .git folders for search
- **Mitigation:** Exclude .git from search, lazy load history

**❌ Merge conflicts**

- Git merge conflicts are painful
- Users might break their notes
- **Mitigation:** Provide conflict resolution UI, warn users

**❌ Storage overhead**

- Git history can balloon disk usage
- `.git` folder can be larger than notes
- **Mitigation:** Add "compact history" command (gc)

**❌ Sync complexity**

- Syncing .git folders is expensive
- Conflicts between devices' git state
- **Mitigation:** Git is source of truth, sync is transport layer

### Risks

**🔴 Technical Risk: Git library integration**

- Need to integrate `simple-git` or similar
- Cross-platform git commands (Windows, macOS, Linux)
- **Mitigation:** Use `isomorphic-git` (pure JS, no git binary needed)

**🟡 Product Risk: Too niche**

- Only developers care about git
- Non-devs won't understand value
- **Mitigation:** This is OK - we're targeting developers specifically

**🟡 UX Risk: Complexity overwhelming**

- Too many git options confuse users
- **Mitigation:** Progressive disclosure (advanced features hidden)

**🟢 Market Risk: Competitors copy us**

- Inkdrop/Obsidian could add git
- **Mitigation:** Execution matters more than idea, ship first

---

## Alternatives Considered

### Alternative 1: No git, focus on better sync

**Pros:**

- Simpler implementation
- No complexity
- Faster to market

**Cons:**

- No differentiation
- Compete on price with Inkdrop
- "Yet another sync" is boring

**Rejected:** Not a differentiator

---

### Alternative 2: Git sync only (not local)

Sync via git instead of custom protocol.

**Pros:**

- Simpler than dual (git + custom sync)
- Users already know git

**Cons:**

- Performance terrible (git is slow for sync)
- Merge conflicts everywhere
- No offline support
- Requires git server (GitHub, GitLab)

**Rejected:** UX too bad, git not designed for sync

---

### Alternative 3: Git-like versioning (custom)

Implement git-like features (commits, history) but custom format.

**Pros:**

- Full control over UX
- Optimize for note-taking
- No git complexity

**Cons:**

- **Not standard git** → no ecosystem
- Users can't use git tools
- Not as trustworthy ("fake git")

**Rejected:** Loses main benefit (standard git)

---

## Implementation Notes

### Phase 1: MVP (Semana 5-7)

**UI:**

- Toggle: "Enable Git for this notebook"
- Commit history view (log + diffs)
- Revert to commit button
- Auto-commit toggle

**Backend:**

- Use `isomorphic-git` (pure JS, no binary)
- Initialize repo on enable
- Commit on save (if auto-commit enabled)
- Read commit history

**Data model:**

- Notebooks have `git_enabled: boolean`
- Notebook filesystem location: `~/Dripnex/Notebooks/<notebook-name>/`
- Git repo at: `~/Dripnex/Notebooks/<notebook-name>/.git`

**Sync integration:**

- Git commits are synced as files
- Cloud sync transports `.git` folder (encrypted)
- Conflicts: Local git state wins

### Phase 2: Advanced (Post-launch)

- Branching UI
- Merge notes
- Remote configuration (GitHub, GitLab)
- Collaborative editing via PR workflow
- Git hooks (e.g., auto-push on commit)

---

## Success Metrics

**Product metrics:**

- % of users who enable git on at least 1 notebook
- Average commits per git-enabled notebook
- % of users who push to GitHub/GitLab

**Business metrics:**

- Conversion rate (free → Pro) with git-backed as selling point
- NPS increase from git-enabled users
- HackerNews engagement (upvotes, comments)

**Targets (6 months post-launch):**

- > 30% of active users enable git
- > 50% of Pro subscribers cite git as reason
- Feature mentioned in >10 HN posts

---

## References

- [Git Internals](https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain)
- [isomorphic-git](https://isomorphic-git.org/) - Pure JS git implementation
- [Obsidian Git Plugin](https://github.com/denolehov/obsidian-git) - Inspiration
- [Foam](https://foambubble.github.io/foam/) - Git-based knowledge management (VS Code)

---

## Approval

**Proposer:** Tomas Maritano
**Reviewers:** TBD (solo dev for now)
**Status:** Proposed → Will move to **Accepted** after Phase 1 implementation

---

## Related ADRs

- ADR 002: Knowledge Graph Implementation (differentiator #2) - To be written
- ADR 003: CLI/API Design (differentiator #3) - To be written
- ADR 004: Sync Architecture (git + cloud coexistence) - To be written
