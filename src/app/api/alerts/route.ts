import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Using a more reliable historical mirror from Tzeva Adom
        const response = await fetch('https://www.tzevaadom.co.il/static/historical/all.json', {
            next: { revalidate: 3600 }, // Cache historical data for 1 hour
        });

        if (!response.ok) {
            throw new Error(`Mirror API responded with status: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching alerts from mirror:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
