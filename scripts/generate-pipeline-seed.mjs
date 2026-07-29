/**
 * generate-pipeline-seed.mjs
 * ----------------------------------------------------------------------------
 * Doc `scripts/_source/pipeline/data/pipeline.json` va sinh
 * `supabase/migrations/0004_pipeline_seed.sql` — seed BOOTSTRAP cho 3 bang cua
 * tab /pipeline (0003_pipeline.sql).
 *
 * Chay:  npm run seed:pipeline
 *
 * ---------------------------------------------------------------------------
 * VI SAO SEED NAY "CHI CHAY KHI BANG RONG"
 * ---------------------------------------------------------------------------
 * Khac han 0002_seed.sql (truncate roi insert lai). Sau khi DB thanh nguon su
 * that, deal duoc sua tay trong Supabase Table Editor. Neu seed nay truncate,
 * moi cap nhat cua business bi xoa sach chi vi ai do chay lai file SQL cu.
 * Nen phan pipeline_deal boc trong `if count = 0` va validation_list/meta dung
 * `on conflict do nothing`. Chay lai bao nhieu lan cung khong pha data.
 *
 * MUON RESET THAT SU: tu chay `truncate table public.pipeline_deal;` truoc,
 * tuc la phai co y thuc chu khong lo tay.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'scripts', '_source', 'pipeline', 'data', 'pipeline.json');
const OUT = path.join(ROOT, 'supabase', 'migrations', '0004_pipeline_seed.sql');

const JSON_DATA = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const SCOPE = "'VA_DISTRIBUTION'";

/* --- escape SQL -------------------------------------------------------- */
const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 'null' : String(Number(v)));

/**
 * Cung thuat toan voi toBrandKey() trong pipeline.js — de brand_key sinh o day
 * TRUNG khop voi key module tu tinh o phia client. Lech key = join sang
 * brand_history that bai am tham.
 */
// Giu DUNG THU TU cua pipeline.js: lowercase -> đ->d -> NFD strip -> bo non-alnum.
const toBrandKey = (str) => {
  if (!str) return '';
  let s = String(str).toLowerCase();
  s = s.replace(/đ/g, 'd');
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s.replace(/[^a-z0-9]/g, '');
};

/* --- kiem chung truoc khi sinh (fail fast) ----------------------------- */
const deals = JSON_DATA.deals || [];
if (!Array.isArray(deals) || deals.length === 0) {
  console.error('[seed:pipeline] FAIL — pipeline.json khong co deal nao');
  process.exit(1);
}
const STAGES = new Set(['Go Live', 'Verbal', 'Potential']);
const badStage = deals.filter((d) => !STAGES.has(d.stage));
if (badStage.length) {
  console.error('[seed:pipeline] FAIL — stage khong hop le (check constraint cua 0003 se chan):');
  badStage.forEach((d) => console.error(`  ${d.brand}: stage=${JSON.stringify(d.stage)}`));
  process.exit(1);
}
// unique (scope, stage, brand_key) — bat trung TRUOC khi Postgres bat.
const seen = new Map();
for (const d of deals) {
  const key = `${d.stage}|${d.brand_key || toBrandKey(d.brand)}`;
  if (seen.has(key)) {
    console.error(`[seed:pipeline] FAIL — trung (stage, brand_key): ${key} — "${seen.get(key)}" vs "${d.brand}"`);
    process.exit(1);
  }
  seen.set(key, d.brand);
}
// brand_key trong JSON phai khop thuat toan — neu lech, tin thuat toan va canh bao.
deals.forEach((d) => {
  const computed = toBrandKey(d.brand);
  if (d.brand_key && d.brand_key !== computed) {
    console.warn(`[seed:pipeline] WARN — brand_key lech: JSON="${d.brand_key}" vs computed="${computed}" (dung computed)`);
  }
});

/* --- sinh SQL ---------------------------------------------------------- */
const out = [];
const say = (s = '') => out.push(s);

say('-- ============================================================================');
say('-- 0004_pipeline_seed.sql — SINH TU DONG boi scripts/generate-pipeline-seed.mjs.');
say('-- DUNG SUA TAY. Sua o scripts/_source/pipeline/data/pipeline.json roi chay');
say('-- `npm run seed:pipeline`.');
say(`-- Nguon: ${path.relative(ROOT, SRC).replace(/\\/g, '/')}`);
say(`-- Sinh luc: ${new Date().toISOString()}`);
say('--');
say('-- AN TOAN: chay lai bao nhieu lan cung khong xoa data dang co.');
say('--   * pipeline_deal            : chi insert KHI BANG RONG');
say('--   * pipeline_validation_list : on conflict do nothing');
say('--   * pipeline_meta            : on conflict do nothing');
say('-- Muon reset that: `truncate table public.pipeline_deal;` roi chay lai file nay.');
say('-- ============================================================================');
say();
say('begin;');
say();

