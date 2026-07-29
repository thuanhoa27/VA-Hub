# Tab Pipeline (`/pipeline`) — VA Distribution Performance

Module pipeline tracker do team khác build (standalone HTML/CSS/JS), được merge vào app này dưới dạng **một tab độc lập**. Merge ngày 2026-07-29, branch `feat/pipeline-tab`.

---

## 1. Nguyên tắc: 2 tab không dùng chung gì cả

```
┌─ Next.js shell ────────────────────────────────────────────┐
│  AppHeader:   Analyze  ·  Pipeline  ·  Run History         │
├──────────────────────────┬─────────────────────────────────┤
│  /  (Analyze)            │  /pipeline                      │
│  BrandHuntApp.jsx        │  PipelineTab.jsx                │
│  ↓                       │  ↓                              │
│  src/lib/engine/         │  public/pipeline/pipeline.js    │
│  (298 assertion)         │  window.PipelineTracker         │
│  engine.css (layout.jsx) │  pipeline.css (route level)     │
└──────────────────────────┴─────────────────────────────────┘
```

**Engine BrandHunt không bị đụng một byte nào.** `git diff main` cho merge này chỉ sửa 3 file có sẵn, tất cả đều là thêm vào:

| File | Thay đổi |
|---|---|
| `src/components/AppHeader.jsx` | +1 dòng: link tab "Pipeline" |
| `src/lib/vendor.js` | +3 loader: `ensureECharts`, `ensureExcelJS`, `ensurePipelineTracker` |
| `package.json` | +script `port:pipeline`, thêm vào `prebuild` |

`src/lib/engine/`, `shellBody.js`, `scripts/_source/{brief_engine,app_new,pptx_export}.js`, `shell.html`, `engine.css`, `supabase/` — **diff trống**.

---

## 2. Sửa ở đâu

**Sửa trong `scripts/_source/pipeline/`, rồi chạy `npm run port:pipeline`.**

4 file dưới đây là **SINH TỰ ĐỘNG — đừng sửa tay**, sẽ bị ghi đè:

```
scripts/_source/pipeline/pipeline.body.html  →  src/components/pipelineBody.js
scripts/_source/pipeline/pipeline.css        →  src/app/pipeline/pipeline.css
scripts/_source/pipeline/pipeline.js         →  public/pipeline/pipeline.js
scripts/_source/pipeline/data/pipeline.json  →  public/pipeline/data/pipeline.json
```

`prebuild` đã gọi `port-pipeline.mjs`, nên Vercel tự sinh lại khi deploy — không cần commit tay.

### 2 cổng chặn tự động

`port-pipeline.mjs` **fail build** nếu module vi phạm isolation:

1. Có selector CSS nào không nằm dưới `#pipeline-root`
2. Có global nào ngoài `window.PipelineTracker`, hoặc module tự chèn `<script>` vào `document.head`

Đây là thứ giữ cho tab Pipeline không bao giờ phá được giao diện tab Analyze. Nếu team kia gửi bản cập nhật, chỉ cần thay file trong `_source/pipeline/` — cổng chặn sẽ tự bắt lỗi.

---

## 3. KPI hybrid — đọc trước khi ai hỏi "sao số lệch"

Header của source workbook ghi số **34 BIL / Go Live 5 brand**, nhưng tổng các dòng deal thực tế trong sheet là **193 BIL / Go Live 2 dòng**. Header là số của kỳ trước hoặc đếm theo scope khác — **không phải do thiếu dòng** (8 dòng đã cộng ra 193 BIL, nếu đủ 11 dòng thì còn cao hơn).

Business muốn KPI card khớp con số official đang báo cáo. Nên tab chạy **2 chế độ**:

| Trạng thái | KPI card hiển thị | Badge |
|---|---|---|
| Chưa filter gì | Số official từ `_meta.officialKpi` | `Official figures per source workbook · as of ...` (xanh) |
| Có bất kỳ filter | Số tính từ các dòng đang lọc | `Filtered · computed from N of M rows` (cam) |

Dòng `Computed from rows — ...` ngay dưới KPI **luôn** là số tính từ rows, kể cả ở chế độ Official — đây là chỗ để đối chiếu.

