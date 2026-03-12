'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function AuthVerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      window.location.href = `readied://auth/verify?token=${token}`;

      const timer = setTimeout(() => {
        const prompt = document.getElementById('download-prompt');
        if (prompt) {
          prompt.style.display = 'block';
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#f4f4f5] mb-4">Invalid Link</h1>
          <p className="text-[#a1a1aa]">This verification link appears to be incomplete.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-[500px] text-center">
        <div className="inline-block w-10 h-10 mb-4 border-[3px] border-white/[0.06] border-t-accent rounded-full animate-spin" />
        <h1 className="text-2xl font-semibold text-[#f4f4f5] mb-4">Opening Readied...</h1>
        <p className="text-lg text-[#a1a1aa] mb-6">
          If the app doesn&apos;t open automatically,{' '}
          <a href={`readied://auth/verify?token=${token}`} className="text-accent underline">
            click here
          </a>
        </p>
        <p className="text-[#a1a1aa]">
          Don&apos;t have Readied?{' '}
          <Link href="/download" className="text-accent underline">
            Download now
          </Link>
        </p>

        <div
          id="download-prompt"
          className="mt-8 p-8 rounded-xl bg-surface border border-white/[0.06]"
          style={{ display: 'none' }}
        >
          <h2 className="text-xl font-semibold text-[#f4f4f5] mb-4">App didn&apos;t open?</h2>
          <p className="text-[#a1a1aa] mb-4">
            Make sure you have Readied installed on your device.
          </p>
          <Link
            href="/download"
            className="inline-block px-8 py-3 bg-accent text-white font-semibold rounded-lg transition-colors hover:bg-accent-hover"
          >
            Download Readied
          </Link>
        </div>
      </div>
    </div>
  );
}