/* ---- pipeline_deal ---- */
say('-- ---------------------------------------------------------------------------');
say(`-- pipeline_deal — ${deals.length} deal bootstrap`);
say('-- ---------------------------------------------------------------------------');
say('do $$');
say('begin');
say('  if (select count(*) from public.pipeline_deal) > 0 then');
say("    raise notice '[0004] pipeline_deal da co data — BO QUA phan seed deal (khong ghi de).';");
say('  else');

const perStage = {};
const rows = deals.map((d) => {
  perStage[d.stage] = (perStage[d.stage] || 0) + 1;
  const bkey = toBrandKey(d.brand);
  return (
    '      (' +
    [
      SCOPE,
      q(d.stage),
      n(d.no),
      q(d.brand),
      q(bkey),
      q(d.tier),
      q(d.model),
      q(d.cd),
      q(d.elephant),
      q(d.cat),
      q(d.va),
      q(d.channel),
      q(d.status),
      n(d.month),
      q(d.date),
      d.dateISO ? q(d.dateISO) : 'null',
      n(d.usd),
      n(d.vnd),
      n(perStage[d.stage]),
    ].join(', ') +
    ')'
  );
});

say('    insert into public.pipeline_deal');
say('      (scope, stage, no, brand, brand_key, tier, model, cd, elephant, cat, va,');
say('       channel, status, month, date_text, date_iso, usd, vnd, sort_order)');
say('    values');
say(rows.join(',\n') + ';');
say('  end if;');
say('end $$;');
say();

/* ---- pipeline_validation_list ---- */
const lists = JSON_DATA.validationLists || {};
const listRows = [];
Object.entries(lists).forEach(([name, values]) => {
  (values || []).forEach((v, i) => listRows.push(`  (${q(name)}, ${q(v)}, ${i + 1})`));
});
say('-- ---------------------------------------------------------------------------');
say(`-- pipeline_validation_list — ${Object.keys(lists).length} list / ${listRows.length} gia tri`);
say('-- ---------------------------------------------------------------------------');
say('insert into public.pipeline_validation_list (list_name, value, sort_order) values');
say(listRows.join(',\n'));
say('on conflict (list_name, value) do nothing;');
say();

/* ---- pipeline_meta ---- */
const k = (JSON_DATA._meta && JSON_DATA._meta.officialKpi) || null;
say('-- ---------------------------------------------------------------------------');
say('-- pipeline_meta — so official cho KPI card (xem PIPELINE_TAB.md muc 3)');
say('-- ---------------------------------------------------------------------------');
if (k) {
  say('insert into public.pipeline_meta');
  say('  (scope, as_of, source, total_nmv_vnd, go_live_nmv_vnd, brand_go_live,');
  say('   brand_verbal, brand_potential, note)');
  say('values (');
  say(`  ${SCOPE}, ${q(k.as_of)}, ${q(k.source)},`);
  say(`  ${n(k.totalNmvVnd)}, ${n(k.goLiveNmvVnd)}, ${n(k.brandGoLive)},`);
  say(`  ${n(k.brandVerbal)}, ${n(k.brandPotential)},`);
  say(`  ${q('So official theo header source workbook. KPI card dung so nay khi KHONG filter; co filter thi doi sang so tinh tu rows.')}`);
  say(')');
  say('on conflict (scope) do nothing;');
} else {
  say('-- pipeline.json khong co _meta.officialKpi -> khong seed. Module se tu tinh tu rows.');
}
say();
say('commit;');
say();
say('-- Doi chieu sau khi chay:');
say('--   select * from public.v_pipeline_summary;              -- so TINH TU ROWS');
say('--   select * from public.pipeline_meta;                   -- so OFFICIAL');
say();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join('\n'), 'utf8');

console.log(`[seed:pipeline] OK -> ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
console.log(`  deal              : ${deals.length} (${Object.entries(perStage).map(([s, c]) => `${s}=${c}`).join(', ')})`);
console.log(`  validation list   : ${Object.keys(lists).length} list / ${listRows.length} gia tri`);
console.log(`  officialKpi       : ${k ? 'co' : 'KHONG CO — module se tinh tu rows'}`);
