import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

const ALGORITHM = 'scrypt';

let dummySecretHash: Promise<string> | undefined;

export function getDummySecretHash(): Promise<string> {
  dummySecretHash ??= hashSecret('timing-dummy');
  return dummySecretHash;
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await deriveKey(
    secret,
    salt,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
  );

  return [
    '',
    ALGORITHM,
    `n=${SCRYPT_N}`,
    `r=${SCRYPT_R}`,
    `p=${SCRYPT_P}`,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export async function verifySecret(
  storedHash: string,
  secret: string,
): Promise<boolean> {
  const parsed = parseHash(storedHash);

  if (!parsed) {
    return false;
  }

  try {
    const derivedKey = await deriveKey(
      secret,
      parsed.salt,
      parsed.n,
      parsed.r,
      parsed.p,
    );

    if (derivedKey.length !== parsed.hash.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, parsed.hash);
  } catch {
    return false;
  }
}

async function deriveKey(
  secret: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  const maxmem = 128 * n * r * p * 2;

  return new Promise((resolve, reject) => {
    scrypt(
      secret,
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      },
    );
  });
}

function parseHash(storedHash: string): {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
} | null {
  const parts = storedHash.split('$');

  if (parts.length !== 7 || parts[1] !== ALGORITHM) {
    return null;
  }

  const n = Number(parts[2]?.replace('n=', ''));
  const r = Number(parts[3]?.replace('r=', ''));
  const p = Number(parts[4]?.replace('p=', ''));

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return null;
  }

  try {
    const salt = Buffer.from(parts[5], 'base64url');
    const hash = Buffer.from(parts[6], 'base64url');

    if (salt.length === 0 || hash.length === 0) {
      return null;
    }

    return { n, r, p, salt, hash };
  } catch {
    return null;
  }
}
