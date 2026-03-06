import { NextRequest, NextResponse } from 'next/server';

const PHOTON   = 'https://photon.komoot.io';
const OSRM     = 'https://router.project-osrm.org/route/v1/driving';
const TZEVAADOM = 'https://www.tzevaadom.co.il/static/historical/all.json';

export interface RouteOption {
    index: number; label: string;
    distanceKm: number; durationMin: number; windowHours: number;
    citiesAlongRoute: string[]; hourlyRisk: number[];
    safestWindow: { startHour: number; totalRisk: number; avgRisk: number; hours: number[] };
    geometry: [number, number][];
    riskRank: number; waypointName: string;
    destLat: number; destLon: number; originLat: number; originLon: number;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Geocode: Hebrew city name → GPS  (Photon — no rate limit, supports Hebrew) ──
async function geocode(city: string): Promise<{ lat: number; lon: number }> {
    const url = `${PHOTON}/api/?q=${encodeURIComponent(city)}&limit=5`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'AlertsIL/2.0' }, cache: 'no-store' });
    const data = await res.json();
    // Prefer results from Israel
    const feature = data.features?.find((f: any) => f.properties?.country === 'ישראל')
                 ?? data.features?.[0];
    if (!feature) throw new Error(`לא נמצאה עיר: ${city}`);
    const [lon, lat] = feature.geometry.coordinates;
    return { lat, lon };
}

// ── Reverse geocode: GPS → Hebrew city name  (Photon) ──
async function reverseGeocode(lat: number, lon: number): Promise<string> {
    const url = `${PHOTON}/reverse?lon=${lon}&lat=${lat}`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'AlertsIL/2.0' }, cache: 'no-store' });
    const data = await res.json();
    const p = data.features?.[0]?.properties;
    return p?.city || p?.town || p?.village || p?.municipality || p?.county || '';
}

let alertCache: any[] | null = null;
let alertCacheTime = 0;

async function getAlerts() {
    if (alertCache && Date.now() - alertCacheTime < 3600000) return alertCache!;
    const res = await fetch(TZEVAADOM, { headers: { 'User-Agent': 'AlertsIL/2.0' }, cache: 'no-store' });
    const raw: any[] = await res.json();
    alertCache = raw.flatMap((r: any) => {
        const [, cat, cities, ts] = r;
        if (cat === 5 || cat === 10 || cat === 13) return [];
        const d = new Date(ts * 1000);
        return (cities as string[]).map((city: string) => ({ data: city, hour: d.getHours() }));
    });
    alertCacheTime = Date.now();
    return alertCache;
}

function calcHourlyRisk(alerts: any[], cities: string[]): number[] {
    const counts = new Array(24).fill(0);
    const norm = cities.map(c => c.replace(/-/g, ' ').trim());
    for (const a of alerts) {
        const d = a.data.replace(/-/g, ' ').trim();
        if (norm.some(c => d.includes(c) || c.includes(d))) counts[a.hour]++;
    }
    return counts.map(c => parseFloat(((c / 730) * 100).toFixed(2)));
}

function findSafestWindow(hourlyRisk: number[], windowHours: number) {
    let bestStart = 0, bestRisk = Infinity;
    for (let s = 0; s < 24; s++) {
        let risk = 0;
        for (let i = 0; i < windowHours; i++) risk += hourlyRisk[(s + i) % 24];
        if (risk < bestRisk) { bestRisk = risk; bestStart = s; }
    }
    return {
        startHour: bestStart,
        totalRisk: parseFloat(bestRisk.toFixed(2)),
        avgRisk: parseFloat((bestRisk / windowHours).toFixed(2)),
        hours: Array.from({ length: windowHours }, (_, i) => (bestStart + i) % 24),
    };
}

