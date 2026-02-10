/**
 * Device Info Service
 *
 * Generates and persists a unique device ID for sync operations.
 * Device ID is created once on first auth and stored locally.
 *
 * @module DeviceInfo
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { hostname, platform } from 'os';
import { randomUUID } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface DeviceInfo {
  /** Unique device identifier (UUID) */
  deviceId: string;
  /** Device name (hostname) */
  name: string;
  /** Operating system platform */
  platform: string;
  /** When the device info was created */
  createdAt: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Gets or creates device info
 * @param dataDir - User data directory path (e.g., app.getPath('userData'))
 * @returns Device info object
 */
export async function getOrCreateDeviceInfo(dataDir: string): Promise<DeviceInfo> {
  const filePath = join(dataDir, 'device.json');

  try {
    // Try to read existing device info
    const content = await fs.readFile(filePath, 'utf-8');
    const deviceInfo = JSON.parse(content) as DeviceInfo;

    // Validate structure
    if (!deviceInfo.deviceId || !deviceInfo.name || !deviceInfo.platform) {
      throw new Error('Invalid device info structure');
    }

    return deviceInfo;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      // File exists but is corrupted - create new one
      console.warn('Device info corrupted, creating new:', error);
    }

    // Generate new device info
    const deviceInfo: DeviceInfo = {
      deviceId: randomUUID(),
      name: getDeviceName(),
      platform: getPlatform(),
      createdAt: new Date().toISOString(),
    };

    // Save to file
    await fs.writeFile(filePath, JSON.stringify(deviceInfo, null, 2), 'utf-8');

    return deviceInfo;
  }
}

/**
 * Gets a human-readable device name
 * @returns Device name (hostname or "Unknown Device")
 */
function getDeviceName(): string {
  try {
    return hostname() || 'Unknown Device';
  } catch {
    return 'Unknown Device';
  }
}

/**
 * Gets the platform identifier
 * @returns Platform string (darwin, win32, linux, etc.)
 */
function getPlatform(): string {
  return platform();
}

/**
 * Clears device info (useful for testing or reset)
 * @param dataDir - User data directory path
 */
export async function clearDeviceInfo(dataDir: string): Promise<void> {
  const filePath = join(dataDir, 'device.json');
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // File doesn't exist - already clear
  }
}

/**
 * Updates device name (e.g., if hostname changes)
 * @param dataDir - User data directory path
 * @param name - New device name
 */
export async function updateDeviceName(dataDir: string, name: string): Promise<void> {
  const deviceInfo = await getOrCreateDeviceInfo(dataDir);
  deviceInfo.name = name;

  const filePath = join(dataDir, 'device.json');
  await fs.writeFile(filePath, JSON.stringify(deviceInfo, null, 2), 'utf-8');
}
