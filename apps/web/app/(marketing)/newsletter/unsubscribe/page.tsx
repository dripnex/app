import { Suspense } from 'react';
import type { Metadata } from 'next';
import UnsubscribeContent from './UnsubscribeContent';

export const metadata: Metadata = {
  title: 'Unsubscribe — Dripnex',
  description: 'Unsubscribe from the Dripnex newsletter.',
};

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-[3px] border-white/6 border-t-accent rounded-full animate-spin" />
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
