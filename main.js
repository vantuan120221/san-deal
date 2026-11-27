"ui";
// Săn Deal — canh 1 sản phẩm trong danh sách live TikTok Shop, đủ điều kiện thì mua.
// Chỉ thao tác giao diện như người bấm. Dừng khi đã sang app MoMo (người dùng tự xác nhận).
var VERSION = "0.2.4";
var TIKTOK = ["com.ss.android.ugc.trill", "com.zhiliaoapp.musically"];
var MOMO = "com.mservice.momotransfer";
var DIR = context.getFilesDir().getAbsolutePath() + "/sandeal/diag/";
var POLL_MS = 80;
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
            <checkbox id="color" text="Kiểm tra màu nút Mua (đỏ/đen) — cần quyền chụp màn hình" marginTop="8"/>
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
ui.color.checked = store.get("color", true);
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
        color: ui.color.checked,
        dry: ui.dry.checked
    };
    if (!(cfg.idx > 0)) { toast("Nhập số thứ tự sản phẩm"); return; }
    if ((cfg.mode == "m_price" || cfg.mode == "m_both") && !cfg.price) { toast("Chế độ này cần nhập giá"); return; }
    store.put("idx", String(cfg.idx)); store.put("price", cfg.price ? String(cfg.price) : "");
    store.put("mode", cfg.mode); store.put("color", cfg.color); store.put("dry", cfg.dry);
    threads.start(function () { hunt(cfg); });
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

// ---------- danh sách sản phẩm ----------
// Số thứ tự là ô số nhỏ ở góc trái ảnh sản phẩm
function badges() {
    var out = [];
    // số có thể nằm ở text hoặc desc
    function add(n, v) {
        var b = n.bounds();
        if (b.left < W * 0.4 && b.top > H * 0.25 && b.height() < H * 0.05) out.push({ n: parseInt(v), top: b.top });
    }
    textMatches(/^\d{1,3}$/).find().forEach(function (n) { add(n, n.text()); });
    descMatches(/^\d{1,3}$/).find().forEach(function (n) { add(n, n.desc()); });
    return out.sort(function (a, b) { return a.top - b.top; });
}

function findRow(idx) {
    var bs = badges();
    for (var i = 0; i < bs.length; i++) {
        if (bs[i].n == idx) {
            var bottom = (i + 1 < bs.length) ? bs[i + 1].top - 4 : bs[i].top + Math.round(H * 0.15);
            return { top: bs[i].top - Math.round(H * 0.01), bottom: Math.min(bottom, H) };
        }
    }
    return { visible: bs.map(function (x) { return x.n; }) };
}

function scrollTo(idx) {
    for (var k = 0; k < 40 && running; k++) {
        var r = findRow(idx);
        if (r.top !== undefined) {
            // đưa hàng lên giữa màn hình cho chắc nút Mua nằm trong màn hình
            if (r.bottom < H * 0.95) return r;
        }
        var vis = r.visible || [];
        var sc = scrollable(true).find(), best = null;
        sc.forEach(function (n) { var b = n.bounds(); if (b.top > H * 0.25 && (!best || b.height() > best.bounds().height())) best = n; });
        if (!best) return null;
        if (vis.length && Math.min.apply(null, vis) > idx) best.scrollBackward(); else best.scrollForward();
        sleep(400);
    }
    return null;
}

function parsePrice(t) {
    t = clean(t).trim();
    if (!/^\d{1,3}(\.\d{3})+\s*đ?$/.test(t) && !/^\d+\s*đ$/.test(t)) return 0;
    return parseInt(t.replace(/\D/g, ""));
}

var capOK = false;
function isRed(b) {
    if (!capOK) return null;
    // lấy màu ở mép trái trong nút (tránh trúng chữ trắng)
    var img = captureScreen();
    var c = images.pixel(img, b.left + Math.round(b.width() * 0.12), b.centerY());
    var r = colors.red(c), g = colors.green(c), bl = colors.blue(c);
    return r > 180 && g < 120 && bl < 150;
}

