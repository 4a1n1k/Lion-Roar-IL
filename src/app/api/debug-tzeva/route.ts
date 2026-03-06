import { NextResponse } from 'next/server';
export async function GET() {
    const url = 'https://nominatim.openstreetmap.org/search?q=Tel+Aviv,+ישראל&format=json&limit=1';
    const res = await fetch(url, { headers: { 'User-Agent': 'AlertsIL/1.0' }, cache: 'no-store' });
    const ct = res.headers.get('content-type');
    const text = await res.text();
    return NextResponse.json({ status: res.status, contentType: ct, first200: text.slice(0, 200) });
}
