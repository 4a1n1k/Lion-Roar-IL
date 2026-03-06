import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://172.17.0.1:11434/api/generate';
const MODEL = 'qwen2.5:7b';

export async function POST(request: NextRequest) {
    try {
        const { prompt } = await request.json();
        if (!prompt?.trim()) {
            return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const res = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: MODEL, prompt, stream: false }),
        });

        if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
        const data = await res.json();
        return NextResponse.json({ response: data.response, model: MODEL });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
