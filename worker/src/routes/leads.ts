/**
 * Leads Route — Airtable Proxy
 *
 * Proxies requests to the Airtable REST API.
 * The Airtable API key is stored as a Worker secret — never exposed to the client.
 * Responses are sanitized to only include fields the dashboard needs.
 */

import type { Env } from '../index';

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    Name?: string;
    Email?: string;
    Phone?: string;
    Service?: string;
    Message?: string;
    Status?: string;
    Assigned?: string;
    Notes?: string;
    Source?: string;
  };
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

export async function handleLeads(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '100'), 100);
  const offset = url.searchParams.get('offset') || '';

  // Build Airtable API URL
  let airtableUrl = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Leads_from_Form?pageSize=${pageSize}&sort%5B0%5D%5Bfield%5D=Name&sort%5B0%5D%5Bdirection%5D=asc`;
  if (offset) {
    airtableUrl += `&offset=${encodeURIComponent(offset)}`;
  }

  const response = await fetch(airtableUrl, {
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Airtable error:', response.status, errBody);
    return new Response(
      JSON.stringify({ error: `Airtable API error: ${response.status}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = (await response.json()) as AirtableResponse;

  // Sanitize: only expose fields the dashboard needs
  const leads = data.records.map(record => ({
    id: record.id,
    name: record.fields.Name || '',
    email: record.fields.Email || '',
    phone: record.fields.Phone || '',
    service: record.fields.Service || '',
    message: record.fields.Message || '',
    status: record.fields.Status || 'New',
    assigned: record.fields.Assigned || '',
    notes: record.fields.Notes || '',
    source: record.fields.Source || '',
    createdAt: record.createdTime,
  }));

  return new Response(
    JSON.stringify({
      leads,
      totalCount: leads.length,
      offset: data.offset || null,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