### Cập nhật số official

Sửa `scripts/_source/pipeline/data/pipeline.json` → `_meta.officialKpi` → `npm run port:pipeline`. **Không hardcode trong `pipeline.js`.**

```json
"officialKpi": {
  "as_of": "2026-07-28",
  "totalNmvVnd": 34000000000,
  "goLiveNmvVnd": 12000000000,
  "brandGoLive": 5, "brandVerbal": 4, "brandPotential": 2
}
```

Nếu block này thiếu hoặc sai kiểu, module **tự fallback** về số tính từ rows và `console.warn` — không bao giờ hiện `NaN`.

File Excel export luôn dùng số tính từ rows (tiêu đề có ghi rõ `(computed from rows)`).

---

## 4. Thư viện

Vendor vào `public/vendor/`, **không dùng CDN** — khoá version và chạy được khi mạng công ty chặn cdnjs.

| Lib | Version | Dùng cho | Thiếu thì sao |
|---|---|---|---|
| ECharts | 5.5.0 | 2 chart | Bỏ chart, phần còn lại vẫn chạy + banner cảnh báo |
| ExcelJS | 4.4.0 | Nút Export Excel | Nút bị disable + banner cảnh báo |

ExcelJS **khác** SheetJS. Cả hai cùng tồn tại, global khác nhau (`ExcelJS` vs `XLSX`) → không xung đột với 298 assertion của engine. Cả 3 script chỉ nạp khi mở `/pipeline`; tab Analyze không tải thêm gì.

First Load JS: `/pipeline` = **164 kB**, `/` = 163 kB. Trước khi nối Supabase (mục 7) `/pipeline` chỉ 99 kB — tăng 65 kB vì tab giờ import `@supabase/supabase-js`. Đây là chunk **dùng chung** với tab Analyze nên tổng tải của app không tăng, chỉ tab Pipeline mất lợi thế "nhẹ hơn". Muốn về lại 99 kB thì gọi PostgREST bằng `fetch` trần thay vì SDK — chưa làm, vì đánh đổi lấy việc dùng chung 1 client với `src/lib/data.js`.

---

## 5. Test

```bash
npm i --no-save jsdom
node scripts/smoke-pipeline.mjs         # 26 assertion — module thuần
node scripts/smoke-pipeline-react.cjs   # 15 assertion — qua lớp host React
npm run smoke:pipeline-data             # 28 assertion — adapter Supabase (mục 7)
```

Phủ: mount/unmount/remount, chuyển chế độ Official ↔ Filtered, reset filter, fallback khi `officialKpi` hỏng, filter `Tier 3` và `SHP & TTS`, và không có `NaN`/`undefined` lọt ra màn hình.

Tất cả 69 assertion đã pass ngày 2026-07-29 (Node 22, jsdom). `next build` pass.

---

## 6. Việc còn tồn đọng

| Việc | Ghi chú |
|---|---|
| **Data chỉ có 8 dòng** | Là data mẫu bị cắt bớt, không phải pipeline thật. Alex đã chốt merge với data này trước. |
| **Không có parser Excel** | `pipeline.json` là bản transcribe tay. Muốn Alex tự upload `.xlsx` thì cần thêm bước dùng SheetJS đã vendor sẵn. |
| **Win-rate badges là text cứng** | `100%` / `>80%` / `40-60%` do business tự type trong Excel, không có dataset won/lost để tính. |
| **Chưa có auth** | Tab để công khai tên brand, NMV forecast 2026, tên CD/VA. Alex đã cân nhắc và chọn giữ public. Nên hạn chế share URL ra ngoài team. **Đây cũng là lý do anon chỉ được ĐỌC** `pipeline_*` (mục 7). |
| **Casing `cat` chưa chuẩn hoá** | `Health` vs `HEALTH` trong workbook gốc. Filter so sánh case-insensitive để lách, data chưa sửa. |
| **Sửa deal phải vào Supabase** | Chưa có form sửa trong app (vì chưa có auth). VA/CD sửa trong Supabase Table Editor. Xem mục 7. |

### Nếu chuyển sang có auth

