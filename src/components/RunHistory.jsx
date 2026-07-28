'use client';

import { useEffect, useMemo, useState } from 'react';
import { listRuns } from '@/lib/data';
import { isConfigured } from '@/lib/supabase/client';

/**
 * Trang bao cao — thu dashboard HTML cu KHONG co: no khong luu lai gi ca.
 * Moi lan VA bam Analyze, analysis_run co them 1 dong; man hinh nay doc lai
 * de tra loi: thang nay hunt bao nhieu brand, bao nhieu vao P1, brief nao fail gate.
 */
export default function RunHistory() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [fPrio, setFPrio] = useState('');
  const [fFlow, setFFlow] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      if (!isConfigured) {
        setErr('Chua cau hinh Supabase — xem README.md.');
        setLoading(false);
        return;
      }
      const { rows: r, error } = await listRuns({ limit: 500 });
      if (error) setErr(error);
      setRows(r);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!fPrio || r.prio === fPrio) &&
          (!fFlow || r.flow === fFlow) &&
          (!q || String(r.brand_name || '').toLowerCase().includes(q.toLowerCase()))
      ),
    [rows, fPrio, fFlow, q]
  );

  const kpi = useMemo(() => {
    const brands = new Set(filtered.map((r) => r.brand_name).filter(Boolean));
    const p1 = filtered.filter((r) => r.prio === 'P1').length;
    const decks = filtered.filter((r) => r.exported_pptx).length;
    const gateFail = filtered.filter((r) => r.brief_valid === false).length;
    const scores = filtered.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n) && n !== 0);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
    return { runs: filtered.length, brands: brands.size, p1, decks, gateFail, avg };
  }, [filtered]);

  const csv = () => {
    const cols = [
      'created_at', 'brand_name', 'group_brand', 'category_1', 'flow', 'tier',
      'score', 'band', 'prio', 'model', 'gmv_ti', 'target_gap_pct',
      'brief_valid', 'exported_pptx', 'run_by',
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = [cols.join(','), ...filtered.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
    // BOM de Excel doc dung tieng Viet co dau
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `BrandHunt_runs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold text-op-ink">Run History</h1>
          <p className="mt-1 text-[13px] text-op-ink2">
            Moi lan chay phan tich deu duoc ghi lai — dung de bao cao hoat dong hunting theo thang.
          </p>
        </div>
        <button
          onClick={csv}
          className="ml-auto cursor-pointer rounded-lg border border-op-line bg-white px-3.5 py-2 text-[13px] font-semibold text-op-ink hover:border-op-blue hover:text-op-blueD"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Kpi label="Runs" value={kpi.runs} />
        <Kpi label="Brands" value={kpi.brands} />
        <Kpi label="P1" value={kpi.p1} accent />
        <Kpi label="Avg score" value={kpi.avg} />
        <Kpi label="Decks exported" value={kpi.decks} />
        <Kpi label="Gate failed" value={kpi.gateFail} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tim brand…"
          className="w-56 rounded-md border border-op-line px-2.5 py-1.5 text-[13px] outline-none focus:border-op-blue"
        />
        <Select value={fPrio} onChange={setFPrio} options={['', 'P1', 'P2', 'P3']} labels={{ '': 'All priority' }} />
        <Select
          value={fFlow}
          onChange={setFFlow}
          options={['', 'new', 'existing', 'repitch']}
          labels={{ '': 'All flow' }}
        />
        <span className="text-[12px] text-op-ink2">{filtered.length} dong</span>
      </div>

      {err && (
        <div className="rounded-lg border border-op-red bg-op-redL px-4 py-3 text-[13px] text-op-neg">{err}</div>
      )}
      {loading && <div className="text-[13px] text-op-ink2">Dang tai…</div>}

      {!loading && !err && (
        <div className="overflow-x-auto rounded-xl border border-op-line bg-white shadow-sm">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-op-blueD text-left text-white">
                {['Date', 'Brand', 'Cat 1', 'Flow', 'Tier', 'Score', 'Band', 'Priority', 'Model', 'GMV (bn)', 'Gap', 'Gate', 'Deck', 'Run by'].map(
                  (h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-op-line/60">
                  <td className="whitespace-nowrap px-3 py-2 text-op-ink2">
                    {new Date(r.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-3 py-2 font-semibold text-op-ink">{r.brand_name || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-op-ink2">{r.category_1 || '—'}</td>
                  <td className="px-3 py-2">{r.flow}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.tier || '—'}</td>
                  <td className="px-3 py-2">{r.score ?? '—'}</td>
                  <td className="px-3 py-2">{r.band || '—'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        'rounded px-1.5 py-0.5 text-[11.5px] font-bold ' +
                        (r.prio === 'P1'
                          ? 'bg-op-redL text-op-red'
                          : r.prio === 'P2'
                            ? 'bg-op-blueL text-op-blue'
                            : 'bg-[#F2F4F7] text-op-ink2')
                      }
                    >
                      {r.prio || '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-op-ink2">{r.model || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {r.gmv_ti != null ? Number(r.gmv_ti).toLocaleString('en-US') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.target_gap_pct != null ? (Number(r.target_gap_pct) * 100).toFixed(1) + '%' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {r.brief_valid === null ? '—' : r.brief_valid ? '✓' : 'blocked'}
                  </td>
                  <td className="px-3 py-2">{r.exported_pptx ? '✓' : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-op-ink2">{r.run_by || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-3 py-8 text-center text-op-ink2">
                    Chua co lan chay nao khop bo loc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div
      className={
        'rounded-lg border bg-white px-4 py-3 shadow-sm ' +
        (accent ? 'border-op-red' : 'border-op-line')
      }
    >
      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-op-ink2">{label}</div>
      <div className={'mt-1 text-[21px] font-extrabold ' + (accent ? 'text-op-red' : 'text-op-ink')}>
        {value}
      </div>
    </div>
  );
}

function Select({ value, onChange, options, labels = {} }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-op-line bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-op-blue"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o] ?? o}
        </option>
      ))}
    </select>
  );
}
