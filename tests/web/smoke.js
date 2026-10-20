// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// smoke.js - a quick look at the web app in headless (muted) Edge: the page loads without errors, the three oscillator views show
// their own cards, the folder tabs belong to the engine shown (OSC1 A1 | OSC2 A2, OSC1 B1), CHORD MODE shows the chord card and grows the panel; screenshots of each view go to <out>.
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
  const B = await Browser.launch({ width: 1500, height: 1160, headless: true, fileAccess: true });
  try {
    await B.navigate(pathToFileURL(path.join(ROOT, 'web', 'index.html')).href + hash);
    await sleep(800);
    check(await B.evaluate('typeof WS_TEST === "object"'), 'the test hook is there');
    const shown = () => B.evaluate(`[...document.querySelectorAll('#device .section')].filter(s => !s.classList.contains('hidden')).map(s => s.querySelector('.title') ? s.querySelector('.title').textContent : '(' + s.style.top + ')')`);
    // beta 0.3: the three folder tabs OSC1 A1 | OSC2 A2 | OSC3 B1 (no engine tabs), the cards of the oscillator shown, OSC MIX and the SCOPE common to all
    const tabs = () => B.evaluate(`[...document.querySelectorAll('#device .otab')].map(b => b.querySelector('.t1').textContent.trim() + (b.classList.contains('on') ? '*' : ''))`);
    check((await B.evaluate(`document.querySelectorAll('#device .engtabs').length`)) === 0, 'no ENGINE tabs any more');
    for (const [v, name] of [[0, 'A1'], [1, 'A2'], [2, 'B1']]) {
      await B.evaluate(`WS_TEST.setParam('osc_view', ${v})`);
      await sleep(250);
      const want = ['OSC1 A1' + (v === 0 ? '*' : ''), 'OSC2 A2' + (v === 1 ? '*' : ''), 'OSC3 B1' + (v === 2 ? '*' : '')];
      const tb = await tabs();
      check(JSON.stringify(tb) === JSON.stringify(want), `view ${name}: the folder tabs are ${want.join(' | ')}`, JSON.stringify(tb));
      const t = await shown(), n = (s) => t.filter(x => x === s).length;
      check(n(name === 'B1' ? 'WAVELET · ADDITIVE' : 'WAVELET · SUBTRACTIVE') === 1 && n(name === 'B1' ? 'WAVELET · SUBTRACTIVE' : 'WAVELET · ADDITIVE') === 0, `view ${name}: its wavelet card is shown, and only that one`, JSON.stringify(t));
      check(n('SCALE FILTER') === 1 && n('POSITION') === 1 && n('TUNE · OWN ENVELOPE · PITCH ENVELOPE') === 1, `view ${name}: one SCALE FILTER, POSITION and TUNE card`, JSON.stringify(t));
      check(n('OSC MIX') === 1 && t.some(x => x.startsWith('SCOPE')) && n('FILTER') === 1 && n('LFO 1') === 1, `view ${name}: OSC MIX, the SCOPE, the FILTER and LFO 1 are always there`, JSON.stringify(t));
      await B.screenshot(path.join(out, `view-${name}.png`), { width: 1500, height: 1160 });
    }
    // the LFO 2 | LFO 3 sub-tab: one card at a time
    for (const lv of [0, 1, 0]) {
      await B.evaluate(`WS_TEST.setParam('lfo_view', ${lv})`);
      await sleep(200);
      const t = await shown();
      check(t.filter(x => x === 'LFO 2/3').length === 1, `LFO card ${lv === 0 ? 'LFO 2' : 'LFO 3'}: one LFO 2/3 card is shown`, JSON.stringify(t.filter(x => /LFO/.test(x))));
    }
    check(!(await shown()).some(x => x.includes('CHORD KEYBOARD')), 'the chord card is hidden while CHORD MODE is off');
    const h0 = await B.evaluate(`document.getElementById('device').style.height`);
    await B.evaluate(`WS_TEST.setParam('chord_mode', 1)`);
    await sleep(300);
    const h1 = await B.evaluate(`document.getElementById('device').style.height`);
    check((await shown()).some(x => x.includes('CHORD KEYBOARD')), 'CHORD MODE shows the chord card');
    check(parseFloat(h1) === parseFloat(h0) + 120, 'CHORD MODE grows the panel by 120', `${h0} -> ${h1}`);
    await B.screenshot(path.join(out, 'chord-mode.png'), { width: 1500, height: 1320 });
    await B.evaluate(`WS_TEST.setParam('chord_mode', 0)`);
    await sleep(200);
    check(parseFloat(await B.evaluate(`document.getElementById('device').style.height`)) === parseFloat(h0), 'CHORD MODE off: the panel shrinks back');
    const errs = B.errors();
    check(errs.length === 0, 'no console error', errs.slice(0, 5).join(' | '));
  } finally { await B.close(); }
  console.log(fails ? `${fails} failure(s)` : 'smoke test passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
