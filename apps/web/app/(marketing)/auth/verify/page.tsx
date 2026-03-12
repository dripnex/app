import { Suspense } from 'react';
import AuthVerifyContent from './AuthVerifyContent';

export default function AuthVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <div className="text-center">
            <div className="inline-block w-10 h-10 mb-4 border-[3px] border-white/[0.06] border-t-accent rounded-full animate-spin" />
            <h1 className="text-2xl font-semibold text-[#f4f4f5]">Verifying...</h1>
          </div>
        </div>
      }
    >
      <AuthVerifyContent />
    </Suspense>
  );
}
