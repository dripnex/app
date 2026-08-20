import { NumberInput } from '../../../ui/primitives';
import { SettingRow } from './SettingRow';

interface SettingNumberProps {
  label: string;
  description?: string;
  htmlFor: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  flush?: boolean;
}

export function SettingNumber({
  label,
  description,
  htmlFor,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  flush,
}: SettingNumberProps) {
  return (
    <SettingRow label={label} description={description} htmlFor={htmlFor} flush={flush}>
      <NumberInput
        id={htmlFor}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </SettingRow>
  );
}
