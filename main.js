"ui";
// Săn Deal — canh 1 sản phẩm trong danh sách live TikTok Shop, đủ điều kiện thì mua.
// Chỉ thao tác giao diện như người bấm. Dừng khi đã sang app MoMo (người dùng tự xác nhận).
var VERSION = "0.3.1";
var TIKTOK = ["com.ss.android.ugc.trill", "com.zhiliaoapp.musically"];
var MOMO = "com.mservice.momotransfer";
var DIR = context.getFilesDir().getAbsolutePath() + "/sandeal/diag/";
var POLL_MS = 30;
var store = storages.create("san_deal");
var W = device.width, H = device.height;

// Chỉ tìm trong cửa sổ TikTok: mặc định AutoX đọc "cửa sổ đang hoạt động", trên Android 17
// cửa sổ đó có thể là app Săn Deal / nút nổi thay vì TikTok.
function winPkg(w) {
    try { var r = w.getRoot(); return r ? String(r.getPackageName()) : ""; } catch (e) { return ""; }
}
try {
    auto.setWindowFilter(function (w) { return TIKTOK.indexOf(winPkg(w)) >= 0; });
} catch (e) { log("setWindowFilter lỗi: " + e); }

ui.layout(
    <scroll>
        <vertical padding="16">
            <text text="Săn Deal TikTok" textSize="22sp" textStyle="bold"/>
            <text id="ver" textSize="12sp" textColor="#888888"/>
            <text text="Số thứ tự sản phẩm trong danh sách" marginTop="12"/>
            <input id="idx" inputType="number" hint="vd 57"/>
            <text text="Giá tối đa (đồng) — để trống nếu không dùng giá" marginTop="8"/>
            <input id="price" inputType="number" hint="vd 150000"/>
            <text text="Điều kiện mua" marginTop="8"/>
            <radiogroup id="mode">
                <radio id="m_any" text="1 trong 2: nút Mua sáng HOẶC giá ≤ X"/>
                <radio id="m_btn" text="Chỉ cần nút Mua sáng"/>
                <radio id="m_price" text="Chỉ cần giá ≤ X"/>
                <radio id="m_both" text="Cả hai: nút sáng VÀ giá ≤ X"/>
            </radiogroup>
            <checkbox id="dry" text="CHẠY THỬ: làm hết nhưng KHÔNG bấm Đặt hàng"/>
            <button id="start" text="BẮT ĐẦU CANH" marginTop="12"/>
            <button id="diag" text="Chẩn đoán màn hình (gửi qua Telegram cho Claude)"/>
            <text id="perm" textSize="13sp" textColor="#cc0000" marginTop="8"/>
            <text textSize="12sp" textColor="#888888" marginTop="12"
                text="Cách dùng: mở live → mở danh sách sản phẩm → quay lại đây nhập số → Bắt đầu → chuyển sang TikTok. Nút nổi DỪNG để dừng."/>
        </vertical>
    </scroll>
);

// ---------- cài đặt ----------
ui.ver.setText("Phiên bản " + VERSION);
ui.idx.setText(store.get("idx", ""));
ui.price.setText(store.get("price", ""));
ui[store.get("mode", "m_any")].checked = true;
ui.dry.checked = store.get("dry", true);

function checkPerm() {
    var msg = [];
    if (!auto.service) msg.push("• Chưa bật Trợ năng cho app (bấm Bắt đầu để mở cài đặt)");
    if (!floaty.checkPermission()) msg.push("• Chưa cho phép hiển thị trên ứng dụng khác");
    ui.perm.setText(msg.join("\n"));
    return msg.length == 0;
}
checkPerm();
ui.emitter.on("resume", checkPerm);

function getMode() {
    var ids = ["m_any", "m_btn", "m_price", "m_both"];
    for (var i = 0; i < ids.length; i++) if (ui[ids[i]].checked) return ids[i];
    return "m_any";
}

