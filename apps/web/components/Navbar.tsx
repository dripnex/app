'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppleIcon } from '@/components/icons/BrandIcons';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const docsItems: { label: string; href: string; external?: boolean }[] = [
  { label: 'Documentation', href: '/docs' },
  { label: 'Philosophy', href: '/philosophy' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Plugins', href: '/plugins' },
  {
    label: 'Report a Bug',
    href: 'https://github.com/tomymaritano/readide/issues/new?template=bug_report.md',
    external: true,
  },
];

const mobileSections = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Changelog', href: '/changelog' },
      { label: 'Download', href: '/download' },
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
];

const navLinkClass =
  'px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:text-text-primary';

const ExternalIcon = () => (
  <svg
    className="h-3.5 w-3.5 shrink-0 text-[#71717a]"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
    />
  </svg>
);

export default function Navbar() {
  const [sheetOpen, setSheetOpen] = useState(false);

  function closeSheet() {
    setSheetOpen(false);
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex justify-center pt-4 px-4">
      {/* Floating pill navbar */}
      <nav
        className="flex w-full max-w-4xl items-center justify-between gap-6 rounded-2xl border border-white/[0.08] bg-zinc-950/70 px-5 py-2.5 backdrop-blur-xl shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center">
          <span className="font-mono text-base font-bold text-text-primary tracking-tight">
            readied<span className="text-accent">.</span>
          </span>
        </Link>

        {/* Desktop nav links — centered */}
        <div className="hidden items-center gap-0.5 md:flex">
          <Link href="/#features" className={navLinkClass}>
            Features
          </Link>
          <Link href="/pricing" className={navLinkClass}>
            Pricing
          </Link>

          {/* Docs dropdown */}
          <div className="group relative">
            <button
              type="button"
              className={`${navLinkClass} inline-flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
            >
              Docs
              <svg
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>

            <div className="invisible absolute left-1/2 z-50 w-52 -translate-x-1/2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-2xl">
                <div className="py-1">
                  {docsItems.map(item => {
                    const cls =
                      'flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-accent/10 hover:text-white';

                    if (item.external) {
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cls}
                        >
                          <span className="flex-1">{item.label}</span>
                          <ExternalIcon />
                        </a>
                      );
                    }
                    return (
                      <Link key={item.href} href={item.href} className={cls}>
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <Link href="/changelog" className={navLinkClass}>
            Changelog
          </Link>
        </div>

        {/* Desktop: Download button with Apple icon */}
        <Link
          href="/download"
          className="hidden items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-1.5 text-[13px] font-medium text-white transition-all hover:bg-white/[0.1] hover:border-white/[0.18] md:inline-flex"
        >
          <AppleIcon className="h-3.5 w-3.5" />
          Download
        </Link>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Open navigation menu"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </button>
            </SheetTrigger>

            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-mono text-lg font-bold tracking-tight">
                  readied<span className="text-accent">.</span>
                </SheetTitle>
              </SheetHeader>

              {/* Mobile CTA */}
              <div className="mt-6 space-y-2">
                <Link
                  href="/download"
                  onClick={closeSheet}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-white/[0.1]"
                >
                  <AppleIcon className="h-4 w-4" />
                  Download for Mac
                </Link>
                <Link
                  href="/pricing"
                  onClick={closeSheet}
                  className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  Try Pro Free <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>

              {/* Sections */}
              <div className="mt-6 border-t border-border pt-4">
                {mobileSections.map(section => (
                  <div key={section.title} className="mb-6 last:mb-0">
                    <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-[#71717a]">
                      {section.title}
                    </h3>
                    <ul className="space-y-1">
                      {section.links.map(link => (
                        <li key={link.href}>
                          {'external' in link && link.external ? (
                            <a
                              href={link.href}
                              onClick={closeSheet}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
                            >
                              {link.label}
                              <ExternalIcon />
                            </a>
                          ) : (
                            <Link
                              href={link.href}
                              onClick={closeSheet}
                              className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
                            >
                              {link.label}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Footer legal */}
              <div className="mt-auto border-t border-border pt-4">
                <div className="flex items-center gap-4 px-4">
                  <Link
                    href="/privacy"
                    onClick={closeSheet}
                    className="text-xs text-[#71717a] transition-colors hover:text-text-secondary"
                  >
                    Privacy Policy
                  </Link>
                  <span className="text-white/20" aria-hidden="true">
                    &middot;
                  </span>
                  <Link
                    href="/terms"
                    onClick={closeSheet}
                    className="text-xs text-[#71717a] transition-colors hover:text-text-secondary"
                  >
                    Terms of Service
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
