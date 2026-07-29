import { supabase, isConfigured } from '@/lib/supabase/client';

/**
 * Adapter DB -> hinh dang data ma module pipeline.js doc.
 *
 * CUNG TRIET LY VOI src/lib/data.js: DB co schema chuan hoa (snake_case,
 * date_iso, is_active...), con module la code vanilla da chay production doc
 * `d.dateISO`, `data.validationLists.vaName`, `data._meta.officialKpi`.
 * Doi ten field trong module = phai sua pipeline.js + 26 assertion cua
 * smoke-pipeline.mjs. Nen dich o day, khong dich o do.
 *
 * KHONG dung chung bang nao voi tab Analyze — xem NGUYEN TAC 1 trong
 * supabase/migrations/0003_pipeline.sql.
 *
 * ---------------------------------------------------------------------------
 * FALLBACK — quan trong
 * ---------------------------------------------------------------------------
 * Neu chua chay 0003/0004, hoac Supabase env thieu, hoac bang rong, ham nay
 * KHONG nem loi ma tra ve source:'json' de PipelineTab doc file tinh
 * /pipeline/data/pipeline.json nhu truoc. Nghia la deploy migration va deploy
 * code KHONG can dong bo: code len truoc van chay, DB len sau la tu dong doi
 * nguon. Tranh canh site trang trong luc chuyen doi.
 */

const SCOPE = 'VA_DISTRIBUTION';
const STATIC_URL = '/pipeline/data/pipeline.json';

/**
 * @returns {Promise<{data: object|null, source: 'db'|'json', warning: string|null}>}
 *   data.deals, data.validationLists, data._meta.officialKpi — dung shape
 *   cua SCHEMA.md, san sang truyen vao PipelineTracker.mount().
 */
export async function loadPipelineData({ fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);

  if (!isConfigured) {
    return withStatic(doFetch, 'Chua cau hinh NEXT_PUBLIC_SUPABASE_* — dang doc file tinh.');
  }

  let deals, lists, meta;
  try {
    [deals, lists, meta] = await Promise.all([
      supabase
        .from('pipeline_deal')
        .select('*')
        .eq('scope', SCOPE)
        .eq('is_active', true)
        // Thu tu quyet dinh thu tu dong trong 3 bang cua dashboard.
        .order('stage')
        .order('sort_order')
        .order('no'),
      supabase
        .from('pipeline_validation_list')
        .select('list_name, value, sort_order')
        .order('list_name')
        .order('sort_order'),
      supabase.from('pipeline_meta').select('*').eq('scope', SCOPE).maybeSingle(),
    ]);
  } catch (e) {
    return withStatic(doFetch, `Loi mang khi goi Supabase (${e?.message || e}) — dang doc file tinh.`);
  }

  const dbError = [deals, lists, meta].map((r) => r?.error).find(Boolean);
  if (dbError) {
    // Truong hop hay gap nhat: bang chua ton tai (chua chay 0003_pipeline.sql).
    const hint = /relation .* does not exist|schema cache/i.test(dbError.message)
      ? 'Bang pipeline_* chua ton tai — chua chay 0003_pipeline.sql?'
      : dbError.message;
    return withStatic(doFetch, `${hint} — dang doc file tinh.`);
  }

  if (!deals.data || deals.data.length === 0) {
    return withStatic(doFetch, 'Bang pipeline_deal rong — chua chay 0004_pipeline_seed.sql? Dang doc file tinh.');
  }

  return {
    source: 'db',
    warning: null,
    data: {
      _meta: buildMeta(meta.data),
      deals: deals.data.map(toDeal),
      validationLists: buildLists(lists.data),
    },
  };
}

/* ------------------------------------------------------------------------- */

/**
 * 1 dong DB -> 1 Deal theo SCHEMA.md.
 * Luu y 3 cho de sai:
 *   - `dateISO` (camelCase, D-I-S-O hoa) la ten module doc; DB la date_iso.
 *   - date_iso null la HOP LE (date_text = 'TBU') -> view Day/Week bo qua dong do.
 *   - usd/vnd tu Postgres numeric ve duoi dang STRING trong JSON -> phai Number(),
 *     khong thi KPI se noi chuoi thay vi cong so ("15114490073" + "15000000000").
 */
function toDeal(r) {
  return {
    stage: r.stage,
    no: numOrNull(r.no),
    brand: r.brand,
    brand_key: r.brand_key,
    tier: r.tier,
    model: r.model,
    cd: r.cd,
    elephant: r.elephant,
    cat: r.cat,
    va: r.va,
    channel: r.channel,
    status: r.status,
    month: numOrNull(r.month),
    date: r.date_text,
    dateISO: r.date_iso || null,
    usd: numOrNull(r.usd),
    vnd: numOrNull(r.vnd),
  };
}

/** [{list_name, value}] -> {tier: [...], vaName: [...], ...} */
function buildLists(rows) {
  const out = {};
  (rows || []).forEach((r) => {
    (out[r.list_name] ||= []).push(r.value);
  });
  return out;
}

/**
 * pipeline_meta -> _meta.officialKpi.
 * Tra null khi khong co dong meta: module tu fallback ve so tinh tu rows va
 * console.warn (xem PIPELINE_TAB.md muc 3) — dung hanh vi mong doi, khong phai loi.
 */
function buildMeta(m) {
  if (!m) return { source_file: 'Supabase (pipeline_deal)', officialKpi: null };
  return {
    source_file: `Supabase (pipeline_deal) · official KPI: ${m.source || 'pipeline_meta'}`,
    extracted: m.updated_at || null,
    officialKpi: {
      as_of: m.as_of || null,
      source: m.source || null,
      totalNmvVnd: numOrNull(m.total_nmv_vnd),
      goLiveNmvVnd: numOrNull(m.go_live_nmv_vnd),
      brandGoLive: numOrNull(m.brand_go_live),
      brandVerbal: numOrNull(m.brand_verbal),
      brandPotential: numOrNull(m.brand_potential),
    },
  };
}

/** Duong lui: doc file tinh da vendor san trong /public. */
async function withStatic(doFetch, warning) {
  if (!doFetch) return { data: null, source: 'json', warning: `${warning} (khong co fetch)` };
  try {
    const res = await doFetch(STATIC_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json || !Array.isArray(json.deals)) throw new Error('pipeline.json khong co mang `deals`');
    return { data: json, source: 'json', warning };
  } catch (e) {
    // Ca 2 nguon deu chet -> de PipelineTab hien banner do.
    throw new Error(`${warning} Va file tinh cung loi: ${e?.message || e}`);
  }
}

const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
