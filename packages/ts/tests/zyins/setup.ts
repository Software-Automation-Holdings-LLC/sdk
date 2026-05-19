// Node 18+ exposes globalThis.crypto with SubtleCrypto natively; this setup
// file is here for future polyfills if we need to support older runtimes.
import { webcrypto } from 'node:crypto';

if (!(globalThis as { crypto?: Crypto }).crypto) {
  (globalThis as { crypto: Crypto }).crypto = webcrypto as unknown as Crypto;
}
