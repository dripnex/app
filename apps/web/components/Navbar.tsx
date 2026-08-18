'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const links = [
  { label: 'Download', href: '/download' },
  { label: 'Plugins', href: '/plugins' },
  { label: 'Docs', href: '/docs' },
  { label: 'Pricing', href: '/pricing' },
];

const navLinkClass =
  'px-2.5 py-1 text-[13px] text-text-secondary transition-colors hover:text-text-primary';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-background/80 backdrop-blur-md">
      <nav
        className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-5"
        aria-label="Main navigation"
      >
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <img src="/logo.png" alt="" width={20} height={20} className="rounded-[4px]" />
          <span className="font-mono text-[15px] font-medium tracking-tight text-text-primary">
            dripnex.
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(link => (
            <Link key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
            </Link>
          ))}
          <Link href="/login" className={navLinkClass}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className="ml-1 rounded-md bg-text-primary px-2.5 py-1 text-[13px] font-medium text-background hover:opacity-80"
          >
            Sign up
          </Link>
        </div>

        <div className="flex md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:text-text-primary"
                aria-label="Open navigation menu"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 font-mono text-base font-medium tracking-tight">
                  <img src="/logo.png" alt="" width={20} height={20} className="rounded-[4px]" />
                  <span>dripnex.</span>
                </SheetTitle>
              </SheetHeader>
              <ul className="mt-8 space-y-1">
                {[
                  ...links,
                  { label: 'Sign in', href: '/login' },
                  { label: 'Sign up', href: '/signup' },
                ].map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-3 text-sm text-text-secondary hover:bg-white/[0.04] hover:text-text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
