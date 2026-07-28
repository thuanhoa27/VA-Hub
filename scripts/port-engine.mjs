/**
 * port-engine.mjs
 * ----------------------------------------------------------------------------
 * Ghep 3 file JS goc cua dashboard thanh 1 ES module: src/lib/engine/index.js
 *
 *   scripts/_source/brief_engine.js   -> parse brief + gate + tier/score
 *   scripts/_source/app_new.js        -> render HTML/SVG + verdict
 *   scripts/_source/pptx_export.js    -> export deck .pptx
 *
 * TAI SAO GHEP CO HOC THAY VI VIET LAI BANG REACT
 * -----------------------------------------------
 * 3 file nay dang duoc khoa boi 298 assertion (test_app.js + audit_css.js +
 * test_pptx.js), trong do co 53 assertion chong ro ri thong tin noi bo ra deck
 * gui brand. Viet lai bang React = vut bo toan bo lop bao ve do va phai chung
 * minh lai tu dau. Nen: GIU NGUYEN logic tung byte, chi doi 3 thu o vo ngoai:
 *
 *   1. `DATA` tu bien global -> bien module + setData() (data gio tu Supabase)
 *   2. `XLSX` / `PptxGenJS` tu <script> global -> import tu npm
 *   3. Cac ham bi goi boi inline onclick -> gan len window qua attachGlobals()
 *
 * Chay lai script nay MOI KHI sua file trong scripts/_source/:
 *   npm run port
 *
 * Ba file goc van la NGUON SU THAT. Dung sua src/lib/engine/index.js truc tiep.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const S = (f) => fs.readFileSync(path.join(ROOT, 'scripts', '_source', f), 'utf8');
const OUT = path.join(ROOT, 'src', 'lib', 'engine', 'index.js');

let briefEngine = S('brief_engine.js');
let appNew = S('app_new.js');
let pptxExport = S('pptx_export.js');

/* ---------------------------------------------------------------------------
 * 1. brief_engine.js — IIFE gan API len `root`. Doi root tu globalThis sang
 *    mot object cuc bo, va bo nhanh CommonJS (webpack co the dinh nghia
 *    `module` khien nhanh do chay nham).
 * ------------------------------------------------------------------------- */
const beTailRe =
  /\/\/ export\s*\n\s*if \(typeof module !== "undefined" && module\.exports\) \{[\s\S]*?\n\s*\} else \{\s*\n\s*root\.BriefEngine = API;\s*\n\s*\}/;
if (!beTailRe.test(briefEngine)) {
  throw new Error('[port] Khong tim thay khoi export cua brief_engine.js — file goc da doi, sua lai regex.');
}
briefEngine = briefEngine.replace(beTailRe, '  root.BriefEngine = API;');

const beRootRe = /\}\)\(typeof globalThis !== "undefined" \? globalThis : this\);\s*$/;
if (!beRootRe.test(briefEngine.trimEnd() + '\n')) {
  throw new Error('[port] Khong tim thay dong dong IIFE cua brief_engine.js.');
}
briefEngine = briefEngine.trimEnd().replace(beRootRe, '})(__engineRoot);');

/* ---------------------------------------------------------------------------
 * 2. pptx_export.js — bo nhanh module.exports o cuoi file.
 * ------------------------------------------------------------------------- */
const pxTailRe =
  /\/\* export cho test headless trong node \*\/\s*\nif\(typeof module !== 'undefined' && module\.exports\)\{\n[\s\S]*?\n\}/;
if (!pxTailRe.test(pptxExport)) {
  throw new Error('[port] Khong tim thay khoi module.exports cua pptx_export.js.');
}
pptxExport = pptxExport.replace(
  pxTailRe,
  '/* (khoi module.exports cho test node da bo — xem scripts/port-engine.mjs) */'
);

/* ---------------------------------------------------------------------------
 * 3. Rap file
 * ------------------------------------------------------------------------- */
