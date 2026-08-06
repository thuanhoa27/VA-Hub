'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Dang nhap khong thanh cong.');
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError('Loi mang: ' + String(err.message || err));
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F7FA' }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: '#fff', padding: 32, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.1)', width: 320 }}
      >
        <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#1F2A37' }}>
          OnPoint · Brand Hunt &amp; Tier Analyzer
        </h1>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#1F2A37' }}>Mat khau</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 6,
            marginBottom: 12,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #D9DEE7',
            fontSize: 13,
          }}
        />
        {error && <div style={{ color: '#B3261E', fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
        <button
          type="submit"
          disabled={busy || !password}
          style={{
            width: '100%',
            padding: '9px 0',
            borderRadius: 6,
            border: 'none',
            background: busy || !password ? '#9AA6B2' : '#0B2A4A',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13.5,
            cursor: busy || !password ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Dang kiem tra…' : 'Vao'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
