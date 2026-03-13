'use client';

import Link from 'next/link';
import NewsletterForm from './NewsletterForm';

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Download', href: '/download' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Philosophy', href: '/philosophy' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Plugins', href: '/plugins' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
];

const socialLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com/tomymaritano/readide',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    label: 'X',
    href: 'https://x.com/tomymaritano',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'Blog',
    href: 'https://medium.com/@tomymaritano',
    icon: (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
      </svg>
    ),
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto">
      {/* Gradient separator */}
      <div className="mx-auto max-w-4xl px-4">
        <div className="h-px bg-linear-to-r from-transparent via-white/8 to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-8 pt-12">
        {/* Main grid: brand + links + newsletter */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-12">
          {/* Brand + newsletter */}
          <div className="col-span-2 sm:col-span-4 flex flex-col gap-4">
            <Link href="/" className="inline-block w-fit transition-opacity hover:opacity-75">
              <span className="font-mono text-base font-bold text-text-primary tracking-tight">
                readied<span className="text-accent">.</span>
              </span>
            </Link>
            <p className="text-[13px] leading-relaxed text-text-muted">
              The note app that stays out of your way. Open source, offline-first, Markdown forever.
            </p>
            <div className="mt-1 max-w-[280px]">
              <NewsletterForm compact />
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map(section => (
            <div key={section.title} className="col-span-1 sm:col-span-2 flex flex-col gap-2.5">
              <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {section.title}
              </span>
              {section.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-fit text-[13px] text-text-secondary transition-colors hover:text-text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          {/* Social column */}
          <div className="col-span-2 sm:col-span-2 flex flex-col gap-2.5">
            <span className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
              Connect
            </span>
            {socialLinks.map(social => (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="inline-flex w-fit items-center gap-2 text-[13px] text-text-secondary transition-colors hover:text-text-primary"
              >
                {social.icon}
                <span>{social.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex items-center justify-center sm:justify-start">
          <div className="h-px w-full bg-linear-to-r from-transparent via-white/6 to-transparent sm:hidden" />
          <span className="text-[11px] text-text-muted">
            &copy; {year} Readied. Built with &hearts; in Argentina.
          </span>
        </div>
      </div>
    </footer>
  );
}
