import { useState, useMemo } from 'react';
import { Disclosure, Transition } from '@headlessui/react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  category: string;
  questions: FaqItem[];
}

/* ── Simple accordion (original behaviour) ── */
interface FaqAccordionProps {
  items: FaqItem[];
  categories?: never;
}

/* ── Tabbed categories mode ── */
interface FaqTabbedProps {
  items?: never;
  categories: FaqCategory[];
}

type Props = FaqAccordionProps | FaqTabbedProps;

/* ── Accordion list (shared) ── */
function AccordionList({ items }: { items: FaqItem[] }) {
  return (
    <div className="mx-auto w-full space-y-3">
      {items.map((item, index) => (
        <Disclosure key={index}>
          {({ open }) => (
            <div
              className={`overflow-hidden rounded-xl transition-colors ${
                open ? 'bg-surface' : 'bg-surface/50 hover:bg-surface'
              }`}
            >
              <Disclosure.Button className="flex w-full items-center justify-between px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                <span
                  className={`pr-4 text-base font-medium transition-colors ${
                    open ? 'text-white' : 'text-[#a1a1aa]'
                  }`}
                >
                  {item.question}
                </span>
                <svg
                  className={`h-5 w-5 shrink-0 text-[#71717a] transition-transform duration-200 ${
                    open ? 'rotate-180 text-accent' : ''
                  }`}
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
              </Disclosure.Button>

              <Transition
                enter="transition duration-200 ease-out"
                enterFrom="max-h-0 opacity-0"
                enterTo="max-h-96 opacity-100"
                leave="transition duration-150 ease-in"
                leaveFrom="max-h-96 opacity-100"
                leaveTo="max-h-0 opacity-0"
              >
                <Disclosure.Panel className="overflow-hidden">
                  <div className="border-t border-white/[0.06] bg-inset px-6 py-4">
                    <p className="text-sm leading-relaxed text-[#a1a1aa]">{item.answer}</p>
                  </div>
                </Disclosure.Panel>
              </Transition>
            </div>
          )}
        </Disclosure>
      ))}
    </div>
  );
}

/* ── Search icon (inline SVG) ── */
function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-[#71717a]"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

/* ── Main export ── */
export default function FaqAccordion(props: Props) {
  /* Simple mode — just render the accordion list directly */
  if (props.items) {
    return <AccordionList items={props.items} />;
  }

  /* Tabbed categories mode */
  const { categories } = props;
  const [activeTab, setActiveTab] = useState(categories[0]?.category ?? '');
  const [search, setSearch] = useState('');

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (query.length > 0) {
      /* Search across ALL categories */
      return categories.flatMap(cat =>
        cat.questions.filter(
          q => q.question.toLowerCase().includes(query) || q.answer.toLowerCase().includes(query)
        )
      );
    }

    /* Show selected category */
    return categories.find(c => c.category === activeTab)?.questions ?? [];
  }, [categories, activeTab, search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="w-full">
      {/* ── Search bar ── */}
      <div className="relative mb-6 max-w-md mx-auto">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search questions..."
          className="w-full rounded-lg border border-white/[0.08] bg-surface/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#71717a] outline-none transition-colors focus:border-accent focus:bg-surface"
        />
      </div>

      {/* ── Category tabs ── */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {categories.map(cat => (
          <button
            key={cat.category}
            onClick={() => {
              setActiveTab(cat.category);
              setSearch('');
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              !isSearching && activeTab === cat.category
                ? 'bg-accent text-white'
                : 'border border-white/[0.08] text-[#a1a1aa] hover:bg-white/5 hover:text-white'
            }`}
          >
            {cat.category}
          </button>
        ))}
      </div>

      {/* ── Results ── */}
      {isSearching && visibleItems.length === 0 ? (
        <p className="text-center text-sm text-[#71717a] py-8">No questions match your search.</p>
      ) : (
        <div className="max-w-2xl mx-auto">
          <AccordionList items={visibleItems} />
        </div>
      )}
    </div>
  );
}
