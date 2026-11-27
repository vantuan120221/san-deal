# Săn Deal

App Android (chạy bằng AutoX.js) canh 1 sản phẩm trong danh sách live TikTok Shop theo số thứ tự,
khi nút Mua sáng và/hoặc giá ≤ X thì bấm Mua → chọn MoMo → Đặt hàng, dừng khi sang app MoMo.
Chỉ thao tác giao diện như người bấm; dùng cho tài khoản cá nhân.

- `loader.js` — cài 1 lần trên điện thoại; mỗi lần mở tự tải `main.js` mới (kiểm SHA-256), lỗi mạng dùng bản đã lưu.
- `main.js` — giao diện + logic canh/mua + chẩn đoán màn hình.
- `version.json` — tạo bằng `./release.sh` sau mỗi lần sửa `main.js`.

## Cài trên điện thoại (1 lần)
1. Cài AutoX.js từ https://github.com/kkevsekk1/AutoX/releases (bản arm64-v8a).
2. Android 13+: Cài đặt → Ứng dụng → AutoX.js → ⋮ → **Cho phép cài đặt bị hạn chế**.
3. Bật Trợ năng cho AutoX.js; cho phép **Hiển thị trên ứng dụng khác**; Pin → **Không hạn chế**.
4. Trong AutoX.js tạo file mới `SanDeal.js`, dán nội dung `loader.js`, lưu.
5. Bấm ⋮ cạnh `SanDeal.js` → **Tạo lối tắt / Gửi ra màn hình chính** → có biểu tượng Săn Deal.
