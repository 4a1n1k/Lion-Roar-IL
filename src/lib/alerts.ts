import { parse, format, isWithinInterval, startOfDay, endOfDay, getHours } from 'date-fns';
import { ALL_DISTRICTS, ALL_CITIES_IN_DISTRICT, DISTRICTS } from './locations';

export interface RawAlert {
    data: string;          // City name
    date: string;          // DD.MM.YYYY
    time: string;          // HH:mm:ss
    category: number;      // Alert category ID
    category_desc: string; // Description like "ירי רקטות וטילים"
    matrix_id: number;
    rid: number;
}

export interface ProcessedStats {
    hour: string; // "00:00-01:00"
    count: number;
    probability: number;
    type: string;
}

export const ALL_EVENTS = 'כל האירועים';

export function filterByLocation(alerts: RawAlert[], district: string, city: string): RawAlert[] {
    if (district === ALL_DISTRICTS || !district) return alerts;

    const districtData = DISTRICTS.find(d => d.name === district);
    if (!districtData) return alerts;

    if (city === ALL_CITIES_IN_DISTRICT || !city) {
        const districtCityNames = districtData.cities.map(c => c.value);
        // Match if the alert data (city string) includes any of the cities in the district
        // Also normalize spaces/hyphens for robustness
        return alerts.filter(a => {
            const normalizedData = a.data.replace(/-/g, ' ').trim();
            return districtCityNames.some(cn => {
                const normalizedCn = cn.replace(/-/g, ' ').trim();
                return normalizedData.includes(normalizedCn);
            });
        });
    }

    // Match specific city
    const normalizedCity = city.replace(/-/g, ' ').trim();
    return alerts.filter(a => a.data.replace(/-/g, ' ').trim().includes(normalizedCity));
}

export function processAlerts(
    alerts: RawAlert[],
    startDate: Date,
    endDate: Date,
    targetCategoryDesc: string
): ProcessedStats[] {
    const isAllEvents = targetCategoryDesc === ALL_EVENTS || !targetCategoryDesc;

    const filteredByType = alerts.filter(a => {
        if (isAllEvents) return !!a.category_desc;
        return a.category_desc === targetCategoryDesc;
    });

    // ── Count alert records per hour — dedup by raw record, not by city ──────
    // tzevaadom format: [matrix_id, category, [cities], timestamp]
    // One raw record → expanded to N city rows, each with a different rid.
    // Counting by rid = counting every city = massive inflation for "כל הארץ".
    // Correct key = matrix_id:date:time (exact timestamp) → counts the original
    // raw record once, regardless of how many cities it covered.
    // Same matrix_id at a different time = a different salvo = counted again. ✓
    const hourlyBuckets: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyBuckets[i] = 0;

    const seenRecords = new Set<string>();

    filteredByType.forEach(a => {
        try {
            const alertDate = parse(`${a.date} ${a.time}`, 'dd.MM.yyyy HH:mm:ss', new Date());
            if (isWithinInterval(alertDate, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
                // key = matrix_id + exact timestamp → unique per raw record
                const key = `${a.matrix_id}:${a.date}:${a.time}`;
                if (!seenRecords.has(key)) {
                    seenRecords.add(key);
                    hourlyBuckets[getHours(alertDate)]++;
                }
            }
        } catch (e) {
            console.error('Failed to parse date:', a.date, a.time);
        }
    });

    const totalDays = Math.max(1, Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1); // +1 to include both start and end day

    return Array.from({ length: 24 }, (_, hourNum) => {
        const count = hourlyBuckets[hourNum];
        const probability = parseFloat(Math.min(100, (count / totalDays) * 100).toFixed(1));
        return {
            hour: `${String(hourNum).padStart(2, '0')}:00-${String((hourNum + 1) % 24).padStart(2, '0')}:00`,
            count,
            probability,
            type: targetCategoryDesc,
        };
    });
}
