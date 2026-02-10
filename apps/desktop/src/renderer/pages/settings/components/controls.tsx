/**
 * Form Controls
 *
 * Reusable form controls for settings pages.
 */

import type { ChangeEvent } from 'react';
import styles from './controls.module.css';

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
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      disabled={disabled}
      className={styles.toggle}
    />
  );
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
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const num = parseFloat(e.target.value);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  return (
    <input
      type="number"
      id={id}
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={styles.numberInput}
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
}

export function TextInput({ id, value, onChange, placeholder, disabled }: TextInputProps) {
  return (
    <input
      type="text"
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={styles.textInput}
    />
  );
}

// ============================================================================
// Select (Dropdown)
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export function Select({ id, value, onChange, options, disabled }: SelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={styles.select}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
