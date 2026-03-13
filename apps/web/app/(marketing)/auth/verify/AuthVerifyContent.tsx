'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function AuthVerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (token) {
      window.location.href = `readied://auth/verify?token=${token}`;

      const timer = setTimeout(() => {
        setShowFallback(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-[420px] text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-red-500/10">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#f4f4f5] mb-3">Invalid Link</h1>
          <p className="text-[#a1a1aa] mb-6">
            This verification link is incomplete or has expired. Please request a new magic link
            from the Readied app.
          </p>
          <Link
            href="/download"
            className="inline-block px-6 py-2.5 bg-accent text-white font-medium rounded-lg transition-colors hover:bg-accent-hover"
          >
            Download Readied
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-[480px] text-center">
        {!showFallback ? (
          <>
            <div className="inline-block w-10 h-10 mb-6 border-[3px] border-white/[0.06] border-t-accent rounded-full animate-spin" />
            <h1 className="text-2xl font-semibold text-[#f4f4f5] mb-3">Opening Readied...</h1>
            <p className="text-[#a1a1aa]">The app should open automatically. Hang tight.</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-accent/10">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="w-8 h-8 text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-[#f4f4f5] mb-3">Almost there</h1>
            <p className="text-lg text-[#a1a1aa] mb-6">
              The app didn&apos;t open automatically. Try clicking the button below.
            </p>

            <a
              href={`readied://auth/verify?token=${token}`}
              className="inline-block px-8 py-3 mb-8 bg-accent text-white font-semibold rounded-lg transition-colors hover:bg-accent-hover"
            >
              Open in Readied
            </a>

            <div className="p-6 rounded-xl bg-surface border border-white/[0.06]">
              <h2 className="text-base font-medium text-[#f4f4f5] mb-2">
                Opened this on the wrong device?
              </h2>
              <p className="text-sm text-[#a1a1aa] mb-4">
                Open this same link on the device where Readied is installed. The magic link is
                valid for 15 minutes.
              </p>
              <p className="text-sm text-[#a1a1aa]">
                Don&apos;t have Readied yet?{' '}
                <Link href="/download" className="text-accent underline">
                  Download now
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
