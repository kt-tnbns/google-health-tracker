import { randomBytes } from 'node:crypto';
import { decrypt, encrypt } from './crypto';

describe('crypto', () => {
  const key = randomBytes(32).toString('base64');

  it('round-trips', () => {
    const blob = encrypt('1//refresh-token', key);
    expect(blob).not.toContain('refresh');
    expect(decrypt(blob, key)).toBe('1//refresh-token');
  });

  it('rejects a wrong key', () => {
    const blob = encrypt('secret', key);
    expect(() => decrypt(blob, randomBytes(32).toString('base64'))).toThrow();
  });

  it('rejects a short key', () => {
    expect(() => encrypt('x', 'c2hvcnQ=')).toThrow(/32 bytes/);
  });
});