ui.start.click(function () {
    if (!auto.service) { app.startActivity({ action: "android.settings.ACCESSIBILITY_SETTINGS" }); return; }
    if (!floaty.checkPermission()) { floaty.requestPermission(); return; }
    var cfg = {
        idx: parseInt(String(ui.idx.getText())),
        price: parseInt(String(ui.price.getText()).replace(/\D/g, "")) || 0,
        mode: getMode(),
        dry: ui.dry.checked
    };
    if (!(cfg.idx > 0)) { toast("Nhập số thứ tự sản phẩm"); return; }
    if ((cfg.mode == "m_price" || cfg.mode == "m_both") && !cfg.price) { toast("Chế độ này cần nhập giá"); return; }
    store.put("idx", String(cfg.idx)); store.put("price", cfg.price ? String(cfg.price) : "");
    store.put("mode", cfg.mode); store.put("dry", cfg.dry);
    threads.start(function () {
        try { hunt(cfg); }
        catch (e) {
            var m = String(e);
            if (/mlkit|UnsatisfiedLink|ocr/i.test(m)) m = "Thiếu bộ đọc chữ — hãy cài APK Săn Deal 1.1.0 mới. (" + m + ")";
            status("LỖI: " + m); toast("LỖI: " + m); running = false;
        }
    });
});

// Chẩn đoán bằng nút nổi: bạn mở TikTok tới đúng màn hình rồi tự bấm "ĐỌC" -> không phải canh giờ
var dw = null;
ui.diag.click(function () {
    if (!auto.service) { app.startActivity({ action: "android.settings.ACCESSIBILITY_SETTINGS" }); return; }
    if (!floaty.checkPermission()) { floaty.requestPermission(); return; }
    if (dw) return;
    var n = 0;
    dw = floaty.window(
        <vertical bg="#dd1565c0" padding="6">
            <text id="dtxt" textColor="#ffffff" textSize="12sp" text="Mở TikTok tới màn hình cần đọc rồi bấm ĐỌC" w="200"/>
            <horizontal>
                <button id="btnRead" text="ĐỌC" w="90" h="44"/>
                <button id="btnClose" text="ĐÓNG" w="90" h="44"/>
            </horizontal>
        </vertical>
    );
    dw.setPosition(30, Math.round(H * 0.08));
    dw.btnRead.click(function () {
        n++;
        var label = "man" + n;
        dw.dtxt.setText("Đang đọc " + label + "...");
        threads.start(function () {
            var txt = diagDump(label);
            ui.run(function () { if (dw) dw.dtxt.setText("Đã đọc " + label + " (" + txt.length + " ký tự). Chọn Telegram để gửi."); });
        });
    });
    dw.btnClose.click(function () { dw.close(); dw = null; });
    toast("Mở TikTok rồi bấm nút ĐỌC màu xanh");
});

// ---------- tiện ích ----------
var running = false, fw = null;

function status(s) {
    log(s);
    if (fw) ui.run(function () { fw.ftxt.setText(s); });
}
function clean(s) { return s ? String(s).replace(/[\r\n\t]+/g, " ") : ""; }
function waitFor(fn, ms) {
    var t = Date.now();
    while (running && Date.now() - t < ms) { var r = fn(); if (r) return r; sleep(30); }
    return null;
}
function tap(n) {
    // bấm node: ưu tiên chính nó/cha có thể bấm, không được thì bấm theo tọa độ
    var p = n, k = 0;
    while (p && k < 5) { if (p.clickable() && p.click()) return true; p = p.parent(); k++; }
    var b = n.bounds();
    return click(b.centerX(), b.centerY());
}
function inTikTok() { return TIKTOK.indexOf(String(currentPackage())) >= 0; }

// ---------- chụp màn hình + đọc chữ trên ảnh (ML Kit OCR) ----------
// TikTok không cho Trợ năng đọc danh sách sản phẩm, nên đọc bằng ảnh chụp màn hình.
var capOK = false, _rec = null;
function ensureCapture() {
    if (!capOK) capOK = requestScreenCapture();
    return capOK;
}
function shot() {
    try { return captureScreen(); }
    catch (e) {
        // phiên chụp màn hình bị Android ngắt (vd sau khi chẩn đoán) -> xin lại 1 lần
        if (/not available|ScreenCapturer/i.test(String(e))) {
            capOK = false;
            status("Phiên chụp màn hình đã tắt — bấm cho phép lại (Toàn màn hình)");
            if (ensureCapture()) { sleep(300); return captureScreen(); }
        }
        throw e;
    }
}

