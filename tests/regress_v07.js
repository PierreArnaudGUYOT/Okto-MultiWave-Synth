// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// The 22 TOP Sounds must sound as they did in the Wavelet Synthesizer beta 0.7: renders each with that version's engine
// (tests/ref/v07, as published) and with this version's engine (the converted presets), and compares the two renders.
// Usage: node tests/regress_v07.js [tolerance, default 1e-5 of the peak]
'use strict';
const path = require('path');
const OLD_SPEC = require('./ref/v07/spec.js'), OLD = require('./ref/v07/core.js')(OLD_SPEC);
const SPEC = require('../web/js/spec.js'), C = require('../web/js/core.js')(SPEC);
const sr = 48000, n = sr * 3, blk = 128, tol = parseFloat(process.argv[2] || '1e-5');
function render(Core, values) {
  const params = Float64Array.from(values);
  const eng = new Core.Engine(sr); params.forEach((v, i) => eng.setParam(i, v));
  if (Core === OLD) eng.mixSm = params[Core.P.ab_mix];   // beta 0.7 smoothed the A/B balance from its default in a new engine; this version starts at the preset's levels
  eng.setTables(Core.buildTables(params, true));
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let o = 0; o < n; o += blk) {
    if (o === 0) eng.noteOn(60, 0.9);
    if (o === 36000) eng.noteOff(60);
    if (o === 48000) { eng.noteOn(57, 0.8); eng.noteOn(64, 0.8); eng.noteOn(67, 0.8); }
    if (o === 105600) eng.allNotesOff();
    eng.process(L.subarray(o, o + blk), R.subarray(o, o + blk), Math.min(blk, n - o));
  }
  return [L, R];
}
let fails = 0, worst = 0;
for (let i = 0; i < SPEC.TOP; i++) {
  const o = SPEC.PRESETS[i], p = OLD_SPEC.PRESETS[i];
  if (o.name !== p.name) throw new Error('order differs: ' + o.name + ' / ' + p.name);
  const a = render(OLD, p.values), b = render(C, o.values);
  let peak = 0, maxd = 0;
  for (let k = 0; k < 2; k++) for (let j = 0; j < n; j++) { peak = Math.max(peak, Math.abs(a[k][j])); maxd = Math.max(maxd, Math.abs(a[k][j] - b[k][j])); }
  const rel = maxd / Math.max(peak, 1e-9), ok = rel <= tol && peak > 0.01;
  if (!ok) fails++;
  worst = Math.max(worst, rel);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${o.name.padEnd(26)} peak ${peak.toFixed(3)}  max diff / peak ${rel.toExponential(2)}`);
}
console.log(fails ? `${fails} TOP Sound(s) differ from beta 0.7` : `the 22 TOP Sounds match beta 0.7 (worst ${worst.toExponential(2)} of the peak)`);
process.exit(fails ? 1 : 0);
