'use client';
import { useState, useRef, useEffect } from 'react';

interface Message { role: 'user' | 'ai'; text: string; }

export default function AskTheLion() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'שלום! אני Qwen 2.5 — המודל המקומי של מבצע שאגת הארי 🦁\nשאל אותי כל שאלה.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: prompt }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(m => [...m, { role: 'ai', text: data.response }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: 'ai', text: `שגיאה: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
        🦁 שאל את האריה
        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', background: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
          qwen2.5:7b · מודל מקומי
        </span>
      </h2>

      {/* Chat window */}
      <div style={{ height: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: m.role === 'user' ? 'flex-start' : 'flex-end',
          }}>
            <div style={{
              maxWidth: '80%', padding: '0.65rem 1rem', borderRadius: m.role === 'user' ? '1rem 1rem 1rem 0.2rem' : '1rem 1rem 0.2rem 1rem',
              background: m.role === 'user' ? '#2563eb' : 'white',
              color: m.role === 'user' ? 'white' : '#0f172a',
              border: m.role === 'ai' ? '1px solid #e2e8f0' : 'none',
              fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.07)'
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem 1rem 0.2rem 1rem', padding: '0.65rem 1rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1s infinite' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1s infinite 0.2s' }} />
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1s infinite 0.4s' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="שאל שאלה... (Enter לשליחה)"
          disabled={loading}
          style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '1rem', background: loading ? '#f8fafc' : 'white' }}
        />
        <button onClick={send} disabled={loading || !input.trim()} className="primary"
          style={{ padding: '0.75rem 1.25rem', borderRadius: '0.5rem', fontWeight: 700, opacity: loading || !input.trim() ? 0.6 : 1 }}>
          {loading ? '...' : 'שלח'}
        </button>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
        ⚠️ המודל רץ על השרת המקומי — לא זמין בסביבת פיתוח מקומית
      </p>
    </div>
  );
}
