-- ============================================================================
-- OnPoint · Brand Hunt & Tier Analyzer — Supabase schema
-- Migration 0001: tables + RLS + views
--
-- Nguon: DATA const trong _source_dashboard/data_line.js (dump tu Raw data/
-- Metrics + Kalodata, va History/Final Brand history.xlsx).
--
-- Nguyen tac:
--   * Bang REFERENCE (market_*, subcategory*, price_band, competitor*,
--     scoring_rule, validation_list, brand_history) = read-only voi anon.
--     Chi sua bang service_role (script seed) hoac Table Editor.
--   * Bang TRANSACTIONAL (analysis_run) = anon INSERT + SELECT.
--     KHONG cho UPDATE/DELETE de giu audit trail.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. MARKET KPI — block1. Chi dung 1 dong (singleton), khoa bang `scope`.
-- ---------------------------------------------------------------------------
create table if not exists public.market_kpi (
  scope          text primary key default 'HEALTH_VN',
  gmv12_ti       numeric not null,   -- GMV 12 thang gan nhat, ti VND
  tiktok_share   numeric not null,   -- ty trong TikTok Shop, 0..1
  hoh            numeric not null,   -- tang truong half-on-half, 0..1
  yoy            numeric not null,   -- tang truong year-on-year, 0..1
  item_h126_tr   numeric not null,   -- so item ban ra H1.2026, trieu cai
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. MARKET PERIOD — block6. NMV theo ky, tach Shopee / TikTok Shop.
-- ---------------------------------------------------------------------------
create table if not exists public.market_period (
  id         bigserial primary key,
  scope      text not null default 'HEALTH_VN',
  period     text not null,          -- 'H1.2025' | 'H2.2025' | 'H1.2026'
  sort_order int  not null,
  nmv_ti     numeric,                -- NMV toan nganh, ti VND
  shp        numeric,                -- NMV Shopee, ti VND
  tts        numeric,                -- NMV TikTok Shop, ti VND
  item_tr    numeric,                -- so item, trieu cai
  unique (scope, period)
);

-- ---------------------------------------------------------------------------
-- 3. SUBCATEGORY — block2. Sizing tung sub-category trong nganh Health.
--    `bucket` map sub-cat tieng Viet -> bucket tieng Anh dung o competitor.
-- ---------------------------------------------------------------------------
create table if not exists public.subcategory (
  id       bigserial primary key,
  scope    text not null default 'HEALTH_VN',
  sub      text not null,            -- ten sub-cat (tieng Viet, tu Metrics)
  gmv_ti   numeric,                  -- GMV 12 thang, ti VND
  grow     numeric,                  -- tang truong, 0..1
  bucket   text,                     -- 'Nutrition & Wellness' | 'Medical Supplies' | ...
  pct      numeric,                  -- ty trong tren tong nganh, 0..1
  sort_order int not null default 0,
  unique (scope, sub)
);

-- ---------------------------------------------------------------------------
-- 4. SUBCATEGORY CHANNEL — block5. Channel split Shopee vs TikTok theo sub-cat.
-- ---------------------------------------------------------------------------
create table if not exists public.subcategory_channel (
  id     bigserial primary key,
  scope  text not null default 'HEALTH_VN',
  sub    text not null,
  shp    numeric,                    -- ty trong Shopee, 0..1
  tts    numeric,                    -- ty trong TikTok Shop, 0..1
  sort_order int not null default 0,
  unique (scope, sub)
);

-- ---------------------------------------------------------------------------
-- 5. PRICE BAND — block3. Phan bo GMV theo dai gia.
--    sort_order GIU NGUYEN thu tu goc: UI ve bieu do theo thu tu nay.
-- ---------------------------------------------------------------------------
create table if not exists public.price_band (
  id         bigserial primary key,
  scope      text not null default 'HEALTH_VN',
  band       text not null,          -- '< 10.000₫' | '10.000₫ - 20.000₫' | ...
  pct        numeric,                -- ty trong GMV, 0..1
  sort_order int not null,
  unique (scope, band)
);

-- ---------------------------------------------------------------------------
-- 6. COMPETITOR BUCKET + COMPETITOR — competitor{}. Kalodata top brand.
-- ---------------------------------------------------------------------------
create table if not exists public.competitor_bucket (
  bucket     text primary key,       -- 'Nutrition & Wellness' | 'Medical Supplies'
  scope      text not null default 'HEALTH_VN',
  subtot_ti  numeric                 -- tong GMV bucket, ti VND
);

create table if not exists public.competitor (
  id         bigserial primary key,
  bucket     text not null references public.competitor_bucket(bucket) on delete cascade,
  sort_order int  not null,          -- thu tu hien thi (theo GMV giam dan)
  brand      text not null,
  gmv_ti     numeric,                -- GMV 365D, ti VND
  price      numeric,                -- gia trung binh, VND
  aff        numeric,                -- ty trong affiliate, 0..1
  seller     numeric,                -- ty trong self-operated, 0..1
  mall       numeric,                -- ty trong mall/showcase, 0..1
  item       numeric,                -- so item ban
  creator    numeric,                -- so creator
  ls         numeric,                -- so livestream
  video      numeric,                -- so video
  gmv_ls     numeric,                -- GMV per livestream
  share      numeric,                -- market share trong bucket, 0..1
  unique (bucket, brand)
);

-- ---------------------------------------------------------------------------
-- 7. SCORING RULE — rule{}. Nguong Tier / Band / trong so factor.
--    De o DB de CD/Head chinh nguong ma khong can dev deploy lai.
-- ---------------------------------------------------------------------------
create table if not exists public.scoring_rule (
  id         bigserial primary key,
  kind       text not null check (kind in ('tier','band','factor')),
  sort_order int  not null,          -- doc tu tren xuong, dung nguong DAU TIEN khop
  threshold  numeric,                -- tier: GMV ti VND · band: diem 0..100
  label      text,                   -- 'ELEPHANT (T1)' | 'HIGH' | ...
  factor_key text,                   -- 'A'..'F' (chi voi kind='factor')
  weight     numeric                 -- trong so 0..1 (chi voi kind='factor')
);

-- ---------------------------------------------------------------------------
-- 8. VALIDATION LIST — lists{}. 10 danh sach pill tu sheet Validation.
-- ---------------------------------------------------------------------------
create table if not exists public.validation_list (
  id         bigserial primary key,
  list_name  text not null,          -- cat/tier/elephant/model/channel/status/
                                     -- contract/pending/country/lead
  value      text not null,
  sort_order int  not null,
  unique (list_name, value)
);

-- ---------------------------------------------------------------------------
-- 9. BRAND HISTORY — history[]. 40 column tu sheet Pipeline.
--    Pipeline tracker: brand da tiep can, trang thai deal, verdict cu.
-- ---------------------------------------------------------------------------
create table if not exists public.brand_history (
  id             bigserial primary key,
  name           text not null,
  "group"        text,
  tier           text,
  model          text,
  status         text,
  sub            text,               -- bucket: 'Nutrition & Wellness' | ...
  gmv            numeric,            -- GMV annualized, ti VND
  score          numeric,            -- Commercial Score 0..100
  band           text,               -- HIGH | MED | LOW
  prio           text,               -- P1 | P2 | P3
  pos            text,               -- Assessment & positioning (VI)
  head           text,               -- Enabler opportunity / headroom (VI)
  risk           text,               -- Risk & compliance (VI)
  next           text,               -- Next action (VI)
  blocker        text,
  pic            text,
  va             text,
  cd             text,
  elephant       text,               -- 'YES' | 'NO'
  cat            text,               -- HEALTH | BEAUTY | ...
  channel        text,               -- 'ECOM & TTS' | 'SHP' | 'TTS' | 'ECOM' | 'D2C'
  contract       text,
  country        text,
  pending        text,               -- Pending Party (hien de trong)
  lead           text,               -- Lead Source
  nmv26_usd      numeric,
  nmv26_vnd      numeric,
  nmv12_usd      numeric,
  nmv12_vnd      numeric,
  "linkStore"    text,
  "linkProposal" text,
  "linkBP"       text,
  "livedDate"    text,
  "analysisDate" text,
  "linkOut"      text,
  notes          text,
  c_name         text,               -- Contact point: ho ten
  c_pos          text,               -- Contact point: chuc danh
  c_email        text,
  c_phone        text,
  sort_order     int not null default 0,
  updated_at     timestamptz not null default now(),
  unique (name)
);

create index if not exists brand_history_status_idx on public.brand_history (status);
create index if not exists brand_history_sub_idx    on public.brand_history (sub);

-- ---------------------------------------------------------------------------
-- 10. ANALYSIS RUN — MOI. Ghi lai MOI lan VA chay phan tich.
--     Dashboard HTML hien tai khong luu lai gi. Co bang nay moi bao cao duoc
--     "thang nay hunt bao nhieu brand", "ty le brand vao P1",
--     "brief nao thieu field nhieu nhat".
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_run (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),

  -- input cua VA
  brand_name        text,
  group_brand       text,
  typed_input       text,            -- chuoi VA go, truoc khi fuzzy match
  category_1        text,
  category_2        text,

  -- ket qua tra cuu
  flow              text check (flow in ('new','existing','repitch')),
  matched_brand_id  bigint references public.brand_history(id) on delete set null,

  -- ket qua brief (chi voi flow='new')
  brief_filename    text,
  brief_valid       boolean,
  gate_missing      jsonb,           -- nhom/field bat buoc con thieu
  gate_grid         jsonb,           -- 14 truong: co/khong + nguon
  brief_schema      jsonb,           -- toan bo schema parse tu .xlsx
  brief_warnings    jsonb,           -- unit_inferred, SKU rong, template cu...

  -- verdict
  tier              text,
  score             numeric,
  band              text,
  prio              text,            -- Hunt Priority
  model             text,            -- commercial model de xuat
  verdict_pos       text,
  verdict_head      text,
  verdict_risk      text,
  verdict_next      text,
  verdict_source    text,            -- 'history' | 'live' | 'prebake'

  -- so lieu chot de bao cao nhanh, khong phai parse lai jsonb
  gmv_ti            numeric,         -- GMV 365D dung trong benchmark
  aov_vnd           numeric,
  target_ti         numeric,         -- target 12M quy ra ti VND
  target_gap_pct    numeric,         -- chenh lech target moi vs quy mo cu

  -- ai chay, xuat gi
  run_by            text,            -- ten/email VA tu nhap (app public, khong login)
  exported_pptx     boolean not null default false,
  app_version       text
);

