import { Toggle } from '../../../ui/primitives';
import { SettingRow } from './SettingRow';

interface SettingToggleProps {
  label: string;
  description?: string;
  htmlFor: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  flush?: boolean;
}

export function SettingToggle({
  label,
  description,
  htmlFor,
  checked,
  onChange,
  disabled,
  flush,
}: SettingToggleProps) {
  return (
    <SettingRow label={label} description={description} htmlFor={htmlFor} flush={flush}>
      <Toggle id={htmlFor} checked={checked} onChange={onChange} disabled={disabled} />
    </SettingRow>
  );
}
