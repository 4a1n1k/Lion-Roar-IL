'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parse } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  History, BarChart3, LayoutGrid, Download, RefreshCw, MapPin, Calendar,
  AlertTriangle, Info, Clock
} from 'lucide-react';
import { processAlerts, filterByLocation, RawAlert, ALL_EVENTS } from '@/lib/alerts';
import { District, ALL_DISTRICTS, ALL_CITIES_IN_DISTRICT } from '@/lib/locations';
import RoutePlanner from './RoutePlanner';
import AskTheLion from './AskTheLion';

export default function Home() {
  const [alerts, setAlerts] = useState<RawAlert[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'alerts' | 'route' | 'ai'>('alerts');

  // תאריכים סטטיים: תחילת מבצע שאגת הארי עד היום
  const [startDate] = useState('2026-02-28');
  const [endDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [district, setDistrict] = useState(ALL_DISTRICTS);
  const [city, setCity] = useState(ALL_CITIES_IN_DISTRICT);
  const [activeTab, setActiveTab] = useState(ALL_EVENTS);
  const [viewMode, setViewMode] = useState<'tiles' | 'graph'>('tiles');

  const categories = useMemo(() => {
    const cats = Array.from(new Set(alerts.map(a => a.category_desc))).filter(Boolean);
    return [ALL_EVENTS, ...cats];
  }, [alerts]);

  // Load districts/cities from Pikud Haoref API (dynamic, always up to date)
  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDistricts(data); })
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const from = format(new Date(startDate), 'dd.MM.yyyy');
        const to = format(new Date(endDate), 'dd.MM.yyyy');
        const res = await fetch(`/api/alerts/history?mode=0&fromDate=${from}&toDate=${to}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error);
        if (!Array.isArray(data)) throw new Error('Data format error: expected array');

        setAlerts(data);

        // Ensure activeTab is valid
        if (data.length > 0) {
          const availableCats = [ALL_EVENTS, ...Array.from(new Set(data.map((a: any) => a.category_desc))).filter(Boolean)];
          if (!availableCats.includes(activeTab)) {
            setActiveTab(ALL_EVENTS);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const filteredAlerts = useMemo(() => {
    const locFiltered = filterByLocation(alerts, district, city, districts);
    const isAllEvents = activeTab === ALL_EVENTS;

    return locFiltered.filter(a => {
      if (isAllEvents) {
        return !!a.category_desc;
      }
      return a.category_desc === activeTab;
    })
      .sort((a, b) => {
        try {
          const dateA = parse(`${a.date} ${a.time}`, 'dd.MM.yyyy HH:mm:ss', new Date());
          const dateB = parse(`${b.date} ${b.time}`, 'dd.MM.yyyy HH:mm:ss', new Date());
          return dateB.getTime() - dateA.getTime();
        } catch (e) {
          return 0;
        }
      });
  }, [alerts, district, city, activeTab]);

  const stats = useMemo(() => processAlerts(
    filterByLocation(alerts, district, city, districts),
    new Date(startDate),
    new Date(endDate),
    activeTab
  ), [alerts, district, city, startDate, endDate, activeTab]);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(stats);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AlertStats");
    XLSX.writeFile(workbook, `Alerts_${district}_${city}_${startDate}_${endDate}.xlsx`);
  };

  const totalCount = stats.reduce((acc, curr) => acc + curr.count, 0);

  const availableCities = useMemo(() => {
    const found = districts.find(d => d.name === district);
    return found ? found.cities : [];
  }, [districts, district]);

  return (
    <div className="container" dir="rtl">
      <header>
        <h1>🦁 ניתוח התראות מבצע שאגת הארי</h1>
        <p className="subtitle">ניתוח סטטיסטי של התראות צבע אדום | מ-28.02.2026 עד היום</p>
        <p className="op-info">מבצע שאגת הארי — מבצע צבאי משולב של ישראל וארצות הברית נגד איראן, החל ב-28 בפברואר 2026</p>
        <div className="disclaimer">
          ⚠️ <strong>הצהרת אחריות:</strong> אפליקציה זו היא פרויקט אישי בלבד המבוסס על נתוני צבע אדום.
          אין בה המלצה, הנחיה, או עצה כלשהי. כל החלטה לגבי שימוש במידע זה היא באחריות המשתמש בלבד.
          המפתח אינו אחראי לכל תוצאה שתנבע משימוש באפליקציה.
        </div>
      </header>

      <main>
        {/* Main navigation tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0' }}>
          <button
            onClick={() => setMainTab('alerts')}
            style={{ padding: '0.75rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', borderBottom: mainTab === 'alerts' ? '3px solid var(--primary)' : '3px solid transparent', color: mainTab === 'alerts' ? 'var(--primary)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <AlertTriangle size={18} /> ניתוח אזעקות
          </button>
          <button
            onClick={() => setMainTab('route')}
            style={{ padding: '0.75rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', borderBottom: mainTab === 'route' ? '3px solid var(--primary)' : '3px solid transparent', color: mainTab === 'route' ? 'var(--primary)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            🗺️ תכנון נסיעה בטוחה
          </button>
          {/* 🦁 שאל את האריה — מוסתר זמנית */}
        </div>

        {mainTab === 'route' && <RoutePlanner />}
        {mainTab === 'ai' && <AskTheLion />}
        {mainTab === 'alerts' && (<>
        <div className="card">
          <div className="controls">
            <div className="control-group">
              <label htmlFor="district" className="btn-icon">
                <MapPin size={16} /> מחוז
              </label>
              <select
                id="district"
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setCity(ALL_CITIES_IN_DISTRICT);
                }}
              >
                <option value={ALL_DISTRICTS}>{ALL_DISTRICTS}</option>
                {districts.map(d => (
                  <option key={d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="city" className="btn-icon">
                <MapPin size={16} /> עיר / יישוב
              </label>
              <select
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={district === ALL_DISTRICTS}
              >
                <option value={ALL_CITIES_IN_DISTRICT}>{ALL_CITIES_IN_DISTRICT}</option>
                {availableCities.map(c => (
                  <option key={c.value} value={c.value}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="control-group">
              <button className="primary btn-icon" onClick={() => window.location.reload()}>
                <RefreshCw size={18} /> רענן
              </button>
            </div>
          </div>
        </div>

        <div className="tabs scrollable-tabs">
          {categories.map(cat => (
            <div
              key={cat}
              className={`tab btn-icon ${activeTab === cat ? 'active' : ''}`}
              onClick={() => setActiveTab(cat)}
            >
              <AlertTriangle size={18} /> {cat}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="loader">
            <div className="spinner"></div>
            <p className="m-t-1">טוען נתוני צבע אדום...</p>
          </div>
        ) : error ? (
          <div className="card text-danger">
            שגיאה בטעינת נתונים: {error}
          </div>
        ) : totalCount === 0 && filteredAlerts.length === 0 ? (
          <div className="card empty-state">
            לא נמצאו נתונים לטווח התאריכים והמיקום הנבחר
          </div>
        ) : (
          <>
            <div className="view-controls">
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'tiles' ? 'active' : ''}`}
                  onClick={() => setViewMode('tiles')}
                >
                  <LayoutGrid size={16} /> אריחים
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
                  onClick={() => setViewMode('graph')}
                >
                  <BarChart3 size={16} /> גרף
                </button>
              </div>
            </div>

            {viewMode === 'tiles' ? (
              <div className="stats-grid">
                {stats.map((stat) => (
                  <div key={stat.hour} className="stat-item stats-card">
                    <span className="stat-hour">{stat.hour}</span>
                    <span className="stat-value">{stat.count}</span>
                    <span className="stat-label">התראות</span>
                    <div className="probability-bar">
                      <div
                        className="probability-fill"
                        style={{ '--probability': `${stat.probability}%` } as React.CSSProperties}
                      ></div>
                    </div>
                    <span className="stat-label m-t-1">
                      הסתברות: {stat.probability}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="graph-container card" style={{ height: '400px', padding: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 12 }}
                      interval={2}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [`${value} התראות`, 'כמות']}
                      labelFormatter={(label) => `שעה: ${label}`}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.count > 0 ? 'var(--primary)' : '#e2e8f0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="export-section">
              <p>סה"כ בפרק זמן זה: <strong>{totalCount}</strong> התראות</p>
              <button className="secondary btn-icon" onClick={exportToExcel}>
                <Download size={18} /> ייצוא לאקסל
              </button>
            </div>

            <section className="history-section">
              <div className="history-header">
                <h2><Clock size={20} style={{ verticalAlign: 'middle', marginLeft: '0.5rem' }} /> היסטוריית התראות</h2>
                <span className="badge badge-warning">{filteredAlerts.length} התראות נמצאו</span>
              </div>

              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>תאריך ושעה</th>
                      <th>סוג</th>
                      <th>יישוב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.slice(0, 100).map((alert, idx) => (
                      <tr key={`${alert.rid}-${idx}`}>
                        <td>{alert.date} {alert.time}</td>
                        <td>
                          <span className={`badge ${alert.category === 1 ? 'badge-danger' : 'badge-warning'}`}>
                            {alert.category_desc}
                          </span>
                        </td>
                        <td>
                          <span className="city-tag">{alert.data}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredAlerts.length > 100 && (
                  <div className="text-center p-1 color-muted border-t">
                    מציג 100 התראות אחרונות מתוך {filteredAlerts.length}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
        </> /* end mainTab === alerts */
        )}
      </main>

      <footer className="footer">
        <p>© 2026 מבצע שאגת הארי — ניתוח התראות צבע אדום | פרויקט אישי בלבד | אין אחריות על המידע</p>
      </footer>
    </div>
  );
}
