import { PasswordHasher } from './password-hasher.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with argon2id at the OWASP minimum cost (19 MiB, 2 passes, 1 lane)', async () => {
    await expect(hasher.hash('Analytical1!')).resolves.toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
    );
  });

  it('salts every hash, so equal passwords never share a hash', async () => {
    const [first, second] = await Promise.all([
      hasher.hash('Analytical1!'),
      hasher.hash('Analytical1!'),
    ]);

    expect(first).not.toBe(second);
  });

  it('verifies the right password and rejects any other', async () => {
    const hash = await hasher.hash('Analytical1!');

    await expect(hasher.verify(hash, 'Analytical1!')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'analytical1!')).resolves.toBe(false);
  });

  it('runs a real check for unknown accounts and always answers false', async () => {
    const freshHasher = new PasswordHasher();
    const hashSpy = vi.spyOn(freshHasher, 'hash');

    await expect(freshHasher.verifyWithoutAccount('Analytical1!')).resolves.toBe(false);
    await expect(freshHasher.verifyWithoutAccount('anything-else')).resolves.toBe(false);
    // The throwaway hash is made once and reused.
    expect(hashSpy).toHaveBeenCalledOnce();
  });

  it('prepares the throwaway hash at startup, so the first unknown email is not slower', async () => {
    const freshHasher = new PasswordHasher();
    await freshHasher.onModuleInit();
    const hashSpy = vi.spyOn(freshHasher, 'hash');

    await freshHasher.verifyWithoutAccount('Analytical1!');

    expect(hashSpy).not.toHaveBeenCalled();
  });
});
