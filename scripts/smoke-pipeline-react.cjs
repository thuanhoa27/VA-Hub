/**
 * smoke-pipeline-react.cjs — test TICH HOP: render PipelineTab.jsx that bang React
 * trong jsdom, roi kiem xem module co render duoc data ra DOM khong.
 *
 * Chay:  node scripts/smoke-pipeline-react.cjs
 *        (can: npm i --no-save jsdom   — sucrase/react-dom da co san)
 *
 * TAI SAO CAN FILE NAY
 * --------------------
 * smoke-pipeline.mjs goi PipelineTracker.mount() truc tiep -> pass 26/26, nhung
 * tab van trang khi chay that. Loi khong nam trong module ma nam o lop host, nen
 * phai co mot test di qua dung lop host that.
 *
 * !! GIOI HAN DA BIET — DUNG TIN FILE NAY QUA MUC !!
 * Test nay KHONG tai hien duoc bug "khung trong, placeholder cong" da gap tren
 * Chrome: no PASS ca khi PipelineTab dung dangerouslySetInnerHTML (bug cu).
 * Ly do gan nhu chac chan: jsdom render thuan client, khong co SSR + hydration
 * cua Next.js — va do la khac biet duy nhat con lai voi moi truong that.
 *
 * Vi vay file nay chi bao dam duoc: hop dong data/ID giua PipelineTab va module
 * con dung, KPI hybrid hoat dong qua React, listener con song sau khi React
 * render, unmount khong nem loi. No KHONG thay the duoc viec mo bang trinh duyet
 * that. Muon chan han bug class nay thi phai them Playwright chay tren next dev.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { transform } = require('sucrase');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/* ---- cho phep require file JSX/ESM trong src/, va alias "@/" ---- */
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) request = path.join(SRC, request.slice(2));
  return origResolve.call(this, request, ...rest);
};
const compileSrc = (module, filename) => {
  const code = fs.readFileSync(filename, 'utf8');
  const out = transform(code, {
    transforms: ['jsx', 'imports'],
    jsxRuntime: 'automatic',
    filePath: filename,
  }).code;
  module._compile(out, filename);
};
const origJs = require.extensions['.js'];
require.extensions['.jsx'] = compileSrc;
require.extensions['.js'] = (module, filename) =>
  filename.startsWith(SRC) ? compileSrc(module, filename) : origJs(module, filename);

/* ---- jsdom + globals ---- */
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost:3000/pipeline',
});
const { window } = dom;
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'getComputedStyle']) {
  global[k] = window[k];
}
global.IS_REACT_ACT_ENVIRONMENT = true;

/* ---- Nap san 3 "vendor" vao window.
       vendor.js co `if (window[globalName]) return Promise.resolve(...)`, nen khi
       da co san no khong chen <script> (jsdom khong chay script ngoai). ---- */
const PIPELINE_JS = fs.readFileSync(path.join(ROOT, 'public', 'pipeline', 'pipeline.js'), 'utf8');
window.eval(PIPELINE_JS); // -> window.PipelineTracker

const chartStub = () => ({ setOption() {}, resize() {}, dispose() {}, on() {} });
window.echarts = { init: chartStub, use() {} };
window.ExcelJS = { Workbook: function () { this.addWorksheet = () => ({}); } };

