// Renders the app icon (leather + gilt lettering) to PNG with the pre-installed Chromium.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const font = readFileSync('node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2').toString('base64');
const html = (s) => `<html><head><style>
@font-face{font-family:C;src:url(data:font/woff2;base64,${font})}
body{margin:0;width:${s}px;height:${s}px;background:#2a1512;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;font-family:C}
body:before{content:'';position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%,rgba(255,255,255,.1),transparent 55%),radial-gradient(100% 100% at 80% 100%,rgba(0,0,0,.45),transparent 60%)}
.f{position:absolute;inset:${s*0.09}px;border:${Math.max(1,s/180)}px solid rgba(201,164,96,.6)}
.f2{position:absolute;inset:${s*0.12}px;border:${Math.max(1,s/260)}px solid rgba(201,164,96,.35)}
.t{position:relative;text-align:center;line-height:.95;letter-spacing:.12em;font-size:${s*0.2}px;background:linear-gradient(175deg,#e9d29a,#b8914f 45%,#8a6a33 70%,#e9d29a);-webkit-background-clip:text;color:transparent;padding-left:.12em}
</style></head><body><div class=f></div><div class=f2></div><div class=t>HOLY<br>BIBLE</div></body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage();
for (const [s, n] of [[192, 'icon-192'], [512, 'icon-512'], [180, 'apple-touch-icon']]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(html(s));
  await p.waitForTimeout(200);
  await p.screenshot({ path: `public/icons/${n}.png` });
}
await b.close();
