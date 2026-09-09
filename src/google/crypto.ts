import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string, keyB64: string): string {
  const key = loadKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decrypt(blobB64: string, keyB64: string): string {
  const key = loadKey(keyB64);
  const blob = Buffer.from(blobB64, 'base64');
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function loadKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes base64 (openssl rand -base64 32)');
  }
  return key;
}
