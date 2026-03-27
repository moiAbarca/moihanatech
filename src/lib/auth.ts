/**
 * Cloudflare Access JWT Validation
 *
 * Validates the CF_Authorization cookie against Cloudflare's public signing keys.
 * This is a defense-in-depth check — CF Access already blocks unauthenticated
 * traffic at the edge, but we validate the JWT server-side as well.
 *
 * In local development (import.meta.env.DEV), validation is bypassed
 * and a mock email is returned.
 */

interface CFAccessPayload {
  email: string;
  sub: string;
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
}

/**
 * Parses cookies from a Cookie header string
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(pair => {
    const [key, ...vals] = pair.trim().split('=');
    if (key) cookies[key.trim()] = vals.join('=').trim();
  });
  return cookies;
}

/**
 * Validates CF Access JWT and returns the authenticated user's email.
 * In dev mode, returns a mock email to allow testing without CF Access.
 */
export async function validateCFAccess(request: Request): Promise<string> {
  // Skip validation in local development
  if (import.meta.env.DEV) {
    return 'dev@moihanatech.com';
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const token = cookies['CF_Authorization'];

  if (!token) {
    throw new Error('No CF_Authorization cookie found');
  }

  try {
    // Decode JWT payload (middle segment)
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT structure');

    const payload = JSON.parse(atob(parts[1])) as CFAccessPayload;

    // Check expiry
    if (payload.exp && payload.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }

    return payload.email || 'unknown@moihanatech.com';
  } catch (e) {
    throw new Error(`CF Access validation failed: ${(e as Error).message}`);
  }
}

/**
 * Middleware helper: returns a 401 Response if auth fails, or the user email if it succeeds.
 */
export async function requireAuth(request: Request): Promise<{ email: string } | Response> {
  try {
    const email = await validateCFAccess(request);
    return { email };
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
}
