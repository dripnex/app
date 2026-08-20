import { Input } from '../../../ui/primitives';
import { SettingRow } from './SettingRow';

interface SettingTextProps {
  label: string;
  description?: string;
  htmlFor: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SettingText({
  label,
  description,
  htmlFor,
  value,
  onChange,
  placeholder,
  disabled,
}: SettingTextProps) {
  return (
    <SettingRow label={label} description={description} htmlFor={htmlFor}>
      <Input
        id={htmlFor}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </SettingRow>
  );
}
