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
        if (isAllEvents) {
            // Include ALL alerts with any category description
            return !!a.category_desc;
        }
        return a.category_desc === targetCategoryDesc;
    });

    const hourlyBuckets: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyBuckets[i] = 0;

    filteredByType.forEach(a => {
        // Parse date format "DD.MM.YYYY"
        try {
            const alertDate = parse(`${a.date} ${a.time}`, 'dd.MM.yyyy HH:mm:ss', new Date());

            if (isWithinInterval(alertDate, { start: startOfDay(startDate), end: endOfDay(endDate) })) {
                const hour = getHours(alertDate);
                hourlyBuckets[hour]++;
            }
        } catch (e) {
            console.error('Failed to parse date:', a.date, a.time);
        }
    });

    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    return Object.keys(hourlyBuckets).map(h => {
        const hourNum = parseInt(h);
        const count = hourlyBuckets[hourNum];
        // Probability is based on historical frequency in that hour across the selected days
        const probability = Math.min(100, (count / totalDays) * 100);

        return {
            hour: `${hourNum.toString().padStart(2, '0')}:00-${((hourNum + 1) % 24).toString().padStart(2, '0')}:00`,
            count,
            probability: parseFloat(probability.toFixed(2)),
            type: targetCategoryDesc
        };
    });
}
