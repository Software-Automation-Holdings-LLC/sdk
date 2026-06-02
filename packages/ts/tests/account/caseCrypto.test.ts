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

  it('emits a base64url fragment key that round-trips to 16 raw bytes (128-bit)', async () => {
    const { keyFragment } = await encryptCase('zyins', { x: 1 });
    expect(keyFragment).not.toMatch(/[+/=]/); // URL-safe, unpadded
    const raw = base64ToBytes(keyFragment);
    expect(raw.byteLength).toBe(16);
    // Re-encoding the decoded bytes reproduces the same fragment string.
    expect(bytesToBase64Url(raw)).toBe(keyFragment);
  });

  it('decrypts a legacy 256-bit-key envelope (key length is decided by the key, not the constant)', async () => {
    // Force a 32-byte (256-bit) data key to emulate a case sealed before the
    // generation length dropped to 128-bit. AES-GCM keys its variant off the
    // key material, so decrypt must open it with no branching.
    const KEY_256_BYTES = 32;
    const IV_BYTES = 12;
    const random256Key = (length: number): Uint8Array =>
      crypto.getRandomValues(new Uint8Array(length === IV_BYTES ? IV_BYTES : KEY_256_BYTES));
    const payload = { applicant: { dob: '1962-04-18', state: 'NC' } };
    const { envelope, keyFragment } = await encryptCase('zyins', payload, {
      randomBytes: random256Key,
    });
    expect(base64ToBytes(keyFragment).byteLength).toBe(KEY_256_BYTES);
    const decrypted = await decryptCase('zyins', envelope, keyFragment);
    expect(decrypted).toEqual(payload);
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
