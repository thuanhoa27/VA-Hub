-- ============================================================================
-- OnPoint · VA Distribution Performance (tab /pipeline) — Supabase schema
-- Migration 0003: 3 bang cua tab Pipeline + RLS + view doi chieu KPI
--
-- BOI CANH: tab /pipeline dang doc file tinh public/pipeline/data/pipeline.json.
-- Migration nay chuyen sang doc DB de sua deal khong can redeploy.
--
-- ---------------------------------------------------------------------------
-- NGUYEN TAC ISOLATION — doc truoc khi sua
-- ---------------------------------------------------------------------------
-- 1. KHONG dung chung bang voi tab Analyze. Cu the la KHONG nhoi
--    validationLists cua pipeline vao public.validation_list dang co.
--    Ly do: 2 ben trung ten list (tier / model / cat / channel / status /
--    elephant) nhung KHAC gia tri. Pipeline: tier = 'Tier 0..3'. Engine:
--    tier = 'ELEPHANT (T1)'... Nhoi chung se lam engine doc sai list va pha
--    298 assertion cua test suite. Nen co bang rieng:
--    public.pipeline_validation_list.
--
-- 2. brand_key la cot join sang public.brand_history(name) cua tab Analyze —
--    CO Y KHONG dat foreign key. Pipeline co brand chua bao gio qua BrandHunt
--    (va nguoc lai). FK se chan insert deal moi. Join khi can bao cao, khong
--    rang buoc luc ghi.
--
-- 3. GHI: chi service_role (Table Editor / script seed). anon CHI DUOC DOC.
--    App dang public khong auth (xem PIPELINE_TAB.md muc 6) — mo quyen ghi cho
--    anon nghia la bat ky ai co URL cung sua duoc NMV forecast va ten brand.
--    Khi nao co auth thi them policy ghi cho role 'authenticated'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PIPELINE DEAL — 1 dong = 1 deal, dung shape cua SCHEMA.md
--    Ten cot snake_case; src/lib/pipelineData.js map sang camelCase (dateISO)
--    ma module pipeline.js doc. KHONG doi ten cot theo module — lop adapter lo.
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_deal (
  id          bigserial primary key,
  scope       text not null default 'VA_DISTRIBUTION',

  -- stage quyet dinh deal nam o bang nao trong 3 bang cua dashboard.
  -- Module TRUST cot nay, khong tu suy ra tu status (SCHEMA.md muc Stages).
  stage       text not null check (stage in ('Go Live', 'Verbal', 'Potential')),
  no          int  not null,          -- so thu tu TRONG bang cua stage do, khong unique toan cuc
  brand       text not null,          -- ten brand, free text theo business go
  brand_key   text not null,          -- brand lowercase, bo dau, bo ky tu khong phai [a-z0-9]

  tier        text,                   -- 'Tier 0'..'Tier 3'
  model       text,                   -- Consignment | Outright | Service
  cd          text,                   -- Commercial Deal owner
  elephant    text check (elephant in ('YES', 'NO')),
  cat         text,                   -- Health | Beauty | Mom & Babies ... (casing chua chuan hoa)
  va          text,                   -- VA phu trach
  channel     text,                   -- co the ghep nhieu gia tri: 'SHP & TTS'
  status      text,                   -- Lived | Onboarding | Negotiation ...

  -- month la thang KE HOACH (Lived Month / Lived Month based on BP), luon co
  -- ngay ca khi date = 'TBU'. Chart 1 va filter Month chay tren cot nay.
  month       int check (month between 1 and 12),
  date_text   text,                   -- nguyen van o Excel: '6/30/2026' hoac 'TBU'
  date_iso    date,                   -- null khi date_text = 'TBU' -> khong len duoc view Day/Week

  usd         numeric,                -- NMV (USD)
  vnd         numeric,                -- NMV (VND) — day la don vi cua KPI card (BIL)

  -- Soft delete: anon khong co quyen delete, va giu lai dau vet deal bi huy.
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  note        text,
  updated_at  timestamptz not null default now(),

  unique (scope, stage, brand_key)
);

create index if not exists pipeline_deal_stage_idx  on public.pipeline_deal (stage);
create index if not exists pipeline_deal_bkey_idx   on public.pipeline_deal (brand_key);
create index if not exists pipeline_deal_active_idx on public.pipeline_deal (is_active);

-- ---------------------------------------------------------------------------
-- 2. PIPELINE VALIDATION LIST — dropdown filter cua tab.
--    Chua TOAN BO gia tri hop le (khong chi gia tri dang xuat hien trong deal)
--    de dropdown hoat dong giong data-validation cua Excel goc.
--    list_name: tier|model|cd|elephant|cat|vaName|channel|status|
--               pendingParty|country|leadSource|leadStage|contractStatus
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_validation_list (
  id         bigserial primary key,
  list_name  text not null,
  value      text not null,
  sort_order int  not null default 0,
  unique (list_name, value)
);

-- ---------------------------------------------------------------------------
-- 3. PIPELINE META — so official cua KPI card (che do "Official figures").
--    Xem PIPELINE_TAB.md muc 3: header workbook ghi 34 BIL / 5 brand Go Live,
--    nhung tong cac dong deal ra 193 BIL / 2 dong. Business muon KPI card khop
--    so dang bao cao, nen so official nam o day va CHI dung khi khong filter.
--    Thieu/sai kieu -> module tu fallback ve so tinh tu rows + console.warn.
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_meta (
  scope             text primary key default 'VA_DISTRIBUTION',
  as_of             date,
  source            text,             -- vi du: 'Copy_of_validation.xlsx > Sheet3 > KPI header row'
  total_nmv_vnd     numeric,
  go_live_nmv_vnd   numeric,
  brand_go_live     int,
  brand_verbal      int,
  brand_potential   int,
  note              text,
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. VIEW doi chieu — so TINH TU ROWS, de so voi pipeline_meta.
--    Dung khi ai hoi "sao KPI card lech so trong bang": chay view nay ra so
--    thuc, so voi pipeline_meta ra so official.
-- ---------------------------------------------------------------------------
create or replace view public.v_pipeline_summary as
select
  d.scope,
  d.stage,
  count(*)                        as deals,
  count(distinct d.brand_key)     as brands,
  sum(d.vnd)                      as nmv_vnd,
  sum(d.usd)                      as nmv_usd,
  count(*) filter (where d.date_iso is null) as deals_tbu
from public.pipeline_deal d
where d.is_active
group by d.scope, d.stage;

-- ============================================================================
-- RLS — anon CHI DOC. Ghi bang service_role (Table Editor hoac script seed).
-- ============================================================================
alter table public.pipeline_deal            enable row level security;
alter table public.pipeline_validation_list enable row level security;
alter table public.pipeline_meta            enable row level security;

drop policy if exists pipeline_deal_anon_read            on public.pipeline_deal;
drop policy if exists pipeline_validation_list_anon_read on public.pipeline_validation_list;
drop policy if exists pipeline_meta_anon_read            on public.pipeline_meta;

create policy pipeline_deal_anon_read on public.pipeline_deal
  for select to anon, authenticated using (true);
create policy pipeline_validation_list_anon_read on public.pipeline_validation_list
  for select to anon, authenticated using (true);
create policy pipeline_meta_anon_read on public.pipeline_meta
  for select to anon, authenticated using (true);

-- KHONG co policy insert/update/delete cho anon — co y. Xem NGUYEN TAC 3 o dau file.
