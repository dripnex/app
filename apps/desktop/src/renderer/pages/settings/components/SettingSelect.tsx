import { Select, type SelectOption } from '../../../ui/primitives';
import { SettingRow } from './SettingRow';

interface SettingSelectProps {
  label: string;
  description?: string;
  htmlFor: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  flush?: boolean;
}

export function SettingSelect({
  label,
  description,
  htmlFor,
  value,
  onChange,
  options,
  disabled,
  flush,
}: SettingSelectProps) {
  return (
    <SettingRow label={label} description={description} htmlFor={htmlFor} flush={flush}>
      <Select
        id={htmlFor}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
      />
    </SettingRow>
  );
}
