import { prisma } from '@/lib/prisma';
import { decrypt, encrypt, parseBlob, serializeBlob } from './envelope';
import { unwrapDek } from './workspaceKeys';

// The only place in the app that turns a workspace's wrapped DEK into
// plaintext ciphertext/plaintext for GTM/GA4/Stape secrets. Callers never see
// the DEK itself — only encryptWorkspaceSecret/decryptWorkspaceSecret.
async function getWorkspaceDek(workspaceId: string): Promise<Buffer> {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  return unwrapDek(workspaceId, workspace.wrappedDek, workspace.dekKeyVersion);
}

// `field` (e.g. "gtmRefreshToken") is bound into the ciphertext as AAD, so a
// blob stored under one field can't be swapped into another and still decrypt.
export async function encryptWorkspaceSecret(workspaceId: string, field: string, plaintext: string): Promise<string> {
  const dek = await getWorkspaceDek(workspaceId);
  return serializeBlob(encrypt(dek, Buffer.from(plaintext, 'utf8'), `${workspaceId}:${field}`));
}

export async function decryptWorkspaceSecret(workspaceId: string, field: string, serialized: string): Promise<string> {
  const dek = await getWorkspaceDek(workspaceId);
  return decrypt(dek, parseBlob(serialized), `${workspaceId}:${field}`).toString('utf8');
}
