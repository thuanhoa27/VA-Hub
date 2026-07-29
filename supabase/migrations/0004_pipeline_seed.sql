-- ============================================================================
-- 0004_pipeline_seed.sql — SINH TU DONG boi scripts/generate-pipeline-seed.mjs.
-- DUNG SUA TAY. Sua o scripts/_source/pipeline/data/pipeline.json roi chay
-- `npm run seed:pipeline`.
-- Nguon: scripts/_source/pipeline/data/pipeline.json
-- Sinh luc: 2026-07-29T10:02:07.477Z
--
-- AN TOAN: chay lai bao nhieu lan cung khong xoa data dang co.
--   * pipeline_deal            : chi insert KHI BANG RONG
--   * pipeline_validation_list : on conflict do nothing
--   * pipeline_meta            : on conflict do nothing
-- Muon reset that: `truncate table public.pipeline_deal;` roi chay lai file nay.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- pipeline_deal — 8 deal bootstrap
-- ---------------------------------------------------------------------------
do $$
begin
  if (select count(*) from public.pipeline_deal) > 0 then
    raise notice '[0004] pipeline_deal da co data — BO QUA phan seed deal (khong ghi de).';
  else
    insert into public.pipeline_deal
      (scope, stage, no, brand, brand_key, tier, model, cd, elephant, cat, va,
       channel, status, month, date_text, date_iso, usd, vnd, sort_order)
    values
      ('VA_DISTRIBUTION', 'Go Live', 1, 'Hector', 'hector', 'Tier 2', 'Consignment', 'Thao Pham', 'NO', 'Health', 'Quyen Ngo', 'ECOM & TTS', 'Lived', 1, '1/19/2026', '2026-01-19', 567148, 15114490073, 1),
      ('VA_DISTRIBUTION', 'Go Live', 2, 'BeanStalk', 'beanstalk', 'Tier 2', 'Outright', 'Ngoc Pham', 'NO', 'Mom & Babies', 'Anh Nguyen', 'SHP & TTS', 'Lived', 2, '2/27/2026', '2026-02-27', 562852, 15000000000, 2),
      ('VA_DISTRIBUTION', 'Verbal', 1, 'LaVie', 'lavie', 'Tier 2', 'Outright', 'Nhung Nguyen', 'YES', 'F&B', 'Hue Phan', 'TTS', 'Onboarding', 6, 'TBU', null, 304958, 8127138137, 1),
      ('VA_DISTRIBUTION', 'Verbal', 2, 'DETECH BIO', 'detechbio', 'Tier 1', 'Service', 'Duy Tran', 'YES', 'Mom & Babies', 'Minh Do', 'SHP & TTS', 'Verbally Agreement', 6, '6/30/2026', '2026-06-30', 1067947, 28460793404, 2),
      ('VA_DISTRIBUTION', 'Verbal', 3, 'Reckitt - OTC', 'reckittotc', 'Tier 3', 'Outright', 'Thao Pham', 'NO', 'Health', 'Quyen Ngo', 'Ecom', 'Verbally Agreement', 6, '6/1/2026', '2026-06-01', 150000, 3997500000, 3),
      ('VA_DISTRIBUTION', 'Potential', 1, 'FATZ BABY', 'fatzbaby', 'Tier 0', 'Outright', 'Duy Tran', 'YES', 'Mom & Babies', 'Minh Do', 'SHP & TTS', 'Negotiation', 6, '6/15/2026', '2026-06-15', 2469966, 65824593900, 1),
      ('VA_DISTRIBUTION', 'Potential', 2, 'Pierre Fabre', 'pierrefabre', 'Tier 2', 'Outright', 'Ngoc Pham', 'NO', 'Beauty', 'Anh Nguyen', 'ECOM & TTS', 'Negotiation', 7, '7/15/2026', '2026-07-15', 1879677, 50093392050, 2),
      ('VA_DISTRIBUTION', 'Potential', 3, 'LOREAL_LID project 1', 'loreallidproject1', 'Tier 1', 'Consignment', 'Thao Pham', 'YES', 'Beauty', 'Anh Nguyen', 'Ecom & TTS', 'Negotiation', 6, 'TBU', null, 245961, 6554860650, 3);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- pipeline_validation_list — 13 list / 82 gia tri
