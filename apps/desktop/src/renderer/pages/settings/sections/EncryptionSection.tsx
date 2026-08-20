import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { startCloudSyncIfReady, selectEmail, useAuthStore } from '../../../stores/authStore';
import { downloadEmergencyKit, printEmergencyKit } from '../../../utils/emergencyKit';
import { downloadOnePasswordCsv } from '../../../utils/onePasswordCsv';
import {
  PassphraseCreateForm,
  seedGeneratedPassphrase,
} from '../../../components/sync/PassphraseCreateForm';
import { SaveToOnePasswordButton } from '../../../components/sync/SaveToOnePasswordButton';
import { formatRecoveryKey, scorePassphrase } from '../../../utils/passphrase';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { SettingsPage } from '../components/SettingsPage';
import { Button, Input } from '../../../ui/primitives';
import styles from './Section.module.css';

type KeyStatus = {
  ready: boolean;
  hasServerKeys: boolean;
  hasLocalKey: boolean;
  hasLegacyKey: boolean;
};

const EMPTY_STATUS: KeyStatus = {
  ready: false,
  hasServerKeys: false,
  hasLocalKey: false,
  hasLegacyKey: false,
};

export function EncryptionSection() {
  const [status, setStatus] = useState<KeyStatus>(EMPTY_STATUS);
  const accountEmail = useAuthStore(selectEmail);
  const seeded = useMemo(() => seedGeneratedPassphrase(), []);
  const [passphrase, setPassphrase] = useState(seeded);
  const [passphraseConfirm, setPassphraseConfirm] = useState(seeded);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [ready, keys] = await Promise.all([
      window.dripnex.encryption.isReady(),
      window.dripnex.encryption.getKeyStatus(),
    ]);
    setStatus({
      ready: ready.ready,
      hasServerKeys: keys.hasServerKeys === true,
      hasLocalKey: keys.hasLocalKey === true,
      hasLegacyKey: keys.hasLegacyKey === true,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearForm = () => {
    const next = seedGeneratedPassphrase();
    setPassphrase(next);
    setPassphraseConfirm(next);
    setRecoveryInput('');
  };

  const handleSetup = async () => {
    setError(null);
    setMessage(null);
    if (passphrase !== passphraseConfirm) {
      setError('Passphrases do not match.');
      return;
    }
    if (!scorePassphrase(passphrase).ok) {
      setError('Choose a stronger passphrase — six random words, or 16+ mixed characters.');
      return;
    }
    setBusy(true);
    try {
      const result = status.hasLegacyKey
        ? await window.dripnex.encryption.migrateLegacyKey(passphrase)
        : await window.dripnex.encryption.setupKeys(passphrase);
      if (!result.success) {
        setError(result.error || 'Failed to set up encryption');
        return;
      }
      if (result.recoveryKey) setRecoveryKey(result.recoveryKey);
      await startCloudSyncIfReady();
      await refresh();
      clearForm();
      setMessage('Encryption is ready. Sync can start on this device.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await window.dripnex.encryption.unlockWithPassphrase(passphrase);
      if (!result.success) {
        setError(
          result.wrongPassphrase ? 'Incorrect passphrase' : (result.error ?? 'Unlock failed')
        );
        return;
      }
      await startCloudSyncIfReady();
      await refresh();
      clearForm();
      setMessage('Unlocked. Sync can start on this device.');
    } finally {
      setBusy(false);
    }
  };

  const handleRecovery = async () => {
    setError(null);
    setMessage(null);
    const key = recoveryInput.trim();
    if (!key) {
      setError('Paste your recovery key.');
      return;
    }
    setBusy(true);
    try {
      const result = await window.dripnex.encryption.unlockWithRecoveryKey(key);
      if (!result.success) {
        setError(result.error || 'Recovery failed');
        return;
      }
      await startCloudSyncIfReady();
      await refresh();
      clearForm();
      setMessage('Unlocked with recovery key.');
    } finally {
      setBusy(false);
    }
  };

  const handleChange = async () => {
    setError(null);
    setMessage(null);
    if (passphrase !== passphraseConfirm) {
      setError('Passphrases do not match.');
      return;
    }
    if (!scorePassphrase(passphrase).ok) {
      setError('Choose a stronger passphrase — six random words, or 16+ mixed characters.');
      return;
    }
    setBusy(true);
    try {
      const result = await window.dripnex.encryption.changePassphrase(passphrase);
      if (!result.success) {
        setError(result.error || 'Could not change passphrase');
        return;
      }
      clearForm();
      setMessage('Passphrase updated.');
    } finally {
      setBusy(false);
    }
  };

  const stateLabel = status.ready
    ? 'Unlocked on this device'
    : status.hasServerKeys
      ? 'Locked — enter passphrase'
      : 'Not set up';

  return (
    <SettingsPage
      title="Encryption"
      lede="Notes are encrypted on this device before they sync. The passphrase is never stored."
    >
      <SettingGroup title="Status">
        <SettingRow label="This device" description={stateLabel}>
          <div className={styles.statusBadge} data-tone={status.ready ? 'ok' : 'warn'}>
            {status.ready ? <Unlock size={14} /> : <Lock size={14} />}
            <span>{status.ready ? 'Ready' : 'Locked'}</span>
          </div>
        </SettingRow>
      </SettingGroup>

      {recoveryKey ? (
        <SettingGroup title="Recovery key">
          <SettingRow
            label="Save this now"
            description={`${formatRecoveryKey(recoveryKey)} — shown once. You need it if you forget the passphrase.`}
          >
            <div className={styles.actionStack}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  printEmergencyKit({
                    email: accountEmail,
                    passphrase,
                    recoveryKey,
                  })
                }
              >
                Print / Save as PDF
              </Button>
              <SaveToOnePasswordButton
                email={accountEmail}
                passphrase={passphrase}
                recoveryKey={recoveryKey}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadOnePasswordCsv({
                    email: accountEmail,
                    passphrase,
                    recoveryKey,
                  })
                }
              >
                1Password CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadEmergencyKit({
                    email: accountEmail,
                    passphrase,
                    recoveryKey,
                  })
                }
              >
                Download kit
              </Button>
            </div>
          </SettingRow>
        </SettingGroup>
      ) : null}

      {!status.ready && !status.hasServerKeys ? (
        <SettingGroup title="Set up">
          <div className={styles.stack}>
            <PassphraseCreateForm
              passphrase={passphrase}
              passphraseConfirm={passphraseConfirm}
              onPassphraseChange={setPassphrase}
              onConfirmChange={setPassphraseConfirm}
              onSubmit={() => void handleSetup()}
              error={error}
              busy={busy}
              email={accountEmail}
            />
          </div>
        </SettingGroup>
      ) : null}

      {!status.ready && status.hasServerKeys ? (
        <SettingGroup title="Unlock">
          <SettingRow label="Passphrase" description="The one you created on your first device">
            <Input
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={event => setPassphrase(event.target.value)}
              placeholder="Passphrase"
            />
          </SettingRow>
          <SettingRow label="Unlock this device">
            <Button
              variant="primary"
              size="sm"
              icon={<Unlock size={14} />}
              loading={busy}
              onClick={() => void handleUnlock()}
            >
              Unlock
            </Button>
          </SettingRow>
          <SettingRow label="Recovery key" description="If you forgot the passphrase">
            <Input
              autoComplete="off"
              value={recoveryInput}
              onChange={event => setRecoveryInput(event.target.value)}
              placeholder="Recovery key (dashes ok)"
            />
          </SettingRow>
          <SettingRow label="Unlock with recovery">
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() => void handleRecovery()}
            >
              Use recovery key
            </Button>
          </SettingRow>
        </SettingGroup>
      ) : null}

      {status.ready ? (
        <SettingGroup title="Change passphrase">
          <div className={styles.stack}>
            <PassphraseCreateForm
              passphrase={passphrase}
              passphraseConfirm={passphraseConfirm}
              onPassphraseChange={setPassphrase}
              onConfirmChange={setPassphraseConfirm}
              onSubmit={() => void handleChange()}
              error={error}
              busy={busy}
              submitLabel="Change passphrase"
              email={accountEmail}
            />
          </div>
        </SettingGroup>
      ) : null}

      {error ? <p className={styles.errorMessage}>{error}</p> : null}
      {message ? <p className={styles.version}>{message}</p> : null}
    </SettingsPage>
  );
}
