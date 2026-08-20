import { Toggle } from '../../../ui/primitives';
import { SettingRow } from './SettingRow';

interface SettingToggleProps {
  label: string;
  description?: string;
  htmlFor: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingToggle({
  label,
  description,
  htmlFor,
  checked,
  onChange,
  disabled,
}: SettingToggleProps) {
  return (
    <SettingRow label={label} description={description} htmlFor={htmlFor}>
      <Toggle id={htmlFor} checked={checked} onChange={onChange} disabled={disabled} />
    </SettingRow>
  );
}
