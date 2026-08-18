/**
 * ImageLightbox - Fullscreen image viewer
 *
 * Opens when clicking on embedded images in the preview.
 * Supports zoom and pan.
 */

import { useCallback, useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { cssm } from '../lib/cssm';
import styles from './ImageLightbox.module.css';

const sc = cssm(styles);

interface ImageLightboxProps {
  readonly src: string;
  readonly alt?: string;
  readonly onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        setScale(s => Math.min(s + 0.25, 4));
      } else if (e.key === '-') {
        setScale(s => Math.max(s - 0.25, 0.25));
      } else if (e.key === 'r') {
        setRotation(r => (r + 90) % 360);
      } else if (e.key === '0') {
        setScale(1);
        setRotation(0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const zoomIn = useCallback(() => setScale(s => Math.min(s + 0.25, 4)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.25, 0.25)), []);
  const rotate = useCallback(() => setRotation(r => (r + 90) % 360), []);

  return (
    <div className={sc('lightbox-overlay')} onClick={handleBackdropClick}>
      {/* Controls */}
      <div className={sc('lightbox-controls')}>
        <button
          type="button"
          className={sc('lightbox-btn')}
          onClick={zoomOut}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <ZoomOut size={20} />
        </button>
        <span className={sc('lightbox-zoom-level')}>{Math.round(scale * 100)}%</span>
        <button
          type="button"
          className={sc('lightbox-btn')}
          onClick={zoomIn}
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <ZoomIn size={20} />
        </button>
        <button
          type="button"
          className={sc('lightbox-btn')}
          onClick={rotate}
          aria-label="Rotate"
          title="Rotate (R)"
        >
          <RotateCw size={20} />
        </button>
        <button
          type="button"
          className={sc('lightbox-btn', 'lightbox-btn--close')}
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
        >
          <X size={20} />
        </button>
      </div>

      {/* Image */}
      <div className={sc('lightbox-image-container')}>
        <img
          src={src}
          alt={alt || 'Image preview'}
          className={sc('lightbox-image')}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>

      {/* Filename */}
      {alt && <div className={sc('lightbox-filename')}>{alt}</div>}
    </div>
  );
}
