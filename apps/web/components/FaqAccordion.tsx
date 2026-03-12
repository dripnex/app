'use client';

import { useState, useMemo } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  category: string;
  questions: FaqItem[];
}

/* Simple accordion (original behaviour) */
interface FaqAccordionProps {
  items: FaqItem[];
  categories?: never;
}

/* Tabbed categories mode */
interface FaqTabbedProps {
  items?: never;
  categories: FaqCategory[];
}

type Props = FaqAccordionProps | FaqTabbedProps;

/* Accordion list (shared) */
function AccordionList({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="single" collapsible className="mx-auto w-full space-y-3">
      {items.map(item => (
        <AccordionItem
          key={item.question}
          value={`faq-${item.question.slice(0, 40).toLowerCase().replace(/\s+/g, '-')}`}
          className="rounded-xl bg-surface/50"
        >
          <AccordionTrigger className="px-6 py-4 text-base font-medium text-text-secondary hover:text-white [&[data-state=open]]:text-white">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="border-t border-border bg-inset px-6 py-4">
            <p className="text-sm leading-relaxed text-text-secondary">{item.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/* Search icon (inline SVG) */
function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-text-muted"
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

/* Main export */
export default function FaqAccordion(props: Props) {
  /* Simple mode */
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
      return categories.flatMap(cat =>
        cat.questions.filter(
          q => q.question.toLowerCase().includes(query) || q.answer.toLowerCase().includes(query)
        )
      );
    }

    return categories.find(c => c.category === activeTab)?.questions ?? [];
  }, [categories, activeTab, search]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="w-full">
      {/* Search bar */}
      <div className="relative mb-6 max-w-md mx-auto">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <SearchIcon />
        </div>
        <input
          aria-label="Search FAQ questions"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search questions..."
          className="w-full rounded-lg border border-border bg-surface/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder-text-muted outline-none transition-colors focus:border-accent focus:bg-surface"
        />
      </div>

      {/* Category tabs */}
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
                : 'border border-border text-text-secondary hover:bg-white/5 hover:text-white'
            }`}
          >
            {cat.category}
          </button>
        ))}
      </div>

      {/* Results */}
      {isSearching && visibleItems.length === 0 ? (
        <p className="text-center text-sm text-text-muted py-8">No questions match your search.</p>
      ) : (
        <div className="max-w-2xl mx-auto">
          <AccordionList items={visibleItems} />
        </div>
      )}
    </div>
  );
}