`pipeline.css` import ở route level (`src/app/pipeline/page.jsx`), không ở `layout.jsx`. Nghĩa là bọc `/pipeline` sau middleware auth mà không ảnh hưởng tab Analyze — chỉ cần thêm matcher cho `/pipeline`.

---

## 7. Nguồn data: Supabase (thêm 2026-07-29)

```
Supabase                                 src/lib/pipelineData.js
┌──────────────────────────┐             ┌──────────────────────────┐
│ pipeline_deal            │──┐          │ loadPipelineData()       │
│ pipeline_validation_list │──┼─ đọc ───▶ │  date_iso  → dateISO     │
│ pipeline_meta            │──┘          │  numeric   → Number()    │──▶ PipelineTracker.mount()
└──────────────────────────┘             │  rows      → {list: []}  │
       ▲ ghi bằng Table Editor           └───────────┬──────────────┘
       │ (service_role, không phải app)              │ DB lỗi/rỗng/thiếu env
                                                     ▼
                                   /pipeline/data/pipeline.json (file tĩnh)
```

**3 bảng riêng, không dùng chung với tab Analyze.** Lý do đã ghi trong đầu file `supabase/migrations/0003_pipeline.sql`: pipeline và engine trùng tên list (`tier`, `model`, `cat`, `channel`, `status`, `elephant`) nhưng khác giá trị — nhồi chung vào `public.validation_list` sẽ làm engine đọc sai list.

### Fallback là điểm quan trọng nhất

`loadPipelineData()` **không throw** khi DB chưa sẵn sàng — nó lùi về file JSON tĩnh và hiện banner cam. Nghĩa là **deploy code và chạy migration không cần đồng bộ**: code lên trước vẫn chạy y như cũ, chạy SQL sau là tự đổi nguồn ở lần load kế tiếp. Không có cửa sổ site trắng.

Chỉ khi **cả hai** nguồn chết thì mới throw → banner đỏ có nội dung cụ thể.

### Cập nhật data

| Việc | Làm ở đâu |
|---|---|
| Sửa/thêm/bớt deal | Supabase → Table Editor → `pipeline_deal`. Không cần deploy, F5 là thấy. Xoá thì set `is_active = false` (giữ dấu vết). |
| Sửa số official của KPI card | Table Editor → `pipeline_meta` (1 dòng). Xem mục 3. |
| Thêm giá trị dropdown | Table Editor → `pipeline_validation_list`. |
| Bootstrap lại từ đầu | Sửa `scripts/_source/pipeline/data/pipeline.json` → `npm run seed:pipeline` → chạy `0004_pipeline_seed.sql`. |

`0004_pipeline_seed.sql` **chỉ insert khi `pipeline_deal` rỗng** (khác `0002_seed.sql` là truncate-rồi-insert). Cố ý: sau khi DB thành nguồn sự thật, chạy lại file SQL cũ không được phép xoá cập nhật của business. Muốn reset thật thì phải tự `truncate table public.pipeline_deal;` trước.

### Đối chiếu số

```sql
select * from public.v_pipeline_summary;   -- số TÍNH TỪ ROWS, theo stage
select * from public.pipeline_meta;        -- số OFFICIAL đang hiện trên KPI card
```

### anon chỉ được ĐỌC — có chủ ý

`0003_pipeline.sql` không tạo policy insert/update/delete cho `anon`. App đang public không auth, mở quyền ghi cho anon = bất kỳ ai có URL đều sửa được NMV forecast và tên brand. Khi nào có auth thì thêm policy ghi cho role `authenticated`.

### `brand_key` — cầu nối sang tab Analyze

`pipeline_deal.brand_key` cùng thuật toán với `toBrandKey()` trong `pipeline.js` (và `scripts/generate-pipeline-seed.mjs` copy đúng thứ tự các bước). **Cố ý không đặt foreign key** sang `brand_history`: pipeline có brand chưa từng qua BrandHunt và ngược lại, FK sẽ chặn insert. Join khi cần báo cáo, không ràng buộc lúc ghi:

```sql
select d.brand, d.stage, d.vnd, h.tier, h.score, h.prio
from public.pipeline_deal d
left join public.brand_history h
       on lower(regexp_replace(h.name, '[^a-zA-Z0-9]', '', 'g')) = d.brand_key
where d.is_active;
```
