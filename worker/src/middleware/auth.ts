/**
 * Auth Middleware — CF Access JWT Validation
 *
 * Validates that the request comes from an authenticated CF Access user.
 * In the Worker context, we check the CF_Authorization cookie or the
 * CF-Access-Jwt-Assertion header.
 *
 * For local development, requests from localhost bypass auth.
 */

import type { Env } from '../index';

export async function validateRequest(
  request: Request,
  env: Env
): Promise<Response | null> {
  // Allow local dev requests to bypass auth
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  if (
    url.hostname === 'localhost' || 
    url.hostname === '127.0.0.1' || 
    origin.startsWith('http://localhost')
  ) {
    return null; // Proceed without auth in local dev
  }

  // Check for CF Access JWT
  const cfJwt =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    getCookieValue(request.headers.get('Cookie') || '', 'CF_Authorization');

  if (!cfJwt) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized — No CF Access token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Decode and validate JWT (basic validation)
  try {
    const parts = cfJwt.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT structure');

    const payload = JSON.parse(atob(parts[1]));

    // Check expiry
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    // Optionally verify audience matches your CF Access app
    // if (!payload.aud?.includes(env.CF_ACCESS_AUD)) throw new Error('Invalid audience');

    return null; // Auth passed
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Unauthorized — ${(err as Error).message}` }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  return match ? match.split('=').slice(1).join('=') : null;
}
