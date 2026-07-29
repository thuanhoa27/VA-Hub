/**
 * smoke-pipeline-data.mjs — test lop adapter src/lib/pipelineData.js
 * (DB Supabase -> shape ma module pipeline.js doc).
 *
 * Chay:  node scripts/smoke-pipeline-data.mjs      (can jsdom cho test [8])
 *
 * TAI SAO CAN FILE NAY
 * --------------------
 * Doi nguon data tu file tinh sang Supabase la cho de vo AM THAM nhat:
 *   - Postgres tra `numeric` ve duoi dang STRING trong JSON. Khong Number()
 *     thi KPI NOI CHUOI thay vi cong so — man hinh hien mot so khong lo, khong
 *     bao loi. Test [4] chan cho nay.
 *   - Module doc `dateISO` (camelCase) con DB la `date_iso`. Lech ten = filter
 *     Day/Week im lang tra 0 dong. Test [2][3].
 *   - Chua chay migration -> phai LUI ve file tinh, khong duoc trang. Test [6].
 *
 * Test [8] khong chi so shape ma dua output cua adapter vao PipelineTracker
 * that trong jsdom: "shape dung" khong bao dam "render duoc".
 *
 * KHONG dung sucrase/babel: file nay tu ghep 1 ban copy cua pipelineData.js
 * voi stub Supabase roi import — nen chay duoc voi node tran.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-data-'));

/* ------------------------------------------------------------------ *
   1. Nap pipelineData.js voi Supabase client bi thay bang stub.
      Moi lan goi = 1 module moi -> dat duoc isConfigured khac nhau.
 * ------------------------------------------------------------------ */
const STUB_SRC = `
// Stub cho @/lib/supabase/client. Doc globalThis.__PL_TABLES luc goi.
function result(table, single) {
  const t = (globalThis.__PL_TABLES || {})[table];
  if (t === undefined) return { data: single ? null : [], error: null };
  if (t && t.__throw) throw new Error(t.__throw);
  if (t && t.__error) return { data: null, error: { message: t.__error } };
  return { data: t, error: null };
}
function builder(table) {
  // supabase-js tra ve mot thenable (khong phai Promise) -> await duoc.
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (res, rej) => Promise.resolve().then(() => result(table)).then(res, rej),
    maybeSingle: () => Promise.resolve().then(() => result(table, true)),
  };
  return chain;
}
export const supabase = { from: builder };
export const isConfigured = __IS_CONFIGURED__;
`;

let seq = 0;
async function loadAdapter({ isConfigured = true } = {}) {
  const id = ++seq;
  const stubPath = path.join(TMP, `stub${id}.mjs`);
  const modPath = path.join(TMP, `pipelineData${id}.mjs`);
  fs.writeFileSync(stubPath, STUB_SRC.replace('__IS_CONFIGURED__', String(isConfigured)), 'utf8');

  const code = fs.readFileSync(path.join(SRC, 'lib', 'pipelineData.js'), 'utf8');
  const patched = code.replace(
    /from\s+'@\/lib\/supabase\/client'/,
    `from ${JSON.stringify(pathToFileURL(stubPath).href)}`
  );
  if (patched === code) throw new Error('khong tim thay import @/lib/supabase/client trong pipelineData.js');
  fs.writeFileSync(modPath, patched, 'utf8');
  return import(pathToFileURL(modPath).href);
}

/* ------------------------------------------------------------------ *
   2. Fixture — dung chinh pipeline.json lam nguon su that
 * ------------------------------------------------------------------ */
const STATIC_JSON = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public', 'pipeline', 'data', 'pipeline.json'), 'utf8')
);
const K = STATIC_JSON._meta.officialKpi;

const fakeFetch = (ok = true) => async () => ({
  ok,
  status: ok ? 200 : 404,
  json: async () => STATIC_JSON,
});

/** Dong DB mo phong PostgREST: numeric -> string, date_iso null khi TBU. */
const dbRow = (d, i) => ({
  id: i + 1, scope: 'VA_DISTRIBUTION',
  stage: d.stage, no: d.no, brand: d.brand, brand_key: d.brand_key,
  tier: d.tier, model: d.model, cd: d.cd, elephant: d.elephant, cat: d.cat,
  va: d.va, channel: d.channel, status: d.status, month: d.month,
  date_text: d.date, date_iso: d.dateISO,
  usd: String(d.usd), vnd: String(d.vnd),
  is_active: true, sort_order: i + 1, note: null, updated_at: '2026-07-29T00:00:00Z',
});

