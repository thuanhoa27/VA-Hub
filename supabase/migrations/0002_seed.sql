-- ============================================================================
-- 0002_seed.sql — SINH TU DONG boi scripts/generate-seed.mjs. DUNG SUA TAY.
-- Nguon: scripts/_source/data_line.js
-- Sinh luc: 2026-07-28T04:23:11.852Z
-- Idempotent: chay lai bao nhieu lan cung duoc (truncate roi insert lai
--             cac bang reference; analysis_run KHONG bi dong toi).
-- ============================================================================

begin;

truncate table public.competitor, public.competitor_bucket restart identity cascade;
truncate table public.market_period, public.subcategory, public.subcategory_channel,
               public.price_band, public.scoring_rule, public.validation_list,
               public.brand_history restart identity cascade;
delete from public.market_kpi;

-- 1. market_kpi (block1)
insert into public.market_kpi (scope, gmv12_ti, tiktok_share, hoh, yoy, item_h126_tr) values
  ('HEALTH_VN', 20532.3, 0.518, 0.193, 0.236, 78.5);

-- 2. market_period (block6)
insert into public.market_period (scope, period, sort_order, nmv_ti, shp, tts, item_tr) values
  ('HEALTH_VN', 'H1.2025', 0, 9039, 4845, 4194, 71.4),
  ('HEALTH_VN', 'H2.2025', 1, 9361, 4746, 4615, 74.6),
  ('HEALTH_VN', 'H1.2026', 2, 11171, 5385, 5787, 78.5);

-- 3. subcategory (block2)
insert into public.subcategory (scope, sub, gmv_ti, grow, bucket, pct, sort_order) values
  ('HEALTH_VN', 'Chăm sóc sức khỏe', 9713.7, 0.219, 'Nutrition & Wellness', 0.473, 0),
  ('HEALTH_VN', 'Thực phẩm chức năng', 7014.2, 0.184, 'Nutrition & Wellness', 0.342, 1),
  ('HEALTH_VN', 'Vật tư y tế', 3128.2, 0.19, 'Medical Supplies', 0.152, 2),
  ('HEALTH_VN', 'Sản phẩm hỗ trợ tình dục', 418.9, 0.203, 'Sexual Wellness', 0.02, 3),
  ('HEALTH_VN', 'Dinh dưỡng thể thao  protein', 222.8, -0.399, 'Nutrition & Wellness', 0.011, 4),
  ('HEALTH_VN', 'Sức khỏe khác', 30.7, 0.135, 'Nutrition & Wellness', 0.001, 5),
  ('HEALTH_VN', 'Thiết bị massage', 3.8, 1.397, 'Medical Supplies', 0, 6);

-- 4. subcategory_channel (block5)
insert into public.subcategory_channel (scope, sub, shp, tts, sort_order) values
  ('HEALTH_VN', 'Chăm sóc sức khỏe', 0.481, 0.519, 0),
  ('HEALTH_VN', 'Thực phẩm chức năng', 0.365, 0.635, 1),
  ('HEALTH_VN', 'Vật tư y tế', 0.695, 0.305, 2),
  ('HEALTH_VN', 'Sản phẩm hỗ trợ tình dục', 1, 0, 3),
  ('HEALTH_VN', 'Sức khỏe khác', 1, 0, 4),
  ('HEALTH_VN', 'Dinh dưỡng thể thao  protein', 0, 1, 5),
  ('HEALTH_VN', 'Thiết bị massage', 0, 1, 6);

-- 5. price_band (block3) — sort_order giu nguyen thu tu goc de ve chart dung
insert into public.price_band (scope, band, pct, sort_order) values
  ('HEALTH_VN', '< 10.000₫', 0.001, 0),
  ('HEALTH_VN', '10.000₫ - 30.000₫', 0.016, 1),
  ('HEALTH_VN', '30.000₫ - 50.000₫', 0.034, 2),
  ('HEALTH_VN', '50.000₫ - 75.000₫', 0.069, 3),
  ('HEALTH_VN', '75.000₫ - 100.000₫', 0.075, 4),
  ('HEALTH_VN', '100.000₫ - 150.000₫', 0.117, 5),
  ('HEALTH_VN', '150.000₫ - 200.000₫', 0.114, 6),
  ('HEALTH_VN', '200.000₫ - 350.000₫', 0.168, 7),
  ('HEALTH_VN', '350.000₫ - 500.000₫', 0.092, 8),
  ('HEALTH_VN', '500.000₫ - 750.000₫', 0.073, 9),
  ('HEALTH_VN', '750.000₫ - 1.000.000₫', 0.058, 10),
  ('HEALTH_VN', '1.000.000₫ - 1.500.000₫', 0.065, 11),
  ('HEALTH_VN', '1.500.000₫ - 2.000.000₫', 0.037, 12),
  ('HEALTH_VN', '2.000.000₫ - 3.500.000₫', 0.04, 13),
  ('HEALTH_VN', '3.500.000₫ - 5.000.000₫', 0.017, 14),
  ('HEALTH_VN', '5.000.000₫ - 7.500.000₫', 0.007, 15),
  ('HEALTH_VN', '7.500.000₫ - 10.000.000₫', 0.005, 16),
  ('HEALTH_VN', '10.000.000₫ - 15.000.000₫', 0.011, 17),
  ('HEALTH_VN', '15.000.000₫ - 20.000.000₫', 0.002, 18),
  ('HEALTH_VN', '20.000.000₫ - 25.000.000₫', 0, 19);