function readRow(row) {
    var nodes = boundsInside(0, row.top, W, row.bottom).find();
    var mua = null, prices = [];
    nodes.forEach(function (n) {
        var t = clean(n.text());
        if (t == "Mua") mua = n;
        var p = parsePrice(t);
        if (p) prices.push(p);
    });
    var lit = false;
    if (mua) {
        var en = mua.enabled(), p = mua.parent();
        if (p) en = en && p.enabled();
        lit = en;
        var btn = mua;
        if (p && p.clickable()) btn = p;
        if (lit && capOK) lit = isRed(btn.bounds());
    }
    return { mua: mua, lit: lit, price: prices.length ? Math.min.apply(null, prices) : 0 };
}

function shouldBuy(st, cfg) {
    var okPrice = cfg.price > 0 && st.price > 0 && st.price <= cfg.price;
    if (cfg.mode == "m_btn") return st.lit;
    if (cfg.mode == "m_price") return st.mua && okPrice;
    if (cfg.mode == "m_both") return st.lit && okPrice;
    return st.lit || (st.mua && okPrice); // m_any
}

// ---------- trang đặt hàng ----------
function checkout(cfg) {
    status("Đang chờ trang đặt hàng...");
    var ready = waitFor(function () {
        return textMatches(/^(Đặt hàng|Kích hoạt)$/).findOnce() || textStartsWith("Tổng (").findOnce();
    }, 20000);
    if (!ready) return "Không thấy trang đặt hàng sau 20 giây";

    // tìm MoMo (cuộn xuống nếu cần), không có thì COD
    var pay = null;
    for (var k = 0; k < 10 && running && !pay; k++) {
        pay = textContains("MoMo").findOnce() || null;
        if (!pay) {
            var sc = scrollable(true).findOnce();
            if (sc) sc.scrollForward(); else swipe(W / 2, H * 0.7, W / 2, H * 0.35, 150);
            sleep(150);
        }
    }
    var payName = "MoMo";
    if (!pay) { pay = textContains("Thanh toán khi giao").findOnce(); payName = "COD"; }
    if (!pay) return "Không tìm thấy MoMo hay COD";
    status("Chọn " + payName);
    tap(pay);

    // hộp thoại "Bạn sẽ mất ưu đãi" -> Thay đổi phương thức thanh toán
    var chg = waitFor(function () { return textStartsWith("Thay đổi phương thức").findOnce(); }, 2000);
    if (chg) { tap(chg); sleep(150); }

    // chỉ bấm khi nút ghi đúng "Đặt hàng" — tuyệt đối không bấm "Kích hoạt"
    var order = waitFor(function () {
        if (text("Kích hoạt").findOnce()) return null;
        return text("Đặt hàng").findOnce();
    }, 5000);
    if (!order) return "Nút dưới cùng chưa thành 'Đặt hàng' (vẫn PayLater?) — dừng để an toàn";
    if (cfg.dry) return "CHẠY THỬ OK: đã chọn " + payName + ", nút Đặt hàng sẵn sàng (không bấm)";

    status("Bấm Đặt hàng!");
    tap(order);
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

    capOK = false;
    if (cfg.color && cfg.mode != "m_price") {
        status("Cho phép chụp màn hình (để xem màu nút)...");
        capOK = requestScreenCapture();
        if (!capOK) status("Không có quyền chụp màn hình — chỉ dựa vào trạng thái nút");
    }

    status("Chuyển sang TikTok, mở danh sách sản phẩm...");
    waitFor(inTikTok, 60000);

    var row = null, last = "", t0 = Date.now(), n = 0, result = null;
    while (running) {
        if (!inTikTok()) { status("Đang ngoài TikTok, chờ..."); sleep(300); continue; }
        if (!row) {
            row = scrollTo(cfg.idx);
            if (!row) { status("Không tìm thấy #" + cfg.idx + " — mở danh sách sản phẩm"); sleep(500); continue; }
        }
        var st = readRow(row);
        if (!st.mua && !st.price) { row = null; continue; } // danh sách bị cuộn/đóng -> tìm lại
        if (shouldBuy(st, cfg)) {
            status("MUA #" + cfg.idx + " " + st.price + "đ");
            tap(st.mua);
            result = checkout(cfg);
            break;
        }
        n++;
        var s = "#" + cfg.idx + " | " + (st.price ? st.price.toLocaleString() + "đ" : "?") +
                " | nút " + (st.mua ? (st.lit ? "SÁNG" : "đen") : "không có") +
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
        "badges=" + JSON.stringify(badges()), "windows=" + diagWindows(),
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
