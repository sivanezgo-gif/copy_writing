const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const dir = __dirname;
  const scale = Number(process.argv[2] || 1);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: scale });
  await p.goto('file://' + path.join(dir, 'flyer.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(dir, scale > 1 ? 'flyer_new.png' : 'preview.png') });
  if (scale > 1) await p.pdf({ path: path.join(dir, 'flyer_new.pdf'), width: '794px', height: '1123px', printBackground: true });
  await b.close();
})();
