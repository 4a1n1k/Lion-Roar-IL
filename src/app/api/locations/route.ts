import { NextResponse } from 'next/server';

const OREF_DISTRICTS_URL =
    'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he';

interface OrefCity {
    label: string;
    areaname: string;
}

export interface LocationDistrict {
    name: string;
    cities: { name: string; value: string }[];
}

// Cache for 24 hours — data changes very rarely
let cachedDistricts: LocationDistrict[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 3600 * 1000;

async function fetchDistricts(): Promise<LocationDistrict[]> {
    const now = Date.now();
    if (cachedDistricts && now - cacheTime < CACHE_TTL) return cachedDistricts;

    const res = await fetch(OREF_DISTRICTS_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.oref.org.il/',
        },
        cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Oref GetDistricts responded with ${res.status}`);

    const raw: OrefCity[] = await res.json();

    // Group by areaname, deduplicate city labels within each area
    const areaMap = new Map<string, Set<string>>();
    for (const city of raw) {
        const area = city.areaname?.trim();
        const label = city.label?.trim();
        if (!area || !label) continue;
        if (!areaMap.has(area)) areaMap.set(area, new Set());
        areaMap.get(area)!.add(label);
    }

    // Sort areas alphabetically (Hebrew), cities alphabetically within each area
    const districts: LocationDistrict[] = Array.from(areaMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'he'))
        .map(([name, citySet]) => ({
            name,
            cities: Array.from(citySet)
                .sort((a, b) => a.localeCompare(b, 'he'))
                .map(label => ({ name: label, value: label })),
        }));

    cachedDistricts = districts;
    cacheTime = now;
    return districts;
}

export async function GET() {
    try {
        const districts = await fetchDistricts();
        return NextResponse.json(districts);
    } catch (error: any) {
        console.error('Error fetching locations:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
