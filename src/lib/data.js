import { supabase } from '@/lib/supabase/client';

const SCOPE = 'HEALTH_VN';

/**
 * Nap toan bo reference data tu Supabase va rap lai thanh DUNG hinh dang cua
 * `const DATA = {...}` trong dashboard cu (data_line.js).
 *
 * Vi sao phai giu nguyen hinh dang: toan bo engine (app_new.js, pptx_export.js)
 * doc DATA.block1 / DATA.block2 / DATA.competitor[bucket].top / DATA.history ...
 * Doi hinh dang o day = phai sua ~40 cho trong engine va lam hong test suite.
 * Nen: DB co schema chuan hoa, con day la lop adapter DB -> hinh dang engine.
 *
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function loadReferenceData() {
  const [
    kpi,
    periods,
    subs,
    subChannels,
    bands,
    compBuckets,
    comps,
    rules,
    lists,
    history,
  ] = await Promise.all([
    supabase.from('market_kpi').select('*').eq('scope', SCOPE).maybeSingle(),
    supabase.from('market_period').select('*').eq('scope', SCOPE).order('sort_order'),
    supabase.from('subcategory').select('*').eq('scope', SCOPE).order('sort_order'),
    supabase.from('subcategory_channel').select('*').eq('scope', SCOPE).order('sort_order'),
    supabase.from('price_band').select('*').eq('scope', SCOPE).order('sort_order'),
    supabase.from('competitor_bucket').select('*').eq('scope', SCOPE),
    supabase.from('competitor').select('*').order('bucket').order('sort_order'),
    supabase.from('scoring_rule').select('*').order('kind').order('sort_order'),
    supabase.from('validation_list').select('*').order('list_name').order('sort_order'),
    supabase.from('brand_history').select('*').order('sort_order'),
  ]);

  const firstError = [kpi, periods, subs, subChannels, bands, compBuckets, comps, rules, lists, history]
    .map((r) => r.error)
    .find(Boolean);
  if (firstError) return { data: null, error: firstError.message };
  if (!kpi.data) return { data: null, error: 'Bang market_kpi rong — chua chay 0002_seed.sql?' };

  // ---- block1: KPI nganh -------------------------------------------------
  const block1 = {
    gmv12_ti: num(kpi.data.gmv12_ti),
    tiktok_share: num(kpi.data.tiktok_share),
    hoh: num(kpi.data.hoh),
    yoy: num(kpi.data.yoy),
    item_h126_tr: num(kpi.data.item_h126_tr),
  };

  // ---- block6: NMV theo ky ----------------------------------------------
  const block6 = (periods.data || []).map((r) => ({
    t: r.period,
    nmv_ti: num(r.nmv_ti),
    shp: num(r.shp),
    tts: num(r.tts),
    item_tr: num(r.item_tr),
  }));

  // ---- block2 / block5 / block3 -----------------------------------------
  const block2 = (subs.data || []).map((r) => ({
    sub: r.sub, gmv_ti: num(r.gmv_ti), grow: num(r.grow), bucket: r.bucket, pct: num(r.pct),
  }));
  const block5 = (subChannels.data || []).map((r) => ({
    sub: r.sub, shp: num(r.shp), tts: num(r.tts),
  }));
  const block3 = (bands.data || []).map((r) => ({ band: r.band, pct: num(r.pct) }));

  // ---- competitor: {bucket: {subtot_ti, top: [...]}} ---------------------
  const competitor = {};
  (compBuckets.data || []).forEach((b) => {
    competitor[b.bucket] = { subtot_ti: num(b.subtot_ti), top: [] };
  });
  (comps.data || []).forEach((c) => {
    if (!competitor[c.bucket]) competitor[c.bucket] = { subtot_ti: null, top: [] };
    competitor[c.bucket].top.push({
      brand: c.brand, gmv_ti: num(c.gmv_ti), price: num(c.price), aff: num(c.aff),
      seller: num(c.seller), mall: num(c.mall), item: num(c.item), creator: num(c.creator),
      ls: num(c.ls), video: num(c.video), gmv_ls: num(c.gmv_ls), share: num(c.share),
    });
  });

  // ---- rule: {tier: [[nguong,label]], band: [[...]], factors: [[key,w]]} --
  const rule = { tier: [], band: [], factors: [] };
  (rules.data || []).forEach((r) => {
    if (r.kind === 'tier') rule.tier.push([num(r.threshold), r.label]);
    else if (r.kind === 'band') rule.band.push([num(r.threshold), r.label]);
    else if (r.kind === 'factor') rule.factors.push([r.factor_key, num(r.weight)]);
  });

  // ---- lists: {cat: [...], tier: [...], ...} -----------------------------
  const listMap = {};
  (lists.data || []).forEach((r) => {
    (listMap[r.list_name] ||= []).push(r.value);
  });

  // ---- history: giu nguyen ten field cua engine --------------------------
  // Engine doc b.name / b.group / b.linkStore ... nen tra ve gan nhu nguyen ban,
  // chi bo cac cot ky thuat cua DB (sort_order, updated_at).
  const historyRows = (history.data || []).map((r) => {
    const { sort_order, updated_at, ...rest } = r;
    return rest;
  });

  return {
    error: null,
    data: {
      block1,
      block6,
      block2,
      block5,
      block3,
      total12: block1.gmv12_ti,
      competitor,
      rule,
      lists: listMap,
      history: historyRows,
    },
  };
}

/** Ghi 1 dong analysis_run. Loi khong duoc lam hong luong lam viec cua VA. */
export async function saveRun(row) {
  const { data, error } = await supabase.from('analysis_run').insert(row).select('id').maybeSingle();
  if (error) {
    console.error('[saveRun] khong ghi duoc analysis_run:', error.message);
    return { id: null, error: error.message };
  }
  return { id: data?.id ?? null, error: null };
}

/** Danh sach lan chay gan nhat, cho trang /runs. */
export async function listRuns({ limit = 200 } = {}) {
  const { data, error } = await supabase
    .from('analysis_run')
    .select(
      'id, created_at, brand_name, group_brand, category_1, flow, tier, score, band, prio, model, gmv_ti, target_gap_pct, brief_valid, exported_pptx, run_by'
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { rows: [], error: error.message };
  return { rows: data || [], error: null };
}

const num = (v) => (v === null || v === undefined ? null : Number(v));
