import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const TZEVAADOM_URL = 'https://www.tzevaadom.co.il/static/historical/all.json';
// Local cache file — used as fallback when tzevaadom blocks datacenter IPs
const LOCAL_CACHE_PATH = join(process.cwd(), 'tmp_alerts.json');

// Categories that are RELEVANT — active threats only
const RELEVANT_CATEGORIES = new Set([0, 1, 2, 5]);
// 0,1 = ירי רקטות וטילים
// 2   = חדירת כלי טיס עוין (active UAV)
// 5   = tzevaadom mistakenly labels active UAV alerts as "הסתיים" — treat as חדירת כלי טיס עוין
// Excluded: 3 (earthquake), 4/9 (infiltrators - different threat), 6,7,8 (irrelevant),
//           10 (רקטות הסתיים), 13 (הסתיים)

const CATEGORY_MAP: Record<number, string> = {
    0: 'ירי רקטות וטילים',
    1: 'ירי רקטות וטילים',
    2: 'חדירת כלי טיס עוין',
    5: 'חדירת כלי טיס עוין', // tzevaadom bug: active UAV alerts stored as cat 5
};

let cachedData: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

async function getAllAlerts(): Promise<any[]> {
    const now = Date.now();
    if (cachedData && now - cacheTime < CACHE_TTL) return cachedData;

    let raw: any[];

    try {
        const res = await fetch(TZEVAADOM_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store',
        });
        if (!res.ok) throw new Error(`tzevaadom responded with ${res.status}`);
        raw = await res.json();
    } catch (err: any) {
        // Fallback: read from local file (pre-fetched from a non-datacenter IP)
        console.warn('tzevaadom fetch failed, using local cache:', err.message);
        const fileContent = readFileSync(LOCAL_CACHE_PATH, 'utf-8');
        raw = JSON.parse(fileContent);
    }

    // Convert raw → RawAlert, keeping RELEVANT categories only
    // Each record = [matrix_id, category, [cities], unix_timestamp]
    const alerts = raw.flatMap((record: any) => {
        const [matrixId, category, cities, timestamp] = record;

        // Filter irrelevant categories (ended events, earthquakes, etc.)
        if (!RELEVANT_CATEGORIES.has(category)) return [];

        const alertDate = new Date(timestamp * 1000);
        const dd = String(alertDate.getDate()).padStart(2, '0');
        const mm = String(alertDate.getMonth() + 1).padStart(2, '0');
        const yyyy = alertDate.getFullYear();
        const hh = String(alertDate.getHours()).padStart(2, '0');
        const min = String(alertDate.getMinutes()).padStart(2, '0');
        const ss = String(alertDate.getSeconds()).padStart(2, '0');

        return (cities as string[]).map((city: string, idx: number) => ({
            data: city,
            date: `${dd}.${mm}.${yyyy}`,
            time: `${hh}:${min}:${ss}`,
            alertDate: alertDate.toISOString(),
            category: category,
            category_desc: CATEGORY_MAP[category] ?? 'התראה',
            matrix_id: matrixId,
            rid: timestamp * 1000 + idx,
        }));
    });

    cachedData = alerts;
    cacheTime = now;
    return alerts;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate'); // DD.MM.YYYY
    const toDate = searchParams.get('toDate');     // DD.MM.YYYY

    if (!fromDate || !toDate) {
        return NextResponse.json({ error: 'fromDate and toDate are required' }, { status: 400 });
    }

    try {
        const all = await getAllAlerts();

        // Parse DD.MM.YYYY to comparable number YYYYMMDD
        const parseDate = (s: string) => {
            const [d, m, y] = s.split('.').map(Number);
            return y * 10000 + m * 100 + d;
        };

        const fromNum = parseDate(fromDate);
        const toNum = parseDate(toDate);

        const filtered = all.filter(a => {
            const n = parseDate(a.date);
            return n >= fromNum && n <= toNum;
        });

        return NextResponse.json(filtered);
    } catch (error: any) {
        console.error('Error fetching alerts:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