const TABLES_OK = {
  pipeline_deal: STATIC_JSON.deals.map(dbRow),
  pipeline_validation_list: Object.entries(STATIC_JSON.validationLists).flatMap(([list_name, vals]) =>
    vals.map((value, i) => ({ list_name, value, sort_order: i + 1 }))
  ),
  pipeline_meta: {
    scope: 'VA_DISTRIBUTION', as_of: K.as_of, source: K.source,
    total_nmv_vnd: String(K.totalNmvVnd), go_live_nmv_vnd: String(K.goLiveNmvVnd),
    brand_go_live: K.brandGoLive, brand_verbal: K.brandVerbal, brand_potential: K.brandPotential,
    note: null, updated_at: '2026-07-29T00:00:00Z',
  },
};

/* ------------------------------------------------------------------ *
   3. Assert
 * ------------------------------------------------------------------ */
let pass = 0;
const fails = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fails.push(`${name}${extra ? ' — ' + extra : ''}`); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

async function main() {
  const A = await loadAdapter();

  /* ---- [1] Happy path ---- */
  console.log('\n[1] DB co data');
  globalThis.__PL_TABLES = TABLES_OK;
  const r1 = await A.loadPipelineData({ fetchImpl: fakeFetch() });
  ok('source = db', r1.source === 'db', `nhan duoc "${r1.source}"`);
  ok('khong co warning', r1.warning === null, String(r1.warning));
  ok(`du ${STATIC_JSON.deals.length} deal`, r1.data.deals.length === STATIC_JSON.deals.length);

  /* ---- [2] Khop tung field voi file tinh ---- */
  console.log('\n[2] Deal khop TUNG FIELD voi pipeline.json');
  const FIELDS = ['stage','no','brand','brand_key','tier','model','cd','elephant','cat','va','channel','status','month','date','dateISO','usd','vnd'];
  const diffs = [];
  r1.data.deals.forEach((got, i) => {
    const want = STATIC_JSON.deals[i];
    FIELDS.forEach((f) => {
      if (got[f] !== want[f]) diffs.push(`deal[${i}].${f}: got ${JSON.stringify(got[f])} want ${JSON.stringify(want[f])}`);
    });
  });
  ok(`${FIELDS.length} field x ${STATIC_JSON.deals.length} deal khop 100%`, diffs.length === 0, diffs.slice(0, 3).join(' | '));
  ok('khong ro ri ten cot snake_case', !('date_iso' in r1.data.deals[0]) && !('date_text' in r1.data.deals[0]));

  /* ---- [3] TBU ---- */
  console.log('\n[3] Dong TBU giu dateISO = null');
  const tbu = r1.data.deals.filter((d) => d.date === 'TBU');
  ok(`co ${tbu.length} dong TBU trong fixture`, tbu.length > 0);
  ok('moi dong TBU co dateISO = null', tbu.every((d) => d.dateISO === null));

  /* ---- [4] numeric -> number ---- */
  console.log('\n[4] numeric cua Postgres duoc Number() (chan loi noi chuoi)');
  ok('usd la number', r1.data.deals.every((d) => typeof d.usd === 'number'));
  ok('vnd la number', r1.data.deals.every((d) => typeof d.vnd === 'number'));
  const sumVnd = r1.data.deals.reduce((a, d) => a + d.vnd, 0);
  ok('tong vnd la number huu han', Number.isFinite(sumVnd) && sumVnd > 0, String(sumVnd));
  ok('officialKpi.totalNmvVnd la number', typeof r1.data._meta.officialKpi.totalNmvVnd === 'number');

  /* ---- [5] validationLists ---- */
  console.log('\n[5] validationLists');
  const wantLists = Object.keys(STATIC_JSON.validationLists);
  ok(`du ${wantLists.length} list`, wantLists.every((k) => Array.isArray(r1.data.validationLists[k])));
  ok('gia tri + thu tu khop', wantLists.every((k) =>
    r1.data.validationLists[k].join('|') === STATIC_JSON.validationLists[k].join('|')));

  /* ---- [6] Duong lui ---- */
  console.log('\n[6] Duong lui ve file tinh');
  globalThis.__PL_TABLES = { pipeline_deal: { __error: 'relation "public.pipeline_deal" does not exist' } };
  const r6a = await A.loadPipelineData({ fetchImpl: fakeFetch() });
  ok('bang chua ton tai -> source json', r6a.source === 'json');
  ok('warning chi ro 0003', /0003/.test(r6a.warning || ''), r6a.warning);
  ok('van du deal tu file tinh', r6a.data.deals.length === STATIC_JSON.deals.length);

  globalThis.__PL_TABLES = { pipeline_deal: [], pipeline_validation_list: [], pipeline_meta: null };
  const r6b = await A.loadPipelineData({ fetchImpl: fakeFetch() });
  ok('bang rong -> source json', r6b.source === 'json');
  ok('warning chi ro 0004', /0004/.test(r6b.warning || ''), r6b.warning);

  globalThis.__PL_TABLES = { pipeline_deal: { __throw: 'Failed to fetch' } };
  const r6c = await A.loadPipelineData({ fetchImpl: fakeFetch() });
  ok('loi mang -> source json (khong nem)', r6c.source === 'json', r6c.warning);

  const B = await loadAdapter({ isConfigured: false });
  globalThis.__PL_TABLES = TABLES_OK;
  const r6d = await B.loadPipelineData({ fetchImpl: fakeFetch() });
  ok('thieu env -> source json', r6d.source === 'json');
  ok('warning chi ro thieu env', /NEXT_PUBLIC_SUPABASE/.test(r6d.warning || ''), r6d.warning);

  /* ---- [7] Ca 2 nguon chet -> phai NEM loi ---- */
  console.log('\n[7] Ca DB lan file tinh chet -> nem loi de banner do hien ra');
  let threw = null;
  try {
    await B.loadPipelineData({ fetchImpl: fakeFetch(false) });
  } catch (e) { threw = e; }
  ok('co nem Error', threw instanceof Error);
  ok('message noi ca 2 nguon', /file tinh cung loi/.test(threw?.message || ''), threw?.message);

  /* ---- [8] Tich hop: mount output cua adapter vao module that ---- */
  console.log('\n[8] Tich hop: mount output cua adapter vao PipelineTracker that');
  let JSDOM;
  try { ({ JSDOM } = await import('jsdom')); }
  catch { console.log('  ! BO QUA — chua co jsdom (npm i --no-save jsdom)'); return report(); }

  const { PIPELINE_BODY } = await import(pathToFileURL(path.join(SRC, 'components', 'pipelineBody.js')).href);
  const PJS = fs.readFileSync(path.join(ROOT, 'public', 'pipeline', 'pipeline.js'), 'utf8');

  globalThis.__PL_TABLES = TABLES_OK;
  const fromDb = (await A.loadPipelineData({ fetchImpl: fakeFetch() })).data;

  const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { runScripts: 'outside-only' });
  const host = dom.window.document.getElementById('host');
  host.innerHTML = PIPELINE_BODY;
  dom.window.eval(PJS); // khong nap echarts/ExcelJS -> di duong degrade
  dom.window.PipelineTracker.mount(host, fromDb);

  const txt = (id) => dom.window.document.getElementById(id)?.textContent?.trim() || '';
  const rows = dom.window.document.querySelectorAll(
    '#pl-tbl-go-live tbody tr:not(.pl-empty-row), #pl-tbl-verbal tbody tr:not(.pl-empty-row), #pl-tbl-potential tbody tr:not(.pl-empty-row)'
  ).length;
  ok('KPI khong con placeholder "-"', txt('pl-kpi-nmv-fc') !== '-' && txt('pl-kpi-nmv-fc') !== '', `="${txt('pl-kpi-nmv-fc')}"`);
  ok(`render du ${STATIC_JSON.deals.length} dong`, rows === STATIC_JSON.deals.length, `dem duoc ${rows}`);
  const screen = dom.window.document.getElementById('pipeline-root').textContent;
  ok('khong co NaN tren man hinh', !/NaN/.test(screen));
  ok('khong co undefined tren man hinh', !/undefined/.test(screen));
  const bil = (v) => (v / 1e9).toFixed(1);
  ok('che do Official dung so tu pipeline_meta', txt('pl-kpi-nmv-fc').includes(bil(K.totalNmvVnd)),
    `card="${txt('pl-kpi-nmv-fc')}" official=${bil(K.totalNmvVnd)} BIL`);

  report();
}

function report() {
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${'-'.repeat(60)}`);
  if (fails.length === 0) { console.log(`PASS — ${pass}/${pass} assertion`); process.exit(0); }
  console.log(`FAIL — ${fails.length} loi / ${pass + fails.length} assertion`);
  fails.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
