// The master key (KEK) that wraps every workspace's Data Encryption Key (see
// workspaceKeys.ts). It never touches the database — only this env var.
//
// TOKEN_ENCRYPTION_KEYS holds one or more "version:base64key" pairs, comma
// separated, e.g. "1:<base64>". The highest version present is used to wrap
// new DEKs; older versions stay available so already-wrapped DEKs keep
// unwrapping after a rotation that adds a new version (rotating the KEK only
// means re-wrapping each workspace's DEK with the new version — it does not
// require re-encrypting any stored token).
type KeyRing = Map<number, Buffer>;

let cached: { ring: KeyRing; currentVersion: number } | null = null;

function parseKeyRing(): { ring: KeyRing; currentVersion: number } {
  if (cached) return cached;

  const raw = process.env.TOKEN_ENCRYPTION_KEYS;
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEYS is not set. Generate one with: openssl rand -base64 32 — then set ' +
        'TOKEN_ENCRYPTION_KEYS="1:<that value>".',
    );
  }

  const ring: KeyRing = new Map();
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [versionStr, keyB64] = entry.split(':');
    const version = Number(versionStr);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`TOKEN_ENCRYPTION_KEYS: invalid version in entry "${entry}"`);
    }
    const key = Buffer.from(keyB64 ?? '', 'base64');
    if (key.length !== 32) {
      throw new Error(`TOKEN_ENCRYPTION_KEYS: key for version ${version} must decode to 32 bytes, got ${key.length}`);
    }
    ring.set(version, key);
  }
  if (ring.size === 0) throw new Error('TOKEN_ENCRYPTION_KEYS is set but empty.');

  cached = { ring, currentVersion: Math.max(...ring.keys()) };
  return cached;
}

export function currentKekVersion(): number {
  return parseKeyRing().currentVersion;
}

export function kekForVersion(version: number): Buffer {
  const key = parseKeyRing().ring.get(version);
  if (!key) throw new Error(`No TOKEN_ENCRYPTION_KEYS entry for key version ${version}`);
  return key;
}
