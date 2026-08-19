import { getDummySecretHash, hashSecret, verifySecret } from './secret-hash';

describe('secret-hash', () => {
  it('hashes a secret and verifies the original value', async () => {
    const hash = await hashSecret('password123');

    await expect(verifySecret(hash, 'password123')).resolves.toBe(true);
  });

  it('rejects a wrong secret', async () => {
    const hash = await hashSecret('password123');

    await expect(verifySecret(hash, 'other-password')).resolves.toBe(false);
  });

  it('rejects a malformed hash without throwing', async () => {
    await expect(verifySecret('not-a-hash', 'password123')).resolves.toBe(
      false,
    );
  });

  it('builds a dummy hash that still runs verification', async () => {
    const dummy = await getDummySecretHash();

    await expect(verifySecret(dummy, 'password123')).resolves.toBe(false);
    await expect(getDummySecretHash()).resolves.toBe(dummy);
  });
});
