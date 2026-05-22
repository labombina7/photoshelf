import { describe, it, expect } from 'vitest';

// We test the pure password-checking logic without importing the full session module
// (which requires Next.js cookies()). Extract the comparison logic directly.
function timingSafeCheck(input: string, expected: string): boolean {
  const crypto = require('crypto');
  if (!expected || input.length !== expected.length) {
    const dummy = expected || 'xxxxxxxxxxxxxxxx';
    try {
      const a = Buffer.from(input.padEnd(dummy.length, '\0'));
      const b = Buffer.from(dummy.padEnd(input.length, '\0'));
      crypto.timingSafeEqual(a, b);
    } catch {}
    return false;
  }
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return crypto.timingSafeEqual(a, b);
}

describe('checkPassword', () => {
  it('returns true for a correct password', () => {
    expect(timingSafeCheck('secret123', 'secret123')).toBe(true);
  });

  it('returns false for a wrong password', () => {
    expect(timingSafeCheck('wrong', 'secret123')).toBe(false);
  });

  it('returns false when input is shorter', () => {
    expect(timingSafeCheck('short', 'much-longer-password')).toBe(false);
  });

  it('returns false when input is longer', () => {
    expect(timingSafeCheck('much-longer-password', 'short')).toBe(false);
  });

  it('returns false when expected password is empty', () => {
    expect(timingSafeCheck('anything', '')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(timingSafeCheck('Password', 'password')).toBe(false);
  });
});
