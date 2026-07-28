# public/vendor/

Hai thư viện này **cố ý không lấy từ npm**.

| File | Là gì |
|---|---|
| `xlsx.full.min.js` | SheetJS — đọc file brief `.xlsx` |
| `pptxgen.bundle.js` | PptxGenJS 4.0.1 + JSZip — xuất deck `.pptx` |

## Vì sao không dùng npm

1. **298 assertion của test suite được viết dựa trên đúng 2 bản này.** Đổi sang version npm khác = đổi hành vi parse `.xlsx` và sinh `.pptx` mà không có gì bảo đảm. Đây là rủi ro không cần thiết.
2. **SheetJS bản mới chỉ phân phối qua `cdn.sheetjs.com`**, không còn cập nhật trên npm registry. Một dependency mạng ngoài registry có thể làm fail build trên Vercel hoặc sau proxy công ty.
3. `pptxgen.bundle.js` là **bản bundle kèm JSZip**. Gói `pptxgenjs` trên npm không đóng kèm JSZip, nên không thay thế 1-1 được.

## Cách nạp

Không nhúng bằng `<script>` trong layout. `src/lib/vendor.js` nạp theo nhu cầu:

- `ensureXLSX()` — gọi khi mở màn hình upload brief
- `ensurePptxGenJS()` — gọi ngay trước khi export deck

Kết quả: người chỉ tra cứu brand đã tiếp cận không phải tải 1.3 MB JS mà họ không dùng đến.

## Cập nhật thư viện

Chỉ nâng version khi có lý do rõ ràng (lỗ hổng bảo mật, hoặc cần tính năng mới). Quy trình bắt buộc:

1. Thay file trong thư mục này **và** trong `Dashboard/_source_dashboard/`
2. Chạy lại toàn bộ test suite: `node test_app.js && node audit_css.js && node test_pptx.js`
3. Kiểm tra tay: parse cả 6 brief trong `Brief form library/` + export 1 deck rồi mở bằng PowerPoint
