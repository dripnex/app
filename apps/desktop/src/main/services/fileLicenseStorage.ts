/**
 * File-backed implementation of @readied/licensing's LicenseStorage.
 *
 * Lives alongside the other services. Persists three small JSON files
 * under the user's data directory:
 *
 *   license.json       — legacy LicenseFile (StoredLicenseData)
 *   trial.json         — local trial start (StoredTrialData)
 *   subscription.json  — cached subscription state (StoredSubscriptionData)
 *
 * Note: trial.json is unsigned by design (see packages/licensing/README.md).
 * subscription.json will move to a signed-envelope wire format once the
 * server emits SignedSubscriptionEnvelope (see @readied/licensing
 * verifySubscriptionSignature). Until then, the cache is best-effort.
 */

import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  LicenseStorage,
  StoredLicenseData,
  StoredTrialData,
  StoredSubscriptionData,
} from '@readied/licensing';

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
    return readJsonOrNull<StoredSubscriptionData>(this.subscriptionPath);
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