function ocrBitmap(bmp, ox, oy) {
    if (!_rec) _rec = com.google.mlkit.vision.text.TextRecognition.getClient(
        com.google.mlkit.vision.text.latin.TextRecognizerOptions.DEFAULT_OPTIONS);
    var res = com.google.android.gms.tasks.Tasks.await(
        _rec.process(com.google.mlkit.vision.common.InputImage.fromBitmap(bmp, 0)));
    var out = [], blocks = res.getTextBlocks();
    for (var i = 0; i < blocks.size(); i++) {
        var lines = blocks.get(i).getLines();
        for (var j = 0; j < lines.size(); j++) {
            var ln = lines.get(j), b = ln.getBoundingBox();
            if (!b) continue;
            out.push({ t: String(ln.getText()), l: b.left + ox, top: b.top + oy, r: b.right + ox, b: b.bottom + oy });
        }
    }
    return out;
}
// đọc chữ trong 1 vùng của ảnh
function ocrRegion(img, x, y, w, h) {
    x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
    w = Math.min(W - x, Math.round(w)); h = Math.min(H - y, Math.round(h));
    if (w < 10 || h < 10) return [];
    var bmp = android.graphics.Bitmap.createBitmap(img.getBitmap(), x, y, w, h);
    try { return ocrBitmap(bmp, x, y); } finally { bmp.recycle(); }
}
// bỏ dấu tiếng Việt để so chữ cho chắc
function plain(s) {
    s = String(java.text.Normalizer.normalize(String(s), java.text.Normalizer.Form.NFD));
    return s.replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}
function findLine(lines, re) {
    for (var i = 0; i < lines.length; i++) if (re.test(plain(lines[i].t))) return lines[i];
    return null;
}
function tapXY(x, y) { return click(Math.round(x), Math.round(y)); }

// ---------- danh sách sản phẩm ----------
// Số thứ tự = ô số nhỏ ở góc trái trên ảnh sản phẩm
function badges(img) {
    var lines = ocrRegion(img, 0, H * 0.3, W * 0.14, H * 0.7), out = [];
    lines.forEach(function (ln) {
        var t = ln.t.replace(/\s/g, "");
        if (/^\d{1,3}$/.test(t) && ln.l < W * 0.15 && (ln.b - ln.top) < H * 0.04) out.push({ n: parseInt(t), top: ln.top });
    });
    return out.sort(function (a, b) { return a.top - b.top; });
}

function findRow(img, idx) {
    var bs = badges(img);
    for (var i = 0; i < bs.length; i++) {
        if (bs[i].n == idx) {
            var top = bs[i].top - Math.round(H * 0.012);
            var bottom = (i + 1 < bs.length) ? bs[i + 1].top - Math.round(H * 0.015) : top + Math.round(H * 0.145);
            return { top: top, bottom: Math.min(bottom, H - 5) };
        }
    }
    return { visible: bs.map(function (x) { return x.n; }) };
}

function listScroller() {
    var best = null;
    scrollable(true).find().forEach(function (n) {
        var b = n.bounds();
        if (b.top > H * 0.4 && (!best || b.height() > best.bounds().height())) best = n;
    });
    return best;
}

