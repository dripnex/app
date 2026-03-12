import Hero from '@/components/landing/Hero';
import SocialProof from '@/components/landing/SocialProof';
import Features from '@/components/landing/Features';
import WhyLocal from '@/components/landing/WhyLocal';
import Audience from '@/components/landing/Audience';

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <Features />
      <WhyLocal />
      <Audience />
    </>
  );
}
