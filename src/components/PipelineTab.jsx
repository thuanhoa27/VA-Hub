'use client';

import { useEffect, useRef, useState } from 'react';
import { PIPELINE_BODY } from './pipelineBody';
import { ensureECharts, ensureExcelJS, ensurePipelineTracker } from '@/lib/vendor';
import { loadPipelineData } from '@/lib/pipelineData';

/**
 * Host cua module Pipeline Tracker (tab "Pipeline").
 *
 * KIEN TRUC — doc truoc khi sua
 * -----------------------------
 * Module do team khac ban giao la vanilla HTML/CSS/JS, da qua audit isolation
 * (CSS scope duoi #pipeline-root, chi 1 global window.PipelineTracker).
 * Cung triet ly voi BrandHuntApp: KHONG viet lai bang JSX.
 *
 * !! TAI SAO KHONG DUNG dangerouslySetInnerHTML !!
 *
 * TRIEU CHUNG DA GAP (2026-07-29, Chrome, next dev):
 *   Khung dashboard hien ra day du va dung style, nhung MOI gia tri dung nguyen
 *   placeholder "-", moi dropdown chi con "All", 2 chart trong, bang khong co ca
 *   dong "No deals match", VA KHONG CO LOI NAO trong UI.
 *   -> dau hieu dac trung: module tra cuu element bang rootEl.querySelector() va
 *      moi lan deu ra null; vi module co guard `if (el)` / `if (!tbody) return`
 *      khap noi nen no BO QUA IM LANG thay vi nem loi.
 *
 * GIA THUYET (CHUA KIEM CHUNG DUOC):
 *   Khi React so huu subtree qua dangerouslySetInnerHTML, node ma module giu
 *   trong bien rootEl co the bi thay the/detach o mot thoi diem nao do quanh
 *   hydration, nen tro thanh node cu nam ngoai document.
 *
 *   LUU Y THAT THA: scripts/smoke-pipeline-react.cjs render component nay bang
 *   React trong jsdom va PASS CA KHI dung dangerouslySetInnerHTML — tuc la jsdom
 *   KHONG tai hien duoc bug. Khac biet con lai giua jsdom va browser that la
 *   SSR + hydration cua Next.js. Nen day van la gia thuyet, chua phai ket luan.
 *   Neu ai tim ra nguyen nhan that, sua lai comment nay.
 *
 * CACH LAM HIEN TAI (an toan bat ke nguyen nhan that la gi):
 *   React chi so huu 1 div RONG. Markup duoc ghi bang innerHTML ngay trong effect,
 *   truoc khi mount(). React khong co children nao trong div do de reconcile, nen
 *   khong bao gio dieu chinh ben trong -> node ma module giu song dung bang tuoi
 *   cua tab. Ngoai ra assertRendered() o duoi bien moi that bai im lang thanh
 *   banner do co noi dung cu the.
 *
 * Component nay lam 5 viec:
 *   1. Ghi markup goc         -> host.innerHTML = PIPELINE_BODY
 *   2. Nap 3 script vendor    -> ECharts, ExcelJS, pipeline.js
 *   3. Nap data               -> loadPipelineData(): Supabase, lui ve JSON tinh
 *                                neu DB chua san sang -> PipelineTracker.mount()
 *   4. Tu kiem chung da render that chua (xem assertRendered)
 *   5. Go sach khi roi tab    -> PipelineTracker.unmount()
 *
 * KHONG dung chung gi voi src/lib/engine/ — 2 tab doc lap hoan toan.
 * File sinh tu dong (dung sua tay): pipelineBody.js, ../app/pipeline/pipeline.css,
 * public/pipeline/*. Sua o scripts/_source/pipeline/ roi `npm run port:pipeline`.
 */