function scrollTo(idx) {
    for (var k = 0; k < 40 && running; k++) {
        var r = findRow(shot(), idx);
        if (r.top !== undefined && r.bottom < H * 0.97) return r;
        var vis = r.visible || [];
        var down = !(vis.length && Math.min.apply(null, vis) > idx);
        if (r.top !== undefined) down = true;  // thấy nhưng sát đáy -> kéo lên chút
        var sc = listScroller(), pages = 1;
        if (vis.length >= 2 && r.top === undefined) {
            // mỗi trang thấy khoảng vis.length món -> nhảy thẳng nhiều trang khi còn xa
            var gap = down ? idx - Math.max.apply(null, vis) : Math.min.apply(null, vis) - idx;
            pages = Math.max(1, Math.min(10, Math.floor(gap / vis.length)));
        }
        for (var p = 0; p < pages && running; p++) {
            if (sc) { if (down) sc.scrollForward(); else sc.scrollBackward(); }
            else if (down) swipe(W * 0.5, H * 0.85, W * 0.5, H * 0.45, 200);
            else swipe(W * 0.5, H * 0.45, W * 0.5, H * 0.85, 200);
            sleep(pages > 1 ? 180 : 0);
        }
        sleep(350);
    }
    return null;
}

function isRedPx(c) { return colors.red(c) > 200 && colors.green(c) < 100 && colors.blue(c) < 140; }
function isDarkPx(c) { return colors.red(c) < 90 && colors.green(c) < 90 && colors.blue(c) < 90; }

// nút Mua nằm cột phải của hàng: đỏ = mua được, đen/xám = hết suất
function readButton(img, row) {
    var x = Math.round(W * 0.86), red = [], dark = [];
    for (var y = row.top; y < row.bottom; y += 6) {
        var c = images.pixel(img, x, y);
        if (isRedPx(c)) red.push(y); else if (isDarkPx(c)) dark.push(y);
    }
    var mid = function (a) { return a[Math.floor(a.length / 2)]; };
    if (red.length >= 4) return { has: true, lit: true, x: x, y: mid(red) };
    if (dark.length >= 4) return { has: true, lit: false, x: x, y: mid(dark) };
    return { has: false, lit: false };
}

function parsePriceText(t) {
    var m = String(t).replace(/\s/g, "").match(/(\d{1,3}(?:[.,]\d{3})+)/);
    return m ? parseInt(m[1].replace(/\D/g, "")) : 0;
}
function readPrice(img, row) {
    var ps = [];
    ocrRegion(img, W * 0.28, row.top + (row.bottom - row.top) * 0.45, W * 0.32, (row.bottom - row.top) * 0.55).forEach(function (ln) {
        var p = parsePriceText(ln.t);
        if (p >= 1000) ps.push(p);
    });
    return ps.length ? Math.min.apply(null, ps) : 0; // giá gạch luôn cao hơn giá bán
}

function shouldBuy(st, cfg) {
    var okPrice = cfg.price > 0 && st.price > 0 && st.price <= cfg.price;
    if (cfg.mode == "m_btn") return st.lit;
    if (cfg.mode == "m_price") return st.has && okPrice;
    if (cfg.mode == "m_both") return st.lit && okPrice;
    return st.lit || (st.has && okPrice); // m_any
}

// ---------- trang đặt hàng (đọc bằng ảnh) ----------
function screenLines() { return ocrRegion(shot(), 0, 0, W, H); }
function waitLines(re, ms) {
    var t = Date.now();
    while (running && Date.now() - t < ms) {
        var ls = screenLines(), f = findLine(ls, re);
        if (f) return { hit: f, lines: ls };
        sleep(60);
    }
    return null;
}

