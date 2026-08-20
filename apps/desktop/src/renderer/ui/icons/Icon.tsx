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
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export const Icon = forwardRef<MorphHandle, IconProps>(function Icon(
  {
    icon,
    hoverIcon,
    size = 16,
    strokeWidth = 2,
    className,
    color,
    label,
    style,
    'aria-label': ariaLabel,
    'aria-hidden': ariaHidden,
  },
  ref
) {
  const [hover, setHover] = useState(false);
  const shown = hover && hoverIcon ? hoverIcon : icon;
  const hidden = ariaHidden === true || ariaHidden === 'true';

  return (
    <MorphIcon
      ref={ref}
      icon={shown}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      color={color}
      label={hidden ? undefined : (label ?? ariaLabel)}
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : ariaLabel}
      style={style}
      spring="snappy"
      reducedMotion="user"
      onMouseEnter={hoverIcon ? () => setHover(true) : undefined}
      onMouseLeave={hoverIcon ? () => setHover(false) : undefined}
    />
  );
});
