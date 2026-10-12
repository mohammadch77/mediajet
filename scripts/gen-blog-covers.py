#!/usr/bin/env python3
"""ساخت تصویر شاخص مقاله‌های وبلاگ (۱۲۰۰×۶۳۰) با Playwright. اجرا: python3 scripts/gen-blog-covers.py
تصاویر کاملاً اصلی‌اند (شکل‌های هندسی + لوگوی خود سایت)؛ هیچ تصویر یا لوگوی شخص ثالث استفاده نمی‌شود."""
import os, base64, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "node_modules/@fontsource/vazirmatn/files/vazirmatn-arabic-800-normal.woff2")
FONT_B = os.path.join(ROOT, "node_modules/@fontsource/vazirmatn/files/vazirmatn-arabic-400-normal.woff2")
LOGO = os.path.join(ROOT, "public/brand/logo.png")
b64 = lambda p: base64.b64encode(open(p, "rb").read()).decode()

ICONS = {
  "cart": '<path d="M20 28h22l14 70h66l12-48H52" /><circle cx="76" cy="124" r="10"/><circle cx="116" cy="124" r="10"/>',
  "grid": '<rect x="24" y="24" width="52" height="52" rx="12"/><rect x="104" y="24" width="52" height="52" rx="12"/><rect x="24" y="104" width="52" height="52" rx="12"/><rect x="104" y="104" width="52" height="52" rx="12"/>',
  "layers": '<path d="M90 20 160 56 90 92 20 56Z"/><path d="M20 92 90 128 160 92"/><path d="M20 126 90 162 160 126"/>',
  "shield": '<path d="M90 18 156 44v48c0 36-26 60-66 74-40-14-66-38-66-74V44Z"/><path d="m60 92 22 22 40-46"/>',
  "play": '<rect x="18" y="34" width="144" height="112" rx="22"/><path d="m74 64 48 26-48 26Z"/>',
  "frame": '<rect x="22" y="26" width="136" height="100" rx="14"/><path d="M22 106 64 72l32 28 24-18 38 30"/><circle cx="62" cy="58" r="10"/><path d="M60 148h60"/>',
}

COVERS = [
  ("buy-single-stock-file-without-subscription", "دانلود تک‌فایل از سایت‌های استوک بدون اشتراک", "راهنمای کامل سفارش، پرداخت و تحویل", "راهنمای خرید", "cart", "#ff7a3d", "#6b5bff"),
  ("how-to-choose-stock-site", "کدام سایت استوک برای پروژه‌ی تو مناسب‌تر است؟", "انتخاب سایت بر اساس نوع فایل", "سایت‌های استوک", "grid", "#2de2e6", "#6b5bff"),
  ("vector-psd-png-formats-guide", "وکتور، PSD و PNG؛ کدام را بخریم؟", "تفاوت فرمت‌ها با مثال‌های کاربردی", "فرمت فایل", "layers", "#a07bf0", "#2de2e6"),
  ("stock-license-basics-commercial-use", "پیش از استفاده‌ی تجاری، لایسنس را اینطور بخوان", "چک‌لیست عمومی لایسنس فایل استوک", "لایسنس", "shield", "#4cd29a", "#6b5bff"),
  ("stock-video-music-for-youtubers", "ویدیو و موزیک استوک برای یوتیوبرها و تدوینگرها", "چه چیزی، از کجا و چطور انتخاب کنیم", "طراحی و تولید محتوا", "play", "#ff5d73", "#ff7a3d"),
  ("mockup-psd-templates-speed-up-design", "موکاپ و فایل لایه‌باز؛ سرعت طراحی را دو برابر کن", "چطور پیش‌نمایش حرفه‌ای‌تر به مشتری نشان بدهیم", "طراحی و تولید محتوا", "frame", "#ffc800", "#2de2e6"),
]

def html(title, sub, cat, icon, c1, c2):
    return f"""<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><style>
@font-face{{font-family:V;font-weight:800;src:url(data:font/woff2;base64,{b64(FONT)})}}
@font-face{{font-family:V;font-weight:400;src:url(data:font/woff2;base64,{b64(FONT_B)})}}
*{{box-sizing:border-box;margin:0}}
body{{width:1200px;height:630px;overflow:hidden;font-family:V,sans-serif;color:#eef0fb;background:#070914;position:relative}}
.bg{{position:absolute;inset:0;background:
 radial-gradient(900px 520px at 100% 0%, {c2}55, transparent 60%),
 radial-gradient(760px 480px at 0% 100%, {c1}44, transparent 60%),
 linear-gradient(135deg,#0b0e22,#070914)}}
.grid{{position:absolute;inset:0;opacity:.35;background-image:linear-gradient(#8a7cff22 1px,transparent 1px),linear-gradient(90deg,#8a7cff22 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse at 70% 40%,#000,transparent 72%)}}
.wrap{{position:absolute;inset:0;padding:64px 72px;display:flex;flex-direction:column;justify-content:space-between}}
.top{{display:flex;align-items:center;justify-content:space-between}}
.brand{{display:flex;align-items:center;gap:14px;font-weight:800;font-size:30px}}
.brand img{{width:46px;height:46px;border-radius:12px}}
.chip{{font-size:22px;font-weight:800;padding:10px 22px;border-radius:999px;border:2px solid {c1}99;color:{c1};background:#ffffff08}}
h1{{font-weight:800;font-size:64px;line-height:1.5;max-width:720px}}
.sub{{margin-top:18px;font-size:28px;font-weight:400;color:#b4bbe0}}
.bar{{width:120px;height:8px;border-radius:8px;background:linear-gradient(90deg,{c1},{c2});margin-bottom:26px}}
.art{{position:absolute;left:70px;top:150px;width:340px;height:340px;border-radius:64px;display:grid;place-items:center;
 background:linear-gradient(145deg,{c2}33,{c1}22);border:2px solid #ffffff22;box-shadow:0 40px 120px -30px {c1}aa, inset 0 0 80px #ffffff0a}}
.art svg{{width:230px;height:230px;fill:none;stroke:{c1};stroke-width:7;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 24px {c1}99)}}
.ring{{position:absolute;left:30px;top:110px;width:420px;height:420px;border-radius:50%;border:2px dashed #ffffff1c}}
</style><div class="bg"></div><div class="grid"></div><div class="ring"></div>
<div class="art"><svg viewBox="0 0 180 180">{ICONS[icon]}</svg></div>
<div class="wrap"><div class="top"><div class="brand"><img src="data:image/png;base64,{b64(LOGO)}">گت‌استوک</div><div class="chip">{cat}</div></div>
<div><div class="bar"></div><h1>{title}</h1><div class="sub">{sub}</div></div></div></html>"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium"))
    pg = b.new_page(viewport={"width": 1200, "height": 630})
    for slug, title, sub, cat, icon, c1, c2 in COVERS:
        pg.set_content(html(title, sub, cat, icon, c1, c2)); pg.wait_for_timeout(400)
        out = os.path.join(ROOT, "public/blog", f"{slug}.png")
        pg.screenshot(path=out); print("wrote", out)
    b.close()
