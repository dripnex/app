/**
 * NumberInput — Numeric Input with parsed onChange
 */

import { type InputHTMLAttributes, forwardRef } from 'react';
import { Input } from './Input';

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
  invalid?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, className, size = 'md', invalid, min, max, step, style, ...rest }, ref) => {
    return (
      <Input
        ref={ref}
        type="number"
        size={size}
        invalid={invalid}
        className={className}
        style={{ width: 80, ...style }}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={event => {
          const next = event.target.valueAsNumber;
          if (!Number.isNaN(next)) onChange(next);
        }}
        {...rest}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';
