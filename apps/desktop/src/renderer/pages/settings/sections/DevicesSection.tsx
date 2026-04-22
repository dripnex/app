/**
 * Devices Section — displays linked devices with rename/revoke controls
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, Laptop, Trash2, Check, X, LogOut } from 'lucide-react';
import { SettingGroup } from '../components/SettingGroup';
import styles from './Section.module.css';

interface Device {
  id: string;
  deviceId: string;
  name: string | null;
  platform: string | null;
  isCurrent: boolean;
  lastSeenAt: string;
  createdAt: string;
}

function getPlatformIcon(platform: string | null) {
  switch (platform) {
    case 'darwin':
      return <Laptop size={16} />;
    case 'win32':
    case 'linux':
      return <Monitor size={16} />;
    case 'ios':
    case 'android':
      return <Smartphone size={16} />;
    default:
      return <Monitor size={16} />;
  }
}

function getPlatformLabel(platform: string | null): string {
  switch (platform) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    default:
      return 'Unknown';
  }
}

function formatLastSeen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function DeviceRow({
  device,
  onRename,
  onRevoke,
}: {
  device: Device;
  onRename: (deviceId: string, name: string) => void;
  onRevoke: (deviceId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(device.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== device.name) {
      onRename(device.deviceId, trimmed);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditName(device.name ?? '');
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div className={styles.deviceRow}>
      <div className={styles.deviceIcon}>{getPlatformIcon(device.platform)}</div>
      <div className={styles.deviceInfo}>
        {editing ? (
          <div className={styles.deviceEditRow}>
            <input
              ref={inputRef}
              className={styles.deviceNameInput}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              maxLength={100}
            />
            <button type="button" className={styles.iconButton} onClick={handleSave}>
              <Check size={14} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onMouseDown={e => {
                e.preventDefault();
                handleCancel();
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.deviceName}
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {device.name || 'Unnamed Device'}
          </button>
        )}
        <span className={styles.deviceMeta}>
          {getPlatformLabel(device.platform)} &middot; {formatLastSeen(device.lastSeenAt)}
          {device.isCurrent && <span className={styles.currentBadge}>This device</span>}
        </span>
      </div>
      <button
        type="button"
        className={styles.dangerIconButton}
        onClick={() => onRevoke(device.deviceId)}
        title={device.isCurrent ? 'Sign out this device' : 'Revoke device'}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function DevicesSection() {
  const queryClient = useQueryClient();
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);

  const { data: deviceList = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => window.readied.devices.list(),
    staleTime: 30_000,
  });

  const renameMutation = useMutation({
    mutationFn: ({ deviceId, name }: { deviceId: string; name: string }) =>
      window.readied.devices.rename(deviceId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId: string) => window.readied.devices.revoke(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => window.readied.devices.revokeOthers(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const handleRename = useCallback(
    (deviceId: string, name: string) => {
      renameMutation.mutate({ deviceId, name });
    },
    [renameMutation]
  );

  const handleRevoke = useCallback(
    (deviceId: string) => {
      const device = deviceList.find(d => d.deviceId === deviceId);
      if (device?.isCurrent) {
        setConfirmRevokeId(deviceId);
      } else {
        revokeMutation.mutate(deviceId);
      }
    },
    [deviceList, revokeMutation]
  );

  const handleConfirmRevoke = useCallback(() => {
    if (confirmRevokeId) {
      revokeMutation.mutate(confirmRevokeId);
      setConfirmRevokeId(null);
      // Current device revoked = logout
      void window.readied.auth.logout();
    }
  }, [confirmRevokeId, revokeMutation]);

  const handleRevokeOthers = useCallback(() => {
    setConfirmRevokeOthers(true);
  }, []);

  const handleConfirmRevokeOthers = useCallback(() => {
    revokeOthersMutation.mutate();
    setConfirmRevokeOthers(false);
  }, [revokeOthersMutation]);

  const otherDeviceCount = deviceList.filter(d => !d.isCurrent).length;

  return (
    <SettingGroup title="Devices">
      {isLoading ? (
        <div className={styles.infoMessage}>Loading devices...</div>
      ) : deviceList.length === 0 ? (
        <div className={styles.infoMessage}>No devices registered.</div>
      ) : (
        <>
          <div className={styles.deviceList}>
            {deviceList.map(device => (
              <DeviceRow
                key={device.deviceId}
                device={device}
                onRename={handleRename}
                onRevoke={handleRevoke}
              />
            ))}
          </div>

          {otherDeviceCount > 0 && (
            <div className={styles.deviceActions}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleRevokeOthers}
                disabled={revokeOthersMutation.isPending}
              >
                <LogOut size={14} />
                <span>Sign out other devices ({otherDeviceCount})</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirm revoke current device */}
      {confirmRevokeId && (
        <div className={styles.confirmDialog}>
          <p>This will sign you out of this device. Continue?</p>
          <div className={styles.buttonGroup}>
            <button type="button" className={styles.dangerButton} onClick={handleConfirmRevoke}>
              Sign Out
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfirmRevokeId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirm revoke others */}
      {confirmRevokeOthers && (
        <div className={styles.confirmDialog}>
          <p>
            Sign out {otherDeviceCount} other device{otherDeviceCount > 1 ? 's' : ''}?
          </p>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={handleConfirmRevokeOthers}
            >
              Sign Out Others
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setConfirmRevokeOthers(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </SettingGroup>
  );
}
