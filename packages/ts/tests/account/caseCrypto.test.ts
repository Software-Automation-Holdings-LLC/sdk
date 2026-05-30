import { describe, expect, it } from 'vitest';
import { encryptCase, decryptCase, IsaCaseDecryptError } from '../../src/account/caseCrypto';
import { base64ToBytes, bytesToBase64Url } from '../../src/core';

describe('caseCrypto round-trip', () => {
  it('encrypts then decrypts back to the original payload', async () => {
    const payload = { applicant: { dob: '1962-04-18', state: 'NC' }, amounts: ['25000'] };
    const { envelope, keyFragment } = await encryptCase('zyins', payload);
    const decrypted = await decryptCase('zyins', envelope, keyFragment);
    expect(decrypted).toEqual(payload);
  });

  it('emits a base64url fragment key that round-trips to 32 raw bytes', async () => {
    const { keyFragment } = await encryptCase('zyins', { x: 1 });
    expect(keyFragment).not.toMatch(/[+/=]/); // URL-safe, unpadded
    const raw = base64ToBytes(keyFragment);
    expect(raw.byteLength).toBe(32);
    // Re-encoding the decoded bytes reproduces the same fragment string.
    expect(bytesToBase64Url(raw)).toBe(keyFragment);
  });

  it('produces distinct keys and ivs across calls (fresh per case)', async () => {
    const a = await encryptCase('zyins', { x: 1 });
    const b = await encryptCase('zyins', { x: 1 });
    expect(a.keyFragment).not.toBe(b.keyFragment);
    expect(a.envelope.iv).not.toBe(b.envelope.iv);
  });

  it('rejects non-JSON top-level payloads before encryption', async () => {
    await expect(encryptCase('zyins', undefined)).rejects.toThrow(/JSON-serializable/);
  });

  it('fails decryption when the product (AEAD) does not match', async () => {
    const { envelope, keyFragment } = await encryptCase('zyins', { secret: true });
    await expect(decryptCase('eapp', envelope, keyFragment)).rejects.toBeInstanceOf(
      IsaCaseDecryptError,
    );
  });

  it('fails decryption with a wrong key', async () => {
    const { envelope } = await encryptCase('zyins', { secret: true });
    const wrongKey = bytesToBase64Url(new Uint8Array(32));
    await expect(decryptCase('zyins', envelope, wrongKey)).rejects.toThrow(/failed authentication/);
  });

  it('fails decryption when the ciphertext is tampered', async () => {
    const { envelope, keyFragment } = await encryptCase('zyins', { secret: true });
    const flipped = { ...envelope, tag: bytesToBase64Url(new Uint8Array(16)) };
    await expect(decryptCase('zyins', flipped, keyFragment)).rejects.toBeInstanceOf(
      IsaCaseDecryptError,
    );
  });
});
