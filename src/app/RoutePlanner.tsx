'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Navigation, Clock, MapPin, Shield, Loader, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface SafestWindow { startHour: number; totalRisk: number; avgRisk: number; hours: number[]; }
interface RouteOption {
    index: number; label: string;
    distanceKm: number; durationMin: number; windowHours: number;
    citiesAlongRoute: string[]; hourlyRisk: number[];
    safestWindow: SafestWindow; geometry: [number, number][];
    riskRank: number;
    destLat: number; destLon: number;
    originLat: number; originLon: number;
    waypointName: string;
}
interface ApiResult { origin: string; destination: string; routes: RouteOption[]; }

const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a'];
const RC = (r: number) => r === 0 ? '#22c55e' : r < 5 ? '#86efac' : r < 15 ? '#fbbf24' : r < 30 ? '#f97316' : '#ef4444';
const RL = (r: number) => r === 0 ? 'בטוח' : r < 5 ? 'נמוך' : r < 15 ? 'בינוני' : r < 30 ? 'גבוה' : 'גבוה מאוד';
const pad = (n: number) => String(n).padStart(2, '0');

function wazeUrl(destLat: number, destLon: number) {
    // Deep link — opens Waze app on mobile, website on desktop
    return `https://waze.com/ul?ll=${destLat},${destLon}&navigate=yes&zoom=17`;
}

function calcWindow(hourlyRisk: number[], start: number, hours: number) {
    let total = 0;
    for (let i = 0; i < hours; i++) total += hourlyRisk[(start + i) % 24];
    return { total: parseFloat(total.toFixed(2)), avg: parseFloat((total / hours).toFixed(2)), endHour: (start + hours) % 24 };
}

// ─── Multi-route Leaflet map ──────────────────────────────────────────────────
function RouteMap({ routes, selectedIdx }: { routes: RouteOption[]; selectedIdx: number }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const polylinesRef = useRef<any[]>([]);

    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;
        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css'; link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }
        import('leaflet').then(L => {
            if (!mapRef.current || mapInstanceRef.current) return;
            const allCoords = routes.flatMap(r => r.geometry.map(([lon, lat]) => [lat, lon] as [number, number]));
            const bounds = L.latLngBounds(allCoords);
            const map = L.map(mapRef.current!).fitBounds(bounds, { padding: [40, 40] });
            mapInstanceRef.current = map;
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

            // Draw all routes
            polylinesRef.current = routes.map((r, i) => {
                const latlngs = r.geometry.map(([lon, lat]) => [lat, lon] as [number, number]);
                return L.polyline(latlngs, {
                    color: ROUTE_COLORS[i] ?? '#888',
                    weight: i === selectedIdx ? 5 : 3,
                    opacity: i === selectedIdx ? 1 : 0.45,
                    dashArray: i === selectedIdx ? undefined : '8 5',
                }).addTo(map);
            });

            // Origin / destination markers
            const mkIcon = (bg: string) => L.divIcon({ html: `<div style="background:${bg};width:13px;height:13px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`, iconSize: [13, 13], iconAnchor: [6, 6], className: '' });
            const first = routes[0].geometry[0];
            const last  = routes[0].geometry[routes[0].geometry.length - 1];
            L.marker([first[1], first[0]], { icon: mkIcon('#16a34a') }).addTo(map);
            L.marker([last[1],  last[0]],  { icon: mkIcon('#dc2626') }).addTo(map);
        });
        return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
    }, []);

    // Update opacity/weight when selected route changes
    useEffect(() => {
        polylinesRef.current.forEach((pl, i) => {
            if (!pl) return;
            pl.setStyle({ weight: i === selectedIdx ? 5 : 3, opacity: i === selectedIdx ? 1 : 0.45, dashArray: i === selectedIdx ? undefined : '8 5' });
            if (i === selectedIdx) pl.bringToFront();
        });
    }, [selectedIdx]);

    return <div ref={mapRef} style={{ height: '360px', borderRadius: '10px', zIndex: 0 }} />;
}

