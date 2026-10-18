// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// smoke.js - a quick look at the web app in headless (muted) Edge: the page loads without errors, the four oscillator views show
// their own cards, CHORD MODE shows the chord card and grows the panel; screenshots of each view go to <out>.
//   node tests/web/smoke.js [--out <dir>] [--hash <fragment>]
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { Browser, sleep } = require('./cdp');
const ROOT = path.resolve(__dirname, '..', '..');
let out = path.join(__dirname, 'out'), hash = '#noaudio#nobrowser';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--out') out = path.resolve(process.argv[++i]);
  else if (process.argv[i] === '--hash') hash = process.argv[++i];
}
fs.mkdirSync(out, { recursive: true });
let fails = 0;
const check = (ok, name, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  -- ' + detail}`); };

(async () => {
  const B = await Browser.launch({ width: 1500, height: 1000, headless: true, fileAccess: true });
  try {
    await B.navigate(pathToFileURL(path.join(ROOT, 'web', 'index.html')).href + hash);
    await sleep(800);
    check(await B.evaluate('typeof WS_TEST === "object"'), 'the test hook is there');
    const shown = () => B.evaluate(`[...document.querySelectorAll('#device .section')].filter(s => !s.classList.contains('hidden')).map(s => s.querySelector('.title') ? s.querySelector('.title').textContent : '(' + s.style.top + ')')`);
    for (const [v, name] of [[0, 'A1'], [1, 'A2'], [2, 'B1'], [3, 'B2']]) {
      await B.evaluate(`WS_TEST.setParam('osc_view', ${v})`);
      await sleep(250);
      const t = await shown();
      check(t.some(x => x.includes('OSC ' + name + ' ·')), `view ${name}: its cards are shown`, JSON.stringify(t));
      check(!t.some(x => /OSC [AB][12] ·/.test(x) && !x.includes('OSC ' + name + ' ·')), `view ${name}: no other oscillator's card`, JSON.stringify(t));
      await B.screenshot(path.join(out, `view-${name}.png`), { width: 1500, height: 1000 });
    }
    check(!(await shown()).some(x => x.includes('CHORD KEYBOARD')), 'the chord card is hidden while CHORD MODE is off');
    const h0 = await B.evaluate(`document.getElementById('device').style.height`);
    await B.evaluate(`WS_TEST.setParam('chord_mode', 1)`);
    await sleep(300);
    const h1 = await B.evaluate(`document.getElementById('device').style.height`);
    check((await shown()).some(x => x.includes('CHORD KEYBOARD')), 'CHORD MODE shows the chord card');
    check(parseFloat(h1) === parseFloat(h0) + 120, 'CHORD MODE grows the panel by 120', `${h0} -> ${h1}`);
    await B.screenshot(path.join(out, 'chord-mode.png'), { width: 1500, height: 1100 });
    await B.evaluate(`WS_TEST.setParam('chord_mode', 0)`);
    await sleep(200);
    check(parseFloat(await B.evaluate(`document.getElementById('device').style.height`)) === parseFloat(h0), 'CHORD MODE off: the panel shrinks back');
    const errs = B.errors();
    check(errs.length === 0, 'no console error', errs.slice(0, 5).join(' | '));
  } finally { await B.close(); }
  console.log(fails ? `${fails} failure(s)` : 'smoke test passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