-- 6. competitor_bucket + competitor (Kalodata)
insert into public.competitor_bucket (bucket, scope, subtot_ti) values
  ('Nutrition & Wellness', 'HEALTH_VN', 1642.4),
  ('Medical Supplies', 'HEALTH_VN', 324.1);

insert into public.competitor
  (bucket, sort_order, brand, gmv_ti, price, aff, seller, mall, item, creator, ls, video, gmv_ls, share)
values
  ('Nutrition & Wellness', 0, 'drcung', 85.9, 704493, 0.414, 0.394, 0.193, 121989, 3802, 17658, 15379, 4.9, 0.0523),
  ('Nutrition & Wellness', 1, 'tiến sĩ an', 83.9, 1253142, 0.712, 0.002, 0.286, 66946, 1140, 8612, 10852, 9.7, 0.0511),
  ('Nutrition & Wellness', 2, 'dsd arma', 51.2, 194850, 0.985, 0.015, 0, 262552, 5307, 25413, 55526, 2, 0.0311),
  ('Nutrition & Wellness', 3, 'fresheen health', 49.6, 168758, 0.886, 0.112, 0.003, 363982, 3209, 12298, 32151, 4, 0.0302),
  ('Nutrition & Wellness', 4, 'adapharma', 41.7, 116923, 0.986, 0.013, 0.001, 356964, 6533, 36064, 60981, 1.2, 0.0254),
  ('Nutrition & Wellness', 5, 'wonderplusvn', 38.8, 82193, 0.953, 0.045, 0.002, 471911, 18315, 39052, 163073, 1, 0.0236),
  ('Medical Supplies', 0, 'khẩu trang - thịnh phát', 36.4, 65611, 0.987, 0.01, 0.003, 554954, 32266, 146093, 163515, 0.2, 0.1123),
  ('Medical Supplies', 1, 'thịnh phát khẩu trang', 22.9, 58211, 0.957, 0.042, 0.001, 394240, 13213, 64480, 105732, 0.4, 0.0708),
  ('Medical Supplies', 2, 'khăn ướt khăn giấy an hà phát', 19.7, 97410, 0.893, 0.072, 0.035, 202405, 5075, 21458, 35903, 0.9, 0.0608),
  ('Medical Supplies', 3, 'nikita', 17.6, 4053341, 0.11, 0.017, 0.873, 4332, 367, 294, 1525, 59.7, 0.0542),
  ('Medical Supplies', 4, 'khẩu trang cửu long vie mask', 16.5, 48773, 0.829, 0, 0.171, 338791, 3816, 27211, 34689, 0.6, 0.051),
  ('Medical Supplies', 5, 'eguoo việt nam', 14.1, 92394, 0.988, 0, 0.012, 152225, 2868, 8122, 28870, 1.7, 0.0434);

-- 7. scoring_rule (rule) — sua nguong o day, khong can deploy lai app
insert into public.scoring_rule (kind, sort_order, threshold, label, factor_key, weight) values
  ('tier', 0, 60, 'ELEPHANT (T1)', null, null),
  ('tier', 1, 15, 'TIER 2', null, null),
  ('tier', 2, 0, 'TIER 3', null, null),
  ('band', 0, 70, 'HIGH', null, null),
  ('band', 1, 40, 'MED', null, null),
  ('band', 2, 0, 'LOW', null, null),
  ('factor', 0, null, null, 'A', 0.25),
  ('factor', 1, null, null, 'B', 0.15),
  ('factor', 2, null, null, 'C', 0.2),
  ('factor', 3, null, null, 'D', 0.15),
  ('factor', 4, null, null, 'E', 0.15),
  ('factor', 5, null, null, 'F', 0.1);

