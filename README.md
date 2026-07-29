# OnPoint · Brand Hunt & Tier Analyzer — Web App

Bản web của dashboard `BrandHunt_App_LIVE.html`, chạy trên **Next.js + Supabase + Vercel**.

Khác biệt lớn nhất so với file HTML cũ: **data nằm trong database chứ không nhúng cứng trong file**, và **mọi lần chạy phân tích đều được ghi lại** — nên báo cáo được hoạt động hunting theo tháng, việc mà bản HTML không làm được.

---

## Mục lục

1. [Kiến trúc — đọc trước khi sửa code](#1-kiến-trúc)
2. [Deploy: 3 bước](#2-deploy)
3. [Cập nhật data khi Excel thay đổi](#3-cập-nhật-data)
4. [Sửa logic nghiệp vụ](#4-sửa-logic-nghiệp-vụ)
5. [Xử lý sự cố](#5-xử-lý-sự-cố)
6. [Việc còn tồn đọng](#6-việc-còn-tồn-đọng)

> **Tab Pipeline (`/pipeline`)** là module riêng do team khác build, merge vào ngày 2026-07-29. Nó **không dùng chung gì** với engine BrandHunt. Tài liệu riêng: **[PIPELINE_TAB.md](./PIPELINE_TAB.md)**. Sửa ở `scripts/_source/pipeline/` rồi `npm run port:pipeline`.

---

## 1. Kiến trúc

### Quyết định quan trọng: KHÔNG viết lại engine bằng React

Ba file JS gốc (`brief_engine.js`, `app_new.js`, `pptx_export.js`) đang được khoá bởi **298 assertion**, trong đó **53 assertion chống rò rỉ thông tin nội bộ ra deck gửi brand** (Tier, Commercial Score, Hunt Priority, commercial model, Internal Brand Brief...). Viết lại bằng React đồng nghĩa vứt bỏ toàn bộ lớp bảo vệ đó và phải chứng minh lại từ đầu.

Nên kiến trúc là: **giữ nguyên engine từng byte, chỉ thay lớp vỏ.**

```
┌─ Next.js (React + Tailwind) ─────────────────────────────┐
│  AppHeader ·  /runs (báo cáo)  ·  Run-by bar             │  ← code MỚI, Tailwind
├───────────────────────────────────────────────────────────┤
│  BrandHuntApp.jsx                                         │  ← lớp host
│    1. loadReferenceData()  → Supabase                     │
│    2. engine.setData(DATA)                                │
│    3. mount SHELL_BODY (#p1 #p2 #p3)                      │
│    4. engine.attachGlobals()  → window.lookup() ...       │
│    5. onRun → saveRun() → analysis_run                    │
├───────────────────────────────────────────────────────────┤
│  src/lib/engine/index.js   (SINH TỰ ĐỘNG, 111 KB)        │  ← logic GỐC
│    = brief_engine.js + app_new.js + pptx_export.js        │
└───────────────────────────────────────────────────────────┘
                          ↕
┌─ Supabase (Postgres) ─────────────────────────────────────┐
│  READ-ONLY:  market_kpi · market_period · subcategory ·   │
│              subcategory_channel · price_band ·           │
│              competitor_bucket · competitor ·             │
│              scoring_rule · validation_list ·             │
│              brand_history                                │
│  GHI MỚI:    analysis_run  (insert-only, giữ audit trail) │
└───────────────────────────────────────────────────────────┘
```

### File nào là nguồn sự thật

| File | Vai trò | Sửa được? |
|---|---|---|
| `scripts/_source/*.js` | **Nguồn sự thật** của logic nghiệp vụ | ✅ sửa ở đây |
| `src/lib/engine/index.js` | Bản ghép tự động | ❌ sẽ bị ghi đè |
| `src/app/engine.css` | Tách tự động từ `shell.html` | ❌ sẽ bị ghi đè |
| `src/components/shellBody.js` | Tách tự động từ `shell.html` | ❌ sẽ bị ghi đè |
| `supabase/migrations/0002_seed.sql` | Sinh tự động từ `data_line.js` | ❌ sẽ bị ghi đè |
| `src/components/*.jsx`, `src/app/**` | Lớp vỏ React | ✅ sửa ở đây |
| `supabase/migrations/0001_schema.sql` | Schema DB | ✅ sửa ở đây |

Sau khi sửa `scripts/_source/`, chạy:

```bash
npm run port    # sinh lại engine/index.js + engine.css + shellBody.js
npm run seed    # sinh lại 0002_seed.sql (chỉ khi đổi data_line.js)
```

`npm run port` cũng tự chạy trong `prebuild`, nên Vercel luôn build từ source mới nhất.

### Thư viện

| | Trước | Sau |
|---|---|---|
| SheetJS | nhúng cứng 639 KB vào HTML | `npm: xlsx` (từ CDN chính chủ) |
| PptxGenJS + JSZip | nhúng cứng 461 KB | `npm: pptxgenjs` |
| Kết quả | 1 file 1.5 MB, **87% là thư viện** | code splitting, chỉ tải khi cần |

---

## 2. Deploy

Cần 3 tài khoản miễn phí: **GitHub**, **Supabase**, **Vercel**. Tổng thời gian ~20 phút.

### Bước 1 — Supabase (làm trước, vì Vercel cần key)

1. Vào https://supabase.com → **New project**
   - Name: `brandhunt`
   - Region: **Southeast Asia (Singapore)** — gần VN nhất, latency thấp
   - Database password: đặt một mật khẩu mạnh và **lưu lại** (dùng khi cần kết nối trực tiếp)
2. Đợi project khởi tạo xong (~2 phút).
3. Vào **SQL Editor** → **New query**:
   - Mở file `supabase/migrations/0001_schema.sql`, copy toàn bộ, dán vào, bấm **Run**.
   - Kết quả mong đợi: `Success. No rows returned`.
4. Lại **New query**:
   - Mở `supabase/migrations/0002_seed.sql`, copy toàn bộ, dán vào, bấm **Run**.
   - File này ~28 KB. Nếu editor báo quá dài, chạy làm 2 lần: phần trước `-- 9. brand_history` và phần còn lại.
5. Kiểm tra bằng **New query**:

   ```sql
   select 'brand_history' t, count(*) from brand_history
   union all select 'competitor', count(*) from competitor
   union all select 'validation_list', count(*) from validation_list
   union all select 'subcategory', count(*) from subcategory;
   ```

   Kỳ vọng: `brand_history = 20` · `competitor = 12` · `validation_list = 57` · `subcategory = 7`.

6. Vào **Project Settings → API**, copy 2 giá trị:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   ⚠️ **Không** dùng `service_role` key. Key đó bỏ qua toàn bộ RLS, và biến `NEXT_PUBLIC_*` bị nhúng thẳng vào JS mà ai mở DevTools cũng đọc được.

### Bước 2 — GitHub

Nếu chưa có Git trên máy: cài từ https://git-scm.com/download/win

Mở PowerShell tại thư mục `brandhunt-web`:

```powershell
git init
git add .
git commit -m "BrandHunt web app - Next.js + Supabase"
git branch -M main
```

Lên GitHub → **New repository** → tên `brandhunt-web` → **Private** → **Create** (không tick thêm README/gitignore nào).

Rồi chạy (thay `<user>` bằng username GitHub của bạn):

```powershell
git remote add origin https://github.com/<user>/brandhunt-web.git
git push -u origin main
```

`node_modules/`, `.next/` và `.env.local` đã nằm trong `.gitignore` nên không bị đẩy lên.

### Bước 3 — Vercel

1. Vào https://vercel.com → đăng nhập bằng GitHub.
2. **Add New → Project** → chọn repo `brandhunt-web` → **Import**.
3. Vercel tự nhận Next.js. **Không cần đổi** Build Command hay Output Directory.
4. Mở **Environment Variables**, thêm 2 biến (tick cả Production / Preview / Development):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL lấy ở Bước 1.6 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key lấy ở Bước 1.6 |

5. Bấm **Deploy**. Sau ~2 phút sẽ có link dạng `https://brandhunt-web.vercel.app`.

### Kiểm tra sau khi deploy

| Kiểm tra | Kỳ vọng |
|---|---|
| Mở link, góc phải hiện badge | `Data: Supabase` (xanh) |
| Gõ `VitaNova Health` → Check Brand | Ra hồ sơ brand đã tiếp cận + 10 khối pill |
| Gõ `vitanova helth` → Check Brand | Banner vàng "Ý bạn là...?" |
| Gõ `Brand XYZ` → Check Brand | Luồng brand mới + ô upload brief |
| Upload 1 file trong `Brief form library/` | Lưới gate 14 trường |
| Bấm **Analyze** | Step 3 hiện đủ · badge `Đã lưu 1 lần chạy` |
| Mở tab **Run History** | Có đúng dòng vừa chạy |
| Bấm **Export Brand Proposal** | Tải về file `.pptx` 8 slide |

Nếu bất kỳ mục nào fail → xem [Xử lý sự cố](#5-xử-lý-sự-cố).

### Chạy trên máy (tuỳ chọn)

```powershell
copy .env.example .env.local
# mở .env.local, điền 2 giá trị Supabase
npm install
npm run dev
# mở http://localhost:3000
```

---

## 3. Cập nhật data

### Khi `Final Brand history.xlsx` đổi (thêm brand / đổi status)

Quy trình hiện tại vẫn đi qua `data_line.js` như bản HTML cũ:

1. Chạy script extract của dashboard cũ để sinh lại `data_line.js`.
2. Copy `data_line.js` mới đè lên `scripts/_source/data_line.js`.
3. `npm run seed` → sinh lại `supabase/migrations/0002_seed.sql`.
4. Vào Supabase **SQL Editor**, chạy file `0002_seed.sql` mới.

File seed **idempotent**: nó `truncate` các bảng reference rồi insert lại. Chạy bao nhiêu lần cũng được, và **không đụng tới `analysis_run`** — lịch sử chạy được giữ nguyên.

### Cách nhanh hơn cho thay đổi nhỏ

Đổi 1 status, 1 blocker, 1 contact → sửa thẳng trong Supabase **Table Editor → brand_history**. App đọc DB nên có hiệu lực ngay, không cần deploy lại.

⚠️ Nhưng lần chạy `npm run seed` tiếp theo sẽ ghi đè. Nên: sửa nhanh trong Table Editor, và cập nhật lại file Excel gốc để hai nguồn không lệch nhau.

### Đổi ngưỡng Tier / Band

Bảng `scoring_rule` — sửa trong Table Editor, không cần dev, không cần deploy:

```sql
-- ví dụ: hạ ngưỡng ELEPHANT từ 60 xuống 50 tỉ VND
update scoring_rule set threshold = 50 where kind = 'tier' and label = 'ELEPHANT (T1)';
```

Bảng đọc từ trên xuống (`sort_order`), dùng **ngưỡng đầu tiên khớp**.

---

## 4. Sửa logic nghiệp vụ

| Muốn sửa | Sửa ở đâu | Sau đó |
|---|---|---|
| Text, verdict, cách tính, chart SVG | `scripts/_source/app_new.js` | `npm run port` |
| Rule parse brief, gate, suy đơn vị | `scripts/_source/brief_engine.js` | `npm run port` |
| Nội dung / chống rò rỉ deck .pptx | `scripts/_source/pptx_export.js` | `npm run port` |
| Màu, font, layout của màn phân tích | `scripts/_source/shell.html` (khối `:root`) + `src/lib/engine` object `C` | `npm run port` |
| Header, trang /runs, vỏ app | `src/components/*.jsx` | không cần |
| Bảng, cột, RLS | `supabase/migrations/0001_schema.sql` | chạy lại SQL |

### Chạy test suite gốc

Test suite (298 assertion) vẫn chạy được trên các file trong `scripts/_source/` — nó không biết gì về Next.js:

```bash
mkdir -p /tmp/bh && cp scripts/_source/*.js scripts/_source/shell.html /tmp/bh/
cp "<đường dẫn>/Brief form library/"*.xlsx /tmp/bh/
python scripts/_source/make_test_fixtures.py /tmp/bh   # nếu có copy sang
cd /tmp/bh && node test_app.js && node audit_css.js && node test_pptx.js
```

Test cần `data_line.js` ở dạng `const DATA={...}` — file trong `scripts/_source/` giữ đúng dạng đó chính là để phục vụ việc này.

**Chạy test trước mỗi lần đổi logic rồi mới `npm run port`.**

### Kiểm chứng data không bị sai lệch qua đường DB

Khâu nguy hiểm nhất của cả hệ thống là chuỗi `DATA gốc → SQL seed → Postgres → adapter → DATA' mà engine thực sự đọc`. Nếu lệch dù chỉ một con số, app vẫn chạy bình thường nhưng ra kết quả sai — **không có gì báo lỗi**.

```bash
pip install pglast
npm run verify
```

Kỳ vọng: `KHOP 100% — 10 key, 20 brand, 20 price band, tat ca so lieu trung khop`

Chạy lại mỗi khi sửa `generate-seed.mjs`, `src/lib/data.js`, hoặc `0001_schema.sql`.

---

## 5. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Badge đỏ `Lỗi data`, báo thiếu biến môi trường | Chưa set env trên Vercel | Settings → Environment Variables → thêm 2 biến → **Redeploy** (đổi env không tự build lại) |
| `Bảng market_kpi rỗng` | Chưa chạy `0002_seed.sql` | Chạy file seed trong SQL Editor |
| Nạp data lỗi, Console báo `permission denied` | RLS chưa bật policy | Chạy lại phần cuối `0001_schema.sql` (khối `do $$ ... $$`) |
| Trang trắng, Console báo `lookup is not defined` | `attachGlobals()` chưa chạy | Đợi badge `Data: Supabase` rồi mới thao tác. Nếu vẫn lỗi → kiểm tra `reactStrictMode: false` trong `next.config.mjs` |
| Chart trong .pptx ra trắng | SVG bị raster hoá sai | Xem mục "Chart = raster hoá SVG" trong `_source_dashboard/README.md`. Ba điều kiện: bơm font · xoá `style` · dùng `data:` URL |
| Export .pptx bị chặn, báo token nội bộ | Lớp 3 `auditPayload()` bắt được rò rỉ | **Đúng như thiết kế.** Field mới phải thêm vào `buildProposalPayload()`, không được nới `LEAK` |
| Build Vercel fail ở `npm run port` | File `scripts/_source/*` bị sửa làm lệch regex | Xem log Vercel — script báo rõ khối nào không tìm thấy |
| `Run History` trống dù đã Analyze | RLS chặn insert, hoặc insert lỗi | Mở Console tìm `[saveRun]`. Kiểm tra policy `analysis_run_anon_insert` |

---

## 6. Việc còn tồn đọng

Chuyển sang web **không** giải quyết các vấn đề nghiệp vụ đã có từ bản HTML:

1. **App chạy public, không login** — theo yêu cầu. Nghĩa là: ai có link đều xem được Brand history đầy đủ (Tier, Commercial Score, blocker, contact point, notes). Đây là **data pipeline nội bộ**. Nếu link lọt ra ngoài, toàn bộ pipeline lộ. Cách khắc phục khi cần: bật Supabase Auth giới hạn domain `@onpoint.vn` (~nửa ngày công), hoặc bật Vercel Password Protection (có sẵn ở gói Pro).

2. **Kalodata licensing chưa xác minh** — deck xuất ra republish số GMV/affiliate của Kalodata cho bên thứ ba. Cần check hợp đồng Kalodata trước khi gửi brand. Rủi ro này giờ **lớn hơn** vì deck xuất được từ link public.

3. **Contact point trong `brand_history` là dummy** — 20/20 brand đang dùng data giả viết theo format thật. Đừng gọi/mail. Ghi đè khi có contact thật.

4. **Cột `group` rỗng cho cả 20 brand** — tra bằng Group Brand luôn rơi vào luồng brand mới. Tự khớp khi Excel có data.

5. **Chưa parse được template `Brief form_v1`** — 2 brief thật trong `01 Brief input/` (COMET, Sennheiser) dùng format này.

6. **Data chỉ có 1 scope `HEALTH_VN`** — schema đã có sẵn cột `scope` ở mọi bảng reference, nên mở rộng sang Beauty / EL / Thailand chỉ cần seed thêm data và cho VA chọn scope, không phải đổi schema.

---

## Cấu trúc thư mục

```
brandhunt-web/
├── scripts/
│   ├── _source/              ← NGUỒN SỰ THẬT của logic nghiệp vụ
│   │   ├── app_new.js
│   │   ├── brief_engine.js
│   │   ├── pptx_export.js
│   │   ├── shell.html
│   │   └── data_line.js
│   ├── port-engine.mjs       ← _source/*.js → src/lib/engine/index.js
│   └── generate-seed.mjs     ← data_line.js → 0002_seed.sql
├── supabase/migrations/
│   ├── 0001_schema.sql       ← bảng + RLS + view
│   └── 0002_seed.sql         ← SINH TỰ ĐỘNG
├── src/
│   ├── app/
│   │   ├── layout.jsx
│   │   ├── page.jsx          ← màn phân tích
│   │   ├── runs/page.jsx     ← báo cáo lịch sử chạy
│   │   ├── globals.css
│   │   └── engine.css        ← SINH TỰ ĐỘNG
│   ├── components/
│   │   ├── AppHeader.jsx
│   │   ├── BrandHuntApp.jsx  ← host của engine
│   │   ├── RunHistory.jsx
│   │   └── shellBody.js      ← SINH TỰ ĐỘNG
│   └── lib/
│       ├── data.js           ← adapter Supabase → hình dạng DATA của engine
│       ├── engine/index.js   ← SINH TỰ ĐỘNG
│       └── supabase/client.js
├── .env.example
└── README.md
```