// ─── Route comparison card ────────────────────────────────────────────────────
function RouteCard({ route, isSelected, selectedHour, onClick }: {
    route: RouteOption; isSelected: boolean; selectedHour: number; onClick: () => void
}) {
    const [expanded, setExpanded] = useState(false);
    const color    = ROUTE_COLORS[route.index] ?? '#888';
    const isSafest = route.riskRank === 1;
    // Waze deep-link: navigate to destination
    const waze = wazeUrl(route.destLat, route.destLon);
    // Display the hour that's active for this card (its optimal, unless it's the selected card)
    const displayHour = isSelected ? selectedHour : route.safestWindow.startHour;
    return (
        <div onClick={onClick} style={{ border: `2px solid ${isSelected ? color : '#e2e8f0'}`, borderRadius: '12px',
            padding: '1rem', cursor: 'pointer', background: isSelected ? '#f8faff' : 'white',
            transition: 'all 0.2s', position: 'relative' }}>
            {isSafest && <span style={{ position: 'absolute', top: '-11px', right: '12px', background: '#16a34a', color: 'white', fontSize: '0.68rem', borderRadius: '5px', padding: '2px 7px', fontWeight: 700 }}>★ הכי בטוח</span>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: color }} />
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{route.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.85rem', color: '#475569' }}>
                    <span>📏 {route.distanceKm} ק"מ</span>
                    <span>⏱ {route.durationMin} דק'</span>
                </div>
            </div>
            {/* Risk summary */}
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '120px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>חלון מומלץ</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{pad(route.safestWindow.startHour)}:00 – {pad((route.safestWindow.startHour + route.windowHours) % 24)}:00</div>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '100px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>סיכון כולל</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: RC(route.safestWindow.avgRisk) }}>{route.safestWindow.totalRisk}%</div>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '0.5rem 0.75rem', flex: 1, minWidth: '100px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ממוצע/שעה</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: RC(route.safestWindow.avgRisk) }}>{route.safestWindow.avgRisk}% <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({RL(route.safestWindow.avgRisk)})</span></div>
                </div>
            </div>
            {/* Waze + Details buttons */}
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href={waze} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.85rem',
                        background: '#05c8f0', color: '#1a1a2e', borderRadius: '6px', fontWeight: 700,
                        fontSize: '0.82rem', textDecoration: 'none', border: 'none', cursor: 'pointer' }}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Waze_icon.svg/32px-Waze_icon.svg.png"
                        width={16} height={16} alt="Waze" style={{ borderRadius: '3px' }} />
                    פתח ב-Waze {pad(displayHour)}:00
                    <ExternalLink size={12} />
                </a>
                <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem',
                        background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px',
                        cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}>
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {expanded ? 'הסתר פרטים' : 'פרטים + שעות'}
                </button>
            </div>
            {expanded && (
                <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                        {route.citiesAlongRoute.map(c => <span key={c} className="city-tag" style={{ fontSize: '0.75rem' }}>{c}</span>)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.3rem' }}>
                        {route.hourlyRisk.map((risk, h) => (
                            <div key={h} style={{ borderRadius: '6px', padding: '0.3rem 0.4rem', background: route.safestWindow.hours.includes(h) ? '#eff6ff' : '#f8fafc', border: route.safestWindow.hours.includes(h) ? '1.5px solid #93c5fd' : '1px solid #e2e8f0', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>{pad(h)}:00</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: RC(risk) }}>{risk}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RoutePlanner() {
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ApiResult | null>(null);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [selectedHour, setSelectedHour] = useState<number>(0);

    const handleSearch = async () => {
        if (!origin.trim() || !destination.trim()) return;
        setLoading(true); setError(null); setResult(null);
        try {
            const res  = await fetch(`/api/route-plan?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
            const safest = data.routes.find((r: RouteOption) => r.riskRank === 1);
            setSelectedIdx(safest?.index ?? 0);
            setSelectedHour(safest?.safestWindow.startHour ?? 0);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const activeRoute = result?.routes[selectedIdx] ?? null;

    const manualWindow = useMemo(() => {
        if (!activeRoute) return null;
        const w = calcWindow(activeRoute.hourlyRisk, selectedHour, activeRoute.windowHours);
        const optimal = activeRoute.safestWindow.totalRisk;
        return { ...w, delta: parseFloat((w.total - optimal).toFixed(2)) };
    }, [activeRoute, selectedHour]);

    return (
        <div className="route-planner" dir="rtl">
            {/* Input */}
            <div className="card">
                <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Navigation size={22} /> תכנון מסלול בטוח
                </h2>
                <div className="controls" style={{ flexWrap: 'wrap' }}>
                    <div className="control-group" style={{ flex: 1, minWidth: '160px' }}>
                        <label className="btn-icon"><MapPin size={15} /> מוצא</label>
                        <input type="text" placeholder="מעלות תרשיחא" value={origin}
                            onChange={e => setOrigin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                    </div>
                    <div className="control-group" style={{ flex: 1, minWidth: '160px' }}>
                        <label className="btn-icon"><MapPin size={15} /> יעד</label>
                        <input type="text" placeholder="דימונה" value={destination}
                            onChange={e => setDestination(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                    </div>
                    <div className="control-group">
                        <label>&nbsp;</label>
                        <button className="primary btn-icon" onClick={handleSearch} disabled={loading}>
                            {loading ? <Loader size={16} /> : <Navigation size={16} />}
                            {loading ? 'מחשב...' : 'חפש נתיבים'}
                        </button>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="loader">
                    <div className="spinner" />
                    <p className="m-t-1">מחשב נתיבים חלופיים ומנתח אזעקות...</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>עשוי לקחת 20-40 שניות</p>
                </div>
            )}
            {error && <div className="card text-danger">שגיאה: {error}</div>}

            {result && activeRoute && manualWindow && (
                <>
                    {/* ── Route comparison cards ── */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Shield size={18} /> השוואת נתיבים חלופיים
                            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 400 }}>{result.routes.length} נתיבים נמצאו</span>
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {[...result.routes]
                                .sort((a, b) => a.riskRank - b.riskRank)
                                .map(r => (
                                    <RouteCard key={r.index} route={r}
                                        isSelected={r.index === selectedIdx}
                                        selectedHour={selectedHour}
                                        onClick={() => { setSelectedIdx(r.index); setSelectedHour(r.safestWindow.startHour); }} />
                                ))
                            }
                        </div>
                    </div>

                    {/* ── Map ── */}
                    <div className="card" style={{ padding: '1rem' }}>
                        <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🗺️ מסלולים על המפה
                            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 400 }}>
                                {result.routes.map((r, i) => (
                                    <span key={i} style={{ marginRight: '0.6rem' }}>
                                        <span style={{ color: ROUTE_COLORS[i], fontWeight: 700 }}>—</span> {r.label}
                                    </span>
                                ))}
                            </span>
                        </h3>
                        <RouteMap routes={result.routes} selectedIdx={selectedIdx} />
                    </div>

                    {/* ── Manual hour slider for selected route ── */}
                    <div className="card">
                        <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={18} /> בחר שעת יציאה — {activeRoute.label}
                            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: ROUTE_COLORS[activeRoute.index] }}>●</span>
                        </h3>
                        <input type="range" min={0} max={23} step={1} value={selectedHour}
                            onChange={e => setSelectedHour(Number(e.target.value))}
                            style={{ width: '100%', accentColor: ROUTE_COLORS[activeRoute.index], cursor: 'pointer' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--muted)', margin: '0.2rem 0 1rem' }}>
                            {[0,3,6,9,12,15,18,21].map(h => <span key={h}>{pad(h)}:00</span>)}
                        </div>

                        {/* Selected window summary */}
                        <div style={{ borderRadius: '10px', padding: '1rem 1.25rem',
                            background: manualWindow.delta === 0 ? '#f0fdf4' : manualWindow.delta < 5 ? '#fefce8' : '#fff7ed',
                            border: `1.5px solid ${manualWindow.delta === 0 ? '#86efac' : manualWindow.delta < 5 ? '#fde68a' : '#fdba74'}`,
                            display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>חלון נבחר ({activeRoute.windowHours} שעות)</div>
                                <div style={{ fontWeight: 800, fontSize: '1.7rem', color: '#1e293b' }}>
                                    {pad(selectedHour)}:00 – {pad(manualWindow.endHour)}:00
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>סיכון כולל</div>
                                <div style={{ fontWeight: 800, fontSize: '1.6rem', color: RC(manualWindow.avg) }}>{manualWindow.total}%</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>ממוצע/שעה: {manualWindow.avg}%</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>לעומת אופטימלי</div>
                                <div style={{ fontWeight: 700, fontSize: '1.3rem', color: manualWindow.delta === 0 ? '#16a34a' : manualWindow.delta < 5 ? '#ca8a04' : '#ea580c' }}>
                                    {manualWindow.delta === 0 ? '✓ מיטבי' : `+${manualWindow.delta}%`}
                                </div>
                            </div>
                        </div>

                        {/* 24h grid — clickable */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))', gap: '0.3rem', marginTop: '1rem' }}>
                            {activeRoute.hourlyRisk.map((risk, h) => {
                                const inSel = Array.from({ length: activeRoute.windowHours }, (_, i) => (selectedHour + i) % 24).includes(h);
                                const isOpt = activeRoute.safestWindow.hours.includes(h);
                                return (
                                    <div key={h} onClick={() => setSelectedHour(h)} style={{ borderRadius: '6px', padding: '0.3rem 0.35rem', textAlign: 'center', cursor: 'pointer',
                                        background: inSel ? '#eff6ff' : isOpt ? '#f0fdf4' : '#f8fafc',
                                        border: h === selectedHour ? `2px solid ${ROUTE_COLORS[activeRoute.index]}` : inSel ? '1.5px solid #93c5fd' : isOpt ? '1.5px solid #86efac' : '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 600 }}>{pad(h)}:00</div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: RC(risk) }}>{risk}%</div>
                                    </div>
                                );
                            })}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                            🔵 נבחר &nbsp; 🟢 אופטימלי — לחץ על שעה לבחירה
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
