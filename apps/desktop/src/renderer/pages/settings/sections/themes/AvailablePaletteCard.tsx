import themeStyles from '../AppearanceThemes.module.css';
import { Button } from '../../../../ui/primitives';

export function AvailablePaletteCard({
  name,
  description,
  version,
  installing,
  disabled,
  onInstall,
}: {
  name: string;
  description: string;
  version: string;
  installing: boolean;
  disabled: boolean;
  onInstall: () => void;
}) {
  return (
    <div className={themeStyles.availableCard}>
      <div className={themeStyles.availableMeta}>
        <div className={themeStyles.availableTitleRow}>
          <span className={themeStyles.name}>{name}</span>
          <span className={themeStyles.availableVersion}>v{version}</span>
        </div>
        <span className={themeStyles.desc}>{description}</span>
      </div>
      <Button variant="primary" size="sm" disabled={disabled} onClick={onInstall}>
        {installing ? 'Installing…' : 'Install'}
      </Button>
    </div>
  );
}