const HEADER = `/* eslint-disable */
/* ============================================================================
 * FILE NAY DUOC SINH TU DONG — DUNG SUA TAY.
 *
 * Sinh boi:  scripts/port-engine.mjs
 * Nguon:     scripts/_source/brief_engine.js
 *            scripts/_source/app_new.js
 *            scripts/_source/pptx_export.js
 * Sinh lai:  npm run port
 *
 * Sua logic nghiep vu -> sua 3 file trong scripts/_source/ roi chay lai npm run port.
 * ==========================================================================*/
import { ensureXLSX, ensurePptxGenJS } from '@/lib/vendor';

/* XLSX va PptxGenJS KHONG import tu npm.
 *
 * Ly do: 298 assertion cua test suite duoc viet dua tren DUNG 2 ban thu vien
 * dang nam trong public/vendor/. Doi sang ban npm khac version = doi hanh vi
 * parse .xlsx va sinh .pptx ma khong co gi bao dam. Ngoai ra ban SheetJS moi
 * chi phan phoi qua cdn.sheetjs.com — mot dependency mang co the lam fail build.
 *
 * Nen: nap 2 file do tu /public/vendor/ luc runtime, CHI KHI CAN.
 * Trong module ES, tham chieu tran \`XLSX\` / \`PptxGenJS\` se resolve ra
 * window.XLSX / window.PptxGenJS — dung y nhu khi chay bang <script> truoc day.
 */

/* DATA truoc day la \`const DATA={...}\` nhung trong file HTML.
   Gio nap tu Supabase qua setData(). Moi ham ben duoi doc bien nay khong doi. */
let DATA = null;

/* callback de lop React biet 1 lan phan tich vua chay xong -> ghi analysis_run */
let __onRun = null;
let __exportedPptx = false;

/* root gia cho IIFE cua brief_engine (thay cho globalThis) */
const __engineRoot = {};
`;

const MID_BRIEF = `

/* ==== BriefEngine: API do IIFE ben tren gan len __engineRoot ============== */
const BriefEngine = __engineRoot.BriefEngine;
if (!BriefEngine) throw new Error('[engine] BriefEngine khong khoi tao duoc');
`;

const FOOTER = `

/* ============================================================================
 * LOP VO CHO NEXT.JS — phan duy nhat khong co trong 3 file goc.
 * ==========================================================================*/

/** Nap reference data (tu Supabase) vao engine. Phai goi TRUOC moi thao tac. */
export function setData(d) {
  DATA = d;
}

/** Dang ky callback chay sau moi lan renderStep3() thanh cong. */
export function setOnRun(cb) {
  __onRun = cb;
}

/** State hien tai cua phien lam viec (read-only snapshot cho React). */
export function getState() {
  return S;
}

/** Reset ve dau — dung khi VA bam "phan tich brand khac". */
export function resetState() {
  S.brand = null; S.sub = null; S.cat2 = null; S.group = '';
  S.found = false; S.parsed = null; S.fname = null; S.typed = '';
  S.verdict = undefined;
  __exportedPptx = false;
}

/**
 * Chuyen state hien tai thanh 1 dong analysis_run.
 * Chay sau renderStep3() nen S.verdict da co.
 */
export function snapshotRun({ runBy = null, appVersion = null } = {}) {
  const b = S.brand || {};
  const v = S.verdict || {};
  const p = S.parsed || null;
  const schema = p ? p.schema : null;

  // flow: brand moi (upload brief) / brand da tiep can / re-pitch (co target moi)
  let flow = 'new';
  if (S.found) flow = S.repitch ? 'repitch' : 'existing';

  // luoi gate 14 truong -> jsonb {group: {field: true/false}}
  let gateGrid = null;
  if (p) {
    try {
      gateGrid = {};
      gateGroups().forEach((g) => {
        gateGrid[g.n] = {};
        g.rows.forEach((r) => { gateGrid[g.n][r.l] = !nz(r.v); });
      });
    } catch (e) { gateGrid = null; }
  }

  // target 12M quy ra ti VND + chenh lech so voi quy mo cu
  let targetTi = null;
  if (schema && schema.objective_2627 && schema.objective_2627.value != null) {
    targetTi = BriefEngine.toBillionVND(schema.objective_2627.value, schema.objective_2627.unit);
  }
  const baseTi = myGmvTi() ? myGmvTi().ti : null;
  const gapPct = (targetTi != null && baseTi) ? (targetTi - baseTi) / baseTi : null;

  return {
    brand_name: b.name || S.typed || null,
    group_brand: S.group || b.group || null,
    typed_input: S.typed || null,
    category_1: S.sub || null,
    category_2: S.cat2 || null,
    flow,
    matched_brand_id: S.found && b.id != null ? b.id : null,
    brief_filename: S.fname || null,
    brief_valid: p ? !!p.brief_valid : null,
    gate_missing: p && p.gate ? p.gate.missing : null,
    gate_grid: gateGrid,
    brief_schema: schema || null,
    brief_warnings: p ? p.warnings : null,
    tier: v.tier || null,
    score: v.score != null ? v.score : null,
    band: v.band || null,
    prio: v.prio || null,
    model: v.model || null,
    verdict_pos: v.pos || null,
    verdict_head: v.head || null,
    verdict_risk: v.risk || null,
    verdict_next: v.next || null,
    verdict_source: v.srcTag || null,
    gmv_ti: baseTi,
    aov_vnd: (() => { try { return aovVND() ? aovVND().v : null; } catch (e) { return null; } })(),
    target_ti: targetTi,
    target_gap_pct: gapPct,
    run_by: runBy,
    exported_pptx: __exportedPptx,
    app_version: appVersion,
  };
}

/**
 * Gan cac ham len window. Bat buoc: HTML do engine sinh ra dung inline
 * onclick="lookup()" / onclick="pickBrand('X')" ... nen cac ham phai la global.
 * Goi 1 lan trong useEffect cua component.
 */
export function attachGlobals() {
  if (typeof window === 'undefined') return;

  window.go = go;
  window.lookup = lookup;
  window.pickBrand = pickBrand;
  window.confirmNew = confirmNew;
  window.copyIBB = copyIBB;

  // renderStep2 mo man hinh upload brief -> phai co SheetJS san truoc do
  window.renderStep2 = function () {
    ensureXLSX().catch((e) => console.error('[engine] khong nap duoc SheetJS', e));
    return renderStep2();
  };
  window.showRepitch = function () {
    S.repitch = true;
    return showRepitch();
  };

  // renderStep3 duoc boc them: chay xong thi bao cho React de ghi analysis_run
  window.renderStep3 = function () {
    const r = renderStep3();
    try { if (__onRun) __onRun(); } catch (e) { console.error('[engine] onRun failed', e); }
    return r;
  };

  // export deck: nap PptxGenJS ngay truoc khi dung (~460 KB, chi tai 1 lan),
  // roi danh dau da xuat de bao cao dem duoc
  window.exportBrandProposal = async function (btn) {
    await ensurePptxGenJS();
    const r = await exportBrandProposal(btn);
    __exportedPptx = true;
    try { if (__onRun) __onRun(); } catch (e) { console.error('[engine] onRun failed', e); }
    return r;
  };

  // tien cho debug trong DevTools
  window.__BH = { get S() { return S; }, get DATA() { return DATA; }, BriefEngine, snapshotRun };
}

export { BriefEngine, DATA as _DATA };
`;

