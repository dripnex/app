import Link from 'next/link';
import ProductDemo from '@/components/landing/ProductDemo';

const decisions = [
  {
    title: 'Files on disk',
    body: 'Standard Markdown. The editor is a window onto the file, not a silo.',
  },
  {
    title: 'Works offline',
    body: 'No account to open a note. Sync is optional, and never the source of truth.',
  },
  {
    title: 'Free for the core',
    body: 'The editor and your files do not expire. Pro is extras, not the notes.',
  },
];

export default function HomePage() {
  return (
    <div className="px-5">
      <section className="mx-auto max-w-3xl pt-32 pb-12 sm:pt-36 sm:pb-14">
        <h1 className="max-w-[16ch] text-[clamp(2rem,5vw,3.15rem)] font-medium leading-[1.12] tracking-tight text-text-primary">
          Your Markdown, on your machine.
        </h1>
        <p className="mt-5 max-w-[36ch] text-[16px] leading-relaxed text-text-secondary sm:text-[17px]">
          A clean editor for notes that remain files. Try it here — then keep it locally.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/download"
            className="rounded-md bg-text-primary px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-80"
          >
            Download
          </Link>
          <Link
            href="/docs"
            className="text-[13px] text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
          >
            Documentation
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl pb-20">
        <ProductDemo />
      </section>

      <section className="mx-auto max-w-3xl border-t border-white/[0.06] py-20">
        <div className="grid gap-12 sm:grid-cols-3 sm:gap-8">
          {decisions.map(item => (
            <div key={item.title}>
              <h2 className="text-[15px] font-medium text-text-primary">{item.title}</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
