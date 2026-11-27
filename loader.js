// Săn Deal — LOADER (cài 1 lần, gần như không bao giờ đổi)
// Mỗi lần mở: kiểm tra bản mới trên GitHub, tải main.js nếu có, kiểm SHA-256, rồi chạy.
// Mất mạng / GitHub lỗi -> chạy bản đã lưu trong máy.
var BASE = "https://raw.githubusercontent.com/vantuan120221/san-deal/main/";
var DIR = "/sdcard/SanDeal/";
var MAIN = DIR + "main.js";
var VER = DIR + "version.txt";

function sha256(s) {
    var md = java.security.MessageDigest.getInstance("SHA-256");
    var b = md.digest(new java.lang.String(s).getBytes("UTF-8"));
    var hex = "";
    for (var i = 0; i < b.length; i++) {
        var h = (b[i] & 0xff).toString(16);
        hex += h.length < 2 ? "0" + h : h;
    }
    return hex;
}

files.ensureDir(DIR);
var local = files.exists(VER) ? String(files.read(VER)).trim() : "";

try {
    toast("Săn Deal: kiểm tra cập nhật...");
    var r = http.get(BASE + "version.json?t=" + Date.now());
    if (r.statusCode != 200) throw "HTTP " + r.statusCode;
    var info = r.body.json();
    if (info.version != local || !files.exists(MAIN)) {
        var m = http.get(BASE + "main.js?v=" + info.version);
        if (m.statusCode != 200) throw "HTTP " + m.statusCode;
        var code = m.body.string();
        if (sha256(code) != info.sha256) throw "file tải về bị lỗi (SHA-256 không khớp)";
        files.write(MAIN, code);
        files.write(VER, info.version);
        toast("Đã cập nhật lên bản " + info.version);
    }
} catch (e) {
    if (files.exists(MAIN)) toast("Không cập nhật được (" + e + "), dùng bản cũ " + local);
    else { alert("Lần đầu cần có mạng để tải app.\nLỗi: " + e); exit(); }
}

engines.execScriptFile(MAIN);
