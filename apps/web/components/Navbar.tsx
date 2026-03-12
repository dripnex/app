import Link from 'next/link';
import NavDropdown from './NavDropdown';
import MobileNav from './MobileNav';

export default function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-8 px-6 lg:px-8">
        {/* Text logo */}
        <Link href="/" className="flex items-center">
          <span className="font-mono text-lg font-bold text-zinc-50 tracking-tight">
            readied<span className="text-accent">.</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          <Link
            href="/#features"
            className="relative rounded-lg px-3 py-2 text-sm font-medium text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-[#f4f4f5]"
          >
            Features
          </Link>
          <Link
            href="/pricing"
            className="relative rounded-lg px-3 py-2 text-sm font-medium text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-[#f4f4f5]"
          >
            Pricing
          </Link>

          <NavDropdown
            label="Docs"
            items={[
              { label: 'Documentation', href: '/docs' },
              { label: 'Philosophy', href: '/philosophy' },
              { label: 'FAQ', href: '/faq' },
              { label: 'Plugins', href: '/plugins' },
              {
                label: 'Report a Bug',
                href: 'https://github.com/tomymaritano/readide/issues/new?template=bug_report.md',
                external: true,
              },
            ]}
          />

          <Link
            href="/changelog"
            className="relative rounded-lg px-3 py-2 text-sm font-medium text-[#a1a1aa] transition-colors hover:bg-white/5 hover:text-[#f4f4f5]"
          >
            Changelog
          </Link>
        </nav>

        {/* Desktop dual CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/download"
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Download
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Try Pro Free &rarr;
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <MobileNav
            links={[
              { label: 'Download', href: '/download' },
              { label: 'Try Pro Free', href: '/pricing' },
            ]}
            sections={[
              {
                title: 'Product',
                links: [
                  { label: 'Pricing', href: '/pricing' },
                  { label: 'Changelog', href: '/changelog' },
                ],
              },
              {
                title: 'Resources',
                links: [
                  { label: 'Documentation', href: '/docs' },
                  { label: 'Philosophy', href: '/philosophy' },
                  { label: 'FAQ', href: '/faq' },
                  { label: 'Plugins', href: '/plugins' },
                  {
                    label: 'Report a Bug',
                    href: 'https://github.com/tomymaritano/readide/issues/new?template=bug_report.md',
                    external: true,
                  },
                  {
                    label: 'Contribute',
                    href: 'https://github.com/tomymaritano/readide/contribute',
                    external: true,
                  },
                  {
                    label: 'Blog',
                    href: 'https://medium.com/@tomymaritano',
                    external: true,
                  },
                ],
              },
              {
                title: 'Community',
                links: [
                  {
                    label: 'GitHub',
                    href: 'https://github.com/tomymaritano/readide',
                    external: true,
                  },
                  {
                    label: 'X (Twitter)',
                    href: 'https://x.com/tomymaritano',
                    external: true,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