-- ---------------------------------------------------------------------------
insert into public.pipeline_validation_list (list_name, value, sort_order) values
  ('tier', 'Tier 0', 1),
  ('tier', 'Tier 1', 2),
  ('tier', 'Tier 2', 3),
  ('tier', 'Tier 3', 4),
  ('model', 'Consignment', 1),
  ('model', 'Outright', 2),
  ('model', 'Service', 3),
  ('cd', 'Duy Tran', 1),
  ('cd', 'Thao Vu', 2),
  ('cd', 'Ngoc Pham', 3),
  ('cd', 'Nhung Nguyen', 4),
  ('cd', 'Thao Pham', 5),
  ('elephant', 'YES', 1),
  ('elephant', 'NO', 2),
  ('cat', 'BEAUTY', 1),
  ('cat', 'EL', 2),
  ('cat', 'F&B', 3),
  ('cat', 'FASHION', 4),
  ('cat', 'FMCG', 5),
  ('cat', 'MOM & BABIES', 6),
  ('cat', 'HEALTH', 7),
  ('vaName', 'Anh Nguyen', 1),
  ('vaName', 'Quyen Ngo', 2),
  ('vaName', 'Hue Phan', 3),
  ('vaName', 'Thai Dinh', 4),
  ('vaName', 'Tu Nguyen', 5),
  ('vaName', 'Minh Do', 6),
  ('vaName', 'Trang Nguyen', 7),
  ('vaName', 'Under Commercial', 8),
  ('vaName', 'Business Expansion', 9),
  ('channel', 'ECOM & TTS', 1),
  ('channel', 'SHP', 2),
  ('channel', 'SHP & TTS', 3),
  ('channel', 'TTS', 4),
  ('channel', 'ECOM', 5),
  ('channel', 'D2C', 6),
  ('pendingParty', 'Brand', 1),
  ('pendingParty', 'LS Team', 2),
  ('pendingParty', 'AFF/INF Team', 3),
  ('pendingParty', 'Media Team', 4),
  ('pendingParty', 'Short Video Team', 5),
  ('pendingParty', 'VA Service', 6),
  ('pendingParty', 'VA Distribution', 7),
  ('pendingParty', 'Legal Team', 8),
  ('pendingParty', 'Fin/ Ops Team', 9),
  ('pendingParty', 'High level', 10),
  ('country', 'Korea', 1),
  ('country', 'China', 2),
  ('country', 'Thailand', 3),
  ('country', 'Others', 4),
  ('leadSource', 'Top100', 1),
  ('leadSource', 'HL - Fanpage', 2),
  ('leadSource', 'HL - Inquiry (brand send mail)', 3),
  ('leadSource', 'HL - Referral new client only', 4),
  ('leadSource', 'HL - Hotline', 5),
  ('leadStage', '1. Not Started', 1),
  ('leadStage', '2. First Contact (Email/ Call)', 2),
  ('leadStage', '3. First Meeting', 3),
  ('leadStage', '4. Processing Quotation/ Proposal', 4),
  ('leadStage', '5. Sent Quotation/ Proposal', 5),
  ('leadStage', '6. Negotiation', 6),
  ('leadStage', '7. Verbally Agreement', 7),
  ('leadStage', '8. Contract Signed', 8),
  ('leadStage', '9. Onboarding', 9),
  ('leadStage', '10. Lived', 10),
  ('status', '1st Meeting/ Contact', 1),
  ('status', 'Brand Briefing', 2),
  ('status', 'Processing Quotation/ Proposal', 3),
  ('status', 'Sent Quotation/ Proposal', 4),
  ('status', 'Negotiation', 5),
  ('status', 'Verbally Agreement', 6),
  ('status', 'Onboarding', 7),
  ('status', 'Lived', 8),
  ('status', 'Delay', 9),
  ('status', 'Rejected', 10),
  ('contractStatus', 'Drafting Docs', 1),
  ('contractStatus', 'Pending review by OP', 2),
  ('contractStatus', 'Pending review by Brand', 3),
  ('contractStatus', 'In signing process by OP', 4),
  ('contractStatus', 'In signing process by Brand', 5),
  ('contractStatus', 'Contract signed', 6),
  ('contractStatus', 'Cancel/ Delay', 7)
on conflict (list_name, value) do nothing;

-- ---------------------------------------------------------------------------
-- pipeline_meta — so official cho KPI card (xem PIPELINE_TAB.md muc 3)
-- ---------------------------------------------------------------------------
insert into public.pipeline_meta
  (scope, as_of, source, total_nmv_vnd, go_live_nmv_vnd, brand_go_live,
   brand_verbal, brand_potential, note)
values (
  'VA_DISTRIBUTION', '2026-07-28', 'Copy_of_validation.xlsx > Sheet3 > KPI header row',
  34000000000, 12000000000, 5,
  4, 2,
  'So official theo header source workbook. KPI card dung so nay khi KHONG filter; co filter thi doi sang so tinh tu rows.'
)
on conflict (scope) do nothing;

commit;

-- Doi chieu sau khi chay:
--   select * from public.v_pipeline_summary;              -- so TINH TU ROWS
--   select * from public.pipeline_meta;                   -- so OFFICIAL
