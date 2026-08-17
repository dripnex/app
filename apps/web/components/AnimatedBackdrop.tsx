'use client';

import { MeshGradient } from '@paper-design/shaders-react';

export default function AnimatedBackdrop() {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <MeshGradient
        colors={['#07070a', '#152036', '#1c1917', '#3f4654']}
        distortion={0.7}
        swirl={0.35}
        speed={reduceMotion ? 0 : 0.2}
        style={{ width: '100%', height: '100%' }}
      />
      <div className="absolute inset-0 bg-[#09090b]/35" />
    </div>
  );
}
