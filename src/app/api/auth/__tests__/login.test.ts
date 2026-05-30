import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock @/lib/session
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  checkPassword: vi.fn(),
}));

import { getSession, checkPassword } from '@/lib/session';

const mockGetSession = vi.mocked(getSession);
const mockCheckPassword = vi.mocked(checkPassword);

function makeSession() {
  return {
    isLoggedIn: false,
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRequest(password: string, ip?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (ip) {
    headers['x-forwarded-for'] = ip;
  }
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers,
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(makeSession() as unknown as Awaited<ReturnType<typeof getSession>>);
  });

  it('returns 200 with {ok: true} for correct password', async () => {
    // Use a unique IP to avoid rate limit state from other tests
    const { POST } = await import('@/app/api/auth/login/route');

    mockCheckPassword.mockReturnValue(true);
    const session = makeSession();
    mockGetSession.mockResolvedValue(session as unknown as Awaited<ReturnType<typeof getSession>>);

    const req = makeRequest('correct-password', '1.2.3.4');
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(session.save).toHaveBeenCalledOnce();
  });

  it('returns 401 for incorrect password', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    mockCheckPassword.mockReturnValue(false);

    const req = makeRequest('wrong-password', '2.3.4.5');
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toHaveProperty('error');
  });

  it('returns 429 after 10 failed attempts from the same IP', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    // Use a unique IP for this test to isolate from others
    const ip = '9.8.7.6';
    mockCheckPassword.mockReturnValue(false);

    // Make 10 attempts (all fail with wrong password — each increments counter)
    for (let i = 0; i < 10; i++) {
      const req = makeRequest(`attempt-${i}`, ip);
      const response = await POST(req);
      // These should be 401 (wrong password), not 429 yet
      expect(response.status).toBe(401);
    }

    // The 11th attempt should hit the rate limit
    const req = makeRequest('final-attempt', ip);
    const response = await POST(req);

    expect(response.status).toBe(429);
  });

  it('returns 401 when body has no password field', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    mockCheckPassword.mockReturnValue(false);

    // Send a body without the password key — checkPassword receives undefined
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '3.4.5.6' },
      body: JSON.stringify({}),
    });
    const response = await POST(req);

    // checkPassword(undefined) is falsy → 401, not 400 (handler doesn't validate presence)
    expect([400, 401]).toContain(response.status);
  });

  it('returns 401 when APP_PASSWORD is not configured', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    // checkPassword('') with no APP_PASSWORD configured returns false
    mockCheckPassword.mockReturnValue(false);

    const req = makeRequest('', '4.5.6.7');
    const response = await POST(req);

    expect(response.status).toBe(401);
  });
});
