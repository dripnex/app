import { WifiOff, Zap, Sparkles } from 'lucide-react';

export default function Features() {
  return (
    <section className="relative py-24" id="features">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        {/* Section header */}
        <header className="mb-16 text-center">
          <span className="section-label">Features</span>
          <h2 className="section-heading">Tools that get out of your way.</h2>
          <p className="mx-auto max-w-[48ch] text-lg leading-relaxed text-[#a1a1aa]">
            A focused set of tools for people who think in plain text.
          </p>
        </header>

        {/* Row 1: Text left, image right */}
        <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
          <div>
            <h3 className="text-2xl font-bold text-zinc-50 mb-3">
              Write in Markdown. See it rendered.
            </h3>
            <p className="text-base leading-relaxed text-[#a1a1aa] mb-4">
              Split-pane editor with syntax highlighting, live preview, and keyboard shortcuts. No
              WYSIWYG weirdness -- just you and your text.
            </p>
            <p className="text-sm text-[#71717a]">
              CodeMirror 6 under the hood. Fast enough for 10,000-line files.
            </p>
          </div>
          <img
            src="/media/demo-writing.svg"
            alt="Writing markdown with live preview"
            className="rounded-xl border border-white/[0.06]"
            width={800}
            height={500}
            loading="lazy"
          />
        </div>

        {/* Row 2: Image left, text right (reversed) */}
        <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
          <img
            src="/media/feature-organize.svg"
            alt="Organizing notes in notebooks"
            className="rounded-xl border border-white/[0.06]"
            width={640}
            height={480}
            loading="lazy"
          />
          <div>
            <h3 className="text-2xl font-bold text-zinc-50 mb-3">Organize your way.</h3>
            <p className="text-base leading-relaxed text-[#a1a1aa] mb-4">
              Notebooks, folders, pinned notes -- structure your thoughts however makes sense to
              you. It&apos;s your file system, not ours.
            </p>
            <p className="text-sm text-[#71717a]">
              Real .md files on your disk. Open them in VS Code, sync with git, back up however you
              want.
            </p>
          </div>
        </div>

        {/* Row 3: Text left, image right */}
        <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
          <div>
            <h3 className="text-2xl font-bold text-zinc-50 mb-3">Find anything, instantly.</h3>
            <p className="text-base leading-relaxed text-[#a1a1aa] mb-4">
              Full-text search across all your notes. Backlinks computed on the fly from your files
              -- no hidden database required.
            </p>
            <p className="text-sm text-[#71717a]">
              Cmd+P quick-open. Search as you type. Jump between notes in milliseconds.
            </p>
          </div>
          <img
            src="/media/feature-search.svg"
            alt="Searching across notes with highlighted results"
            className="rounded-xl border border-white/[0.06]"
            width={640}
            height={480}
            loading="lazy"
          />
        </div>

        {/* Row 4: Small feature cards (3 columns) */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Offline First */}
          <article className="glass-card p-6">
            <div className="mb-4">
              <WifiOff className="h-8 w-8 text-accent" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-zinc-50">Works on a plane.</h3>
            <p className="text-sm leading-relaxed text-[#a1a1aa]">
              No WiFi? No problem. Readied works entirely offline. Always.
            </p>
          </article>

          {/* Fast & Light */}
          <article className="glass-card p-6">
            <div className="mb-4">
              <Zap className="h-8 w-8 text-accent" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-zinc-50">Opens in under 2 seconds.</h3>
            <p className="text-sm leading-relaxed text-[#a1a1aa]">
              No Electron bloat. No loading spinners. Just instant access to your notes.
            </p>
          </article>

          {/* AI Assist (Pro) */}
          <article className="glass-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-accent" />
              <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider">
                Pro
              </span>
            </div>
            <h3 className="mb-2 text-base font-semibold text-zinc-50">AI that stays local.</h3>
            <p className="text-sm leading-relaxed text-[#a1a1aa]">
              Get writing suggestions without sending your notes to the cloud.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
