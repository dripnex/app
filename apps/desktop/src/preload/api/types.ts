/**
 * Shared types for the preload API modules.
 *
 * Re-exported from the barrel so the renderer can still import them
 * from `../preload/index`.
 */

/** Result type from operations */
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { type: string; error?: unknown } };

/** Note status for workflow tracking */
export type NoteStatus = 'active' | 'on_hold' | 'completed' | 'dropped';

/** Note snapshot from the API */
export interface NoteSnapshot {
  id: string;
  notebookId: string;
  content: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  wordCount: number;
  archivedAt: string | null;
  isArchived: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  status: NoteStatus;
}

/** Notebook snapshot from the API */
export interface NotebookSnapshot {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** Notebook with metadata (note/child counts) */
export interface NotebookWithMetadata extends NotebookSnapshot {
  noteCount: number;
  childCount: number;
}

/** Notebook tree node */
export interface NotebookTreeNode {
  notebook: NotebookSnapshot;
  children: NotebookTreeNode[];
}

/** Notebook tree (array of root nodes) */
export type NotebookTree = NotebookTreeNode[];

/** List options */
export interface ListOptions {
  limit?: number;
  offset?: number;
  tag?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  archived?: 'active' | 'archived' | 'all';
}

/** Note counts */
export interface NoteCounts {
  active: number;
  archived: number;
  total: number;
  pinned: number;
  deleted: number;
  byStatus: Record<NoteStatus, number>;
}

/** Activity stats for heatmap */
export interface ActivityWeek {
  week: string;
  created: number;
  updated: number;
}

export interface ActivityStats {
  weeks: ActivityWeek[];
  totalNotes: number;
  currentStreak: number;
  currentWeek: string;
}

/** Backup info */
export interface BackupInfo {
  filename: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
}

/** Backup result */
export interface BackupResult {
  success: boolean;
  path?: string;
  error?: string;
}

/** Export result */
export interface ExportResult {
  success: boolean;
  path?: string;
  noteCount?: number;
  error?: string;
}

/** Import result */
export interface ImportResult {
  success: boolean;
  noteCount?: number;
  skipped?: string[];
  error?: string;
}

/** Data paths */
export interface DataPaths {
  root: string;
  database: string;
  backups: string;
  logs: string;
}

/** License state (mirrored from @readied/licensing AppLicenseState) */
export type LicenseStatus =
  | 'free'
  | 'trial'
  | 'pro_active'
  | 'pro_grace'
  | 'pro_expired'
  // Legacy statuses (kept for backwards compat)
  | 'trial_expired'
  | 'licensed'
  | 'updates_expired';

export interface TrialInfo {
  startDate: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface SubscriptionInfo {
  subscriptionId: string;
  customerId: string;
  email: string;
  plan: 'monthly' | 'annual';
  status: 'active' | 'past_due' | 'canceled' | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface LicenseState {
  status: LicenseStatus;
  trial?: TrialInfo;
  subscription?: SubscriptionInfo;
  // Legacy fields (kept for backwards compat in settings UI)
  trialDaysRemaining?: number | null;
  expiresAt?: string | null;
  updatesUntil?: string | null;
  hasUpdates?: boolean;
  capabilities?: string[];
}

/** License activation result */
export interface LicenseResult {
  success: boolean;
  error?: string;
}

/** Tag with color */
export interface TagWithColor {
  name: string;
  color: string | null;
}

/** Backlink information (notes that link TO a note) */
export interface BacklinkInfo {
  noteId: string;
  noteTitle: string;
  targetRef: string;
}

/** Outgoing link information (notes that a note links TO) */
export interface OutgoingLinkInfo {
  targetRef: string;
  targetNoteId: string | null;
  targetTitle: string | null;
}

/** Graph data for visualization */
export interface GraphData {
  nodes: Array<{ id: string; title: string; notebookId: string }>;
  edges: Array<{ source: string; target: string }>;
}

/** Log level types */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** User type for authentication */
export interface User {
  id: string;
  email: string;
}

/** Sync change */
export interface SyncChange {
  id: string;
  noteId: string;
  version: number;
  operation: 'create' | 'update' | 'delete';
  encryptedData: string | null;
  deviceId: string;
  createdAt: string;
}

/** Pull response */
export interface PullResponse {
  changes: SyncChange[];
  cursor: number;
  hasMore: boolean;
}

/** Push result */
export interface PushResult {
  noteId: string;
  version: number;
  status: 'applied' | 'conflict';
  serverVersion?: number;
}

/** Push response */
export interface PushResponse {
  results: PushResult[];
  cursor: number;
}

/** Sync status */
export interface SyncStatus {
  enabled: boolean;
  plan: string;
  cursor: number;
  totalChanges: number;
}

/** Subscription status */
export interface SubscriptionStatus {
  plan: string;
  status: string;
  syncEnabled: boolean;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  canceledAt?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd?: boolean;
}

/** Scanned plugin from filesystem */
export interface PluginConfigSchemaField {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'range';
  default: unknown;
  description?: string;
  /** For 'enum' type: available options */
  options?: Array<{ value: string; label: string }>;
  /** For 'range' type */
  min?: number;
  max?: number;
  step?: number;
}

export interface ScannedPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  configSchema?: Record<string, PluginConfigSchemaField>;
  code: string;
  path: string;
}

/** Plugin registry state row */
export interface PluginRegistryState {
  pluginId: string;
  enabled: boolean;
}
