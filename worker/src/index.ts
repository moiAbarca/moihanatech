/**
 * MoiHana Tech API Worker — Main Entry Point
 *
 * Secure API proxy that sits between the Astro dashboard and external services.
 * All requests require valid CF Access JWT. All API keys stored as Worker secrets.
 *
 * Routes:
 *   GET  /api/leads        → Airtable leads
 *   GET  /api/automations  → n8n workflow list
 *   PATCH /api/automations → toggle n8n workflow
 *   GET  /api/stats        → aggregated dashboard stats
 */

import { handleLeads } from './routes/leads';
import { handleAutomations } from './routes/automations';
import { handleStats } from './routes/stats';
import { handleChat } from './routes/chat';
import { validateRequest } from './middleware/auth';

export interface Env {
  // Airtable
  AIRTABLE_API_KEY: string;
  AIRTABLE_BASE_ID: string;
  // n8n
  N8N_API_KEY: string;
  N8N_BASE_URL: string;
  // Cloudflare Access (for proxying to CF-protected services)
  CF_ACCESS_CLIENT_ID: string;
  CF_ACCESS_CLIENT_SECRET: string;
  CF_ACCESS_TEAM_DOMAIN: string;
  // Config
  ALLOWED_ORIGIN: string;
  GRAFANA_URL: string;
  METABASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ── CORS Preflight ──
    if (request.method === 'OPTIONS') {
      return handleCORS(env);
    }

    // ── Auth Validation ──
    const authError = await validateRequest(request, env);
    if (authError) return authError;

    // ── CORS Origin Check ──
    const origin = request.headers.get('Origin');
    if (origin && !isAllowedOrigin(origin, env)) {
      return jsonResponse({ error: 'Forbidden origin' }, 403);
    }

    // ── Routing ──
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/api/leads':
          return addCORS(await handleLeads(request, env), env);
        case '/api/automations':
          return addCORS(await handleAutomations(request, env), env);
        case '/api/stats':
          return addCORS(await handleStats(request, env), env);
        case '/api/chat':
          return addCORS(await handleChat(request, env), env);
        case '/api/health':
          return addCORS(jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }), env);
        default:
          return addCORS(jsonResponse({ error: 'Not Found' }, 404), env);
      }
    } catch (err) {
      console.error('Worker error:', err);
      return addCORS(
        jsonResponse({ error: 'Internal Server Error' }, 500),
        env
      );
    }
  },
};

// ── Helpers ──────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  const allowed = env.ALLOWED_ORIGIN || 'https://moihanatech.com';
  // Allow localhost in development
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return true;
  }
  return origin === allowed;
}

function handleCORS(env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || 'https://moihanatech.com',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function addCORS(response: Response, env: Env): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || 'https://moihanatech.com');
  headers.set('Access-Control-Allow-Credentials', 'true');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