function checkout(cfg) {
    status("Đang chờ trang đặt hàng...");
    if (!waitLines(/^tong \(|kich hoat|dat hang/, 20000)) return "Không thấy trang đặt hàng sau 20 giây";

    // tìm MoMo, cuộn xuống nếu cần; không có thì COD
    var pay = null, payName = "MoMo";
    for (var k = 0; k < 8 && running && !pay; k++) {
        var ls = screenLines();
        pay = findLine(ls, /momo/);
        if (!pay) { swipe(W * 0.5, H * 0.75, W * 0.5, H * 0.4, 200); sleep(250); }
    }
    if (!pay) {
        var ls2 = screenLines();
        pay = findLine(ls2, /thanh toan khi giao/); payName = "COD";
    }
    if (!pay) return "Không tìm thấy MoMo hay COD";
    status("Chọn " + payName);
    tapXY(W * 0.92, (pay.top + pay.b) / 2); // bấm ô tròn bên phải

    // hộp thoại "Bạn sẽ mất ưu đãi" -> Thay đổi phương thức thanh toán
    var dlg = waitLines(/thay doi phuong thuc/, 2500);
    if (dlg) { tapXY((dlg.hit.l + dlg.hit.r) / 2, (dlg.hit.top + dlg.hit.b) / 2); sleep(300); }

    // nút dưới cùng phải ghi "Đặt hàng"; tuyệt đối không bấm "Kích hoạt"
    var t = Date.now(), order = null;
    while (running && Date.now() - t < 6000 && !order) {
        var bl = ocrRegion(shot(), 0, H * 0.86, W, H * 0.14);
        if (!findLine(bl, /kich hoat/)) order = findLine(bl, /dat hang/);
        if (!order) sleep(100);
    }
    if (!order) return "Nút dưới cùng chưa thành 'Đặt hàng' (vẫn PayLater?) — dừng để an toàn";
    if (cfg.dry) return "CHẠY THỬ OK: đã chọn " + payName + ", nút Đặt hàng sẵn sàng (không bấm)";

    status("Bấm Đặt hàng!");
    tapXY(W / 2, (order.top + order.b) / 2);
    var gone = waitFor(function () { return String(currentPackage()) == MOMO || !inTikTok(); }, 20000);
    if (gone) return "ĐÃ SANG MOMO — xác nhận thanh toán ngay!";
    return "Đã bấm Đặt hàng nhưng chưa sang MoMo — kiểm tra màn hình";
}

// ---------- vòng canh ----------
function hunt(cfg) {
    running = true;
    ui.run(function () {
        fw = floaty.window(
            <vertical bg="#dd000000" padding="8">
                <text id="ftxt" textColor="#ffffff" textSize="13sp" text="Săn Deal..." w="220"/>
                <button id="btnStop" text="DỪNG" w="100" h="44"/>
            </vertical>
        );
        fw.setPosition(30, Math.round(H * 0.12));
        fw.btnStop.click(function () { running = false; });
    });
    sleep(300);

    status("Cho phép chụp màn hình (chọn TOÀN MÀN HÌNH)...");
    if (!ensureCapture()) { status("Cần quyền chụp màn hình để đọc danh sách — đã dừng"); running = false; }

    if (running) { status("Chuyển sang TikTok, mở danh sách sản phẩm..."); waitFor(inTikTok, 60000); }

    var row = null, last = "", t0 = Date.now(), n = 0, result = null, price = 0, miss = 0;
    while (running) {
        if (!inTikTok()) { status("Đang ngoài TikTok, chờ..."); sleep(300); continue; }
        if (!row) {
            var ts = Date.now();
            status("Đang tìm #" + cfg.idx + "...");
            row = scrollTo(cfg.idx);
            if (row) log("tìm #" + cfg.idx + " mất " + (Date.now() - ts) + "ms");
            if (!row) { status("Không tìm thấy #" + cfg.idx + " — mở danh sách sản phẩm"); sleep(500); continue; }
            if (cfg.mode != "m_btn") price = readPrice(shot(), row);
        }
        var tl = Date.now();
        var img = shot();
        var st = readButton(img, row);
        // cứ ~15 vòng kiểm tra lại vị trí hàng (danh sách có thể xê dịch) + đọc lại giá
        if (!st.has || n % 15 == 14) {
            var r2 = findRow(img, cfg.idx);
            if (r2.top === undefined) { if (++miss >= 2) { row = null; miss = 0; } continue; }
            miss = 0; row = r2; st = readButton(img, row);
            if (cfg.mode != "m_btn") price = readPrice(img, row);
        }
        st.price = price;
        if (shouldBuy(st, cfg)) {
            status("MUA #" + cfg.idx + (price ? " " + price + "đ" : ""));
            tapXY(st.x, st.y);
            result = checkout(cfg);
            break;
        }
        n++;
        var s = "#" + cfg.idx + " | " + (price ? price.toLocaleString() + "đ" : "giá ?") +
                " | " + (Date.now() - tl) + "ms/vòng" +
                " | nút " + (st.has ? (st.lit ? "SÁNG" : "đen") : "?") +
                " | " + Math.round(n * 1000 / (Date.now() - t0)) + " lần/giây";
        if (s != last) { status(s); last = s; }
        sleep(POLL_MS);
    }
    if (!result) result = "Đã dừng";
    status(result);
    device.vibrate(result.indexOf("MOMO") >= 0 || result.indexOf("OK") >= 0 ? 1500 : 400);
    running = false;
    sleep(8000);
    ui.run(function () { if (fw) { fw.close(); fw = null; } });
}

// ---------- chẩn đoán ----------
function diagWindows() {
    try {
        var ws = auto.service.getWindows(), out = [];
        for (var i = 0; i < ws.size(); i++) {
            var w = ws.get(i);
            out.push(winPkg(w) + "(type" + w.getType() + (w.isActive() ? ",active" : "") + ")");
        }
        return out.join(" ");
    } catch (e) { return "lỗi " + e; }
}

function dumpNode(n, depth, out) {
    if (!n || out.length > 4000) return;
    var r = new android.graphics.Rect(); n.getBoundsInScreen(r);
    var t = clean(n.getText()), d = clean(n.getContentDescription());
    if (t || d || n.isClickable() || n.isScrollable()) {
        out.push([depth, clean(n.getClassName()).replace(/^.*\./, ""), clean(n.getViewIdResourceName()).replace(/^.*:id\//, ""),
            t.substring(0, 80), d.substring(0, 80), r.left + "," + r.top + "," + r.right + "," + r.bottom,
            (n.isClickable() ? "C" : "") + (n.isEnabled() ? "E" : "") + (n.isSelected() ? "S" : "") +
            (n.isChecked() ? "K" : "") + (n.isScrollable() ? "R" : "")].join("|"));
    }
    for (var i = 0; i < n.getChildCount(); i++) dumpNode(n.getChild(i), depth + 1, out);
}

function diagDump(label) {
    var out = ["label=" + label + " ver=" + VERSION + " pkg=" + currentPackage(),
        "device=" + device.brand + " " + device.model + " android=" + device.release + " screen=" + W + "x" + H,
        "windows=" + diagWindows(),
        "depth|class|id|text|desc|bounds|flags(C=click E=enabled S=selected K=checked R=scroll)"];
    var t0 = Date.now();
    try {
        var ws = auto.service.getWindows();
        for (var i = 0; i < ws.size(); i++) {
            var w = ws.get(i), pk = winPkg(w);
            if (pk == "com.android.systemui" || pk == "com.sec.android.app.launcher") continue;
            out.push("#### window " + pk + " type" + w.getType());
            dumpNode(w.getRoot(), 0, out);
        }
    } catch (e) { out.push("lỗi đọc: " + e); }
    out.splice(2, 0, "doc_ms=" + (Date.now() - t0) + " dong=" + out.length);
    try {
        if (ensureCapture()) {
            var img = shot();
            out.push("#### OCR badges=" + JSON.stringify(badges(img)));
            ocrRegion(img, 0, 0, W, H).forEach(function (ln) { out.push("ocr|" + ln.t + "|" + ln.l + "," + ln.top + "," + ln.r + "," + ln.b); });
        } else out.push("#### OCR: không có quyền chụp màn hình");
    } catch (e) { out.push("#### OCR lỗi: " + e); }
    var txt = out.join("\n");
    files.ensureDir(DIR);
    files.write(DIR + "diag_" + label + ".txt", txt);
    device.vibrate(200);
    app.startActivity({
        action: "android.intent.action.SEND", type: "text/plain",
        extras: { "android.intent.extra.SUBJECT": "SanDeal diag " + label, "android.intent.extra.TEXT": txt }
    });
    return txt;
}
