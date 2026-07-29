# Đưa tab Pipeline lên production + nối Supabase

**Cho ai:** Alex (người đã deploy xong BrandHunt lên https://va-hub-psi.vercel.app/).
**Thời gian:** ~25 phút, trong đó 15 phút là chờ Vercel build.
**Kết quả:** `va-hub-psi.vercel.app/pipeline` chạy được, và sửa deal chỉ cần vào Supabase — không deploy lại.

> Chi tiết kiến trúc: `PIPELINE_TAB.md`. File này chỉ là trình tự bấm nút.

---

## Trạng thái hiện tại (đã kiểm chứng 2026-07-29)

| Việc | Trạng thái |
|---|---|
| Merge tab Pipeline vào app | ✅ Xong, nằm ở branch `feat/pipeline-tab` (3 commit, đã commit sạch) |
| Nối Supabase | ✅ Code + migration xong, **chưa chạy SQL** |
| Engine BrandHunt | ✅ `git diff main..HEAD -- src/lib/engine/ …` **rỗng** — không đụng 1 byte. 5 file có sẵn chỉ được thêm vào (35 dòng) |
| Đẩy lên GitHub | ❌ **Chưa push** — branch chỉ có trên máy |
| Production hiện tại | `main` = commit đầu tiên, **chưa có** `/pipeline` |
| Test | ✅ 69 assertion pass (26 module + 15 React + 28 adapter), `next build` pass, SQL parse bằng parser Postgres thật |
| Round-trip data | ✅ `pipeline.json` → SQL: 8/8 deal khớp từng field, tổng NMV khớp tuyệt đối (193.172.768.214 ₫) |

Vì sao chưa push được từ phiên làm việc này: môi trường của Claude không có credential GitHub của anh. Từ bước 2 trở đi anh chạy trên máy mình.

---

## Bước 0 — Kiểm tra env trên Vercel (2 phút)

Vercel → project `va-hub` → **Settings → Environment Variables**. Đảm bảo 2 biến này có mặt cho **cả Production và Preview**:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Nếu Preview thiếu → bản preview sẽ đọc file JSON tĩnh và hiện banner cam. Không sập, nhưng anh sẽ không test được phần Supabase.

---

## Bước 1 — Kiểm tra trên máy trước khi push (5 phút)

```bash
cd <thư mục brandhunt-web>
git status                      # phải "clean" hoặc chỉ có file anh cố ý sửa
git branch --show-current       # phải: feat/pipeline-tab

npm install
npm i --no-save jsdom

npm run port                    # sinh lại engine BrandHunt
npm run port:pipeline           # sinh lại module Pipeline + 2 cổng chặn isolation
npm run seed:pipeline           # sinh lại 0004_pipeline_seed.sql

node scripts/smoke-pipeline.mjs         # kỳ vọng: PASS 26/26
node scripts/smoke-pipeline-react.cjs   # kỳ vọng: PASS 15/15
npm run smoke:pipeline-data             # kỳ vọng: PASS 28/28
npm run build                           # kỳ vọng: Compiled successfully
```

**Dừng lại nếu bất kỳ dòng nào FAIL.** Cổng chặn của `port:pipeline` fail nghĩa là module vi phạm isolation (CSS lọt ra ngoài `#pipeline-root`, hoặc thêm global lạ) — đó đúng là việc nó phải chặn.

Chạy thử tại chỗ:

```bash
npm run dev
```

Mở http://localhost:3000/pipeline — bảng phải có số, không phải dấu `-`.

---

## Bước 2 — Push branch, lấy Preview URL (5 phút)

```bash
git push -u origin feat/pipeline-tab
```

Vercel tự build và tạo Preview URL (dạng `va-hub-git-feat-pipeline-tab-....vercel.app`). Lấy link ở Vercel → **Deployments** → dòng trên cùng.

**Production `va-hub-psi.vercel.app` không bị ảnh hưởng ở bước này.** Nếu build fail, chỉ preview fail.

---

## Bước 3 — Nghiệm thu trên Preview (5 phút)

Mở Preview URL, làm đúng 8 việc:

| # | Việc | Kỳ vọng |
|---|---|---|
| 1 | Vào `/` (tab Analyze) | Chạy y như production hiện tại — **đây là phép thử quan trọng nhất**, chứng minh tab Pipeline không phá engine |
| 2 | Bấm tab **Pipeline** | 6 KPI card có số, 3 bảng có dòng, không có dấu `-` hay `NaN` |
| 3 | Badge dưới KPI | `Official figures per source workbook` (xanh) |
| 4 | Chọn filter Tier = `Tier 3` | Badge đổi sang `Filtered · computed from N of M rows` (cam), KPI đổi số |
| 5 | Bấm **Reset** | Badge quay lại xanh, KPI về số official |
| 6 | Nút **Export Excel** | Tải được file, tiêu đề ghi `(computed from rows)` |
| 7 | 2 chart | Vẽ được (nếu trống → ECharts không tải, xem banner cam) |
| 8 | Quay lại tab Analyze rồi vào Pipeline lần nữa | Vẫn render đúng (test remount) |

Ở bước này banner cam **"Đang đọc file tĩnh, không phải database"** là **bình thường** — chưa chạy migration. Bước 5 sẽ làm nó biến mất.

---

## Bước 4 — Merge vào main → production (5 phút)

```bash
git checkout main
git merge feat/pipeline-tab      # fast-forward, không conflict
git push origin main
```

Vercel deploy production. Kiểm tra https://va-hub-psi.vercel.app/pipeline và làm lại 8 việc ở Bước 3.

---

## Bước 5 — Bật Supabase (5 phút)

Supabase → project của anh → **SQL Editor** → **New query**.

1. Dán toàn bộ nội dung `supabase/migrations/0003_pipeline.sql` → **Run**.
   Kỳ vọng: `Success. No rows returned`. Tạo 3 bảng + 1 view + RLS.
2. Query mới, dán `supabase/migrations/0004_pipeline_seed.sql` → **Run**.
   Kỳ vọng: `Success`. Nạp 8 deal + 82 giá trị dropdown + 1 dòng KPI official.
3. Đối chiếu — chạy query này:

```sql
select * from public.v_pipeline_summary;
select * from public.pipeline_meta;
```

Kỳ vọng ở `v_pipeline_summary`:

| stage | deals | nmv_vnd |
|---|---|---|
| Go Live | 2 | 30.114.490.073 |
| Verbal | 3 | 40.585.431.541 |
| Potential | 3 | 122.472.846.600 |

Tổng: **193.172.768.214 ₫**. Còn `pipeline_meta.total_nmv_vnd` = **34.000.000.000 ₫** — đây là số official, lệch là **có chủ ý**, xem `PIPELINE_TAB.md` mục 3.

4. Mở lại `/pipeline`, **Ctrl+Shift+R** (hard refresh). **Banner cam phải biến mất.** Số trên màn hình không đổi — đúng, vì DB và file tĩnh đang chứa cùng data. Đó là cách chứng minh việc đổi nguồn không làm sai số.

> Không cần deploy lại sau khi chạy SQL. App đọc DB ở phía client mỗi lần load.

---

## Bước 6 — Nghiệm thu "hệ thống đã active" (3 phút)

Phép thử duy nhất chứng minh việc này có giá trị:

1. Supabase → **Table Editor** → `pipeline_deal`.
2. Sửa `vnd` của dòng `Hector` thành `20000000000`.
3. Về `/pipeline` → **chọn 1 filter bất kỳ** (để sang chế độ Filtered, vì chế độ Official lấy số từ `pipeline_meta`).
4. Số phải đổi theo. **Không deploy, không đợi build.**
5. Sửa lại về `15114490073`.

Xong bước này thì pipeline tracker đã là hệ thống chạy được, không còn là file tĩnh.

---

## Nếu hỏng — quay lại

| Tình huống | Xử lý |
|---|---|
| Vercel build fail ở Bước 2 | Không ảnh hưởng production. Đọc log Vercel → sửa → push lại. |
| Production hỏng sau Bước 4 | Vercel → Deployments → bản deploy trước → **⋯ → Promote to Production**. ~30 giây. |
| Tab Pipeline lỗi sau Bước 5 | `drop table public.pipeline_deal cascade;` → app tự lùi về file JSON tĩnh, tab vẫn chạy. |
| Tab Analyze hỏng | Không liên quan tới việc này (diff không chạm `src/lib/engine/`), nhưng nếu xảy ra thì rollback như trên và nói lại — nghĩa là có giả định nào sai. |

---

## Việc còn lại sau khi active

Theo thứ tự giá trị/công sức:

| Việc | Vì sao cần | Ước lượng |
|---|---|---|
| **Nạp pipeline thật** | DB hiện chỉ có 8 dòng data mẫu. Đây là việc chặn duy nhất khiến tab chưa dùng được để họp. | Nửa buổi (cần chốt nguồn: SharePoint list hay Excel) |
| **Chốt ai cập nhật, tần suất** | `SCHEMA.md` ghi rõ chưa thống nhất với business. Không có việc này thì data sẽ cũ dần rồi bị bỏ. | 1 buổi họp |
| **Auth** | Tab đang public: tên brand, NMV forecast 2026, tên CD/VA. Có auth mới mở được quyền sửa deal trong app. | 1 buổi |
| **Form sửa deal trong app** | Chỉ làm sau khi có auth. Trước đó dùng Table Editor. | 1 buổi |
| **Sync từ SharePoint list** | Bỏ hẳn bước copy tay. Cần Graph API token phía server. | 1–2 buổi |

---

## Lưu ý khi chạy trong OneDrive

Repo đang nằm trong OneDrive. `npm install` và `git` chạy được nhưng chậm, và đã gặp 1 lần `.git/index.lock` còn sót lại làm `git commit` báo *"Another git process seems to be running"*. Xử lý:

```bash
rm -f .git/index.lock
```

Nếu `npm install` treo lâu, `DEPLOY.md` mục 2.1 khuyến nghị copy dự án ra khỏi OneDrive — vẫn đúng.
