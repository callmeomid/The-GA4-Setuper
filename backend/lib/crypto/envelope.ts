import crypto from 'crypto';

// Low-level AES-256-GCM primitive shared by DEK-wrapping (workspaceKeys.ts)
// and secret encryption (tokenVault.ts). `aad` binds the ciphertext to the
// context it was encrypted for (e.g. a workspace id + field name), so a
// ciphertext copied into a different row fails to decrypt instead of
// silently decrypting as if it belonged there.
export type EncryptedBlob = { iv: string; ciphertext: string; authTag: string };

const ALGORITHM = 'aes-256-gcm';

export function encrypt(key: Buffer, plaintext: Buffer, aad: string): EncryptedBlob {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decrypt(key: Buffer, blob: EncryptedBlob, aad: string): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(blob.iv, 'base64'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(blob.ciphertext, 'base64')), decipher.final()]);
}

export function serializeBlob(blob: EncryptedBlob): string {
  return JSON.stringify(blob);
}

export function parseBlob(serialized: string): EncryptedBlob {
  return JSON.parse(serialized) as EncryptedBlob;
}
