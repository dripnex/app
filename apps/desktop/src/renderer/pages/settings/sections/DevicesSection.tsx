/**
 * Devices — linked sessions, rename, sign out.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, Laptop, Check, X, Pencil, LogOut } from 'lucide';
import { Icon } from '../../../ui/icons/Icon';
import { SettingGroup } from '../components/SettingGroup';
import { Button } from '../../../ui/primitives';
import styles from './DevicesSection.module.css';

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
      return <Icon icon={Laptop} size={18} />;
    case 'ios':
    case 'android':
      return <Icon icon={Smartphone} size={18} />;
    default:
      return <Icon icon={Monitor} size={18} />;
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

function tidyHost(name: string | null): string {
  return (name ?? '').replace(/\.local$/i, '').trim();
}

function displayName(device: Device): string {
  return tidyHost(device.name) || 'Unnamed device';
}

function formatLastSeen(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'Active now';
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Active ${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `Last seen ${diffDays}d ago`;
  return `Last seen ${date.toLocaleDateString()}`;
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
  const [editName, setEditName] = useState(displayName(device));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== displayName(device)) {
      onRename(device.deviceId, trimmed);
    }
    setEditing(false);
  };

  return (
    <div className={styles.row} data-current={device.isCurrent}>
      <div className={styles.icon}>{getPlatformIcon(device.platform)}</div>
      <div className={styles.info}>
        {editing ? (
          <div className={styles.editRow}>
            <input
              ref={inputRef}
              className={styles.nameInput}
              value={editName}
              onChange={event => setEditName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') handleSave();
                if (event.key === 'Escape') setEditing(false);
              }}
              onBlur={handleSave}
              maxLength={100}
              aria-label="Device name"
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon icon={Check} size={14} />}
              onClick={handleSave}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon icon={X} size={14} />}
              onMouseDown={event => {
                event.preventDefault();
                setEditing(false);
                setEditName(displayName(device));
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.nameRow}>
              <p className={styles.name}>{displayName(device)}</p>
              {device.isCurrent ? <span className={styles.badge}>This device</span> : null}
            </div>
            <span className={styles.meta}>
              {getPlatformLabel(device.platform)} · {formatLastSeen(device.lastSeenAt)}
            </span>
          </>
        )}
      </div>
      {editing ? null : (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon icon={Pencil} size={13} />}
            onClick={() => {
              setEditName(displayName(device));
              setEditing(true);
            }}
          >
            Rename
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={<Icon icon={LogOut} size={13} />}
            onClick={() => onRevoke(device.deviceId)}
          >
            {device.isCurrent ? 'Sign out' : 'Remove'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function DevicesSection() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ kind: 'one' | 'others'; deviceId?: string } | null>(
    null
  );

  const { data: deviceList = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => window.dripnex.devices.list(),
    staleTime: 30_000,
  });

  const renameMutation = useMutation({
    mutationFn: ({ deviceId, name }: { deviceId: string; name: string }) =>
      window.dripnex.devices.rename(deviceId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (deviceId: string) => window.dripnex.devices.revoke(deviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const revokeOthersMutation = useMutation({
    mutationFn: () => window.dripnex.devices.revokeOthers(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const sorted = useMemo(
    () => [...deviceList].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
    [deviceList]
  );
  const otherCount = deviceList.filter(device => !device.isCurrent).length;
  const pendingDevice = sorted.find(device => device.deviceId === pending?.deviceId);

  const handleRename = useCallback(
    (deviceId: string, name: string) => {
      renameMutation.mutate({ deviceId, name });
    },
    [renameMutation]
  );

  const confirm = () => {
    if (pending?.kind === 'others') {
      revokeOthersMutation.mutate();
    } else if (pending?.kind === 'one' && pending.deviceId) {
      const current = deviceList.find(device => device.deviceId === pending.deviceId)?.isCurrent;
      revokeMutation.mutate(pending.deviceId);
      if (current) void window.dripnex.auth.logout();
    }
    setPending(null);
  };

  return (
    <SettingGroup title="Devices">
      {isLoading ? (
        <div className={styles.inset}>Loading devices…</div>
      ) : sorted.length === 0 ? (
        <div className={styles.inset}>No devices registered.</div>
      ) : (
        <>
          <div className={styles.list}>
            {sorted.map(device => (
              <DeviceRow
                key={device.deviceId}
                device={device}
                onRename={handleRename}
                onRevoke={deviceId => setPending({ kind: 'one', deviceId })}
              />
            ))}
          </div>

          {otherCount > 0 && pending?.kind !== 'others' ? (
            <div className={styles.footer}>
              <p className={styles.footerHint}>
                {otherCount} other {otherCount === 1 ? 'device' : 'devices'} can open this account.
              </p>
              <Button
                variant="danger"
                size="sm"
                icon={<Icon icon={LogOut} size={14} />}
                onClick={() => setPending({ kind: 'others' })}
                disabled={revokeOthersMutation.isPending}
              >
                Sign out others
              </Button>
            </div>
          ) : null}

          {pending?.kind === 'one' && pendingDevice ? (
            <div className={styles.confirm}>
              <p>
                {pendingDevice.isCurrent
                  ? 'Sign out of this Mac? You will need a magic link to come back.'
                  : `Remove ${displayName(pendingDevice)}? It will need to sign in again.`}
              </p>
              <div className={styles.confirmActions}>
                <Button variant="secondary" size="sm" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={confirm}>
                  {pendingDevice.isCurrent ? 'Sign out' : 'Remove'}
                </Button>
              </div>
            </div>
          ) : null}

          {pending?.kind === 'others' ? (
            <div className={styles.confirm}>
              <p>
                Sign out {otherCount} other {otherCount === 1 ? 'device' : 'devices'}? This Mac
                stays signed in.
              </p>
              <div className={styles.confirmActions}>
                <Button variant="secondary" size="sm" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={confirm}>
                  Sign out others
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </SettingGroup>
  );
}
