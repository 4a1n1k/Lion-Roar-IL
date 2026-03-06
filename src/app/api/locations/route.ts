import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

const OREF_DISTRICTS_URL =
    'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he';

const LOCAL_CACHE_PATH = join(process.cwd(), 'locations_cache.json');

interface OrefCity {
    label: string;
    areaname: string;
}

export interface LocationDistrict {
    name: string;
    cities: { name: string; value: string }[];
}

// In-memory cache for 24 hours
let cachedDistricts: LocationDistrict[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 3600 * 1000;

async function fetchDistricts(): Promise<LocationDistrict[]> {
    const now = Date.now();
    if (cachedDistricts && now - cacheTime < CACHE_TTL) return cachedDistricts;

    let districts: LocationDistrict[];

    try {
        // Try live fetch from Pikud Haoref
        const res = await fetch(OREF_DISTRICTS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.oref.org.il/',
            },
            cache: 'no-store',
        });

        if (!res.ok) throw new Error(`Oref responded with ${res.status}`);

        const raw: OrefCity[] = await res.json();

        // Group by areaname
        const areaMap = new Map<string, Set<string>>();
        for (const city of raw) {
            const area = city.areaname?.trim();
            const label = city.label?.trim();
            if (!area || !label) continue;
            if (!areaMap.has(area)) areaMap.set(area, new Set());
            areaMap.get(area)!.add(label);
        }

        districts = Array.from(areaMap.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'he'))
            .map(([name, citySet]) => ({
                name,
                cities: Array.from(citySet)
                    .sort((a, b) => a.localeCompare(b, 'he'))
                    .map(label => ({ name: label, value: label })),
            }));

        console.log('Locations loaded from Pikud Haoref API');

    } catch (err: any) {
        // Fallback: use pre-fetched local cache (datacenter IPs are blocked by Oref)
        console.warn('Oref GetDistricts fetch failed, using local cache:', err.message);
        const fileContent = readFileSync(LOCAL_CACHE_PATH, 'utf-8');
        districts = JSON.parse(fileContent);
    }

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