const bundle = [
  HEADER,
  '\n/* ======================= [1/3] brief_engine.js ========================= */\n',
  briefEngine,
  MID_BRIEF,
  '\n/* ========================== [2/3] app_new.js =========================== */\n',
  appNew,
  '\n/* ======================= [3/3] pptx_export.js ========================== */\n',
  pptxExport,
  FOOTER,
].join('\n');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, bundle, 'utf8');
console.log(`[port] Da ghi ${OUT} (${Math.round(bundle.length / 1024)} KB)`);

/* ---------------------------------------------------------------------------
 * 4. shell.html -> tach CSS va body markup
 *
 *    CSS  -> src/app/engine.css   (import trong layout, KHONG qua Tailwind)
 *    body -> src/components/shellBody.js  (chuoi HTML, mount bang
 *            dangerouslySetInnerHTML de inline onclick van chay)
 *
 *    Vi sao khong viet lai body bang JSX: engine sinh HTML co inline onclick
 *    (vd onclick="pickBrand('X')"). Neu shell la JSX con noi dung la HTML string
 *    thi se co 2 co che su kien khac nhau trong cung 1 man hinh. Giu ca 2 cung
 *    la HTML string + window globals thi nhat quan va khong lech gi so voi ban cu.
 * ------------------------------------------------------------------------- */
const shell = S('shell.html');

const cssMatch = shell.match(/<style>([\s\S]*?)<\/style>/);
if (!cssMatch) throw new Error('[port] Khong tim thay <style> trong shell.html');
const CSS_OUT = path.join(ROOT, 'src', 'app', 'engine.css');
fs.writeFileSync(
  CSS_OUT,
  '/* SINH TU DONG tu scripts/_source/shell.html boi scripts/port-engine.mjs. DUNG SUA TAY. */\n' +
    cssMatch[1].trim() +
    '\n',
  'utf8'
);
console.log(`[port] Da ghi ${CSS_OUT} (${Math.round(cssMatch[1].length / 1024)} KB)`);

const bodyMatch = shell.match(/<body>([\s\S]*?)<!--LIBS-->/);
if (!bodyMatch) throw new Error('[port] Khong tim thay <body>...<!--LIBS--> trong shell.html');
let body = bodyMatch[1];

// Header (.top) do React ve — de dung chung nav voi trang /runs. Bo khoi day.
body = body.replace(/<div class="top">[\s\S]*?<\/div>\n<div class="wrap">/, '<div class="wrap">');

const BODY_OUT = path.join(ROOT, 'src', 'components', 'shellBody.js');
fs.writeFileSync(
  BODY_OUT,
  '/* SINH TU DONG tu scripts/_source/shell.html boi scripts/port-engine.mjs. DUNG SUA TAY. */\n' +
    'export const SHELL_BODY = ' +
    JSON.stringify(body.trim()) +
    ';\n',
  'utf8'
);
console.log(`[port] Da ghi ${BODY_OUT}`);
