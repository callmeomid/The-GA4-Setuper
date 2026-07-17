import crypto from 'crypto';
import { currentKekVersion, kekForVersion } from './kek';
import { decrypt, encrypt, parseBlob, serializeBlob } from './envelope';

// Envelope encryption, one layer up from tokenVault.ts: each workspace gets
// its own 32-byte Data Encryption Key, generated once and wrapped (encrypted)
// with the deployment's master key (the KEK). The unwrapped DEK only ever
// exists in server memory for the duration of a single call — it's never
// written anywhere.
//
// Why per-workspace DEKs instead of encrypting tokens directly with the KEK:
// deleting a workspace's wrappedDek makes every secret it ever protected
// permanently unrecoverable (crypto-shredding), and a compromised DEK only
// exposes one workspace's secrets, not every client's.
const DEK_AAD_SUFFIX = ':dek';

export function createWrappedDek(workspaceId: string): { wrappedDek: string; dekKeyVersion: number } {
  const dek = crypto.randomBytes(32);
  const dekKeyVersion = currentKekVersion();
  const wrapped = encrypt(kekForVersion(dekKeyVersion), dek, workspaceId + DEK_AAD_SUFFIX);
  return { wrappedDek: serializeBlob(wrapped), dekKeyVersion };
}

export function unwrapDek(workspaceId: string, wrappedDek: string, dekKeyVersion: number): Buffer {
  return decrypt(kekForVersion(dekKeyVersion), parseBlob(wrappedDek), workspaceId + DEK_AAD_SUFFIX);
}
