/**
 * Backup Settings Section
 *
 * Export notes, import from other apps, create backups.
 */

import { useState, useCallback } from 'react';
import { Download, Upload, Archive, FolderOpen, RefreshCw } from 'lucide-react';
import { useSettingsStore, selectBackup } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import styles from './Section.module.css';

export function BackupSection() {
  const backup = useSettingsStore(selectBackup);
  const updateBackup = useSettingsStore((s) => s.updateBackup);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setMessage(null);
    try {
      const result = await window.readied.data.export();
      if (result.success) {
        setMessage(`Exported ${result.noteCount} notes to ${result.path}`);
      } else {
        setMessage(`Export failed: ${result.error}`);
      }
    } catch (err) {
      setMessage(`Export error: ${err}`);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    setMessage(null);
    try {
      const result = await window.readied.data.import();
      if (result.success) {
        setMessage(`Imported ${result.noteCount} notes`);
      } else {
        setMessage(`Import failed: ${result.error}`);
      }
    } catch (err) {
      setMessage(`Import error: ${err}`);
    } finally {
      setIsImporting(false);
    }
  }, []);

  const handleBackup = useCallback(async () => {
    setIsBackingUp(true);
    setMessage(null);
    try {
      const result = await window.readied.data.backup();
      if (result.success) {
        setMessage(`Backup created: ${result.path}`);
        updateBackup({ lastBackupAt: Date.now() });
      } else {
        setMessage(`Backup failed: ${result.error}`);
      }
    } catch (err) {
      setMessage(`Backup error: ${err}`);
    } finally {
      setIsBackingUp(false);
    }
  }, [updateBackup]);

  const handleOpenDataFolder = useCallback(async () => {
    await window.readied.data.openFolder();
  }, []);

  const formatLastBackup = () => {
    if (!backup.lastBackupAt) return 'Never';
    const date = new Date(backup.lastBackupAt);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Backup & Data</h2>

      <SettingGroup title="Export">
        <SettingRow
          label="Export All Notes"
          description="Export all your notes as Markdown files"
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <RefreshCw size={14} className={styles.spinning} />
            ) : (
              <Download size={14} />
            )}
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Import">
        <SettingRow
          label="Import Notes"
          description="Import from Obsidian, Markdown folder, or Readied export"
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? (
              <RefreshCw size={14} className={styles.spinning} />
            ) : (
              <Upload size={14} />
            )}
            <span>{isImporting ? 'Importing...' : 'Import'}</span>
          </button>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Backup">
        <SettingRow
          label="Create Backup"
          description={`Last backup: ${formatLastBackup()}`}
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleBackup}
            disabled={isBackingUp}
          >
            {isBackingUp ? (
              <RefreshCw size={14} className={styles.spinning} />
            ) : (
              <Archive size={14} />
            )}
            <span>{isBackingUp ? 'Backing up...' : 'Backup Now'}</span>
          </button>
        </SettingRow>

        <SettingRow
          label="Open Data Folder"
          description="View backups and database files"
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleOpenDataFolder}
          >
            <FolderOpen size={14} />
            <span>Open Folder</span>
          </button>
        </SettingRow>
      </SettingGroup>

      {message && <div className={styles.checkResult}>{message}</div>}
    </div>
  );
}