export default function PipelineTab() {
  const hostRef = useRef(null);
  const bootedRef = useRef(false);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errMsg, setErrMsg] = useState('');
  const [degraded, setDegraded] = useState([]);
  const [source, setSource] = useState(null); // 'db' | 'json'
  const [sourceWarn, setSourceWarn] = useState(null);

  useEffect(() => {
    if (bootedRef.current) return; // chan mount 2 lan -> double-bind listener
    bootedRef.current = true;

    let cancelled = false;
    const host = hostRef.current;

    (async () => {
      try {
        if (!host) throw new Error('khong tim thay div host');

        // (1) Ghi markup TRUOC khi nap script. React khong quan ly ben trong day.
        host.innerHTML = PIPELINE_BODY;
        const root = host.querySelector('#pipeline-root');
        if (!root) throw new Error('PIPELINE_BODY khong chua #pipeline-root — chay lai `npm run port:pipeline`');

        // (2) ECharts/ExcelJS la optional — module tu degrade neu thieu.
        const missing = [];
        const [tracker] = await Promise.all([
          ensurePipelineTracker(),
          ensureECharts().catch(() => { missing.push('Charts (ECharts)'); }),
          ensureExcelJS().catch(() => { missing.push('Export Excel (ExcelJS)'); }),
        ]);

        // (3) Data — uu tien Supabase, tu lui ve file tinh neu DB chua san sang.
        //     Xem src/lib/pipelineData.js muc FALLBACK: deploy code va chay
        //     migration KHONG can dong bo, tab luon co data de render.
        const { data, source: dataSource, warning } = await loadPipelineData();
        if (!data || !Array.isArray(data.deals)) throw new Error('khong lay duoc mang `deals`');
        if (warning) console.warn('[PipelineTab]', warning);

        if (cancelled) return;

        tracker.mount(root, data);

        // (4) Tu kiem chung: mount() im lang khi khong tim thay element, nen phai
        //     kiem lai bang mat thay vi tin no da chay. Day chinh la loi da xay ra.
        assertRendered(root, data);

        setSource(dataSource);
        setSourceWarn(warning);
        setDegraded(missing);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        console.error('[PipelineTab]', e);
        setErrMsg(e?.message || String(e));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (typeof window !== 'undefined' && window.PipelineTracker) {
          window.PipelineTracker.unmount();
        }
      } catch (e) {
        /* khong de loi cleanup lam vo viec chuyen trang */
      }
      if (host) host.innerHTML = ''; // React khong quan ly subtree nay -> tu don
      bootedRef.current = false;
    };
  }, []);

  return (
    <>
      {status === 'loading' && (
        <div className="px-7 py-6 text-[13px] text-op-ink2">Đang tải Pipeline Tracker…</div>
      )}

      {status === 'error' && (
        <div className="mx-7 my-6 rounded-lg border border-op-neg bg-op-redL px-4 py-3 text-[13px] text-op-neg">
          <strong className="font-semibold">Không tải được tab Pipeline.</strong> {errMsg}
        </div>
      )}

      {status === 'ready' && source === 'json' && (
        <div className="mx-7 mt-4 rounded-lg border border-op-warn bg-white px-4 py-2.5 text-[12.5px] text-op-warn">
          <strong className="font-semibold">Đang đọc file tĩnh, không phải database.</strong>{' '}
          {sourceWarn} Sửa deal sẽ cần deploy lại cho tới khi chạy xong 0003/0004 trên Supabase.
        </div>
      )}

      {degraded.length > 0 && (
        <div className="mx-7 mt-4 rounded-lg border border-op-warn bg-white px-4 py-2.5 text-[12.5px] text-op-warn">
          Thiếu thư viện nên các tính năng sau bị tắt: {degraded.join(', ')}. Phần còn lại vẫn hoạt động.
        </div>
      )}

      {/*
        React chi so huu div RONG nay. Markup do effect ghi vao bang innerHTML.
        DUNG them children hay dangerouslySetInnerHTML vao day — xem comment dau file.
      */}
      <div ref={hostRef} />
    </>
  );
}

/**
 * Kiem chung mount() da render THAT su, khong chi "khong nem loi".
 *
 * Module dung guard `if (el)` khap noi, nen khi rootEl sai thi no im lang bo qua
 * va de nguyen placeholder — trieu chung rat kho doan neu khong kiem tra chu dong.
 * Nem loi o day de banner do hien ra thay vi user ngoi doan tai sao bang trong.
 */
function assertRendered(root, data) {
  const kpi = root.querySelector('#pl-kpi-nmv-fc');
  if (!kpi) throw new Error('mount() xong nhung khong thay #pl-kpi-nmv-fc trong DOM');
  if (kpi.textContent.trim() === '-') {
    throw new Error('mount() xong nhung KPI van la placeholder "-" — module khong ghi duoc vao DOM');
  }
  const rows = root.querySelectorAll(
    '#pl-tbl-go-live tbody tr, #pl-tbl-verbal tbody tr, #pl-tbl-potential tbody tr'
  ).length;
  if (data.deals.length > 0 && rows === 0) {
    throw new Error(`co ${data.deals.length} deal trong data nhung bang render 0 dong`);
  }
}
