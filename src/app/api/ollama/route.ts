import { NextRequest, NextResponse } from 'next/server';

// ─── Simple API key auth ───────────────────────────────────────────────────
// Set OLLAMA_API_KEY env var on the server to protect the endpoint.
// If not set → open access (useful for local dev).
const REQUIRED_KEY = process.env.OLLAMA_API_KEY || null;

const OLLAMA_BASE = process.env.OLLAMA_URL
  ? process.env.OLLAMA_URL.replace('/api/generate', '')
  : 'http://172.17.0.1:11434';

function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized — provide X-API-Key header or Authorization: Bearer <key>' },
    { status: 401 }
  );
}

function checkAuth(req: NextRequest): boolean {
  if (!REQUIRED_KEY) return true;
  const key =
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace('Bearer ', '');
  return key === REQUIRED_KEY;
}

// POST /api/ollama  →  proxy to Ollama generate
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();
  try {
    const body = await req.json();
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream: false, ...body }),
    });
    if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/ollama  →  list available models
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
