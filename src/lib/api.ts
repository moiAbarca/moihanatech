/**
 * Typed API client for the Cloudflare Worker API proxy.
 *
 * All external service calls (Airtable, n8n, etc.) go through the Worker.
 * The Worker holds all API keys and secrets — the frontend never sees them.
 *
 * The API client forwards the CF_Authorization cookie so the Worker
 * can validate the user's identity.
 */

// ── Types ────────────────────────────────────────

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  status: string;
  assigned: string;
  notes: string;
  source: string;
  createdAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: { name: string }[];
  triggerCount: number;
}

export interface DashboardStats {
  totalLeads: number;
  activeWorkflows: number;
  totalWorkflows: number;
}

// ── API Client ───────────────────────────────────

const getApiBase = (): string => {
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return import.meta.env.API_BASE_URL || 'https://api.moihanatech.com';
};

/**
 * Makes an authenticated request to the Worker API.
 * Forwards the CF Access cookie for auth validation.
 */
async function apiRequest<T>(
  path: string,
  request: Request,
  options?: RequestInit
): Promise<T> {
  const url = `${getApiBase()}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('cookie') || '',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ── Leads ────────────────────────────────────────

export async function getLeads(request: Request): Promise<Lead[]> {
  const data = await apiRequest<{ leads: Lead[] }>('/api/leads', request);
  return data.leads;
}

// ── Automations ──────────────────────────────────

export async function getWorkflows(request: Request): Promise<Workflow[]> {
  const data = await apiRequest<{ workflows: Workflow[] }>('/api/automations', request);
  return data.workflows;
}

export async function toggleWorkflow(
  request: Request,
  workflowId: string,
  active: boolean
): Promise<Workflow> {
  return apiRequest<Workflow>('/api/automations', request, {
    method: 'PATCH',
    body: JSON.stringify({ workflowId, active }),
  });
}

// ── Stats ────────────────────────────────────────

export async function getDashboardStats(request: Request): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/api/stats', request);
}