-- 8. validation_list (lists) — 10 danh sach pill
insert into public.validation_list (list_name, value, sort_order) values
  ('cat', 'BEAUTY', 0),
  ('cat', 'EL', 1),
  ('cat', 'F&B', 2),
  ('cat', 'FASHION', 3),
  ('cat', 'FMCG', 4),
  ('cat', 'MOM & BABIES', 5),
  ('cat', 'HEALTH', 6),
  ('tier', 'Tier 2', 0),
  ('tier', 'Tier 1', 1),
  ('tier', 'Tier 0', 2),
  ('tier', 'Tier 3', 3),
  ('elephant', 'NO', 0),
  ('elephant', 'YES', 1),
  ('model', 'Consignment', 0),
  ('model', 'Service', 1),
  ('model', 'Outright', 2),
  ('channel', 'ECOM & TTS', 0),
  ('channel', 'SHP', 1),
  ('channel', 'TTS', 2),
  ('channel', 'ECOM', 3),
  ('channel', 'D2C', 4),
  ('status', '1. Not Started', 0),
  ('status', '2. First Contact (Email/ Call)', 1),
  ('status', '3. First Meeting', 2),
  ('status', '4. Processing Quotation/ Proposal', 3),
  ('status', '5. Sent Quotation/ Proposal', 4),
  ('status', '6. Negotiation', 5),
  ('status', '7. Verbally Agreement', 6),
  ('status', '8. Contract Signed', 7),
  ('status', '9. Onboarding', 8),
  ('status', '10. Lived', 9),
  ('contract', 'Drafting Docs', 0),
  ('contract', 'Pending review by OP', 1),
  ('contract', 'Pending review by Brand', 2),
  ('contract', 'In signing process by OP', 3),
  ('contract', 'In signing process by Brand', 4),
  ('contract', 'Contract signed', 5),
  ('contract', 'Cancel/ Delay', 6),
  ('pending', 'Brand', 0),
  ('pending', 'LS Team', 1),
  ('pending', 'AFF/INF Team', 2),
  ('pending', 'Media Team', 3),
  ('pending', 'Short Video Team', 4),
  ('pending', 'VA Service', 5),
  ('pending', 'VA Distribution', 6),
  ('pending', 'Legal Team', 7),
  ('pending', 'Fin/ Ops Team', 8),
  ('pending', 'High level', 9),
  ('country', 'Korea', 0),
  ('country', 'China', 1),
  ('country', 'Thailand', 2),
  ('country', 'Others', 3),
  ('lead', 'Top100', 0),
  ('lead', 'HL - Fanpage', 1),
  ('lead', 'HL - Inquiry (brand send mail)', 2),
  ('lead', 'HL - Referral new client only', 3),
  ('lead', 'HL - Hotline', 4);

