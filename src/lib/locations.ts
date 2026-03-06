// locations.ts
// Static types and constants only.
// The actual districts/cities data is fetched dynamically from Pikud Haoref
// via the /api/locations route, which mirrors the exact structure used by
// tzevaadom / צבע אדום.

export interface City {
    name: string;
    value: string; // exact city label as it appears in tzevaadom alert data
}

export interface District {
    name: string;  // areaname from Pikud Haoref e.g. "חיפה", "קו העימות"
    cities: City[];
}

export const ALL_DISTRICTS = 'כל הארץ';
export const ALL_CITIES_IN_DISTRICT = 'כל האזור';
