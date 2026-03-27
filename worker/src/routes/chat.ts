/**
 * Chat Route — n8n Webhook Proxy
 *
 * Proxies chatbot messages to the n8n webhook securely.
 * The direct webhook URL is not exposed to the frontend.
 */

import type { Env } from '../index';

export async function handleChat(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json() as { message?: string };
    
    if (!body.message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const n8nUrl = `${env.N8N_BASE_URL || 'https://n8n.moihanatech.com'}/webhook/fd7ba7e6-b3a3-4b75-ba9a-0ff740e32010`;
    
    const n8nResponse = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: body.message }),
    });

    if (!n8nResponse.ok) {
        const errText = await n8nResponse.text();
        console.error('n8n webhook error:', n8nResponse.status, errText);
        return new Response(
            JSON.stringify({ error: 'Failed to process chat message' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const data = await n8nResponse.json();
    
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chat routing error:', error);
    return new Response(
        JSON.stringify({ error: 'Internal Server Error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
