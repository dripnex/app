'use client';

import { Fragment } from 'react';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import Link from 'next/link';

interface NavDropdownItem {
  label: string;
  href: string;
  icon?: string;
  external?: boolean;
}

interface NavDropdownProps {
  label: string;
  items: NavDropdownItem[];
}

export default function NavDropdown({ label, items }: NavDropdownProps) {
  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <PopoverButton
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              open ? 'bg-white/5 text-white' : 'text-[#a1a1aa] hover:bg-white/5 hover:text-white'
            }`}
          >
            {label}
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </PopoverButton>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
          >
            <PopoverPanel className="absolute left-1/2 z-50 mt-3 w-56 -translate-x-1/2 transform">
              <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-2xl">
                <div className="py-1">
                  {items.map(item => {
                    const className =
                      'flex items-center gap-3 px-4 py-2.5 text-sm text-[#a1a1aa] transition-colors hover:bg-accent/10 hover:text-white';

                    if (item.external) {
                      return (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={className}
                        >
                          {item.icon && (
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-base"
                              aria-hidden="true"
                            >
                              {item.icon}
                            </span>
                          )}
                          <span className="flex-1">{item.label}</span>
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
                        </a>
                      );
                    }

                    return (
                      <Link key={item.href} href={item.href} className={className}>
                        {item.icon && (
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-base"
                            aria-hidden="true"
                          >
                            {item.icon}
                          </span>
                        )}
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </PopoverPanel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
