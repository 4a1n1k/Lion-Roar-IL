export interface City {
    name: string;
    value: string;
}

export interface District {
    name: string;
    cities: City[];
}

export const DISTRICTS: District[] = [
    {
        name: 'מחוז הצפון',
        cities: [
            { name: 'מעלות-תרשיחא', value: 'מעלות תרשיחא' },
            { name: 'נהריה', value: 'נהריה' },
            { name: 'עכו', value: 'עכו' },
            { name: 'כרמיאל', value: 'כרמיאל' },
            { name: 'צפת', value: 'צפת' },
            { name: 'קריית שמונה', value: 'קריית שמונה' },
            { name: 'טבריה', value: 'טבריה' },
            { name: 'עפולה', value: 'עפולה' },
            { name: 'נוף הגליל', value: 'נוף הגליל' },
            { name: 'נצרת', value: 'נצרת' },
        ],
    },
    {
        name: 'מחוז חיפה',
        cities: [
            { name: 'חיפה', value: 'חיפה' },
            { name: 'קריות', value: 'קריות' },
            { name: 'חדרה', value: 'חדרה' },
            { name: 'טירת כרמל', value: 'טירת כרמל' },
            { name: 'נשר', value: 'נשר' },
            { name: 'אור עקיבא', value: 'אור עקיבא' },
        ],
    },
    {
        name: 'מחוז המרכז',
        cities: [
            { name: 'נתניה', value: 'נתניה' },
            { name: 'פתח תקווה', value: 'פתח תקווה' },
            { name: 'ראשון לציון', value: 'ראשון לציון' },
            { name: 'רחובות', value: 'רחובות' },
            { name: 'נס ציונה', value: 'נס ציונה' },
            { name: 'לוד', value: 'לוד' },
            { name: 'רמלה', value: 'רמלה' },
            { name: 'כפר סבא', value: 'כפר סבא' },
            { name: 'רעננה', value: 'רעננה' },
            { name: 'הרצליה', value: 'הרצליה' },
            { name: 'הוד השרון', value: 'הוד השרון' },
        ],
    },
    {
        name: 'מחוז תל אביב',
        cities: [
            { name: 'תל אביב - יפו', value: 'תל אביב - יפו' },
            { name: 'חולון', value: 'חולון' },
            { name: 'בת ים', value: 'בת ים' },
            { name: 'רמת גן', value: 'רמת גן' },
            { name: 'גבעתיים', value: 'גבעתיים' },
            { name: 'בני ברק', value: 'בני ברק' },
            { name: 'אור יהודה', value: 'אור יהודה' },
            { name: 'קריית אונו', value: 'קריית אונו' },
            { name: 'גבעת שמואל', value: 'גבעת שמואל' },
        ],
    },
    {
        name: 'מחוז ירושלים',
        cities: [
            { name: 'ירושלים', value: 'ירושלים' },
            { name: 'בית שמש', value: 'בית שמש' },
            { name: 'מבשרת ציון', value: 'מבשרת ציון' },
        ],
    },
    {
        name: 'מחוז הדרומי',
        cities: [
            { name: 'אשדוד', value: 'אשדוד' },
            { name: 'אשקלון', value: 'אשקלון' },
            { name: 'באר שבע', value: 'באר שבע' },
            { name: 'שדרות', value: 'שדרות' },
            { name: 'נתיבות', value: 'נתיבות' },
            { name: 'אופקים', value: 'אופקים' },
            { name: 'קריית גת', value: 'קריית גת' },
            { name: 'דימונה', value: 'דימונה' },
            { name: 'אילת', value: 'אילת' },
        ],
    },
    {
        name: 'יהודה ושומרון',
        cities: [
            { name: 'אריאל', value: 'אריאל' },
            { name: 'מעלה אדומים', value: 'מעלה אדומים' },
            { name: 'ביתר עילית', value: 'ביתר עילית' },
            { name: 'מודיעין עילית', value: 'מודיעין עילית' },
        ],
    },
];

export const ALL_DISTRICTS = 'כל הארץ';
export const ALL_CITIES_IN_DISTRICT = 'כל האזור';

export function getCitiesByDistrict(districtName: string): City[] {
    const district = DISTRICTS.find(d => d.name === districtName);
    return district ? district.cities : [];
}
