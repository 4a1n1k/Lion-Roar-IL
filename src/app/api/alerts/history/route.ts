import { NextRequest, NextResponse } from 'next/server';

const TZEVAADOM_URL = 'https://www.tzevaadom.co.il/static/historical/all.json';

// Category mapping from tzevaadom numeric category to description
const CATEGORY_MAP: Record<number, string> = {
    0: 'ירי רקטות וטילים',
    1: 'ירי רקטות וטילים',
    2: 'חדירת כלי טיס עוין',
    3: 'רעידת אדמה',
    4: 'חשד לחדירת מחבלים',
    5: 'חדירת כלי טיס עוין - האירוע הסתיים',
    6: 'אירוע חומרים מסוכנים',
    7: 'אזהרה מפני גלי צונאמי',
    8: 'הנחיות פיקוד העורף',
    9: 'חדירת מחבלים',
    10: 'ירי רקטות וטילים - האירוע הסתיים',
    13: 'האירוע הסתיים',
};

let cachedData: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 3600 * 1000; // 1 hour

async function getAllAlerts(): Promise<any[]> {
    const now = Date.now();
    if (cachedData && now - cacheTime < CACHE_TTL) return cachedData;

    const res = await fetch(TZEVAADOM_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`tzevaadom responded with ${res.status}`);

    const raw: any[] = await res.json();

    // Convert to RawAlert format: [matrix_id, category, [cities], unix_timestamp]
    const alerts = raw.flatMap((record: any) => {
        const [matrixId, category, cities, timestamp] = record;
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
