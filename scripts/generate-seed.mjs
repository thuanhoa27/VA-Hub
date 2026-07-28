/**
 * generate-seed.mjs
 * ----------------------------------------------------------------------------
 * Doc `scripts/_source/data_line.js` (dump JSON cua dashboard cu) va sinh ra
 * `supabase/migrations/0002_seed.sql`.
 *
 * Chay lai script nay MOI KHI:
 *   - Final Brand history.xlsx thay doi (them brand / doi status)
 *   - Raw data Metrics hoac Kalodata duoc refresh
 *
 * Quy trinh:  cap nhat data_line.js  ->  npm run seed  ->  chay lai 0002_seed.sql
 *
 * Chay:  node scripts/generate-seed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'scripts', '_source', 'data_line.js');
const OUT = path.join(ROOT, 'supabase', 'migrations', '0002_seed.sql');

// --- doc data_line.js: file la `const DATA={...};` -> boc ra thanh object ---
const raw = fs.readFileSync(SRC, 'utf8');
const body = raw.replace(/^\s*const\s+DATA\s*=/, '').replace(/;\s*$/, '');
const DATA = new Function('return (' + body + ')')();

// --- helper escape SQL ---
const q = (v) => {
  if (v === null || v === undefined || v === '') return 'null';
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const n = (v) => {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return 'null';
  return String(Number(v));
};
const SCOPE = "'HEALTH_VN'";

const out = [];
const say = (s = '') => out.push(s);

say('-- ============================================================================');
say('-- 0002_seed.sql — SINH TU DONG boi scripts/generate-seed.mjs. DUNG SUA TAY.');
say('-- Nguon: scripts/_source/data_line.js');
say(`-- Sinh luc: ${new Date().toISOString()}`);
say('-- Idempotent: chay lai bao nhieu lan cung duoc (truncate roi insert lai');
say('--             cac bang reference; analysis_run KHONG bi dong toi).');
say('-- ============================================================================');
say();
say('begin;');
say();
say('truncate table public.competitor, public.competitor_bucket restart identity cascade;');
say('truncate table public.market_period, public.subcategory, public.subcategory_channel,');
say('               public.price_band, public.scoring_rule, public.validation_list,');
say('               public.brand_history restart identity cascade;');
say('delete from public.market_kpi;');
say();

// ---------------------------------------------------------------- market_kpi
const b1 = DATA.block1;
say('-- 1. market_kpi (block1)');
say('insert into public.market_kpi (scope, gmv12_ti, tiktok_share, hoh, yoy, item_h126_tr) values');
say(`  (${SCOPE}, ${n(b1.gmv12_ti)}, ${n(b1.tiktok_share)}, ${n(b1.hoh)}, ${n(b1.yoy)}, ${n(b1.item_h126_tr)});`);
say();

// ------------------------------------------------------------- market_period
say('-- 2. market_period (block6)');
say('insert into public.market_period (scope, period, sort_order, nmv_ti, shp, tts, item_tr) values');
say(
  (DATA.block6 || [])
    .map((r, i) => `  (${SCOPE}, ${q(r.t)}, ${i}, ${n(r.nmv_ti)}, ${n(r.shp)}, ${n(r.tts)}, ${n(r.item_tr)})`)
    .join(',\n') + ';'
);
say();

// ---------------------------------------------------------------- subcategory
say('-- 3. subcategory (block2)');
say('insert into public.subcategory (scope, sub, gmv_ti, grow, bucket, pct, sort_order) values');
say(
  (DATA.block2 || [])
    .map((r, i) => `  (${SCOPE}, ${q(r.sub)}, ${n(r.gmv_ti)}, ${n(r.grow)}, ${q(r.bucket)}, ${n(r.pct)}, ${i})`)
    .join(',\n') + ';'
);
say();

// -------------------------------------------------------- subcategory_channel
say('-- 4. subcategory_channel (block5)');
say('insert into public.subcategory_channel (scope, sub, shp, tts, sort_order) values');
say(
  (DATA.block5 || [])
    .map((r, i) => `  (${SCOPE}, ${q(r.sub)}, ${n(r.shp)}, ${n(r.tts)}, ${i})`)
    .join(',\n') + ';'
);
say();

// ----------------------------------------------------------------- price_band
say('-- 5. price_band (block3) — sort_order giu nguyen thu tu goc de ve chart dung');
say('insert into public.price_band (scope, band, pct, sort_order) values');
say(
  (DATA.block3 || [])
    .map((r, i) => `  (${SCOPE}, ${q(r.band)}, ${n(r.pct)}, ${i})`)
    .join(',\n') + ';'
);
say();

// ----------------------------------------------------- competitor_bucket/rows
say('-- 6. competitor_bucket + competitor (Kalodata)');
const buckets = Object.keys(DATA.competitor || {});
say('insert into public.competitor_bucket (bucket, scope, subtot_ti) values');
say(buckets.map((b) => `  (${q(b)}, ${SCOPE}, ${n(DATA.competitor[b].subtot_ti)})`).join(',\n') + ';');
say();
const compRows = [];
buckets.forEach((b) => {
  (DATA.competitor[b].top || []).forEach((c, i) => {
    compRows.push(
      `  (${q(b)}, ${i}, ${q(c.brand)}, ${n(c.gmv_ti)}, ${n(c.price)}, ${n(c.aff)}, ${n(c.seller)}, ` +
        `${n(c.mall)}, ${n(c.item)}, ${n(c.creator)}, ${n(c.ls)}, ${n(c.video)}, ${n(c.gmv_ls)}, ${n(c.share)})`
    );
  });
});
say('insert into public.competitor');
say('  (bucket, sort_order, brand, gmv_ti, price, aff, seller, mall, item, creator, ls, video, gmv_ls, share)');
say('values');
say(compRows.join(',\n') + ';');
say();

// --------------------------------------------------------------- scoring_rule
say('-- 7. scoring_rule (rule) — sua nguong o day, khong can deploy lai app');
const ruleRows = [];
(DATA.rule?.tier || []).forEach(([th, label], i) =>
  ruleRows.push(`  ('tier', ${i}, ${n(th)}, ${q(label)}, null, null)`)
);
(DATA.rule?.band || []).forEach(([th, label], i) =>
  ruleRows.push(`  ('band', ${i}, ${n(th)}, ${q(label)}, null, null)`)
);
(DATA.rule?.factors || []).forEach(([key, w], i) =>
  ruleRows.push(`  ('factor', ${i}, null, null, ${q(key)}, ${n(w)})`)
);
say('insert into public.scoring_rule (kind, sort_order, threshold, label, factor_key, weight) values');
say(ruleRows.join(',\n') + ';');
say();

// ------------------------------------------------------------ validation_list
say('-- 8. validation_list (lists) — 10 danh sach pill');
const listRows = [];
Object.entries(DATA.lists || {}).forEach(([name, arr]) => {
  (arr || []).forEach((v, i) => listRows.push(`  (${q(name)}, ${q(v)}, ${i})`));
});
say('insert into public.validation_list (list_name, value, sort_order) values');
say(listRows.join(',\n') + ';');
say();

// -------------------------------------------------------------- brand_history
const HIST_COLS = [
  'name', 'group', 'tier', 'model', 'status', 'sub', 'gmv', 'score', 'band', 'prio',
  'pos', 'head', 'risk', 'next', 'blocker', 'pic', 'va', 'cd', 'elephant', 'cat',
  'channel', 'contract', 'country', 'pending', 'lead', 'nmv26_usd', 'nmv26_vnd',
  'nmv12_usd', 'nmv12_vnd', 'linkStore', 'linkProposal', 'linkBP', 'livedDate',
  'analysisDate', 'linkOut', 'notes', 'c_name', 'c_pos', 'c_email', 'c_phone',
];
const NUMERIC_COLS = new Set(['gmv', 'score', 'nmv26_usd', 'nmv26_vnd', 'nmv12_usd', 'nmv12_vnd']);

say('-- 9. brand_history (history) — pipeline tracker, 40 column');
say('insert into public.brand_history (');
say('  ' + HIST_COLS.map((c) => `"${c}"`).join(', ') + ', sort_order');
say(') values');
say(
  (DATA.history || [])
    .map((b, i) => {
      const vals = HIST_COLS.map((c) => (NUMERIC_COLS.has(c) ? n(b[c]) : q(b[c])));
      return '  (' + vals.join(', ') + `, ${i})`;
    })
    .join(',\n') + ';'
);
say();
say('commit;');
say();
say('-- Kiem tra nhanh sau khi chay:');
say('--   select count(*) from public.brand_history;      -- ky vong: ' + (DATA.history || []).length);
say('--   select count(*) from public.competitor;         -- ky vong: ' + compRows.length);
say('--   select count(*) from public.validation_list;    -- ky vong: ' + listRows.length);

fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log(`[seed] Da ghi ${OUT}`);
console.log(`[seed] brand_history=${(DATA.history || []).length} rows · competitor=${compRows.length} rows · validation_list=${listRows.length} rows`);