/* ---- fetch stub: tra ve dung file pipeline.json that ---- */
const DATA_RAW = fs.readFileSync(path.join(ROOT, 'public', 'pipeline', 'data', 'pipeline.json'), 'utf8');
const DATA = JSON.parse(DATA_RAW);
let fetchCalls = 0;
global.fetch = async (url) => {
  fetchCalls++;
  if (String(url).includes('pipeline.json')) {
    return { ok: true, status: 200, json: async () => JSON.parse(DATA_RAW) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
window.fetch = global.fetch;

/* ---- render ---- */
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const PipelineTab = require(path.join(SRC, 'components', 'PipelineTab.jsx')).default;

let pass = 0;
const fails = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fails.push(`${name}${extra ? ' — ' + extra : ''}`); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const container = window.document.getElementById('app');
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(PipelineTab)); });

  /*
    Effect chay async (nap vendor + fetch) -> phai doi settle.
    Doi CA HAI dieu kien: module da ghi KPI, VA React da flush setStatus('ready')
    de an dong "Dang tai". Chi doi 1 trong 2 la test bao dong sai (da tung xay ra:
    KPI render xong truoc khi React re-render).
  */
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    await act(async () => { await sleep(25); });
    const kpi = container.querySelector('#pl-kpi-nmv-fc');
    const rendered = kpi && kpi.textContent.trim() !== '-';
    const settled = !container.textContent.includes('Đang tải Pipeline Tracker');
    if (rendered && settled) break;
    if (container.textContent.includes('Không tải được tab Pipeline')) break;
  }

  const q = (sel) => container.querySelector(sel);
  const txt = (sel) => q(sel)?.textContent?.trim();
  const rows = (t) => container.querySelectorAll(`#pl-tbl-${t} tbody tr:not(.pl-empty-row)`).length;

  console.log('\n[React integration] PipelineTab render qua React');
  ok('khong hien banner loi', !container.textContent.includes('Không tải được tab Pipeline'),
    container.textContent.match(/Không tải được tab Pipeline\.?\s*(.{0,90})/)?.[1] || '');
  ok('khong con o trang thai loading', !container.textContent.includes('Đang tải Pipeline Tracker'));
  ok('co fetch pipeline.json', fetchCalls > 0);
  ok('#pipeline-root ton tai trong DOM', !!q('#pipeline-root'));
  ok('#pipeline-root nam TRONG document (khong bi detach)',
    !!q('#pipeline-root') && window.document.contains(q('#pipeline-root')));

  // Day la assertion da bat duoc bug that: KPI khong duoc la placeholder "-"
  ok('KPI KHONG con la placeholder "-"', txt('#pl-kpi-nmv-fc') !== '-', `nhan duoc "${txt('#pl-kpi-nmv-fc')}"`);
  ok('KPI = so official 34.00 BIL', txt('#pl-kpi-nmv-fc') === '34.00 BIL', `nhan duoc "${txt('#pl-kpi-nmv-fc')}"`);
  ok('badge o che do Official', /Official figures/.test(txt('#pl-kpi-mode') || ''), `nhan duoc "${txt('#pl-kpi-mode')}"`);
  ok('bang render du 8 dong (2/3/3)', rows('go-live') === 2 && rows('verbal') === 3 && rows('potential') === 3,
    `nhan duoc ${rows('go-live')}/${rows('verbal')}/${rows('potential')}`);

  // dropdown phai duoc JS dien tu validationLists, khong chi con "All"
  const tierOpts = [...(q('#pl-f-tier')?.options || [])].map((o) => o.value);
  ok('dropdown Tier da duoc dien (> 1 option)', tierOpts.length > 1, `co: ${tierOpts.join(', ') || 'rong'}`);
  ok('dropdown Tier co Tier 3', tierOpts.includes('Tier 3'));
  const cdOpts = [...(q('#pl-f-cd')?.options || [])].map((o) => o.value);
  ok('dropdown CD da duoc dien', cdOpts.length > 1, `co: ${cdOpts.join(', ') || 'rong'}`);

  // doi filter qua React van phai hoat dong (listener con song)
  const sel = q('#pl-f-stage');
  sel.value = 'Go Live';
  await act(async () => { sel.dispatchEvent(new window.Event('change', { bubbles: true })); await sleep(50); });
  ok('doi filter -> badge chuyen Filtered', /^Filtered/.test(txt('#pl-kpi-mode') || ''), `nhan duoc "${txt('#pl-kpi-mode')}"`);
  const glVnd = DATA.deals.filter((d) => d.stage === 'Go Live').reduce((s, d) => s + d.vnd, 0);
  ok(`doi filter -> KPI = ${(glVnd / 1e9).toFixed(2)} BIL`, txt('#pl-kpi-nmv-fc') === (glVnd / 1e9).toFixed(2) + ' BIL',
    `nhan duoc "${txt('#pl-kpi-nmv-fc')}"`);

  // unmount qua React phai go sach, khong nem loi
  let unmountThrew = false;
  try { await act(async () => { root.unmount(); }); } catch (e) { unmountThrew = true; }
  ok('React unmount khong nem loi', !unmountThrew);

  console.log(`\n${'='.repeat(52)}`);
  console.log(`PASS ${pass} / ${pass + fails.length}`);
  if (fails.length) {
    console.log('\nFAIL:');
    fails.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('Tat ca assertion pass.');
  process.exit(0);
})();
