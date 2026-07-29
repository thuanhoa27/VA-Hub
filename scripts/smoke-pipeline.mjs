/**
 * smoke-pipeline.mjs — chay module Pipeline Tracker that trong jsdom va assert
 * hanh vi, khong chi kiem tra "build co pass".
 *
 * Chay:  node scripts/smoke-pipeline.mjs      (can jsdom: npm i --no-save jsdom)
 *
 * Trong tam la che do KPI hybrid — thu de vo nhat khi doi data ve sau:
 *   - khong filter  -> KPI = so official trong pipeline.json (_meta.officialKpi)
 *   - co filter     -> KPI = so tinh tu cac dong dang loc
 *   - reset filter  -> quay lai so official
 *   - officialKpi hong/thieu -> fallback ve so tinh, khong hien NaN
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(import.meta.dirname, '..');
const BODY = (await import(pathToFileURL(path.join(ROOT, 'src', 'components', 'pipelineBody.js')))).PIPELINE_BODY;
const JS = fs.readFileSync(path.join(ROOT, 'public', 'pipeline', 'pipeline.js'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'pipeline', 'data', 'pipeline.json'), 'utf8'));

let pass = 0;
const fails = [];
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fails.push(`${name}${extra ? ' — ' + extra : ''}`); console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

function boot(data) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="host"></div></body></html>`, { runScripts: 'outside-only' });
  const { window } = dom;
  window.document.getElementById('host').innerHTML = BODY;
  // Khong nap echarts/ExcelJS -> ep module di duong "degrade gracefully".
  window.eval(JS);
  const T = window.PipelineTracker;
  T.mount(window.document.getElementById('host'), data);
  const txt = (id) => window.document.getElementById(id)?.textContent?.trim();
  const rows = (t) => window.document.querySelectorAll(`#pl-tbl-${t} tbody tr:not(.pl-empty-row)`).length;
  const setSel = (id, v) => {
    const el = window.document.getElementById(id);
    el.value = v;
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  return { dom, window, T, txt, rows, setSel };
}

console.log('\n[1] Mount + che do OFFICIAL (khong filter)');
{
  const { window, T, txt, rows } = boot(DATA);
  const O = DATA._meta.officialKpi;
  ok('global duy nhat la PipelineTracker', typeof T === 'object' && typeof T.mount === 'function');
  ok('KPI Total NMV = so official (34.00 BIL)', txt('pl-kpi-nmv-fc') === '34.00 BIL', `nhan duoc "${txt('pl-kpi-nmv-fc')}"`);
  ok('KPI Go Live NMV = so official (12.00 BIL)', txt('pl-kpi-nmv-golive') === '12.00 BIL', `nhan duoc "${txt('pl-kpi-nmv-golive')}"`);
  ok('KPI brand counts = official 5/4/2',
    txt('pl-kpi-golive') === String(O.brandGoLive) && txt('pl-kpi-verbal') === String(O.brandVerbal) && txt('pl-kpi-potential') === String(O.brandPotential),
    `nhan duoc ${txt('pl-kpi-golive')}/${txt('pl-kpi-verbal')}/${txt('pl-kpi-potential')}`);
  ok('badge o che do Official', /Official figures/.test(txt('pl-kpi-mode') || ''), `nhan duoc "${txt('pl-kpi-mode')}"`);
  ok('badge co class pl-kpi-mode-official',
    window.document.getElementById('pl-kpi-mode').classList.contains('pl-kpi-mode-official'));
  ok('bang van render du 8 dong (2/3/3)', rows('go-live') === 2 && rows('verbal') === 3 && rows('potential') === 3,
    `nhan duoc ${rows('go-live')}/${rows('verbal')}/${rows('potential')}`);
  ok('breakdown note ghi ro "Computed from rows"', /Computed from rows/.test(txt('pl-kpi-breakdown-note') || ''));
  ok('khong co chuoi NaN/undefined tren man hinh',
    !/NaN|undefined/.test(window.document.getElementById('pipeline-root').textContent));
}

console.log('\n[2] Ap filter -> chuyen sang che do FILTERED');
{
  const { window, txt, rows, setSel } = boot(DATA);
  setSel('pl-f-stage', 'Go Live');
  ok('badge chuyen sang Filtered', /^Filtered/.test(txt('pl-kpi-mode') || ''), `nhan duoc "${txt('pl-kpi-mode')}"`);
  ok('badge co class pl-kpi-mode-filtered',
    window.document.getElementById('pl-kpi-mode').classList.contains('pl-kpi-mode-filtered'));
  const glVnd = DATA.deals.filter((d) => d.stage === 'Go Live').reduce((s, d) => s + d.vnd, 0);
  const expect = (glVnd / 1e9).toFixed(2) + ' BIL';
  ok(`KPI Total NMV = so tinh tu rows (${expect})`, txt('pl-kpi-nmv-fc') === expect, `nhan duoc "${txt('pl-kpi-nmv-fc')}"`);
  ok('KPI brand counts = so tinh (2/0/0)',
    txt('pl-kpi-golive') === '2' && txt('pl-kpi-verbal') === '0' && txt('pl-kpi-potential') === '0',
    `nhan duoc ${txt('pl-kpi-golive')}/${txt('pl-kpi-verbal')}/${txt('pl-kpi-potential')}`);
  ok('chi con bang Go Live co dong', rows('go-live') === 2 && rows('verbal') === 0 && rows('potential') === 0);
}

console.log('\n[3] Reset -> quay lai che do OFFICIAL');
{
  const { window, txt, setSel } = boot(DATA);
  setSel('pl-f-cd', 'Thao Pham');
  ok('dang o che do Filtered truoc khi reset', /^Filtered/.test(txt('pl-kpi-mode') || ''));
  window.document.getElementById('pl-f-reset').dispatchEvent(new window.Event('click', { bubbles: true }));
  ok('sau reset ve lai Official', /Official figures/.test(txt('pl-kpi-mode') || ''), `nhan duoc "${txt('pl-kpi-mode')}"`);
  ok('sau reset KPI ve 34.00 BIL', txt('pl-kpi-nmv-fc') === '34.00 BIL', `nhan duoc "${txt('pl-kpi-nmv-fc')}"`);
}

console.log('\n[4] Va data: Tier 3 va SHP & TTS phai filter duoc');
{
  const { window, rows, setSel } = boot(DATA);
  const tierOpts = [...window.document.getElementById('pl-f-tier').options].map((o) => o.value);
  ok('dropdown Tier co "Tier 3"', tierOpts.includes('Tier 3'), `co: ${tierOpts.join(', ')}`);
  setSel('pl-f-tier', 'Tier 3');
  ok('filter Tier 3 ra dung 1 dong (Reckitt - OTC)', rows('go-live') + rows('verbal') + rows('potential') === 1,
    `nhan duoc ${rows('go-live') + rows('verbal') + rows('potential')} dong`);

  const { rows: rows2, setSel: setSel2, window: w2 } = boot(DATA);
  const chOpts = [...w2.document.getElementById('pl-f-channel').options].map((o) => o.value);
  ok('dropdown Channel co "SHP & TTS"', chOpts.includes('SHP & TTS'));
  setSel2('pl-f-channel', 'SHP & TTS');
  ok('filter "SHP & TTS" ra 3 dong', rows2('go-live') + rows2('verbal') + rows2('potential') === 3,
    `nhan duoc ${rows2('go-live') + rows2('verbal') + rows2('potential')} dong`);
}

console.log('\n[5] Fallback khi officialKpi thieu/hong');
{
  const broken = JSON.parse(JSON.stringify(DATA));
  delete broken._meta.officialKpi;
  const { txt } = boot(broken);
  const allVnd = DATA.deals.reduce((s, d) => s + d.vnd, 0);
  ok('thieu officialKpi -> KPI tinh tu rows', txt('pl-kpi-nmv-fc') === (allVnd / 1e9).toFixed(2) + ' BIL',
    `nhan duoc "${txt('pl-kpi-nmv-fc')}"`);
  ok('badge khong con noi "Official"', !/Official figures/.test(txt('pl-kpi-mode') || ''));

  const bad = JSON.parse(JSON.stringify(DATA));
  bad._meta.officialKpi.totalNmvVnd = 'ba muoi bon ty'; // sai kieu
  const { txt: txt2 } = boot(bad);
  ok('officialKpi sai kieu -> fallback, khong NaN', txt2('pl-kpi-nmv-fc') === (allVnd / 1e9).toFixed(2) + ' BIL',
    `nhan duoc "${txt2('pl-kpi-nmv-fc')}"`);
}

console.log('\n[6] unmount() go sach listener');
{
  const { window, T, txt, setSel } = boot(DATA);
  T.unmount();
  const before = txt('pl-kpi-nmv-fc');
  setSel('pl-f-stage', 'Go Live'); // sau unmount, event nay phai khong con tac dung
  ok('sau unmount, doi filter khong con re-render', txt('pl-kpi-nmv-fc') === before,
    `truoc "${before}" sau "${txt('pl-kpi-nmv-fc')}"`);
  ok('mount lai duoc sau unmount', (() => { T.mount(window.document.getElementById('host'), DATA); return /Official|Filtered/.test(txt('pl-kpi-mode') || ''); })());
}

console.log(`\n${'='.repeat(52)}`);
console.log(`PASS ${pass} / ${pass + fails.length}`);
if (fails.length) {
  console.log('\nFAIL:');
  fails.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('Tat ca assertion pass.');
