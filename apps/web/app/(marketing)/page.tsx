import Hero from '@/components/landing/Hero';
import SocialProof from '@/components/landing/SocialProof';
import Features from '@/components/landing/Features';
import WhyLocal from '@/components/landing/WhyLocal';
import VideoGuides from '@/components/landing/VideoGuides';
import Audience from '@/components/landing/Audience';
import Testimonials from '@/components/landing/Testimonials';
import CreatorStory from '@/components/landing/CreatorStory';

export default function HomePage() {
  return (
    <>
      {/* 1. Hook: bold claim + editor preview + video */}
      <Hero />

      {/* 2. Credibility: social proof badges */}
      <SocialProof />

      {/* 3. What: feature cards */}
      <Features />

      {/* 4. Why: local-first philosophy (bento + beams) */}
      <WhyLocal />

      {/* 5. Learn: video guides */}
      <VideoGuides />

      {/* 6. Who: target audience */}
      <Audience />

      {/* 7. Trust: testimonials / reviews */}
      <Testimonials />

      {/* 8. Personal: creator story */}
      <CreatorStory />
    </>
  );
}
