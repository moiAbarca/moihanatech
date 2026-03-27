/**
 * Stats Route — Aggregated Dashboard Statistics & Trends
 *
 * Fetches summary data from Airtable and n8n to populate
 * the dashboard overview cards and native Chart.js graphs.
 */

import type { Env } from '../index';

interface StatResponse {
  totalLeads: number;
  activeWorkflows: number;
  totalWorkflows: number;
  // Time-series data for the last 7 days (including today)
  leadsChartData: {
    labels: string[]; // e.g. ["Mon", "Tue", "Wed"...]
    data: number[];   // e.g. [2, 5, 1, 0, 8...]
  };
}

export async function handleStats(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fetch leads and workflow stats in parallel
  const [leadsData, workflowStats] = await Promise.all([
    fetchLeadsData(env),
    fetchWorkflowStats(env),
  ]);

  return new Response(
    JSON.stringify({
      totalLeads: leadsData.total,
      activeWorkflows: workflowStats.active,
      totalWorkflows: workflowStats.total,
      leadsChartData: leadsData.chartData,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function fetchLeadsData(env: Env): Promise<{ total: number; chartData: { labels: string[], data: number[] } }> {
  const fallbackChart = { labels: getLast7DaysLabels(), data: [0, 0, 0, 0, 0, 0, 0] };
  
  try {
    // Fetch records with just createdTime. We fetch up to 100 for recent trends.
    const res = await fetch(
      `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Leads_from_Form?pageSize=100&fields%5B%5D=Name`,
      {
        headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}` },
      }
    );
    if (!res.ok) return { total: 0, chartData: fallbackChart };
    
    const data = await res.json() as { records: { createdTime: string }[] };
    const total = data.records.length;

    // Process dates for the chart (last 7 days bucketing)
    const now = new Date();
    // Normalize to start of day UTC for simple bucketing
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Initialize buckets for the last 7 days [6 days ago, 5 days ago, ... today]
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    
    data.records.forEach(r => {
      if (!r.createdTime) return;
      const created = new Date(r.createdTime);
      const diffTime = Math.abs(now.getTime() - created.getTime());
      const diffDays = Math.floor(diffTime / dayMs);
      
      // If it's within the last 7 days (0 is today, 6 is 6 days ago)
      if (diffDays >= 0 && diffDays < 7) {
        // Map 0 (today) to the last index (6), 1 to index 5, etc.
        buckets[6 - diffDays]++;
      }
    });

    return { 
      total, 
      chartData: {
        labels: getLast7DaysLabels(),
        data: buckets
      }
    };
  } catch (e) {
    console.error("Leads fetch error:", e);
    return { total: 0, chartData: fallbackChart };
  }
}

async function fetchWorkflowStats(
  env: Env
): Promise<{ active: number; total: number }> {
  try {
    const res = await fetch(`${env.N8N_BASE_URL}/api/v1/workflows?limit=100`, {
      headers: {
        'X-N8N-API-KEY': env.N8N_API_KEY,
        'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
        'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
      },
    });
    if (!res.ok) return { active: 0, total: 0 };
    const data = await res.json() as {
      data: { active: boolean; isArchived: boolean }[];
    };
    const nonArchived = data.data.filter(w => !w.isArchived);
    return {
      active: nonArchived.filter(w => w.active).length,
      total: nonArchived.length,
    };
  } catch {
    return { active: 0, total: 0 };
  }
}

// Helper to generate labels like ["Mon", "Tue", "Wed"] for the last 7 days ending today
function getLast7DaysLabels(): string[] {
  const labels: string[] = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    labels.push(days[d.getDay()]);
  }
  return labels;
}
