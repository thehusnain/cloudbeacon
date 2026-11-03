import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function compareHashes(left: string, right: string): boolean {
  // Only SHA-256 hex digests are accepted, so timingSafeEqual always gets 32 bytes.
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right))
    return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
