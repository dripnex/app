import { forwardRef, useState, type CSSProperties } from 'react';
import { MorphIcon, type IconInput, type MorphHandle } from 'morphicons/react';

export type { IconInput, MorphHandle };

export interface IconProps {
  icon: IconInput;
  /** Morph to this icon on hover. Same instance — that is what animates. */
  hoverIcon?: IconInput;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  label?: string;
  style?: CSSProperties;
}

export const Icon = forwardRef<MorphHandle, IconProps>(function Icon(
  { icon, hoverIcon, size = 16, strokeWidth = 2, className, color, label, style },
  ref
) {
  const [hover, setHover] = useState(false);
  const shown = hover && hoverIcon ? hoverIcon : icon;

  return (
    <MorphIcon
      ref={ref}
      icon={shown}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      color={color}
      label={label}
      style={style}
      spring="snappy"
      reducedMotion="user"
      onMouseEnter={hoverIcon ? () => setHover(true) : undefined}
      onMouseLeave={hoverIcon ? () => setHover(false) : undefined}
    />
  );
});
