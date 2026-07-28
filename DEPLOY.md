# Hướng dẫn deploy BrandHunt Web App

**Dành cho người chưa từng deploy bao giờ.** Không cần biết code. Bạn sẽ dùng Claude trong VS Code làm phần kỹ thuật, còn bạn bấm nút trên web và duyệt kết quả.

| | |
|---|---|
| **Thời gian** | 45–60 phút lần đầu (lần sau ~5 phút) |
| **Chi phí** | 0đ — cả 3 dịch vụ đều có gói free đủ dùng |
| **Kết quả** | Một đường link dạng `https://brandhunt-web.vercel.app` mà cả team mở được |

---

## Mục lục

- [Bức tranh tổng thể](#bức-tranh-tổng-thể)
- [Phần 0 — Chuẩn bị](#phần-0--chuẩn-bị)
- [Phần 1 — Cài đặt trên máy](#phần-1--cài-đặt-trên-máy)
- [Phần 2 — Mở dự án trong VS Code](#phần-2--mở-dự-án-trong-vs-code)
- [Phần 3 — Supabase (database)](#phần-3--supabase-database)
- [Phần 4 — Chạy thử trên máy](#phần-4--chạy-thử-trên-máy)
- [Phần 5 — GitHub (lưu code)](#phần-5--github-lưu-code)
- [Phần 6 — Vercel (đưa lên mạng)](#phần-6--vercel-đưa-lên-mạng)
- [Phần 7 — Nghiệm thu](#phần-7--nghiệm-thu)
- [Phần 8 — Xử lý sự cố](#phần-8--xử-lý-sự-cố)
- [Phần 9 — Vận hành sau khi deploy](#phần-9--vận-hành-sau-khi-deploy)
- [Phần 10 — Bảo mật](#phần-10--bảo-mật-đọc-trước-khi-share-link)

---

## Bức tranh tổng thể

Ba dịch vụ, mỗi cái làm một việc:

| Dịch vụ | Làm gì | Hình dung đơn giản |
|---|---|---|
| **GitHub** | Lưu code, ghi lại lịch sử thay đổi | Cái tủ hồ sơ |
| **Supabase** | Chứa dữ liệu (brand history, market data, lịch sử chạy) | Cái kho |
| **Vercel** | Biến code thành website chạy được | Cái cửa hàng |

Luồng hoạt động: bạn đẩy code lên **GitHub** → **Vercel** tự lấy code đó dựng thành website → website gọi vào **Supabase** để lấy dữ liệu.

Từ lần thứ hai trở đi, mỗi khi bạn sửa code và đẩy lên GitHub, Vercel **tự động** deploy lại. Không phải làm gì thêm.

---

## Phần 0 — Chuẩn bị

### 0.1. Tài khoản cần có

Đăng ký trước cả 3, mỗi cái 2 phút:

| Dịch vụ | Link | Ghi chú |
|---|---|---|
| GitHub | https://github.com/signup | Dùng email công ty |
| Supabase | https://supabase.com/dashboard/sign-up | **Bấm "Continue with GitHub"** để đỡ phải nhớ thêm mật khẩu |
| Vercel | https://vercel.com/signup | **Bấm "Continue with GitHub"** — bắt buộc, vì Vercel cần đọc repo của bạn |

> **Lưu ý:** Đăng nhập Supabase và Vercel bằng GitHub sẽ tiết kiệm rất nhiều thao tác ở Phần 6.

### 0.2. Quyết định trước: để code ở đâu trên máy

Dự án đang nằm trong OneDrive:

```
...\VA HUB\Dashboard\brandhunt-web
```

**Bạn nên copy nó ra ngoài OneDrive trước khi bắt đầu.** Lý do:

- Git tạo một thư mục ẩn `.git` chứa hàng nghìn file nhỏ. OneDrive sẽ cố đồng bộ từng file một → chậm và dễ hỏng repo.
- `npm install` tạo thư mục `node_modules` với ~10.000 file. OneDrive sẽ đồng bộ hết → treo máy, tốn dung lượng.
- OneDrive khoá file khi đang sync → Git báo lỗi "permission denied" lúc không ngờ nhất.

Vị trí đề xuất: `C:\dev\brandhunt-web`

Claude sẽ làm việc copy này ở Phần 2. Bản gốc trong OneDrive vẫn giữ nguyên làm backup.

---

## Phần 1 — Cài đặt trên máy

Ba thứ cần cài. Nếu máy bạn đã có sẵn thì bỏ qua.

### 1.1. VS Code

1. Tải tại https://code.visualstudio.com/download → chọn **Windows**
2. Chạy file `.exe` vừa tải
3. Ở màn hình **Select Additional Tasks**, tick 2 ô này (quan trọng, giúp thao tác sau dễ hơn nhiều):
   - ☑ *Add "Open with Code" action to Windows Explorer file context menu*
   - ☑ *Add "Open with Code" action to Windows Explorer directory context menu*
   - ☑ *Add to PATH*
4. Next → Install → Finish

**Yêu cầu phiên bản:** VS Code 1.94.0 trở lên. Bản tải mới hôm nay chắc chắn đạt. Kiểm tra: menu **Help → About**.

### 1.2. Node.js

Đây là thứ chạy code JavaScript trên máy bạn.

1. Vào https://nodejs.org
2. Tải bản có chữ **LTS** (Long Term Support — bản ổn định). **Đừng lấy bản "Current"**.
3. Chạy file `.msi`, bấm Next liên tục, để nguyên mọi lựa chọn mặc định
4. **Khởi động lại máy** sau khi cài (nếu không, Windows chưa nhận lệnh `node`)

Dự án cần Node 18.18 trở lên. Bản LTS hiện tại thoải mái đạt.

### 1.3. Git

Đây là thứ đẩy code lên GitHub.

1. Vào https://git-scm.com/download/win → tải **64-bit Git for Windows Setup**
2. Chạy file `.exe`. Rất nhiều màn hình lựa chọn — **cứ bấm Next hết**, mặc định là đúng.
3. Riêng màn hình **Adjusting your PATH environment**, để nguyên lựa chọn giữa: *Git from the command line and also from 3rd-party software*

### 1.4. Claude Code extension cho VS Code

1. Mở VS Code
2. Nhấn `Ctrl + Shift + X` (mở khung Extensions ở thanh bên trái)
3. Gõ vào ô tìm kiếm: `Claude Code`
4. Chọn extension của **Anthropic** → bấm **Install**
5. Sau khi cài, nếu không thấy gì thay đổi: nhấn `Ctrl + Shift + P`, gõ `Developer: Reload Window`, Enter

**Đăng nhập:**

1. Nhìn góc **dưới bên phải** cửa sổ VS Code, bấm vào chữ **✱ Claude Code**
2. Khung chat mở ra, bấm **Sign in**
3. Trình duyệt tự mở → đăng nhập tài khoản Claude của bạn → cho phép truy cập
4. Quay lại VS Code, khung chat sẽ sẵn sàng

> **Cần tài khoản Claude trả phí** (Pro, Max, Team hoặc Enterprise). Không cần API key.

**Mẹo tìm khung chat Claude:**

| Cách | Thao tác |
|---|---|
| Thanh trạng thái | Bấm **✱ Claude Code** góc dưới phải — luôn dùng được |
| Thanh bên trái | Bấm biểu tượng ✱ (Spark) |
| Bàn phím | `Ctrl + Shift + P` → gõ "Claude Code" |

### ✅ Kiểm tra Phần 1

Trong VS Code, mở terminal bằng `` Ctrl + ` `` (phím dấu huyền, ngay dưới phím Esc), rồi gõ:

```powershell
node --version
git --version
```

Kết quả mong đợi: hai dòng số phiên bản, ví dụ `v22.11.0` và `git version 2.47.0`.

Nếu báo *"không được nhận dạng là lệnh nội bộ"* → chưa khởi động lại máy sau khi cài. Khởi động lại rồi thử lại.

---

## Phần 2 — Mở dự án trong VS Code

### 2.1. Copy dự án ra khỏi OneDrive

Mở VS Code → `Ctrl + Shift + P` → gõ `Terminal: Create New Terminal` → Enter. Dán lệnh sau (sửa lại đường dẫn nếu OneDrive của bạn khác):

```powershell
$src = "$env:USERPROFILE\OneDrive - OnPoint Vietnam\CD Thao Pham - Health & EL - Documents\VA HUB\Dashboard\brandhunt-web"
$dst = "C:\dev\brandhunt-web"
New-Item -ItemType Directory -Force -Path C:\dev | Out-Null
Copy-Item -Recurse -Force $src $dst
code $dst
```

Một cửa sổ VS Code mới mở ra với dự án bên trong. **Từ giờ làm việc trong cửa sổ mới này.**

Nếu VS Code hỏi *"Do you trust the authors of the files in this folder?"* → bấm **Yes, I trust the authors**. (Claude Code không hoạt động trong chế độ Restricted.)

### 2.2. Để Claude kiểm tra dự án

Mở khung chat Claude (**✱ Claude Code** góc dưới phải), dán prompt này:

```
Đây là dự án BrandHunt web app (Next.js + Supabase). Hãy:
1. Đọc README.md để hiểu kiến trúc
2. Liệt kê cấu trúc thư mục
3. Xác nhận đủ các file quan trọng: package.json, 2 file trong
   supabase/migrations/, và 2 file trong public/vendor/
4. Kiểm tra node --version có đạt yêu cầu trong package.json không

Báo cáo ngắn gọn bằng tiếng Việt. Chưa cần cài gì.
```

Claude sẽ đọc và báo cáo. Nếu nó xin phép chạy lệnh, bấm **Allow**.

### 2.3. Cài thư viện

```
Chạy npm install trong thư mục dự án này. Báo cho tôi biết khi xong
và có cảnh báo gì đáng lo không.
```

Mất khoảng 1–2 phút. Xuất hiện thư mục `node_modules` — đó là chuyện bình thường, nó đã được `.gitignore` bỏ qua nên sẽ không bị đẩy lên GitHub.

### ✅ Kiểm tra Phần 2

Claude báo `added ... packages`. Không có dòng nào chữ đỏ bắt đầu bằng `npm error`.

---

## Phần 3 — Supabase (database)

Phần này làm hoàn toàn trên web, không đụng tới VS Code.

### 3.1. Tạo project

1. Vào https://supabase.com/dashboard → **New project**
2. Điền:

   | Ô | Điền gì |
   |---|---|
   | Organization | Chọn cái có sẵn (hoặc tạo mới tên `OnPoint`) |
   | Name | `brandhunt` |
   | Database Password | Bấm **Generate a password** rồi **copy lưu vào nơi an toàn** |
   | Region | **Southeast Asia (Singapore)** |
   | Plan | Free |

3. Bấm **Create new project**, đợi ~2 phút

> **Vì sao chọn Singapore:** đây là region gần Việt Nam nhất. Chọn nhầm US thì mỗi lần app hỏi database sẽ chậm thêm khoảng 200ms — người dùng cảm nhận được rõ.

> **Về Database Password:** app này không dùng đến nó (app dùng anon key). Nhưng lưu lại phòng khi cần kết nối trực tiếp bằng công cụ khác. Mất thì phải reset.

### 3.2. Tạo bảng (chạy file schema)

1. Menu bên trái → biểu tượng **SQL Editor** (hình `>_`)
2. Bấm **New query**
3. Quay sang VS Code, mở file `supabase/migrations/0001_schema.sql`
4. `Ctrl + A` rồi `Ctrl + C` (chọn hết, copy)
5. Quay lại Supabase, dán vào ô soạn thảo, bấm **Run** (hoặc `Ctrl + Enter`)

**Kết quả mong đợi:** `Success. No rows returned`

File này tạo 11 bảng, các chỉ mục, một view báo cáo, và bật RLS (Row Level Security — lớp phân quyền của database).

### 3.3. Nạp dữ liệu (chạy file seed)

1. Bấm **New query** lần nữa
2. Mở file `supabase/migrations/0002_seed.sql` trong VS Code → `Ctrl + A` → `Ctrl + C`
3. Dán vào Supabase → **Run**

**Kết quả mong đợi:** `Success. No rows returned`

> File này ~28 KB. Nếu trình duyệt báo lỗi vì quá dài, chia làm 2: chạy phần từ đầu đến trước dòng `-- 9. brand_history`, rồi chạy phần còn lại (nhớ giữ lại `commit;` ở cuối lần chạy thứ hai).

### 3.4. Kiểm tra dữ liệu đã vào đúng

**New query** → dán → **Run**:

```sql
select 'brand_history'   as bang, count(*) from brand_history
union all select 'competitor',      count(*) from competitor
union all select 'validation_list', count(*) from validation_list
union all select 'subcategory',     count(*) from subcategory
union all select 'price_band',      count(*) from price_band
union all select 'market_period',   count(*) from market_period;
```

**Phải ra đúng những con số này:**

| bang | count |
|---|---|
| brand_history | 20 |
| competitor | 12 |
| validation_list | 57 |
| subcategory | 7 |
| price_band | 20 |
| market_period | 3 |

Sai một con số nào → dữ liệu chưa đầy đủ, app sẽ chạy sai. Chạy lại `0002_seed.sql` (file an toàn khi chạy nhiều lần, nó tự xoá rồi nạp lại).

### 3.5. Lấy 2 chìa khoá

1. Menu trái → **Project Settings** (biểu tượng bánh răng) → **API**
2. Copy 2 giá trị này ra Notepad:

   | Tên trên Supabase | Dạng | Sẽ dùng làm |
   |---|---|---|
   | **Project URL** | `https://abcdxyz.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
   | **anon** / **public** | chuỗi dài bắt đầu bằng `eyJ...` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> ⚠️ **Trong cùng trang có một key tên `service_role`. TUYỆT ĐỐI KHÔNG dùng key đó.** Nó bỏ qua toàn bộ phân quyền — ai có nó là toàn quyền xoá sạch database của bạn. Key `anon` bị lộ ra trình duyệt là chuyện bình thường và an toàn, vì RLS mới là lớp bảo vệ thật.

### ✅ Kiểm tra Phần 3

Query đếm ra đúng 6 con số ở trên, và bạn đã có 2 chìa khoá trong Notepad.

---

## Phần 4 — Chạy thử trên máy

Bước này để chắc chắn mọi thứ chạy được **trước khi** đưa lên mạng. Bỏ qua bước này thì lúc lỗi sẽ không biết lỗi do đâu.

### 4.1. Tạo file cấu hình

Trong khung chat Claude, dán prompt này (nhớ thay 2 giá trị thật của bạn vào):

```
Tạo file .env.local ở thư mục gốc dự án với nội dung:

NEXT_PUBLIC_SUPABASE_URL=<dán Project URL của bạn>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<dán anon key của bạn>
NEXT_PUBLIC_APP_VERSION=1.0.0

Sau đó xác nhận giúp tôi .env.local đã nằm trong .gitignore chưa.
```

> **Vì sao phải hỏi câu cuối:** file này chứa chìa khoá. Nếu nó lọt lên GitHub, ai đọc repo cũng thấy. `.gitignore` là thứ ngăn điều đó. Cứ kiểm tra cho chắc.

### 4.2. Chạy

```
Chạy npm run dev và cho tôi biết địa chỉ để mở trên trình duyệt.
```

Claude sẽ chạy và báo `http://localhost:3000`. Mở link đó trên Chrome.

### 4.3. Kiểm tra 7 chức năng

Làm lần lượt, đúng thứ tự:

| # | Thao tác | Kết quả đúng |
|---|---|---|
| 1 | Nhìn góc trên bên phải | Nhãn xanh **Data: Supabase** |
| 2 | Ô Brand Name gõ `VitaNova Health` → **Check Brand** | Hồ sơ brand đã tiếp cận + 10 khối pill |
| 3 | Quay lại, gõ sai chính tả `vitanova helth` → **Check Brand** | Banner vàng *"Ý bạn là...?"* |
| 4 | Quay lại, gõ `Brand ABC XYZ` → **Check Brand** | Luồng brand mới + ô kéo thả file brief |
| 5 | Kéo một file `.xlsx` từ thư mục `Brief form library` vào | Lưới 14 trường, đếm số trường nhận được |
| 6 | Bấm **Analyze** | Sang Step 3 · góc phải hiện **Đã lưu 1 lần chạy** |
| 7 | Bấm tab **Run History** trên đầu trang | Có đúng 1 dòng vừa chạy |

Mục 6 và 7 là quan trọng nhất — chúng chứng minh app **ghi được** vào database, không chỉ đọc.

Muốn thử luôn cả export: bấm **Export Brand Proposal** cuối Step 3 → tải về file `.pptx` 8 slide. Lần đầu hơi lâu vì phải tải thư viện PptxGenJS.

### 4.4. Dừng lại

Trong terminal, nhấn `Ctrl + C`. Hoặc bảo Claude: `Dừng server dev đi.`

### ✅ Kiểm tra Phần 4

Cả 7 mục đều đúng. Nếu mục nào sai → sang [Phần 8](#phần-8--xử-lý-sự-cố) trước, đừng deploy khi còn lỗi.

---

## Phần 5 — GitHub (lưu code)

### 5.1. Tạo repository trống

1. Vào https://github.com/new
2. Điền:

   | Ô | Điền gì |
   |---|---|
   | Repository name | `brandhunt-web` |
   | Description | `OnPoint Brand Hunt & Tier Analyzer` |
   | Visibility | **Private** ← quan trọng |
   | Initialize this repository with | **Không tick gì cả** |

3. **Create repository**
4. Trang tiếp theo hiện một địa chỉ dạng `https://github.com/<tên-bạn>/brandhunt-web.git` — copy lại

> **Vì sao Private:** repo này chứa Brand history đầy đủ — tier, điểm số, blocker, contact point, notes. Đây là dữ liệu thương mại nội bộ, không để public.

> **Vì sao không tick gì ở mục Initialize:** nếu tick, GitHub tạo sẵn file README/`.gitignore` trên repo, trong khi máy bạn cũng có file cùng tên → xung đột ngay lần đẩy đầu tiên. Để trống là gọn nhất.

### 5.2. Đẩy code lên

Dán prompt này cho Claude (thay địa chỉ repo của bạn vào):

```
Đẩy dự án này lên GitHub:

1. Chạy git init (nếu chưa có)
2. TRƯỚC KHI COMMIT: kiểm tra git status và xác nhận .env.local,
   node_modules/ và .next/ KHÔNG nằm trong danh sách sẽ được commit.
   Nếu có thì dừng lại báo tôi ngay.
3. git add . và commit với message:
   "BrandHunt web app - Next.js + Supabase"
4. Đặt branch chính là main
5. Thêm remote: https://github.com/<tên-bạn>/brandhunt-web.git
6. Push lên

Nếu bị hỏi đăng nhập thì dừng lại và hướng dẫn tôi.
```

**Lần đầu push, Windows sẽ bật cửa sổ đăng nhập GitHub.** Chọn **Sign in with your browser** → đăng nhập → xong. Windows nhớ luôn cho các lần sau.

### 5.3. Kiểm tra

Mở lại trang repo trên GitHub, bấm F5. Phải thấy đủ các file và thư mục.

**Kiểm tra bảo mật — làm ngay bây giờ:** nhìn danh sách file trên GitHub.

- ❌ Nếu thấy `.env.local` → **chìa khoá của bạn đã bị lộ**. Vào Supabase → Project Settings → API → bấm **Reset** cho anon key, rồi làm lại từ 4.1 với key mới.
- ❌ Nếu thấy `node_modules` → không nguy hiểm nhưng repo sẽ phình to. Bảo Claude: `Xoá node_modules khỏi git tracking và commit lại.`
- ✅ Không thấy cả hai → đúng.

### ✅ Kiểm tra Phần 5

Code đã lên GitHub, không có `.env.local`, không có `node_modules`.

---

## Phần 6 — Vercel (đưa lên mạng)

### 6.1. Import dự án

1. Vào https://vercel.com/new
2. Lần đầu dùng, Vercel xin quyền đọc GitHub → bấm **Install** / **Authorize**. Chọn **All repositories** cho tiện, hoặc **Only select repositories** rồi chọn `brandhunt-web`.
3. Tìm `brandhunt-web` trong danh sách → bấm **Import**

### 6.2. Cấu hình

Vercel tự nhận diện đây là Next.js. **Không đổi gì** ở các mục Framework Preset, Build Command, Output Directory, Install Command.

Chỉ làm một việc: mở mục **Environment Variables**, thêm 3 biến:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL từ bước 3.5 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key từ bước 3.5 |
| `NEXT_PUBLIC_APP_VERSION` | `1.0.0` |

Mỗi biến: gõ Key, dán Value, bấm **Add**.

> Nếu Vercel hỏi áp dụng cho môi trường nào → chọn **cả ba**: Production, Preview, Development.

### 6.3. Deploy

Bấm **Deploy**. Đợi 2–3 phút. Màn hình sẽ chạy log build.

Khi xong: pháo giấy 🎉 và một ô preview. Bấm **Continue to Dashboard** → góc trên có đường link dạng `brandhunt-web.vercel.app`. Đó là link của bạn.

### 6.4. Nếu build thất bại

Bấm vào deployment bị lỗi → tab **Building** → copy toàn bộ log. Rồi dán cho Claude:

```
Build trên Vercel bị lỗi. Đây là log:

<dán log vào đây>

Tìm nguyên nhân và sửa. Sau khi sửa xong thì commit và push để Vercel
tự deploy lại.
```

### ✅ Kiểm tra Phần 6

Có link `.vercel.app` mở được.

---

## Phần 7 — Nghiệm thu

Mở link Vercel trên trình duyệt và làm lại **đúng 7 mục ở bước 4.3**. Lần này chạy trên internet thật, không phải máy bạn.

Thêm 3 mục nữa:

| # | Kiểm tra | Vì sao cần |
|---|---|---|
| 8 | Mở link trên điện thoại | Xác nhận không phải chỉ chạy trên máy bạn |
| 9 | Gửi link cho 1 đồng nghiệp, nhờ chạy thử 1 brand | Xác nhận không vướng đăng nhập |
| 10 | Vào Supabase → **Table Editor** → bảng `analysis_run` | Phải thấy các dòng vừa được ghi từ những lần chạy trên |

Mục 10 là bằng chứng cuối cùng: app trên internet **ghi thật** vào database, không phải chỉ hiển thị.

### Kiểm tra chuyên sâu (khuyến nghị, cần Python)

Có một rủi ro không nhìn thấy được bằng mắt: dữ liệu đi qua đường database có thể bị lệch số mà app vẫn chạy bình thường, không báo lỗi gì. Chạy lệnh này để loại trừ:

```
Chạy: pip install pglast
Rồi chạy: npm run verify
Cho tôi biết kết quả.
```

Kết quả đúng: `KHOP 100% — 10 key, 20 brand, 20 price band, tat ca so lieu trung khop`

---

## Phần 8 — Xử lý sự cố

Với mọi lỗi, cách nhanh nhất là mô tả cho Claude kèm bằng chứng. Prompt mẫu:

```
App bị lỗi. Triệu chứng: <mô tả bạn nhìn thấy gì>

Console trình duyệt báo:
<mở Chrome, nhấn F12, tab Console, copy dòng đỏ vào đây>

Đọc mục "Xử lý sự cố" trong README.md rồi chẩn đoán giúp tôi.
```

Bảng tra nhanh:

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Nhãn đỏ **Lỗi data**, báo thiếu biến môi trường | Chưa set env, hoặc set rồi nhưng chưa deploy lại | Vercel → Settings → Environment Variables → kiểm tra đủ 3 biến → sang tab **Deployments** → deployment mới nhất → dấu `...` → **Redeploy**. **Đổi env không tự build lại, bắt buộc phải Redeploy.** |
| Báo `Bảng market_kpi rỗng` | Chưa chạy `0002_seed.sql` | Quay lại bước 3.3 |
| Console báo `permission denied for table` | RLS chưa có policy | Chạy lại toàn bộ `0001_schema.sql` (an toàn khi chạy lại) |
| Trang trắng, Console báo `lookup is not defined` | Thao tác trước khi app nạp xong | Đợi nhãn **Data: Supabase** hiện rồi mới bấm. Còn lỗi → bảo Claude kiểm tra `reactStrictMode: false` trong `next.config.mjs` |
| Bấm Analyze nhưng Run History trống | Insert bị chặn hoặc lỗi | F12 → Console → tìm dòng `[saveRun]`. Kiểm tra policy `analysis_run_anon_insert` trong Supabase |
| Export .pptx bị chặn, báo có token nội bộ | Lớp chống rò rỉ bắt được | **Đây là tính năng, không phải lỗi.** Hệ thống vừa ngăn thông tin nội bộ lọt vào deck gửi brand. Xem mục Export trong README |
| Chart trong .pptx ra trắng | SVG raster hoá sai | Xem mục "Chart = raster hoá SVG" trong `_source_dashboard/README.md` |
| `git push` báo `Permission denied` / `Authentication failed` | Chưa đăng nhập GitHub trên máy | Bảo Claude: `git push lại và hướng dẫn tôi đăng nhập` |
| `npm` hoặc `node` không được nhận dạng | Chưa khởi động lại máy sau khi cài | Khởi động lại máy |
| Build Vercel fail ở bước `npm run port` | File trong `scripts/_source/` bị sửa làm lệch regex | Log Vercel ghi rõ khối nào không tìm thấy. Dán log cho Claude |

---

## Phần 9 — Vận hành sau khi deploy

### 9.1. Sửa code và deploy lại

Đây là vòng lặp hàng ngày:

```
Sửa <mô tả việc cần làm>.
Xong thì commit và push lên GitHub.
```

Vercel tự phát hiện có code mới và deploy lại trong ~2 phút. **Bạn không cần vào Vercel làm gì cả.**

### 9.2. Cập nhật Brand history khi Excel thay đổi

Khi `Final Brand history.xlsx` có brand mới hoặc đổi status:

1. Chạy script extract của dashboard cũ để sinh lại `data_line.js`
2. Copy file đó đè lên `scripts/_source/data_line.js`
3. Nói với Claude:

```
File scripts/_source/data_line.js vừa được cập nhật.
Chạy npm run seed để sinh lại supabase/migrations/0002_seed.sql,
rồi cho tôi biết số dòng mới của từng bảng.
```

4. Copy nội dung `0002_seed.sql` mới → dán vào Supabase SQL Editor → **Run**

File seed **an toàn khi chạy lại nhiều lần**: nó xoá sạch các bảng dữ liệu tham chiếu rồi nạp lại, và **không đụng tới bảng `analysis_run`** — toàn bộ lịch sử chạy được giữ nguyên.

### 9.3. Sửa nhanh 1–2 ô dữ liệu

Đổi một status, một blocker, một contact point → sửa thẳng trong **Supabase → Table Editor → brand_history**. Có hiệu lực ngay, không cần deploy.

⚠️ Nhưng lần chạy `npm run seed` tiếp theo sẽ ghi đè. Nhớ cập nhật cả file Excel gốc để hai nguồn không lệch nhau.

### 9.4. Đổi ngưỡng Tier / Band

Không cần dev, không cần deploy. Supabase → **SQL Editor**:

```sql
-- ví dụ: hạ ngưỡng ELEPHANT từ 60 xuống 50 tỉ VND
update scoring_rule set threshold = 50
where kind = 'tier' and label = 'ELEPHANT (T1)';
```

Bảng đọc từ trên xuống theo `sort_order`, dùng **ngưỡng đầu tiên khớp**.

### 9.5. Quay lại bản trước khi deploy hỏng

Vercel → tab **Deployments** → tìm bản đang chạy tốt → dấu `...` → **Promote to Production**. Có hiệu lực trong vài giây.

Đây là lý do đáng để dùng GitHub + Vercel: mọi bản deploy đều được giữ lại, quay đầu chỉ mất một cú bấm.

### 9.6. Xuất báo cáo hoạt động hunting

Mở link → tab **Run History** → bấm **Export CSV**. File mở được bằng Excel, đã có sẵn BOM nên tiếng Việt không bị lỗi font.

Cần cắt số theo tháng thì dùng view có sẵn trong Supabase SQL Editor:

```sql
select * from v_run_summary order by month desc;
```

---

## Phần 10 — Bảo mật (đọc trước khi share link)

**App này chạy public, không có đăng nhập** — đúng theo yêu cầu ban đầu. Nghĩa là **bất kỳ ai có link đều xem được toàn bộ Brand history**: tier, commercial score, blocker, contact point, notes, và xuất được deck.

Đây là dữ liệu pipeline thương mại nội bộ. Cân nhắc kỹ trước khi phát tán link.

### Hai cách khoá lại, khi cần

| Cách | Công sức | Được gì |
|---|---|---|
| **Vercel Password Protection** | 2 phút, cần gói Pro ($20/tháng) | Một mật khẩu chung cho cả trang. Vercel → Settings → Deployment Protection |
| **Supabase Auth giới hạn domain** | ~nửa ngày công dev | Chỉ email `@onpoint.vn` đăng nhập được, biết ai làm gì, phân quyền được theo vai trò |

Muốn làm cách thứ hai, prompt cho Claude:

```
Thêm Supabase Auth vào app này, chỉ cho phép email @onpoint.vn đăng nhập.
Cập nhật RLS policy để chỉ authenticated user mới đọc được dữ liệu.
Trình bày kế hoạch trước khi sửa code.
```

### Một việc chưa xong, cần kiểm tra riêng

**Kalodata licensing chưa được xác minh.** Deck `.pptx` mà app xuất ra có republish số GMV và tỷ trọng affiliate lấy từ Kalodata cho bên thứ ba (brand). Cần kiểm tra hợp đồng Kalodata xem có cho phép redistribute ra ngoài không.

Rủi ro này **lớn hơn so với hồi còn dùng file HTML**, vì giờ deck xuất được từ một link công khai.

### Danh sách kiểm tra bảo mật

- [ ] Repo GitHub để **Private**
- [ ] `.env.local` **không** có trên GitHub
- [ ] Chỉ dùng key `anon`, **không** dùng `service_role`
- [ ] Đã cân nhắc ai được nhận link
- [ ] Đã xác minh Kalodata licensing trước khi gửi deck ra ngoài

---

## Phụ lục A — Bảng tra prompt cho Claude

| Việc cần làm | Prompt |
|---|---|
| Cài thư viện | `Chạy npm install và báo cáo kết quả.` |
| Chạy thử | `Chạy npm run dev và cho tôi link.` |
| Dừng server | `Dừng server dev đi.` |
| Đẩy code lên | `Commit và push thay đổi lên GitHub với message mô tả rõ những gì vừa sửa.` |
| Sinh lại seed | `Chạy npm run seed và cho tôi biết số dòng từng bảng.` |
| Sinh lại engine | `Chạy npm run port.` |
| Kiểm chứng dữ liệu | `Chạy npm run verify và giải thích kết quả.` |
| Chẩn đoán lỗi | `App lỗi: <mô tả>. Console báo: <dán log>. Đọc README.md rồi chẩn đoán.` |
| Kiểm tra trước khi push | `Chạy git status, xác nhận không có file nhạy cảm nào sắp được commit.` |

## Phụ lục B — Nguyên tắc bắt buộc khi sửa code

Có 4 file **sinh tự động**. Sửa tay vào chúng sẽ mất trắng ở lần build tiếp theo:

- `src/lib/engine/index.js`
- `src/app/engine.css`
- `src/components/shellBody.js`
- `supabase/migrations/0002_seed.sql`

Muốn đổi logic nghiệp vụ → sửa trong `scripts/_source/` rồi chạy `npm run port`.

Nhắc Claude bằng prompt này mỗi khi bắt đầu việc sửa lớn:

```
Trước khi sửa bất cứ gì, đọc README.md mục "Kiến trúc" để biết file nào
được sinh tự động và không được sửa tay.
```

> **Vì sao quan trọng:** engine của app là bản ghép nguyên vẹn 3 file JS đã chạy production, đang được **298 assertion** khoá lại — trong đó **53 assertion chống rò rỉ thông tin nội bộ ra deck gửi brand**. Sửa thẳng vào file sinh tự động sẽ vừa mất thay đổi, vừa phá vỡ lớp bảo vệ đó.

---

## Nguồn tham khảo

- [Claude Code trong VS Code — tài liệu chính thức](https://code.claude.com/docs/en/vs-code)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs — deploy Next.js](https://vercel.com/docs/frameworks/nextjs)
