#!/usr/bin/env python3
"""Ghép Săn Deal vào template AutoX đã giải nén bằng apktool (thư mục work/).
Làm giống ApkBuilder của AutoX: đổi tên app, tên gói, authorities, thêm assets/project."""
import json, re, shutil, sys, time, pathlib

work = pathlib.Path(sys.argv[1])
root = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((root / "build" / "app.json").read_text(encoding="utf-8"))
OLD = "org.autojs.autoxjs.inrt"
NEW = cfg["packageName"]

# 1) AndroidManifest: tên app + authorities
mf = work / "AndroidManifest.xml"
s = mf.read_text(encoding="utf-8")
app_tag = re.search(r"<application\b[^>]*>", s, re.S).group(0)
new_tag = re.sub(r'android:label="[^"]*"', 'android:label="%s"' % cfg["name"], app_tag)
s = s.replace(app_tag, new_tag)
s, n = re.subn(r'(android:authorities=")([^"]*)(")',
               lambda m: m.group(1) + m.group(2).replace(OLD, NEW) + m.group(3), s)
mf.write_text(s, encoding="utf-8")
print("authorities sửa:", n)

# 2) apktool.yml: đổi tên gói (chỉ manifest, giữ nguyên resource package), version
yml = work / "apktool.yml"
y = yml.read_text(encoding="utf-8")
y = re.sub(r"renameManifestPackage:.*", "renameManifestPackage: " + NEW, y)
y = re.sub(r"versionCode:.*", "versionCode: %d" % cfg["versionCode"], y)
y = re.sub(r"versionName:.*", "versionName: " + cfg["versionName"], y)
yml.write_text(y, encoding="utf-8")

# 3) chữ mô tả Trợ năng
for strings in work.glob("res/values*/strings.xml"):
    t = strings.read_text(encoding="utf-8")
    t2 = re.sub(r'(<string name="text_accessibility_service_description">)[^<]*(</string>)',
                lambda m: m.group(1) + cfg["serviceDesc"] + m.group(2), t)
    if t2 != t:
        strings.write_text(t2, encoding="utf-8")

# 4) assets/project: loader + project.json
proj = work / "assets" / "project"
if proj.exists():
    shutil.rmtree(proj)
proj.mkdir(parents=True)
shutil.copy(root / "loader.js", proj / "main.js")
project = {
    "name": cfg["name"], "packageName": NEW, "main": "main.js",
    "versionCode": cfg["versionCode"], "versionName": cfg["versionName"],
    "assets": [], "useFeatures": [], "encrypt-code": False,
    "build": {"build_id": "SANDEAL-%d" % cfg["versionCode"], "build_number": cfg["versionCode"],
              "build_time": int(time.time() * 1000)},
    "launchConfig": {"displaySplash": True, "hideLogs": True, "stableMode": True,
                     "volumeUpcontrol": False, "splashText": cfg["name"],
                     "serviceDesc": cfg["serviceDesc"], "permissions": []},
}
(proj / "project.json").write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
print("OK", NEW, cfg["versionName"])
