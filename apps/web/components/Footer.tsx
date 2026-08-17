import Link from 'next/link';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Download', href: '/download' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Sign in', href: '/login' },
      { label: 'Sign up', href: '/signup' },
    ],
  },
  {
    title: 'Notes',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Philosophy', href: '/philosophy' },
      { label: 'FAQ', href: '/faq' },
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

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto max-w-4xl px-5 py-14">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2">
              <img src="/logo.png" alt="" width={18} height={18} className="rounded-[4px]" />
              <span className="font-mono text-sm text-text-primary">dripnex.</span>
            </Link>
            <p className="mt-3 max-w-[16rem] text-[13px] leading-relaxed text-text-muted">
              Local files. Standard Markdown.
            </p>
          </div>
          {columns.map(column => (
            <div key={column.title} className="flex flex-col gap-2.5">
              <span className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                {column.title}
              </span>
              {column.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-fit text-[13px] text-text-secondary hover:text-text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 text-[12px] text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {year} Dripnex</span>
          <a
            href="https://github.com/dripnex/readide"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-secondary"
          >
            Source on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
