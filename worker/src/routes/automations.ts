/**
 * Automations Route — n8n API Proxy
 *
 * Proxies workflow management requests to the n8n REST API.
 * n8n runs behind Cloudflare Access, so we include the CF service token headers.
 *
 * GET  → list all workflows
 * PATCH → activate/deactivate a workflow
 *
 * The n8n API key and CF Access credentials are Worker secrets.
 */

import type { Env } from '../index';

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: { name: string }[];
  triggerCount: number;
}

/**
 * Creates headers for authenticated n8n API requests.
 * Includes both the n8n API key and CF Access service token.
 */
function n8nHeaders(env: Env, contentType = false): HeadersInit {
  const headers: Record<string, string> = {
    'X-N8N-API-KEY': env.N8N_API_KEY,
    'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
    'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
  };
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export async function handleAutomations(
  request: Request,
  env: Env
): Promise<Response> {
  const n8nBase = env.N8N_BASE_URL;

  // ── GET: List workflows ──
  if (request.method === 'GET') {
    const res = await fetch(`${n8nBase}/api/v1/workflows?limit=100`, {
      headers: n8nHeaders(env),
    });

    if (!res.ok) {
      console.error('n8n list error:', res.status, await res.text());
      return new Response(
        JSON.stringify({ error: `n8n API error: ${res.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await res.json() as { data: N8nWorkflow[] };

    // Sanitize: only expose safe fields
    const workflows = data.data.map(wf => ({
      id: wf.id,
      name: wf.name,
      active: wf.active,
      isArchived: wf.isArchived,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
      tags: wf.tags || [],
      triggerCount: wf.triggerCount || 0,
    }));

    return new Response(
      JSON.stringify({ workflows }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── PATCH: Toggle workflow active state ──
  if (request.method === 'PATCH') {
    let body: { workflowId?: string; active?: boolean };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { workflowId, active } = body;

    if (!workflowId || typeof active !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Missing workflowId or active field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use the proper n8n endpoint for activating/deactivating
    const endpoint = active
      ? `${n8nBase}/api/v1/workflows/${workflowId}/activate`
      : `${n8nBase}/api/v1/workflows/${workflowId}/deactivate`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: n8nHeaders(env, true),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('n8n toggle error:', res.status, errText);
      return new Response(
        JSON.stringify({ error: `n8n API error: ${res.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await res.json();
    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Method Not Allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
}
