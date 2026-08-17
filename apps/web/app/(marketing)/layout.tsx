import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AnimatedBackdrop from '@/components/AnimatedBackdrop';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnimatedBackdrop />
      <Navbar />
      <main className="relative">{children}</main>
      <Footer />
    </>
  );
}
