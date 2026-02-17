import { Disclosure, Transition } from '@headlessui/react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3">
      {items.map((item, index) => (
        <Disclosure key={index}>
          {({ open }) => (
            <div
              className={`overflow-hidden rounded-xl transition-colors ${
                open
                  ? 'bg-surface'
                  : 'bg-surface/50 hover:bg-surface'
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
                    <p className="text-sm leading-relaxed text-[#a1a1aa]">
                      {item.answer}
                    </p>
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
