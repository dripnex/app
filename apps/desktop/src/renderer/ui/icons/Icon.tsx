import { forwardRef, type CSSProperties } from 'react';
import { MorphIcon, type IconInput, type MorphHandle } from 'morphicons/react';

export type { IconInput, MorphHandle };

export interface IconProps {
  icon: IconInput;
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
  label?: string;
  style?: CSSProperties;
}

export const Icon = forwardRef<MorphHandle, IconProps>(function Icon(
  { icon, size = 16, strokeWidth = 2, className, color, label, style },
  ref
) {
  return (
    <MorphIcon
      ref={ref}
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      color={color}
      label={label}
      style={style}
      spring="snappy"
      reducedMotion="user"
    />
  );
});
