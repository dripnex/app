/**
 * File-backed implementation of @readied/licensing's LicenseStorage.
 *
 * Persists three small JSON files under the user's data directory:
 *
 *   license.json       — legacy LicenseFile (StoredLicenseData)
 *   trial.json         — local trial start (StoredTrialData)
 *   subscription.json  — cached subscription state (StoredSubscriptionData)
 *
 * Subscription verification (Ed25519):
 * - If the persisted cache contains `signedEnvelope`, the read path
 *   verifies it via @readied/licensing's verifySubscriptionSignature
 *   before returning. An invalid envelope causes the cache to be
 *   refused (read returns null) so the next call falls through to a
 *   fresh fetch from the API.
 * - If the persisted cache has NO `signedEnvelope`, we accept it and
 *   log a structured warning. This is the migration window: once the
 *   server reliably emits envelopes for N releases, we can flip to
 *   strict mode (refuse unsigned caches).
 * - trial.json is unsigned by design (see packages/licensing/README.md).
 */

import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  verifySubscriptionSignature,
  type LicenseStorage,
  type StoredLicenseData,
  type StoredTrialData,
  type StoredSubscriptionData,
} from '@readied/licensing';
import { loggers } from '../logger';

/**
 * Ed25519 public key used to verify SignedSubscriptionEnvelope payloads.
 *
 * Public-by-design: the client needs it to verify. The matching PRIVATE
 * key MUST live ONLY on the licensing server (env var, never the repo).
 *
 * Rotation procedure when this key needs to change:
 *   1. Generate a new keypair on a trusted machine
 *      (see packages/licensing/README.md > "Rolling the signing key")
 *   2. Ship a desktop release with the new public key embedded HERE
 *   3. Wait for the install base to update
 *   4. Switch the server to sign with the new private key
 *   Clients on the old release will stop verifying envelopes signed
 *   with the new key, falling back to the "no-envelope" lenient log —
 *   no hard lockout, but they'll re-fetch on every cache miss.
 */
const SUBSCRIPTION_PUBLIC_KEY = 'd049019b2ff05ccfd3802e0619d5897e21431a6f946af724c13ed7ecca7ec01f';

export class FileLicenseStorage implements LicenseStorage {
  private readonly licensePath: string;
  private readonly trialPath: string;
  private readonly subscriptionPath: string;

  constructor(dataDir: string) {
    this.licensePath = join(dataDir, 'license.json');
    this.trialPath = join(dataDir, 'trial.json');
    this.subscriptionPath = join(dataDir, 'subscription.json');
  }

  async readLicenseData(): Promise<StoredLicenseData | null> {
    return readJsonOrNull<StoredLicenseData>(this.licensePath);
  }

  async writeLicenseData(data: StoredLicenseData): Promise<void> {
    await writeFile(this.licensePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async removeLicenseData(): Promise<void> {
    if (existsSync(this.licensePath)) {
      await unlink(this.licensePath);
    }
  }

  async readTrialData(): Promise<StoredTrialData | null> {
    return readJsonOrNull<StoredTrialData>(this.trialPath);
  }

  async writeTrialData(data: StoredTrialData): Promise<void> {
    await writeFile(this.trialPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async readSubscriptionData(): Promise<StoredSubscriptionData | null> {
    const cached = await readJsonOrNull<StoredSubscriptionData>(this.subscriptionPath);
    if (!cached) return null;

    if (!cached.signedEnvelope) {
      // Migration window: no envelope on disk. Accept the cache, log so
      // operators can see when the population is fully migrated.
      loggers
        .license()
        .warn(
          { hasSubscriptionId: Boolean(cached.subscription?.subscriptionId) },
          'subscription cache has no signed envelope — running in lenient mode'
        );
      return cached;
    }

    const result = await verifySubscriptionSignature(cached.signedEnvelope, {
      publicKey: SUBSCRIPTION_PUBLIC_KEY,
    });
    if (!result.valid) {
      loggers
        .license()
        .error(
          { error: result.error },
          'subscription cache envelope failed verification — refusing cache, will refetch'
        );
      // Refuse the cache. The next caller will fetch from the API.
      return null;
    }

    return cached;
  }

  async writeSubscriptionData(data: StoredSubscriptionData): Promise<void> {
    await writeFile(this.subscriptionPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async removeSubscriptionData(): Promise<void> {
    if (existsSync(this.subscriptionPath)) {
      await unlink(this.subscriptionPath);
    }
  }
}

async function readJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    if (!existsSync(path)) return null;
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
