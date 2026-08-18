/**
 * Form Controls
 *
 * Settings-specific controls. Text/number/select wrap ui/primitives.
 */

import {
  Input,
  NumberInput as PrimitiveNumberInput,
  Select as PrimitiveSelect,
  Toggle as PrimitiveToggle,
  type SelectOption,
} from '../../../ui/primitives';
import styles from './controls.module.css';

export type { SelectOption };

// ============================================================================
// Toggle (Checkbox)
// ============================================================================

export interface ToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ id, checked, onChange, disabled }: ToggleProps) {
  return <PrimitiveToggle id={id} checked={checked} onChange={onChange} disabled={disabled} />;
}

// ============================================================================
// NumberInput
// ============================================================================

export interface NumberInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberInput({ id, value, onChange, min, max, step, disabled }: NumberInputProps) {
  return (
    <PrimitiveNumberInput
      id={id}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    />
  );
}

// ============================================================================
// TextInput
// ============================================================================

export interface TextInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'password';
  autoComplete?: string;
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
  autoComplete,
}: TextInputProps) {
  return (
    <div className={styles.textInput}>
      <Input
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        type={type}
        autoComplete={autoComplete}
      />
    </div>
  );
}

// ============================================================================
// RangeInput (Slider)
// ============================================================================

export interface RangeInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
}

export function RangeInput({ id, value, onChange, min, max, step = 1, disabled }: RangeInputProps) {
  return (
    <div className={styles.rangeInput}>
      <input
        type="range"
        id={id}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={styles.rangeSlider}
      />
      <span className={styles.rangeValue}>{value}</span>
    </div>
  );
}

// ============================================================================
// Select (Dropdown)
// ============================================================================

export interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export function Select({ id, value, onChange, options, disabled }: SelectProps) {
  return (
    <PrimitiveSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
    />
  );
}

// ============================================================================
// ColorPicker
// ============================================================================

export interface ColorOption {
  value: string;
  label: string;
}

export interface ColorPickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  colors: ColorOption[];
  disabled?: boolean;
}

export function ColorPicker({ id, value, onChange, colors, disabled }: ColorPickerProps) {
  return (
    <div className={styles.colorPicker} id={id}>
      {colors.map(color => (
        <button
          key={color.value}
          type="button"
          className={`${styles.colorSwatch} ${value === color.value ? styles.colorSwatchActive : ''}`}
          style={{ backgroundColor: color.value }}
          onClick={() => !disabled && onChange(color.value)}
          disabled={disabled}
          title={color.label}
          aria-label={color.label}
        />
      ))}
    </div>
  );
}
