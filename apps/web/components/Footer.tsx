import Link from 'next/link';
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
import NewsletterForm from './NewsletterForm';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-base border-t border-white/[0.06]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pb-8 pt-14 lg:px-8">
        {/* Top row: brand */}
        <div className="flex flex-col gap-3">
          <Link href="/" className="inline-block transition-opacity hover:opacity-75">
            <span className="font-mono text-xl font-bold text-zinc-50 tracking-tight">
              readied<span className="text-accent">.</span>
            </span>
          </Link>
          <p className="max-w-[260px] text-sm leading-relaxed text-[#71717a]">
            The note app that stays out of your way.
          </p>
        </div>

        {/* Navigation columns */}
        <nav className="grid grid-cols-2 gap-8 sm:grid-cols-4" aria-label="Footer navigation">
          {/* Product */}
          <div className="flex flex-col gap-2.5">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
              Product
            </span>
            <Link
              href="/#features"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Pricing
            </Link>
            <Link
              href="/download"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Download
            </Link>
          </div>

          {/* Resources */}
          <div className="flex flex-col gap-2.5">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
              Resources
            </span>
            <Link
              href="/docs"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Docs
            </Link>
            <Link
              href="/changelog"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Changelog
            </Link>
            <Link
              href="/philosophy"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Philosophy
            </Link>
            <Link
              href="/faq"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              FAQ
            </Link>
            <a
              href="https://github.com/tomymaritano/readide/issues/new?template=bug_report.md"
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Report a Bug
            </a>
            <a
              href="https://github.com/tomymaritano/readide/contribute"
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Contribute
            </a>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-2.5">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
              Legal
            </span>
            <Link
              href="/terms"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="w-fit text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              Privacy
            </Link>
          </div>

          {/* Connect */}
          <div className="flex flex-col gap-2.5">
            <span className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#71717a]">
              Connect
            </span>
            <a
              href="https://github.com/tomymaritano/readide"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="inline-flex w-fit items-center gap-2 text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              <GithubIcon className="h-[18px] w-[18px] shrink-0" />
              <span>GitHub</span>
            </a>
            <a
              href="https://x.com/tomymaritano"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="inline-flex w-fit items-center gap-2 text-sm text-[#a1a1aa] transition-colors hover:text-accent"
            >
              <TwitterIcon className="h-[18px] w-[18px] shrink-0" />
              <span>Twitter</span>
            </a>
          </div>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 border-t border-white/[0.06] px-6 py-5 sm:flex-row lg:px-8">
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#71717a]">
            &copy; {year} Readied. Built with &hearts; for developers.
          </span>
        </div>
        <div className="w-full max-w-xs shrink-0">
          <NewsletterForm compact />
        </div>
      </div>
    </footer>
  );
}