create index if not exists analysis_run_created_idx on public.analysis_run (created_at desc);
create index if not exists analysis_run_brand_idx   on public.analysis_run (brand_name);
create index if not exists analysis_run_prio_idx    on public.analysis_run (prio);
create index if not exists analysis_run_flow_idx    on public.analysis_run (flow);

-- ---------------------------------------------------------------------------
-- 11. VIEW bao cao — dung cho trang /runs va export Excel.
-- ---------------------------------------------------------------------------
create or replace view public.v_run_summary as
select
  date_trunc('month', r.created_at)                as month,
  r.flow,
  r.prio,
  r.band,
  count(*)                                         as runs,
  count(distinct r.brand_name)                     as brands,
  round(avg(r.score)::numeric, 1)                  as avg_score,
  round(avg(r.gmv_ti)::numeric, 1)                 as avg_gmv_ti,
  sum(case when r.exported_pptx then 1 else 0 end) as decks_exported
from public.analysis_run r
group by 1,2,3,4;

-- ============================================================================
-- RLS — app chay PUBLIC (khong login). anon chi doc reference, ghi analysis_run.
-- ============================================================================
alter table public.market_kpi          enable row level security;
alter table public.market_period       enable row level security;
alter table public.subcategory         enable row level security;
alter table public.subcategory_channel enable row level security;
alter table public.price_band          enable row level security;
alter table public.competitor_bucket   enable row level security;
alter table public.competitor          enable row level security;
alter table public.scoring_rule        enable row level security;
alter table public.validation_list     enable row level security;
alter table public.brand_history       enable row level security;
alter table public.analysis_run        enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'market_kpi','market_period','subcategory','subcategory_channel','price_band',
    'competitor_bucket','competitor','scoring_rule','validation_list','brand_history'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_anon_read', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_anon_read', t);
  end loop;
end $$;

-- analysis_run: cho phep doc + ghi moi, KHONG cho sua/xoa
drop policy if exists analysis_run_anon_read   on public.analysis_run;
drop policy if exists analysis_run_anon_insert on public.analysis_run;
create policy analysis_run_anon_read   on public.analysis_run
  for select to anon, authenticated using (true);
create policy analysis_run_anon_insert on public.analysis_run
  for insert to anon, authenticated with check (true);
