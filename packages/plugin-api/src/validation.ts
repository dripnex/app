import type { PluginManifest } from './types';

/** Kebab-case: lowercase letters, digits, hyphens. No leading/trailing hyphens. */
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Basic semver: major.minor.patch with optional pre-release/build metadata */
const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

export interface ManifestError {
  field: string;
  message: string;
}

/**
 * Validate a plugin manifest before loading.
 *
 * Returns an array of validation errors (empty = valid).
 */
export function validateManifest(manifest: unknown): ManifestError[] {
  const errors: ManifestError[] = [];

  if (manifest == null || typeof manifest !== 'object') {
    return [{ field: 'manifest', message: 'Manifest must be a non-null object' }];
  }

  const m = manifest as Record<string, unknown>;

  // id: non-empty kebab-case string
  if (typeof m.id !== 'string' || m.id.length === 0) {
    errors.push({ field: 'id', message: 'id must be a non-empty string' });
  } else if (!KEBAB_CASE_RE.test(m.id)) {
    errors.push({ field: 'id', message: `id must be kebab-case (got "${m.id}")` });
  }

  // name: non-empty string
  if (typeof m.name !== 'string' || m.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name must be a non-empty string' });
  }

  // version: valid semver
  if (typeof m.version !== 'string' || m.version.length === 0) {
    errors.push({ field: 'version', message: 'version must be a non-empty string' });
  } else if (!SEMVER_RE.test(m.version)) {
    errors.push({ field: 'version', message: `version must be valid semver (got "${m.version}")` });
  }

  // activate: must be a function
  if (typeof m.activate !== 'function') {
    errors.push({ field: 'activate', message: 'activate must be a function' });
  }

  // deactivate: optional, but if present must be a function
  if (m.deactivate !== undefined && typeof m.deactivate !== 'function') {
    errors.push({ field: 'deactivate', message: 'deactivate must be a function if provided' });
  }

  return errors;
}

/**
 * Validate and narrow a manifest. Returns the typed manifest or null.
 * Logs errors via the provided logger (defaults to console.error).
 */
export function assertValidManifest(
  manifest: unknown,
  log: (msg: string) => void = console.error
): PluginManifest | null {
  const errors = validateManifest(manifest);
  if (errors.length > 0) {
    const id = (manifest as Record<string, unknown>)?.id ?? 'unknown';
    for (const err of errors) {
      log(`[plugin:${id}] Invalid manifest: ${err.field} — ${err.message}`);
    }
    return null;
  }
  return manifest as PluginManifest;
}
