// Node 18+ exposes globalThis.crypto natively. This setup file is here for
// future polyfills; the RapidSign SDK targets Node 20+ explicitly.
import { webcrypto } from 'node:crypto';

if (!(globalThis as { crypto?: Crypto }).crypto) {
  (globalThis as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}