-- 9. brand_history (history) — pipeline tracker, 40 column
insert into public.brand_history (
  "name", "group", "tier", "model", "status", "sub", "gmv", "score", "band", "prio", "pos", "head", "risk", "next", "blocker", "pic", "va", "cd", "elephant", "cat", "channel", "contract", "country", "pending", "lead", "nmv26_usd", "nmv26_vnd", "nmv12_usd", "nmv12_vnd", "linkStore", "linkProposal", "linkBP", "livedDate", "analysisDate", "linkOut", "notes", "c_name", "c_pos", "c_email", "c_phone", sort_order
) values
  ('VitaNova Health', null, 'Tier 1', 'Consignment', '1. Not Started', 'Nutrition & Wellness', 82, 75, 'HIGH', 'P1', 'Tier 1, nhóm TPCN/CSSK - sub-cat lớn nhất ngành (~81% GMV); brand nằm top 15% theo GMV.', 'Dư địa: mở rộng SKU combo liệu trình, tăng cadence Livestream, thêm kho HN để phủ miền Bắc.', 'Rủi ro: cần công bố TPCN đầy đủ trước khi quote; phụ thuộc 2-3 KOL chính.', '1) Chốt catalogue + P&L kỳ vọng · 2) Dựng BP theo Rate Card · 3) Pitch trong 2 tuần.', 'Chờ nội bộ brand duyệt ngân sách', 'Thao Pham', 'Thai Dinh', 'Thao Pham', 'YES', 'HEALTH', 'ECOM & TTS', null, 'Others', null, 'Kalodata', 4164567, 105780000000, 3228346, 82000000000, 'https://shopee.vn/vitanovahealth', null, null, null, '2026-06-18', 'VitaNovaHealth_Analysis_2026.pdf', 'Lead nguồn Kalodata', 'Nguyen Minh Anh', 'E-commerce Director', 'a.nguyen@vitanova.vn', '0921 200 300', 0),
  ('NutriLife Vietnam', null, 'Tier 1', 'Consignment', '4. Processing Quotation/ Proposal', 'Nutrition & Wellness', 64, 78, 'HIGH', 'P1', 'Tier 1 trong Nutrition & Wellness; growth kênh TikTok tốt, cạnh tranh cao với brand nhập khẩu.', 'Dư địa: mở rộng SKU combo liệu trình, tăng cadence Livestream, thêm kho HN để phủ miền Bắc.', 'Compliance: kiểm tra giấy phép TPCN & quảng cáo y tế; cạnh tranh giá với hàng xách tay.', '1) Chốt catalogue + P&L kỳ vọng · 2) Dựng BP theo Rate Card · 3) Pitch trong 2 tuần.', 'Chưa có - đang tiến triển tốt', 'Thao Pham', 'Minh Do', 'Thao Pham', 'YES', 'HEALTH', 'ECOM', 'Drafting Docs', 'China', null, 'Top100', 3124409, 79360000000, 2519685, 64000000000, 'https://shopee.vn/nutrilifevietnam', null, null, null, '2026-03-26', 'NutriLifeVietnam_Analysis_2026.pdf', 'Lead nguồn Top100', 'Tran Thi Bich', 'Head of E-commerce', 'b.tran@nutrilife.vn', '0928 237 353', 1),
  ('WellGreen', null, 'Tier 2', 'Consignment', '4. Processing Quotation/ Proposal', 'Nutrition & Wellness', 43, 56, 'MED', 'P2', 'Tier 2, nhóm TPCN/CSSK - sub-cat lớn nhất ngành (~81% GMV); brand nằm top 25% theo GMV.', 'Headroom: chuyển dịch từ affiliate sang brand-store + Mall, tối ưu SOR đa kênh.', 'Compliance: kiểm tra giấy phép TPCN & quảng cáo y tế; cạnh tranh giá với hàng xách tay.', '1) Qualify thêm data Kalodata · 2) Gửi credential + tier deck · 3) Đặt lịch pitch tháng tới.', 'Chưa có - đang tiến triển tốt', 'Thao Pham', 'Thai Dinh', 'Thao Pham', 'NO', 'HEALTH', 'D2C', 'Pending review by OP', 'Others', null, 'Top100', 1912992, 48589999999, 1692913, 43000000000, 'https://shopee.vn/wellgreen', null, null, null, '2026-03-26', 'WellGreen_Analysis_2026.pdf', 'Lead nguồn Top100', 'Le Van Cuong', 'Digital Sales Manager', 'c.le@wellgreen.vn', '0935 274 406', 2),
  ('DailyVit', null, 'Tier 2', 'Service', '9. Onboarding', 'Nutrition & Wellness', 31, 54, 'MED', 'P2', 'Tier 2 trong Nutrition & Wellness; growth kênh TikTok tốt, cạnh tranh cao với brand nhập khẩu.', 'Dư địa: mở rộng SKU combo liệu trình, tăng cadence Livestream, thêm kho HN để phủ miền Bắc.', 'Rủi ro: cần công bố TPCN đầy đủ trước khi quote; phụ thuộc 2-3 KOL chính.', '1) Qualify thêm data Kalodata · 2) Gửi credential + tier deck · 3) Đặt lịch pitch tháng tới.', 'Chờ brand gửi P&L kỳ vọng', 'Thao Pham', 'Trang Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'SHP', 'In signing process by Brand', 'Others', null, 'Top100', 1598819, 40610000000, 1220472, 31000000000, 'https://shopee.vn/dailyvit', 'Proposal_DailyVit.pdf', 'BP_DailyVit.xlsx', null, '2026-06-08', 'DailyVit_Analysis_2026.pdf', 'Lead nguồn Top100', 'Pham Thu Dung', 'E-commerce Manager', 'd.pham@dailyvit.vn', '0942 311 459', 3),
  ('OmegaPlus', null, 'Tier 2', 'Outright', '8. Contract Signed', 'Nutrition & Wellness', 22, 60, 'MED', 'P2', 'Tier 2, nhóm TPCN/CSSK - sub-cat lớn nhất ngành (~81% GMV); brand nằm top 20% theo GMV.', 'Headroom: chuyển dịch từ affiliate sang brand-store + Mall, tối ưu SOR đa kênh.', 'Rủi ro: cần công bố TPCN đầy đủ trước khi quote; phụ thuộc 2-3 KOL chính.', '1) Qualify thêm data Kalodata · 2) Gửi credential + tier deck · 3) Đặt lịch pitch tháng tới.', 'Chưa có - đang tiến triển tốt', 'Thao Pham', 'Quyen Ngo', 'Thao Pham', 'NO', 'HEALTH', 'SHP', 'In signing process by Brand', 'Thailand', null, 'Top100', 987402, 25079999999, 866142, 22000000000, 'https://shopee.vn/omegaplus', 'Proposal_OmegaPlus.pdf', 'BP_OmegaPlus.xlsx', null, '2026-06-06', 'OmegaPlus_Analysis_2026.pdf', 'Lead nguồn Top100', 'Hoang Duc Em', 'Head of Online Sales', 'e.hoang@omegaplus.vn', '0949 348 512', 4),
  ('ImmunaBoost', null, 'Tier 2', 'Consignment', '9. Onboarding', 'Nutrition & Wellness', 17, 60, 'MED', 'P2', 'Tier 2, nhóm TPCN/CSSK - sub-cat lớn nhất ngành (~81% GMV); brand nằm top 10% theo GMV.', 'Dư địa: mở rộng SKU combo liệu trình, tăng cadence Livestream, thêm kho HN để phủ miền Bắc.', 'Compliance: kiểm tra giấy phép TPCN & quảng cáo y tế; cạnh tranh giá với hàng xách tay.', '1) Qualify thêm data Kalodata · 2) Gửi credential + tier deck · 3) Đặt lịch pitch tháng tới.', 'Chờ hồ sơ compliance/công bố', 'Thao Pham', 'Minh Do', 'Thao Pham', 'NO', 'HEALTH', 'TTS', 'In signing process by OP', 'Korea', null, 'HL - Hotline', 850000, 21590000000, 669291, 17000000000, 'https://shopee.vn/immunaboost', 'Proposal_ImmunaBoost.pdf', 'BP_ImmunaBoost.xlsx', null, '2026-03-03', 'ImmunaBoost_Analysis_2026.pdf', 'Lead nguồn Hotline', 'Vu Thi Giang', 'Digital Sales Manager', 'g.vu@immunaboost.vn', '0956 385 565', 5),
  ('HerbaCare', null, 'Tier 3', 'Consignment', '7. Verbally Agreement', 'Nutrition & Wellness', 12, 49, 'MED', 'P3', 'Tier 3, nhóm TPCN/CSSK - sub-cat lớn nhất ngành (~81% GMV); brand nằm top 15% theo GMV.', 'Headroom: chuyển dịch từ affiliate sang brand-store + Mall, tối ưu SOR đa kênh.', 'Compliance: kiểm tra giấy phép TPCN & quảng cáo y tế; cạnh tranh giá với hàng xách tay.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chưa có - đang tiến triển tốt', 'Thao Pham', 'Tu Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'ECOM', 'Contract signed', 'Others', null, 'Kalodata', 538583, 13679999999, 472441, 12000000000, 'https://shopee.vn/herbacare', 'Proposal_HerbaCare.pdf', 'BP_HerbaCare.xlsx', null, '2026-04-12', 'HerbaCare_Analysis_2026.pdf', 'Lead nguồn Kalodata', 'Dang Van Hung', 'E-commerce Executive', 'h.dang@herbacare.vn', '0963 422 618', 6),
  ('GreenLeaf Supplements', null, 'Tier 3', 'Service', '3. First Meeting', 'Nutrition & Wellness', 8, 37, 'LOW', 'P3', 'Tier 3, nhóm TPCN/CSSK - sub-cat lớn nhất ngành (~81% GMV); brand nằm top 25% theo GMV.', 'Headroom: chuyển dịch từ affiliate sang brand-store + Mall, tối ưu SOR đa kênh.', 'Compliance: kiểm tra giấy phép TPCN & quảng cáo y tế; cạnh tranh giá với hàng xách tay.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chưa có - đang tiến triển tốt', 'Thao Pham', 'Trang Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'ECOM & TTS', null, 'Others', null, 'HL - Hotline', 396850, 10080000000, 314961, 8000000000, 'https://shopee.vn/greenleafsupplements', null, null, null, '2026-04-17', 'GreenLeafSupplements_Analysis_2026.pdf', 'Lead nguồn Hotline', 'Bui Thi Hoa', 'Online Channel Lead', 'h.bui@greenleaf.vn', '0970 459 671', 7),
  ('ProteinX Nutrition', null, 'Tier 3', 'Outright', '5. Sent Quotation/ Proposal', 'Nutrition & Wellness', 5, 51, 'MED', 'P3', 'Tier 3, nhóm TPCN/CSSK - sub-cat lớn nhất ngành (~81% GMV); brand nằm top 25% theo GMV.', 'Headroom: chuyển dịch từ affiliate sang brand-store + Mall, tối ưu SOR đa kênh.', 'Rủi ro: cần công bố TPCN đầy đủ trước khi quote; phụ thuộc 2-3 KOL chính.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chờ nội bộ brand duyệt ngân sách', 'Thao Pham', 'Tu Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'ECOM & TTS', 'Pending review by OP', 'China', null, 'HL - Hotline', 222441, 5649999999, 196850, 5000000000, 'https://shopee.vn/proteinxnutrition', 'Proposal_ProteinXNutrition.pdf', 'BP_ProteinXNutrition.xlsx', null, '2026-06-09', 'ProteinXNutrition_Analysis_2026.pdf', 'Lead nguồn Hotline', 'Do Minh Khoa', 'Sales Executive', 'k.do@proteinx.vn', '0977 496 724', 8),
  ('MediSafe', null, 'Tier 2', 'Consignment', '10. Lived', 'Medical Supplies', 58, 68, 'MED', 'P2', 'Tier 2, Vật tư y tế lệch Shopee (~70%); brand đứng top 15% nhưng bị giới hạn ngành hàng y tế trên TikTok.', 'Headroom: tăng phủ Shopee Mall, bổ sung chứng nhận thiết bị để mở thêm ngành hàng.', 'Compliance: hồ sơ nhập khẩu & lưu hành thiết bị y tế; SLA giao hàng 2 miền.', '1) Qualify thêm data Kalodata · 2) Gửi credential + tier deck · 3) Đặt lịch pitch tháng tới.', 'Chờ brand gửi P&L kỳ vọng', 'Thao Pham', 'Tu Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'ECOM & TTS', 'In signing process by OP', 'Others', null, 'HL - Hotline', 2603150, 66119999999, 2283465, 58000000000, 'https://shopee.vn/medisafe', 'Proposal_MediSafe.pdf', 'BP_MediSafe.xlsx', '2026-03-08', '2026-01-12', 'MediSafe_Analysis_2026.pdf', 'Lead nguồn Hotline', 'Ngo Thi Lan', 'E-commerce Manager', 'l.ngo@medisafe.vn', '0984 533 777', 9),
  ('CareFirst Medical', null, 'Tier 2', 'Outright', '2. First Contact (Email/ Call)', 'Medical Supplies', 39, 67, 'MED', 'P2', 'Tier 2, Vật tư y tế lệch Shopee (~70%); brand đứng top 30% nhưng bị giới hạn ngành hàng y tế trên TikTok.', 'Dư địa: đưa lên TikTok Shop (vướng policy y tế - cần hồ sơ), mở kênh D2C, chuẩn hoá catalogue.', 'Compliance: hồ sơ nhập khẩu & lưu hành thiết bị y tế; SLA giao hàng 2 miền.', '1) Qualify thêm data Kalodata · 2) Gửi credential + tier deck · 3) Đặt lịch pitch tháng tới.', 'Chưa có - đang tiến triển tốt', 'Thao Pham', 'Thai Dinh', 'Thao Pham', 'NO', 'HEALTH', 'SHP', null, 'Korea', null, 'HL - Hotline', 2057480, 52260000000, 1535433, 39000000000, 'https://shopee.vn/carefirstmedical', null, null, null, '2026-02-09', 'CareFirstMedical_Analysis_2026.pdf', 'Lead nguồn Hotline', 'Duong Van Minh', 'Head of Online Sales', 'm.duong@carefirst.vn', '0991 570 830', 10),
  ('VinaMed Supplies', null, 'Tier 2', 'Consignment', '7. Verbally Agreement', 'Medical Supplies', 26, 61, 'MED', 'P2', 'Tier 2 trong Medical Supplies; nhu cầu ổn định, rào cản compliance thiết bị y tế cần lưu ý.', 'Dư địa: đưa lên TikTok Shop (vướng policy y tế - cần hồ sơ), mở kênh D2C, chuẩn hoá catalogue.', 'Rủi ro: hạn chế ngành hàng y tế trên TikTok; cần chứng nhận thiết bị/ISO trước onboard.', '1) Qualify thêm data Kalodata · 2) Gửi credential + tier deck · 3) Đặt lịch pitch tháng tới.', 'Chờ brief bản đầy đủ', 'Thao Pham', 'Tu Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'SHP', 'In signing process by Brand', 'Korea', null, 'Kalodata', 1238583, 31460000000, 1023622, 26000000000, 'https://shopee.vn/vinamedsupplies', 'Proposal_VinaMedSupplies.pdf', 'BP_VinaMedSupplies.xlsx', null, '2026-01-11', 'VinaMedSupplies_Analysis_2026.pdf', 'Lead nguồn Kalodata', 'Ly Thi Ngoc', 'Digital Sales Manager', 'n.ly@vinamed.vn', '0998 607 883', 11),
  ('PulseMed', null, 'Tier 3', 'Consignment', '1. Not Started', 'Medical Supplies', 14, 36, 'LOW', 'P3', 'Tier 3 trong Medical Supplies; nhu cầu ổn định, rào cản compliance thiết bị y tế cần lưu ý.', 'Dư địa: đưa lên TikTok Shop (vướng policy y tế - cần hồ sơ), mở kênh D2C, chuẩn hoá catalogue.', 'Rủi ro: hạn chế ngành hàng y tế trên TikTok; cần chứng nhận thiết bị/ISO trước onboard.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Đang chờ phản hồi sau pitch', 'Thao Pham', 'Quyen Ngo', 'Thao Pham', 'NO', 'HEALTH', 'D2C', null, 'Thailand', null, 'Kalodata', 639370, 16239999999, 551181, 14000000000, 'https://shopee.vn/pulsemed', null, null, null, '2026-06-16', 'PulseMed_Analysis_2026.pdf', 'Lead nguồn Kalodata', 'Trinh Duc Phuc', 'E-commerce Executive', 'p.trinh@pulsemed.vn', '0915 644 136', 12),
  ('ThermoCare', null, 'Tier 3', 'Outright', '8. Contract Signed', 'Medical Supplies', 9, 59, 'MED', 'P3', 'Tier 3 trong Medical Supplies; nhu cầu ổn định, rào cản compliance thiết bị y tế cần lưu ý.', 'Headroom: tăng phủ Shopee Mall, bổ sung chứng nhận thiết bị để mở thêm ngành hàng.', 'Compliance: hồ sơ nhập khẩu & lưu hành thiết bị y tế; SLA giao hàng 2 miền.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chờ hồ sơ compliance/công bố', 'Thao Pham', 'Minh Do', 'Thao Pham', 'NO', 'HEALTH', 'ECOM & TTS', 'Contract signed', 'Others', null, 'Top100', 407480, 10350000000, 354331, 9000000000, 'https://shopee.vn/thermocare', 'Proposal_ThermoCare.pdf', 'BP_ThermoCare.xlsx', null, '2026-04-28', 'ThermoCare_Analysis_2026.pdf', 'Lead nguồn Top100', 'Cao Thi Quyen', 'Online Channel Lead', 'q.cao@thermocare.vn', '0922 681 189', 13),
  ('OrthoLife', null, 'Tier 3', 'Consignment', '6. Negotiation', 'Medical Supplies', 4, 57, 'MED', 'P3', 'Tier 3 trong Medical Supplies; nhu cầu ổn định, rào cản compliance thiết bị y tế cần lưu ý.', 'Dư địa: đưa lên TikTok Shop (vướng policy y tế - cần hồ sơ), mở kênh D2C, chuẩn hoá catalogue.', 'Compliance: hồ sơ nhập khẩu & lưu hành thiết bị y tế; SLA giao hàng 2 miền.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chờ brief bản đầy đủ', 'Thao Pham', 'Thai Dinh', 'Thao Pham', 'NO', 'HEALTH', 'D2C', 'Pending review by Brand', 'Others', null, 'Kalodata', 182677, 4640000000, 157480, 4000000000, 'https://shopee.vn/ortholife', 'Proposal_OrthoLife.pdf', 'BP_OrthoLife.xlsx', null, '2026-03-15', 'OrthoLife_Analysis_2026.pdf', 'Lead nguồn Kalodata', 'Ha Van Son', 'Sales Executive', 's.ha@ortholife.vn', '0929 718 242', 14),
  ('IntimaCare', null, 'Tier 2', 'Service', '9. Onboarding', 'Sexual Wellness', 19, 72, 'HIGH', 'P1', 'Tier 2, Sexual Wellness là ngách (~2% ngành) nhưng AOV & margin tốt; brand top 15%.', 'Headroom: mở rộng SKU, xây creator pool riêng, tận dụng margin cao để đầu tư content.', 'Compliance: kiểm duyệt nội dung & hình ảnh sản phẩm; đóng gói kín đáo.', '1) Chốt catalogue + P&L kỳ vọng · 2) Dựng BP theo Rate Card · 3) Pitch trong 2 tuần.', 'Chờ hồ sơ compliance/công bố', 'Thao Pham', 'Quyen Ngo', 'Thao Pham', 'NO', 'HEALTH', 'ECOM', 'Pending review by Brand', 'Others', null, 'Top100', 1002362, 25460000000, 748031, 19000000000, 'https://shopee.vn/intimacare', 'Proposal_IntimaCare.pdf', 'BP_IntimaCare.xlsx', null, '2026-02-28', 'IntimaCare_Analysis_2026.pdf', 'Lead nguồn Top100', 'Mai Thi Trang', 'E-commerce Manager', 't.mai@intimacare.vn', '0936 755 295', 15),
  ('LoveWell', null, 'Tier 3', 'Outright', '8. Contract Signed', 'Sexual Wellness', 11, 42, 'MED', 'P3', 'Tier 3 trong Sexual Wellness; kênh TikTok hạn chế quảng cáo, phụ thuộc affiliate/discreet packaging.', 'Dư địa: đẩy affiliate/short-video, đóng gói discreet, tối ưu AOV bằng bundle.', 'Rủi ro: chính sách quảng cáo nhạy cảm trên các sàn; phụ thuộc kênh affiliate.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Đang chờ phản hồi sau pitch', 'Thao Pham', 'Tu Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'ECOM & TTS', 'In signing process by Brand', 'China', null, 'Kalodata', 524016, 13310000000, 433071, 11000000000, 'https://shopee.vn/lovewell', 'Proposal_LoveWell.pdf', 'BP_LoveWell.xlsx', null, '2026-02-02', 'LoveWell_Analysis_2026.pdf', 'Lead nguồn Kalodata', 'Phan Minh Uyen', 'Online Channel Lead', 'u.phan@lovewell.vn', '0943 792 348', 16),
  ('VitaLove', null, 'Tier 3', 'Consignment', '10. Lived', 'Sexual Wellness', 7, 35, 'LOW', 'P3', 'Tier 3, Sexual Wellness là ngách (~2% ngành) nhưng AOV & margin tốt; brand top 30%.', 'Dư địa: đẩy affiliate/short-video, đóng gói discreet, tối ưu AOV bằng bundle.', 'Rủi ro: chính sách quảng cáo nhạy cảm trên các sàn; phụ thuộc kênh affiliate.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chờ brief bản đầy đủ', 'Thao Pham', 'Anh Nguyen', 'Thao Pham', 'NO', 'HEALTH', 'D2C', 'Contract signed', 'Korea', null, 'HL - Hotline', 338976, 8610000000, 275591, 7000000000, 'https://shopee.vn/vitalove', 'Proposal_VitaLove.pdf', 'BP_VitaLove.xlsx', '2026-01-22', '2026-01-20', 'VitaLove_Analysis_2026.pdf', 'Lead nguồn Hotline', 'Ta Thi Van', 'Sales Executive', 'v.ta@vitalove.vn', '0950 829 401', 17),
  ('PleasureLab', null, 'Tier 3', 'Consignment', '1. Not Started', 'Sexual Wellness', 3, 53, 'MED', 'P3', 'Tier 3 trong Sexual Wellness; kênh TikTok hạn chế quảng cáo, phụ thuộc affiliate/discreet packaging.', 'Headroom: mở rộng SKU, xây creator pool riêng, tận dụng margin cao để đầu tư content.', 'Rủi ro: chính sách quảng cáo nhạy cảm trên các sàn; phụ thuộc kênh affiliate.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chờ nội bộ brand duyệt ngân sách', 'Thao Pham', 'Thai Dinh', 'Thao Pham', 'NO', 'HEALTH', 'SHP', null, 'China', null, 'Top100', 147638, 3750000000, 118110, 3000000000, 'https://shopee.vn/pleasurelab', null, null, null, '2026-06-11', 'PleasureLab_Analysis_2026.pdf', 'Lead nguồn Top100', 'Chu Van Xuan', 'E-commerce Executive', 'x.chu@pleasurelab.vn', '0957 866 454', 18),
  ('DiscreetPlus', null, 'Tier 3', 'Service', '2. First Contact (Email/ Call)', 'Sexual Wellness', 2, 44, 'MED', 'P3', 'Tier 3, Sexual Wellness là ngách (~2% ngành) nhưng AOV & margin tốt; brand top 30%.', 'Dư địa: đẩy affiliate/short-video, đóng gói discreet, tối ưu AOV bằng bundle.', 'Rủi ro: chính sách quảng cáo nhạy cảm trên các sàn; phụ thuộc kênh affiliate.', '1) Watchlist, theo dõi growth 1 quý · 2) Nurture qua email/hotline · 3) Re-assess khi đạt ngưỡng.', 'Chưa có - đang tiến triển tốt', 'Thao Pham', 'Quyen Ngo', 'Thao Pham', 'NO', 'HEALTH', 'TTS', null, 'China', null, 'Kalodata', 86614, 2200000000, 78740, 2000000000, 'https://shopee.vn/discreetplus', null, null, null, '2026-03-05', 'DiscreetPlus_Analysis_2026.pdf', 'Lead nguồn Kalodata', 'Lam Thi Yen', 'Online Channel Lead', 'y.lam@discreetplus.vn', '0964 903 507', 19);

commit;

-- Kiem tra nhanh sau khi chay:
--   select count(*) from public.brand_history;      -- ky vong: 20
--   select count(*) from public.competitor;         -- ky vong: 12
--   select count(*) from public.validation_list;    -- ky vong: 57