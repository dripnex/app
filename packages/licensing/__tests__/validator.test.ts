import { describe, it, expect } from 'vitest';
import {
  validateLicense,
  parseLicenseFile,
  signLicense,
  generateKeyPair,
} from '../src/validator.js';
import type { LicenseFile, Capability } from '../src/types.js';

describe('validator', () => {
  describe('generateKeyPair', () => {
    it('generates valid keypair', async () => {
      const keyPair = await generateKeyPair();

      expect(keyPair.publicKey).toHaveLength(64); // 32 bytes hex
      expect(keyPair.privateKey).toHaveLength(64); // 32 bytes hex
      expect(keyPair.publicKey).toMatch(/^[0-9a-f]+$/);
      expect(keyPair.privateKey).toMatch(/^[0-9a-f]+$/);
    });

    it('generates different keypairs each time', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    });
  });

  describe('signLicense + validateLicense', () => {
    it('signs and validates a license', async () => {
      const keyPair = await generateKeyPair();

      const licenseData: Omit<LicenseFile, 'signature'> = {
        licenseVersion: 1,
        licenseId: 'lic_test123',
        issuedTo: 'test@example.com',
        purchaseDate: '2025-01-01',
        updatesUntil: '2026-01-01',
        plan: 'pro',
        capabilities: ['notes.basic', 'notes.unlimited'] as Capability[],
      };

      const signedLicense = await signLicense(licenseData, keyPair.privateKey);

      expect(signedLicense.signature).toBeTruthy();
      expect(signedLicense.signature.length).toBeGreaterThan(0);

      const result = await validateLicense(signedLicense, {
        publicKey: keyPair.publicKey,
      });

      expect(result.valid).toBe(true);
      expect(result.license).toEqual(signedLicense);
    });

    it('rejects tampered license', async () => {
      const keyPair = await generateKeyPair();

      const licenseData: Omit<LicenseFile, 'signature'> = {
        licenseVersion: 1,
        licenseId: 'lic_test123',
        issuedTo: 'test@example.com',
        purchaseDate: '2025-01-01',
        updatesUntil: '2026-01-01',
        plan: 'pro',
        capabilities: ['notes.basic'] as Capability[],
      };

      const signedLicense = await signLicense(licenseData, keyPair.privateKey);

      // Tamper with the license
      const tamperedLicense = {
        ...signedLicense,
        updatesUntil: '2030-01-01', // Changed!
      };

      const result = await validateLicense(tamperedLicense, {
        publicKey: keyPair.publicKey,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid license signature');
    });

    it('rejects license with wrong public key', async () => {
      const keyPair1 = await generateKeyPair();
      const keyPair2 = await generateKeyPair();

      const licenseData: Omit<LicenseFile, 'signature'> = {
        licenseVersion: 1,
        licenseId: 'lic_test123',
        issuedTo: 'test@example.com',
        purchaseDate: '2025-01-01',
        updatesUntil: '2026-01-01',
        plan: 'pro',
        capabilities: ['notes.basic'] as Capability[],
      };

      const signedLicense = await signLicense(licenseData, keyPair1.privateKey);

      const result = await validateLicense(signedLicense, {
        publicKey: keyPair2.publicKey, // Wrong key!
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid license signature');
    });
  });

  describe('validateLicense structure checks', () => {
    it('rejects null', async () => {
      const result = await validateLicense(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid license format');
    });

    it('rejects non-object', async () => {
      const result = await validateLicense('not an object');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid license format');
    });

    it('rejects missing fields', async () => {
      const result = await validateLicense({ licenseVersion: 1 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid license format');
    });

    it('rejects wrong version', async () => {
      const result = await validateLicense({
        licenseVersion: 2,
        licenseId: 'lic_123',
        issuedTo: 'test@example.com',
        purchaseDate: '2025-01-01',
        updatesUntil: '2026-01-01',
        plan: 'pro',
        capabilities: [],
        signature: 'xxx',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid license format');
    });

    it('rejects invalid purchaseDate', async () => {
      const keyPair = await generateKeyPair();

      // Create a valid signature first
      const licenseData: Omit<LicenseFile, 'signature'> = {
        licenseVersion: 1,
        licenseId: 'lic_test123',
        issuedTo: 'test@example.com',
        purchaseDate: 'not-a-date',
        updatesUntil: '2026-01-01',
        plan: 'pro',
        capabilities: ['notes.basic'] as Capability[],
      };

      const signedLicense = await signLicense(licenseData, keyPair.privateKey);

      const result = await validateLicense(signedLicense, {
        publicKey: keyPair.publicKey,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid purchase date');
    });

    it('rejects invalid updatesUntil', async () => {
      const keyPair = await generateKeyPair();

      const licenseData: Omit<LicenseFile, 'signature'> = {
        licenseVersion: 1,
        licenseId: 'lic_test123',
        issuedTo: 'test@example.com',
        purchaseDate: '2025-01-01',
        updatesUntil: 'invalid',
        plan: 'pro',
        capabilities: ['notes.basic'] as Capability[],
      };

      const signedLicense = await signLicense(licenseData, keyPair.privateKey);

      const result = await validateLicense(signedLicense, {
        publicKey: keyPair.publicKey,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid updates until date');
    });
  });

  describe('parseLicenseFile', () => {
    it('parses valid JSON license', async () => {
      const keyPair = await generateKeyPair();

      const licenseData: Omit<LicenseFile, 'signature'> = {
        licenseVersion: 1,
        licenseId: 'lic_test123',
        issuedTo: 'test@example.com',
        purchaseDate: '2025-01-01',
        updatesUntil: '2026-01-01',
        plan: 'pro',
        capabilities: ['notes.basic'] as Capability[],
      };

      const signedLicense = await signLicense(licenseData, keyPair.privateKey);
      const jsonString = JSON.stringify(signedLicense);

      const result = await parseLicenseFile(jsonString, {
        publicKey: keyPair.publicKey,
      });

      expect(result.valid).toBe(true);
      expect(result.license?.licenseId).toBe('lic_test123');
    });

    it('rejects invalid JSON', async () => {
      const result = await parseLicenseFile('not valid json');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON format');
    });
  });
});
