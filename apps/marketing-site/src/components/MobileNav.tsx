import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

interface NavSection {
  title: string;
  links: NavLink[];
}

interface MobileNavProps {
  links: NavLink[];
  sections: NavSection[];
}

export default function MobileNav({ links, sections }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-surface text-[#a1a1aa] transition-colors hover:bg-elevated hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      {/* Full-screen mobile nav dialog */}
      <Transition show={isOpen} as={Fragment}>
        <Dialog onClose={close} className="relative z-50">
          {/* Backdrop overlay */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
          </Transition.Child>

          {/* Slide-down panel */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="-translate-y-full opacity-0"
            enterTo="translate-y-0 opacity-100"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="-translate-y-full opacity-0"
          >
            <Dialog.Panel className="fixed inset-x-0 top-0 max-h-screen overflow-y-auto bg-base shadow-2xl">
              {/* Header with close button */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <Dialog.Title className="text-lg font-semibold text-white">
                  Menu
                </Dialog.Title>
                <button
                  type="button"
                  onClick={close}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-[#a1a1aa] transition-colors hover:bg-surface hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Close navigation menu"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Primary links */}
              <nav className="px-6 py-4" aria-label="Mobile navigation">
                <ul className="space-y-1">
                  {links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={close}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-[#a1a1aa] transition-colors hover:bg-surface hover:text-white"
                      >
                        {link.label}
                        {link.external && (
                          <svg
                            className="h-4 w-4 text-[#71717a]"
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
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Sections */}
              {sections.length > 0 && (
                <div className="border-t border-white/[0.06] px-6 py-4">
                  {sections.map((section) => (
                    <div key={section.title} className="mb-6 last:mb-0">
                      <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-[#71717a]">
                        {section.title}
                      </h3>
                      <ul className="space-y-1">
                        {section.links.map((link) => (
                          <li key={link.href}>
                            <a
                              href={link.href}
                              onClick={close}
                              target={link.external ? '_blank' : undefined}
                              rel={link.external ? 'noopener noreferrer' : undefined}
                              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-[#71717a] transition-colors hover:bg-surface hover:text-[#a1a1aa]"
                            >
                              {link.label}
                              {link.external && (
                                <svg
                                  className="h-3.5 w-3.5 text-[#71717a]"
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
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer with legal links */}
              <div className="border-t border-white/[0.06] px-6 py-4">
                <div className="flex items-center gap-4 px-4">
                  <a
                    href="/privacy"
                    onClick={close}
                    className="text-xs text-[#71717a] transition-colors hover:text-[#a1a1aa]"
                  >
                    Privacy Policy
                  </a>
                  <span className="text-white/20" aria-hidden="true">&middot;</span>
                  <a
                    href="/terms"
                    onClick={close}
                    className="text-xs text-[#71717a] transition-colors hover:text-[#a1a1aa]"
                  >
                    Terms of Service
                  </a>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  );
}
