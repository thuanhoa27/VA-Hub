/**
 * Nap thu vien vendor tu /public/vendor/ luc runtime, chi khi can.
 *
 * SheetJS (xlsx.full.min.js, ~880 KB)   — can khi VA upload brief .xlsx
 * PptxGenJS (pptxgen.bundle.js, ~460 KB) — can khi bam Export Brand Proposal
 *
 * Truoc day 2 file nay nhung cung trong BrandHunt_App_LIVE.html: 1.1 MB / 1.5 MB
 * tong dung luong, tai het moi lan mo trang. Gio tach ra thanh static asset,
 * tai theo nhu cau va duoc CDN cua Vercel cache.
 */

const cache = new Map();

function loadScript(src, globalName) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('[vendor] chi nap duoc o phia trinh duyet'));
  }
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (cache.has(src)) return cache.get(src);

  const p = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => {
      if (window[globalName]) resolve(window[globalName]);
      else reject(new Error(`[vendor] ${src} nap xong nhung khong thay window.${globalName}`));
    };
    el.onerror = () => {
      cache.delete(src); // cho phep thu lai
      reject(new Error(`[vendor] khong tai duoc ${src}`));
    };
    document.head.appendChild(el);
  });

  cache.set(src, p);
  return p;
}

/** SheetJS — bat buoc co truoc khi parse file brief. */
export const ensureXLSX = () => loadScript('/vendor/xlsx.full.min.js', 'XLSX');

/** PptxGenJS + JSZip — bat buoc co truoc khi export deck. */
export const ensurePptxGenJS = () => loadScript('/vendor/pptxgen.bundle.js', 'PptxGenJS');

/* ------------------------------------------------------------------
   Tab Pipeline (/pipeline) — 3 script duoi day chi nap khi mo tab do.
   Trang phan tich BrandHunt khong tai gi them.
   ------------------------------------------------------------------ */

/**
 * ECharts 5.5.0 — 2 chart cua tab Pipeline.
 * Vendor thay vi CDN: khoa dung version module da test, va chay duoc ca khi
 * mang cong ty chan cdnjs. Neu thieu, pipeline.js bo qua chart va van render
 * phan con lai (KPI/bang/filter/export).
 */
export const ensureECharts = () => loadScript('/vendor/echarts.min.js', 'echarts');

/**
 * ExcelJS 4.4.0 — chi can cho nut "Export Excel" cua tab Pipeline.
 * Day la thu vien KHAC voi SheetJS o tren; ca hai cung ton tai, khong xung dot
 * global (XLSX vs ExcelJS). Neu thieu, nut export bi disable co kem title.
 */
export const ensureExcelJS = () => loadScript('/vendor/exceljs.min.js', 'ExcelJS');

/**
 * Module Pipeline Tracker (vanilla, khong phai ES module) — expose
 * window.PipelineTracker. File sinh boi scripts/port-pipeline.mjs.
 */
export const ensurePipelineTracker = () => loadScript('/pipeline/pipeline.js', 'PipelineTracker');
