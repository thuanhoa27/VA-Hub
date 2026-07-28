'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SHELL_BODY } from './shellBody';
import { loadReferenceData, saveRun } from '@/lib/data';
import { isConfigured } from '@/lib/supabase/client';
import { ensureXLSX } from '@/lib/vendor';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'dev';
const RUN_BY_KEY = 'bh_run_by';

/**
 * Host cua engine phan tich.
 *
 * KIEN TRUC — doc truoc khi sua
 * -----------------------------
 * Engine (src/lib/engine/index.js) la ban ghep nguyen ven 3 file JS da chay
 * production va dang duoc 298 assertion khoa lai. No sinh HTML dang chuoi va
 * tu ghi vao #p1 / #p2 / #p3, dung inline onclick.
 *
 * Component nay KHONG ve lai giao dien do bang JSX. No lam 4 viec:
 *   1. Nap reference data tu Supabase  -> setData()
 *   2. Mount khung HTML goc            -> dangerouslySetInnerHTML
 *   3. Gan ham engine len window       -> attachGlobals()  (cho inline onclick)
 *   4. Nghe callback sau moi lan phan tich -> ghi 1 dong analysis_run
 *
 * Doi nguoc lai (viet lai bang JSX) la viec lon va phai dung lai toan bo
 * test suite chong ro ri thong tin noi bo. Chua nen lam.
 */
export default function BrandHuntApp() {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const bootedRef = useRef(false);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errMsg, setErrMsg] = useState('');
  const [runBy, setRunBy] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [saveErr, setSaveErr] = useState('');

  const shellHtml = useMemo(() => ({ __html: SHELL_BODY }), []);

  // ten VA duoc nho lai o may — app public nen khong co login de lay tu dau
  useEffect(() => {
    try {
      setRunBy(window.localStorage.getItem(RUN_BY_KEY) || '');
    } catch (e) {
      /* trinh duyet chan storage — bo qua, chi mat tinh nang nho ten */
    }
  }, []);

  const runByRef = useRef('');
  useEffect(() => {
    runByRef.current = runBy;
    try {
      window.localStorage.setItem(RUN_BY_KEY, runBy);
    } catch (e) {
      /* bo qua */
    }
  }, [runBy]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    let cancelled = false;

    (async () => {
      if (!isConfigured) {
        setStatus('error');
        setErrMsg(
          'Chua cau hinh Supabase. Tao file .env.local (chay may) hoac them bien moi truong tren Vercel: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.'
        );
        return;
      }

      // 1. reference data
      const { data, error } = await loadReferenceData();
      if (cancelled) return;
      if (error) {
        setStatus('error');
        setErrMsg('Khong nap duoc data tu Supabase: ' + error);
        return;
      }

      // 2. engine — import dong vi no dung window/document ngay khi load
      const engine = await import('@/lib/engine');
      if (cancelled) return;
      engineRef.current = engine;

      engine.setData(data);

      // 3. callback ghi analysis_run sau moi lan renderStep3 / export deck
      engine.setOnRun(async () => {
        try {
          const row = engine.snapshotRun({
            runBy: runByRef.current || null,
            appVersion: APP_VERSION,
          });
          const { error: e } = await saveRun(row);
          if (e) setSaveErr(e);
          else {
            setSaveErr('');
            setSavedCount((c) => c + 1);
          }
        } catch (err) {
          console.error('[BrandHuntApp] snapshotRun that bai', err);
          setSaveErr(String(err.message || err));
        }
      });

      engine.attachGlobals();
      setStatus('ready');

      // 4. nap truoc SheetJS o nen — VA se can no ngay khi upload brief.
      //    Loi o day khong chan gi: ensureXLSX() se thu lai luc that su dung.
      ensureXLSX().catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* thanh phu: ai dang chay + trang thai ghi DB */}
      <div className="border-b border-op-line bg-white px-7 py-2">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3">
          <label className="text-[12.5px] font-semibold text-op-ink">Run by</label>
          <input
            value={runBy}
            onChange={(e) => setRunBy(e.target.value)}
            placeholder="ten hoac email cua ban"
            className="w-56 rounded-md border border-op-line px-2.5 py-1.5 text-[13px] text-op-ink outline-none focus:border-op-blue"
          />
          <span className="text-[12px] text-op-ink2">
            App chay public — ten nay chi de truy vet ai da chay phan tich nao.
          </span>

          <span className="ml-auto flex items-center gap-3 text-[12px]">
            {status === 'loading' && <Badge tone="neutral">Dang nap data…</Badge>}
            {status === 'ready' && <Badge tone="ok">Data: Supabase</Badge>}
            {status === 'error' && <Badge tone="bad">Loi data</Badge>}
            {savedCount > 0 && <Badge tone="ok">Da luu {savedCount} lan chay</Badge>}
            {saveErr && <Badge tone="bad">Khong luu duoc: {saveErr}</Badge>}
          </span>
        </div>
      </div>

      {status === 'error' && (
        <div className="mx-auto mt-6 max-w-[1180px] px-6">
          <div className="rounded-lg border border-op-red bg-op-redL px-5 py-4 text-[13.5px] text-op-neg">
            <b>Khong khoi dong duoc app.</b>
            <div className="mt-1.5">{errMsg}</div>
            <div className="mt-2 text-op-ink2">
              Xem muc &ldquo;Xu ly su co&rdquo; trong README.md.
            </div>
          </div>
        </div>
      )}

      {/* Khung goc cua dashboard. Engine ghi truc tiep vao #p1/#p2/#p3 ben trong. */}
      <div
        ref={hostRef}
        style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
        dangerouslySetInnerHTML={shellHtml}
      />
    </>
  );
}

function Badge({ tone, children }) {
  const cls =
    tone === 'ok'
      ? 'bg-[#E7F4EE] text-op-pos'
      : tone === 'bad'
        ? 'bg-op-redL text-op-neg'
        : 'bg-[#F2F4F7] text-op-ink2';
  return <span className={`rounded px-2 py-1 font-semibold ${cls}`}>{children}</span>;
}