// ── Sample 5 evenly-spaced GPS points along route → city names ──
async function sampleCities(coords: [number, number][]): Promise<string[]> {
    const MAX = 5;
    const step = Math.max(1, Math.floor(coords.length / (MAX - 1)));
    const indices = new Set<number>();
    for (let i = 0; i < coords.length; i += step) indices.add(i);
    indices.add(coords.length - 1);

    const cities: string[] = [];
    for (const idx of [...indices].slice(0, MAX)) {
        const [lon, lat] = coords[idx];
        const city = await reverseGeocode(lat, lon);
        if (city && !cities.includes(city)) cities.push(city);
        await sleep(50); // Photon is generous but let's be polite
    }
    return cities;
}

// ── 3 route variants via geographic waypoints ──
function buildWaypoints(fromLat: number, fromLon: number, toLat: number, toLon: number) {
    const midLat = (fromLat + toLat) / 2;
    const midLon = (fromLon + toLon) / 2;
    return [
        { label: 'נתיב ישיר',  wp: null },
        { label: 'דרך המערב',  wp: { lat: midLat, lon: midLon - 0.4 } },
        { label: 'דרך המזרח',  wp: { lat: midLat, lon: midLon + 0.4 } },
    ];
}

const ROUTE_LABELS = ['נתיב א׳', 'נתיב ב׳', 'נתיב ג׳'];

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const origin      = searchParams.get('origin');
    const destination = searchParams.get('destination');
    if (!origin || !destination)
        return NextResponse.json({ error: 'origin and destination required' }, { status: 400 });

    try {
        const [from, to] = await Promise.all([geocode(origin), geocode(destination)]);
        const alerts    = await getAlerts();
        const waypoints = buildWaypoints(from.lat, from.lon, to.lat, to.lon);

        const routes: RouteOption[] = [];
        const seenKm = new Set<number>();

        for (const { label, wp } of waypoints) {
            const coords = wp
                ? `${from.lon},${from.lat};${wp.lon},${wp.lat};${to.lon},${to.lat}`
                : `${from.lon},${from.lat};${to.lon},${to.lat}`;
            const url = `${OSRM}/${coords}?overview=full&geometries=geojson&steps=false`;
            const res = await fetch(url, { headers: { 'User-Agent': 'AlertsIL/2.0' }, cache: 'no-store' });
            const ct  = res.headers.get('content-type') ?? '';
            if (!ct.includes('json')) continue;
            const osrmData = await res.json();
            if (osrmData.code !== 'Ok') continue;

            const r           = osrmData.routes[0];
            const distanceKm  = Math.round(r.distance / 1000);
            if ([...seenKm].some(d => Math.abs(d - distanceKm) < 5)) continue;
            seenKm.add(distanceKm);

            const geometry    = r.geometry.coordinates as [number, number][];
            const durationMin = Math.round(r.legs.reduce((s: number, l: any) => s + l.duration, 0) / 60);
            const windowHours = Math.max(1, Math.ceil(durationMin / 60));

            const citiesAlongRoute = await sampleCities(geometry);
            const hourlyRisk       = calcHourlyRisk(alerts, citiesAlongRoute);
            const safestWindow     = findSafestWindow(hourlyRisk, windowHours);

            routes.push({
                index: routes.length, label: ROUTE_LABELS[routes.length] ?? label,
                waypointName: label, distanceKm, durationMin, windowHours,
                citiesAlongRoute, hourlyRisk, safestWindow, geometry, riskRank: 0,
                destLat: to.lat, destLon: to.lon, originLat: from.lat, originLon: from.lon,
            });
        }

        if (!routes.length) throw new Error('לא נמצאו נתיבים');

        // Rank by lowest combined risk
        [...routes]
            .sort((a, b) => a.safestWindow.totalRisk - b.safestWindow.totalRisk)
            .forEach((r, rank) => { routes[r.index].riskRank = rank + 1; });

        return NextResponse.json({ origin, destination, routes });
    } catch (err: any) {
        console.error('[route-plan]', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
