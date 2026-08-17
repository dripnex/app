import type { CSSProperties } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';

export function LoginBackdrop() {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div aria-hidden="true" style={layerStyle}>
      <MeshGradient
        colors={['#07070a', '#152036', '#1c1917', '#3f4654']}
        distortion={0.7}
        swirl={0.35}
        speed={reduceMotion ? 0 : 0.2}
        style={{ width: '100%', height: '100%' }}
      />
      <div style={veilStyle} />
    </div>
  );
}

const layerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const veilStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(9, 9, 11, 0.42)',
};
