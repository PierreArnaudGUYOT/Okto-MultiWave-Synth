// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// test_evaluate.js - the web app's EVALUATE SOUNDS session in headless Edge (muted): "Start at…" asks the number of the first sound (the test answers
// the prompt), the passage (Beethoven and the long C minor chord) of the first preset plays with the listening rules, 7 stars -> the question,
// "Yes, modify it" -> the preset as designed, a knob moved, "Record preset change", the next preset, 3 stars with the key 3, Esc stops and gives
// back the sound; the ratings text and the kept session; then the SETS OF 40: with 39 sounds already rated, rating the 40th downloads the set's
// file "sound xx to sound yy.txt" (the test catches the download).
//   node tests/web/test_evaluate.js [--out DIR]
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { Browser, sleep } = require('./cdp');

const ROOT = path.resolve(__dirname, '..', '..');
const SPEC = require(path.join(ROOT, 'tools', 'spec.js'));
const URL0 = pathToFileURL(path.join(ROOT, 'web', 'index.html')).href + '#noaudio&nobrowser';
let fails = 0;
const check = (ok, what, detail = '') => { console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${what}${detail ? '  -- ' + detail : ''}`); if (!ok) fails++; };
const first = SPEC.PRESETS[SPEC.NEW_FIRST], second = SPEC.PRESETS[SPEC.NEW_FIRST + 1];
const num = (p) => p.name.split(' ')[0];
const n1 = num(first), n2 = num(second);   // beta 0.3: the first preset to rate is 501

(async () => {
  const B = await Browser.launch({ width: 1280, height: 900 });
  const ev = (e, t) => B.evaluate(e, t);
  const clickButton = (re) => ev(`(() => { const b = [...document.querySelectorAll('.vote-win .vrow button')].find(x => /${re}/.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
  const phase = () => ev('WS_TEST.evaluate.phase()');
  const waitPhase = async (p, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await phase()) === p) return true; await sleep(100); } return false; };
  try {
    await B.navigate(URL0);
    await sleep(1000);
    // the prompt of "Start at…" is answered by the test; the downloads (the finished sets) are caught
    await ev(`window.__answer = ''; window.__prompts = []; window.__downloads = [];
      window.prompt = (msg, def) => { window.__prompts.push([msg, def]); return window.__answer; };
      HTMLAnchorElement.prototype.click = function () { if (this.download) { const href = this.href; window.__downloads.push({ name: this.download, href }); } };
      true`);
    await ev('Promise.resolve(WS_TEST.start()).then(() => true)', 15000);
    await ev(`WS_TEST.setParam('master', -7.5); true`);
    const master0 = await ev(`WS_TEST.getParam('master')`);
    console.log('1. EVALUATE SOUNDS opens the start window');
    check(await ev('!!WS_TEST.evaluate'), 'the session is exposed to the test hook');
    await ev('WS_TEST.evaluate.start(); true');
    await sleep(300);
    check((await phase()) === 'start', 'the start window is shown', String(await phase()));
    const txt0 = await ev(`document.querySelector('.vote-win').textContent`);
    check(txt0.includes('Start at') && new RegExp(`${SPEC.NEW_COUNT} new presets to rate`).test(txt0), "it offers 'Start at…' and says how many presets", txt0.slice(0, 120));
    check(/long C minor chord/.test(txt0) && /sets of 40/.test(txt0), 'it says that the passage ends with a long chord and that the sounds come in sets of 40');
    await B.screenshot(path.join(__dirname, 'out', 'evaluate_start.png')).catch(() => {});

    console.log('2. preset 001 plays with the listening rules');
    await ev(`window.__answer = 'zzz'; true`);
    check(await clickButton('Start at'), 'Start at… clicked (the typed answer is not a number)');
    await sleep(300);
    const asked = await ev('window.__prompts[0]');
    check(asked && asked[0].includes(n1) && asked[1] === n1, `the prompt asks the number of the first sound (${n1} to ${num(SPEC.PRESETS[SPEC.PRESETS.length - 1])}), offering ${n1}`, JSON.stringify(asked));
    check((await phase()) === 'start' && /No sound numbered/.test(await ev(`document.querySelector('.vote-win').textContent`)), 'a wrong number is refused and the start window stays');
    await ev(`window.__answer = '${n1}'; true`);
    check(await clickButton('Start at'), `Start at… clicked (typed ${n1})`);
    const tStart = Date.now();
    await sleep(500);
    check((await phase()) === 'play', 'the passage is playing', String(await phase()));
    check((await ev(`WS_TEST.getParam('v_voices')`)) === 16 && (await ev(`WS_TEST.getParam('v_oct')`)) === 0 && (await ev(`WS_TEST.getParam('v_glide')`)) === 0, 'listening rules: 16 voices, octave 0, no glide');
    const label = await ev(`(document.querySelector('.presets .pname span') || {}).textContent`);
    check(label === first.name, `the preset box shows '${first.name}'`, label);
    let peak = 0;
    for (let i = 0; i < 20; i++) { const l = await ev('WS_TEST.getLevel()'); peak = Math.max(peak, l.peakL, l.peakR); await sleep(100); }
    check(peak > 0.02, 'the passage sounds', `peak ${peak.toFixed(3)}`);
    await sleep(Math.max(0, 7000 - (Date.now() - tStart)));   // the long chord goes on after the 5 s of Beethoven: still playing 7 s in (counted from the start: the peak loop above takes 2+ s)
    check((await phase()) === 'play', 'the long chord follows the passage (still playing 7 s in)', String(await phase()));
    check(await waitPhase('vote', 8000), 'after the passage and the chord the window asks for stars');
    check(await ev(`[...document.querySelectorAll('.vote-win .vrow button')].some(b => /^Save as/.test(b.textContent))`), "the rating window has 'Save as…' (a copy under a name of your own, to stop half way)");

    console.log('3. 7 stars: the question, then the preset as designed');
    await ev(`document.querySelectorAll('.vote-win .vstars button')[6].click(); true`);
    await sleep(300);
    check((await phase()) === 'ask', 'above 5 stars it asks whether to modify', String(await phase()));
    check((await ev('WS_TEST.evaluate.votes()'))[n1] === 7, 'the rating is kept at once', JSON.stringify(await ev('WS_TEST.evaluate.votes()')));
    check(await clickButton('Yes, modify it'), "'Yes, modify it' clicked");
    await sleep(500);
    check((await phase()) === 'edit', 'edit mode (the window is a bar)', String(await phase()));
    // (a preset's `v` holds only the values that differ from the defaults: beta 0.2's presets are written that way)
    const val = (p, k) => (p.v[k] !== undefined ? p.v[k] : SPEC.PARAMS.find(q => q.key === k).def);
    const cut0 = val(first, 'f_cutoff'), cut1 = +(cut0 + 2.5 <= 12 ? cut0 + 2.5 : cut0 - 2.5).toFixed(4);   // (4 decimals like the presets: no float noise such as 10.369900000000001)
    check((await ev(`WS_TEST.getParam('v_voices')`)) === val(first, 'v_voices') && Math.abs((await ev(`WS_TEST.getParam('f_cutoff')`)) - cut0) < 1e-9, 'the preset is loaded as designed (its own voices and cutoff)',
      `voices ${await ev(`WS_TEST.getParam('v_voices')`)} (preset ${val(first, 'v_voices')})`);
    await ev(`WS_TEST.setParam('f_cutoff', ${cut1}); true`);
    await sleep(200);
    check(await clickButton('Record preset change'), "'Record preset change' clicked");
    await sleep(600);
    check((await phase()) === 'play', 'the next preset (002) plays', String(await phase()));
    const txt = await ev('WS_TEST.evaluate.text()');
    check(new RegExp(`f_cutoff: ${cut0} -> ${cut1}`).test(txt) && /yes {4}/.test(txt), 'the ratings text records the change', (txt.match(/PRESET CHANGES[\s\S]{0,200}/) || [''])[0].replace(/\r?\n/g, ' | '));
    const label2 = await ev(`(document.querySelector('.presets .pname span') || {}).textContent`);
    check(label2 === second.name, `the preset box shows '${second.name}'`, label2);

    console.log('4. the key 3 rates 002; Esc stops and gives back the sound');
    check(await waitPhase('vote', 14000), '002: the window asks for stars');
    await B.key('3', { code: 'Digit3' });
    await sleep(500);
    const votes = await ev('WS_TEST.evaluate.votes()');
    check(JSON.stringify(votes).includes('3') && (await phase()) === 'play', 'a rating of 3 (no question) goes on to 003', `${JSON.stringify(votes)} / ${await phase()}`);
    const txt2 = await ev('WS_TEST.evaluate.text()');
    check(/Okto MultiWave Synth - preset ratings/.test(txt2) && new RegExp(`Rated: 2 / ${SPEC.NEW_COUNT}`).test(txt2) && new RegExp(`${n1} \\| {2}7 \\| yes`).test(txt2) && new RegExp(`${n2} \\| {2}3 \\|`).test(txt2),
      `the ratings text has the header, ${n1} = 7 (changed), ${n2} = 3`, txt2.split(/\r?\n/).slice(3, 4).join(''));
    await B.key('Escape', { code: 'Escape' });
    await sleep(600);
    check((await phase()) === null || (await phase()) === 'off' || (await phase()) === undefined || !(await ev(`!!document.querySelector('.vote-win') && getComputedStyle(document.querySelector('.vote-win')).display !== 'none'`)), 'Esc closes the session');
    const master1 = await ev(`WS_TEST.getParam('master')`);
    check(Math.abs(master1 - master0) < 1e-9 && (await ev(`WS_TEST.getParam('v_voices')`)) !== 16 || Math.abs(master1 - master0) < 1e-9, 'the sound played before the session is back', `master ${master1} (was ${master0})`);
    console.log('5. sets of 40: the 40th rating of a set downloads its file');
    // 39 of the first 40 sounds are already rated (in the browser's memory); the session starts at the first sound and skips to the 40th
    const rated = {};
    for (let k = 0; k < 39; k++) rated[num(SPEC.PRESETS[SPEC.NEW_FIRST + k])] = 5;
    await ev(`localStorage.setItem('mw.votes', ${JSON.stringify(JSON.stringify({ votes: rated, changes: {} }))}); window.__downloads = []; true`);
    await ev('WS_TEST.evaluate.start(); true');
    await sleep(300);
    check((await phase()) === 'start' && /39 of \d+ presets rated/.test(await ev(`document.querySelector('.vote-win').textContent`)), 'the 39 ratings are found again', (await ev(`document.querySelector('.vote-win .vname').textContent`)));
    await ev(`window.__answer = '${n1}'; true`);
    check(await clickButton('Start at'), `Start at… ${n1}`);
    await sleep(400);
    for (let k = 0; k < 39; k++) { await B.key('s', { code: 'KeyS' }); await sleep(60); }
    const n40 = num(SPEC.PRESETS[SPEC.NEW_FIRST + 39]), n41 = num(SPEC.PRESETS[SPEC.NEW_FIRST + 40]);
    const title = await ev(`document.querySelector('.vote-win .vtitle').textContent`);
    check(title.includes(`PRESET 40 OF`) && title.includes(`SET ${n1}–${n40}`), 'the window shows the 40th sound and its set', title);
    check(await waitPhase('vote', 14000), 'the 40th sound asks for stars');
    check((await ev('window.__downloads.length')) === 0, 'no file before the set is finished');
    await ev(`document.querySelectorAll('.vote-win .vstars button')[3].click(); true`);   // 4 stars: no question, on to the 41st = the next set
    await sleep(600);
    const dl = await ev('window.__downloads');
    check(dl.length === 1 && dl[0].name === `sound ${n1} to sound ${n40}.txt`, `the finished set is downloaded as "sound ${n1} to sound ${n40}.txt"`, JSON.stringify(dl.map(d => d.name)));
    const setTxt = dl.length ? await ev(`fetch(window.__downloads[0].href).then(r => r.text()).catch(() => 'unreadable')`) : '';
    check(/Set: sound .* to sound .* \(40 sounds\)/.test(setTxt) && new RegExp(`${n40} \\| {2}4 \\|`).test(setTxt) && !setTxt.includes(`${n41} |`), 'the file has the 40 sounds of the set (and no other)', setTxt.split(/\r?\n/).slice(3, 5).join(' / '));
    check((await phase()) === 'play' && (await ev(`document.querySelector('.vote-win .vtitle').textContent`)).includes(`SET ${n41}–`), `the 41st sound starts the next set (${n41})`);
    await B.key('Escape', { code: 'Escape' });
    await sleep(400);
    check(B.errors().length === 0, 'no console error', JSON.stringify(B.errors()).slice(0, 200));
  } finally {
    await B.close();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
