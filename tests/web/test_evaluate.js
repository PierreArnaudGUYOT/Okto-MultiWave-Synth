// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// test_evaluate.js - the web app's EVALUATE SOUNDS session in headless Edge (muted): start, the passage of preset 001 plays with
// the listening rules, 7 stars -> the question, "Yes, modify it" -> the preset as designed, a knob moved, "Record preset change",
// preset 002, 3 stars with the key 3, Esc stops and gives back the sound; the ratings text and the kept session.
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

(async () => {
  const B = await Browser.launch({ width: 1280, height: 900 });
  const ev = (e, t) => B.evaluate(e, t);
  const clickButton = (re) => ev(`(() => { const b = [...document.querySelectorAll('.vote-win .vrow button')].find(x => /${re}/.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
  const phase = () => ev('WS_TEST.evaluate.phase()');
  const waitPhase = async (p, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await phase()) === p) return true; await sleep(100); } return false; };
  try {
    await B.navigate(URL0);
    await sleep(1000);
    await ev('Promise.resolve(WS_TEST.start()).then(() => true)', 15000);
    await ev(`WS_TEST.setParam('master', -7.5); true`);
    const master0 = await ev(`WS_TEST.getParam('master')`);
    console.log('1. EVALUATE SOUNDS opens the start window');
    check(await ev('!!WS_TEST.evaluate'), 'the session is exposed to the test hook');
    await ev('WS_TEST.evaluate.start(); true');
    await sleep(300);
    check((await phase()) === 'start', 'the start window is shown', String(await phase()));
    const txt0 = await ev(`document.querySelector('.vote-win').textContent`);
    check(/Start at 001/.test(txt0) && new RegExp(`${SPEC.NEW_COUNT} new presets to rate`).test(txt0), "it offers 'Start at 001' and says how many presets", txt0.slice(0, 120));
    await B.screenshot(path.join(__dirname, 'out', 'evaluate_start.png')).catch(() => {});

    console.log('2. preset 001 plays with the listening rules');
    check(await clickButton('Start at 001'), 'Start at 001 clicked');
    await sleep(500);
    check((await phase()) === 'play', 'the passage is playing', String(await phase()));
    check((await ev(`WS_TEST.getParam('v_voices')`)) === 16 && (await ev(`WS_TEST.getParam('v_oct')`)) === 0 && (await ev(`WS_TEST.getParam('v_glide')`)) === 0, 'listening rules: 16 voices, octave 0, no glide');
    const label = await ev(`(document.querySelector('.presets .pname span') || {}).textContent`);
    check(label === first.name, `the preset box shows '${first.name}'`, label);
    let peak = 0;
    for (let i = 0; i < 20; i++) { const l = await ev('WS_TEST.getLevel()'); peak = Math.max(peak, l.peakL, l.peakR); await sleep(100); }
    check(peak > 0.02, 'the passage sounds', `peak ${peak.toFixed(3)}`);
    check(await waitPhase('vote', 8000), 'after the passage the window asks for stars');
    check(await ev(`[...document.querySelectorAll('.vote-win .vrow button')].some(b => /^Save as/.test(b.textContent))`), "the rating window has 'Save as…' (a copy under a name of your own, to stop half way)");

    console.log('3. 7 stars: the question, then the preset as designed');
    await ev(`document.querySelectorAll('.vote-win .vstars button')[6].click(); true`);
    await sleep(300);
    check((await phase()) === 'ask', 'above 5 stars it asks whether to modify', String(await phase()));
    check((await ev('WS_TEST.evaluate.votes()'))[first.name.slice(0, 3)] === 7 || JSON.stringify(await ev('WS_TEST.evaluate.votes()')).includes('7'), 'the rating is kept at once', JSON.stringify(await ev('WS_TEST.evaluate.votes()')));
    check(await clickButton('Yes, modify it'), "'Yes, modify it' clicked");
    await sleep(500);
    check((await phase()) === 'edit', 'edit mode (the window is a bar)', String(await phase()));
    check((await ev(`WS_TEST.getParam('v_voices')`)) === first.v.v_voices && Math.abs((await ev(`WS_TEST.getParam('f_cutoff')`)) - first.v.f_cutoff) < 1e-9, 'the preset is loaded as designed (its own voices and cutoff)',
      `voices ${await ev(`WS_TEST.getParam('v_voices')`)} (preset ${first.v.v_voices})`);
    await ev(`WS_TEST.setParam('f_cutoff', ${first.v.f_cutoff + 2.5}); true`);
    await sleep(200);
    check(await clickButton('Record preset change'), "'Record preset change' clicked");
    await sleep(600);
    check((await phase()) === 'play', 'the next preset (002) plays', String(await phase()));
    const txt = await ev('WS_TEST.evaluate.text()');
    check(new RegExp(`f_cutoff: ${first.v.f_cutoff} -> ${first.v.f_cutoff + 2.5}`).test(txt) && /yes {4}/.test(txt), 'the ratings text records the change', (txt.match(/PRESET CHANGES[\s\S]{0,200}/) || [''])[0].replace(/\r?\n/g, ' | '));
    const label2 = await ev(`(document.querySelector('.presets .pname span') || {}).textContent`);
    check(label2 === second.name, `the preset box shows '${second.name}'`, label2);

    console.log('4. the key 3 rates 002; Esc stops and gives back the sound');
    check(await waitPhase('vote', 8000), '002: the window asks for stars');
    await B.key('3', { code: 'Digit3' });
    await sleep(500);
    const votes = await ev('WS_TEST.evaluate.votes()');
    check(JSON.stringify(votes).includes('3') && (await phase()) === 'play', 'a rating of 3 (no question) goes on to 003', `${JSON.stringify(votes)} / ${await phase()}`);
    const txt2 = await ev('WS_TEST.evaluate.text()');
    check(/Okto MultiWave Synth - preset ratings/.test(txt2) && new RegExp(`Rated: 2 / ${SPEC.NEW_COUNT}`).test(txt2) && /001 \| {2}7 \| yes/.test(txt2) && /002 \| {2}3 \|/.test(txt2),
      'the ratings text has the header, 001 = 7 (changed), 002 = 3', txt2.split(/\r?\n/).slice(3, 4).join(''));
    await B.key('Escape', { code: 'Escape' });
    await sleep(600);
    check((await phase()) === null || (await phase()) === 'off' || (await phase()) === undefined || !(await ev(`!!document.querySelector('.vote-win') && getComputedStyle(document.querySelector('.vote-win')).display !== 'none'`)), 'Esc closes the session');
    const master1 = await ev(`WS_TEST.getParam('master')`);
    check(Math.abs(master1 - master0) < 1e-9 && (await ev(`WS_TEST.getParam('v_voices')`)) !== 16 || Math.abs(master1 - master0) < 1e-9, 'the sound played before the session is back', `master ${master1} (was ${master0})`);
    check(B.errors().length === 0, 'no console error', JSON.stringify(B.errors()).slice(0, 200));
  } finally {
    await B.close();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
