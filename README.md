# Săn Deal

App Android (chạy bằng AutoX.js) canh 1 sản phẩm trong danh sách live TikTok Shop theo số thứ tự,
khi nút Mua sáng và/hoặc giá ≤ X thì bấm Mua → chọn MoMo → Đặt hàng, dừng khi sang app MoMo.
Chỉ thao tác giao diện như người bấm; dùng cho tài khoản cá nhân.

- `loader.js` — cài 1 lần trên điện thoại; mỗi lần mở tự tải `main.js` mới (kiểm SHA-256), lỗi mạng dùng bản đã lưu.
- `main.js` — giao diện + logic canh/mua + chẩn đoán màn hình.
- `version.json` — tạo bằng `./release.sh` sau mỗi lần sửa `main.js`.

## Build APK (GitHub Actions)
`.github/workflows/build-apk.yml`: build khung AutoX **từ mã nguồn** aiselp/AutoX (tag cố định, cache lại),
ghép `loader.js` + `build/app.json` bằng `build/patch.py`, ký bằng secret `SANDEAL_KEYSTORE_B64` / `SANDEAL_KEYSTORE_PASS`,
đăng lên Releases. Chạy khi push tag `apk-v*` hoặc bấm Run workflow.
Chỉ cần build lại APK khi đổi `loader.js` hoặc `build/app.json` (nhớ tăng versionCode).

## Cài trên điện thoại
1. Tải `SanDeal.apk` ở https://github.com/vantuan120221/san-deal/releases/latest , cài.
2. Cài đặt → Ứng dụng → Săn Deal → ⋮ → **Cho phép cài đặt bị hạn chế**.
3. Mở Săn Deal → bật Trợ năng + Hiển thị trên ứng dụng khác khi được hỏi; Pin → Không hạn chế.

Giấy phép AutoX: MPL-2.0 + không dùng cho mục đích thương mại.
