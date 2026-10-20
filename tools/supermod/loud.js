// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Beta 0.3.2: the loudness of the presets against a loud chord. OktoPierre's test (a C major chord at the maximum MIDI velocity) crackled in many presets: the presets of beta 0.3 and later
// were calibrated on the evaluation passage (velocity 0.7), not on the loudest way to play them. Every preset of tools/presets_lfo3.js is rendered with a set of loud chords (triads at
// C4, C5 and C6, a five-note and a six-note chord, all at velocity 1) with the master volume 18 dB lower (so that the output stage does not touch the sound), and the peak of the render,
// scaled back, is the peak the voices sum to before the guard and the soft limiter. A preset whose peak is above TARGET has its master volume lowered by whole dB until it is not.
//   node tools/supermod/loud.js                  report only
//   node tools/supermod/loud.js --apply          writes the new master values into tools/presets_lfo3.js (presets numbered 501 and up)
//   node tools/supermod/loud.js --target 0.9     the peak the loudest chord may reach (default 0.9: the guard's threshold, core.js GUARD_T)
//   node tools/supermod/loud.js --spec [--apply] every preset of the generated list (web/js/spec.js, as the plug-in plays it) except the 22 TOP Sounds; --apply adds the whole dB each one must go
//                                                down to tools/master_adjust.js ({ number: dB }, read by tools/spec.js: beta 0.3.4)
'use strict';
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const FILE = path.join(__dirname, '..', 'presets_lfo3.js');
const TARGET = +arg('target', 0.9), MAXDOWN = 12, PROCS = +arg('procs', 20), FIRST = +arg('first', 501), LIMIT = +arg('limit', 0);
const SPECMODE = process.argv.includes('--spec');
const CHORDS = [[60, 64, 67], [72, 76, 79], [84, 88, 91], [72, 76, 79, 84, 88], [60, 64, 67, 72, 76, 79]], VEL = 1;

if (process.argv[2] === '--worker') {
  const part = +arg('worker', 0), of = +arg('of', 1);
  const lab = require('../preset_lab.js'), A = require('./audit.js');
  const { C, P, sr, SPEC } = lab;
  const mp = SPEC.PARAMS[P.master];
  const render = (values, notes) => {
    const params = Float64Array.from(values);
    const eng = new C.Engine(sr); params.forEach((v, i) => eng.setParam(i, v));
    eng.vol = Math.exp(params[P.master] * (Math.LN10 / 20));
    eng.setTables(C.buildTables(params, true));
    const hold = 1.6, n = Math.round(2.4 * sr), L = new Float32Array(n), R = new Float32Array(n), blk = 128, offAt = Math.round(hold * sr / blk) * blk;
    let pk = 0;
    for (let s = 0; s < n; s += blk) {
      if (s === 0) for (const k of notes) eng.noteOn(k, VEL);
      if (s === offAt) for (const k of notes) eng.noteOff(k);
      eng.process(L.subarray(s, s + blk), R.subarray(s, s + blk), Math.min(blk, n - s));
      for (let i = s; i < Math.min(s + blk, n); i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    }
    return pk;
  };
  // the peak the preset reaches at its own master volume, the loudest of the chords (measured 18 dB lower, scaled back)
  const peakOf = (values) => {
    const low = Math.max(mp.min, values[P.master] - 18), gain = Math.pow(10, (values[P.master] - low) / 20), v2 = values.slice(); v2[P.master] = low;
    let worst = 0;
    for (const ch of CHORDS) worst = Math.max(worst, render(v2, ch) * gain);
    return worst;
  };
  const list = SPECMODE ? SPEC.PRESETS.slice(SPEC.TOP) : require(FILE);
  const out = [];
  list.forEach((p, i) => {
    if (i % of !== part || (!SPECMODE && parseInt(p.name, 10) < FIRST) || (LIMIT && out.length >= LIMIT)) return;
    const values = SPECMODE ? Array.from(p.values) : A.fullValues(p.v);
    const peak0 = peakOf(values);
    // whole dB: the master lowered by 20 log10(peak / TARGET), rounded up (the peak scales with the master while the limiter is out of the way)
    const down = peak0 > TARGET ? Math.min(MAXDOWN, Math.ceil(20 * Math.log10(peak0 / TARGET) - 1e-9)) : 0;
    out.push({ name: p.name, cat: p.cat, peak0, down, master: Math.max(mp.min, values[P.master] - down) });
  });
  fs.writeFileSync(path.join(__dirname, '..', 'out', `loud_${part}.json`), JSON.stringify(out));
  process.exit(0);
}

fs.mkdirSync(path.join(__dirname, '..', 'out'), { recursive: true });
let done = 0;
const t0 = Date.now();
for (let k = 0; k < PROCS; k++) fork(__filename, ['--worker', String(k), '--of', String(PROCS), '--first', String(FIRST), '--target', String(TARGET), '--procs', String(PROCS), '--limit', String(LIMIT)].concat(SPECMODE ? ['--spec'] : [])).on('exit', () => { if (++done === PROCS) report(); });
function report() {
  let rows = [];
  for (let k = 0; k < PROCS; k++) { const f = path.join(__dirname, '..', 'out', `loud_${k}.json`); rows = rows.concat(JSON.parse(fs.readFileSync(f, 'utf8'))); fs.unlinkSync(f); }
  rows.sort((a, b) => parseInt(a.name, 10) - parseInt(b.name, 10));
  const loud = rows.filter(r => r.down > 0);
  console.log(`${rows.length} presets measured in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${CHORDS.length} loud chords at velocity ${VEL}; ${loud.length} reach more than ${TARGET} before the output stage`);
  const byCat = {};
  for (const r of rows) { const c = byCat[r.cat] = byCat[r.cat] || { n: 0, loud: 0, down: 0 }; c.n++; if (r.down > 0) { c.loud++; c.down += r.down; } }
  for (const [c, o] of Object.entries(byCat)) console.log(`  ${c.padEnd(16)} ${String(o.loud).padStart(3)} / ${String(o.n).padStart(3)} loud, lowered by ${(o.loud ? o.down / o.loud : 0).toFixed(1)} dB on average`);
  const hist = {}; for (const r of loud) hist[r.down] = (hist[r.down] || 0) + 1;
  console.log('  lowered by (dB): ' + Object.entries(hist).map(([k, v]) => `${k}: ${v}`).join(', '));
  const peaks = rows.map(r => r.peak0).sort((a, b) => a - b);
  console.log(`  peaks: median ${peaks[peaks.length >> 1].toFixed(2)}, 90 % ${peaks[Math.floor(0.9 * (peaks.length - 1))].toFixed(2)}, max ${peaks[peaks.length - 1].toFixed(2)}`);
  if (process.argv.includes('--apply') && SPECMODE) {
    const OUTF = path.join(__dirname, '..', 'master_adjust.js');
    let table = {}; try { table = JSON.parse(JSON.stringify(require(OUTF))); } catch (e) { /* none yet */ }
    let n = 0;
    for (const r of rows) { const num = parseInt(r.name, 10); if (!r.down || !num) continue; table[num] = (table[num] || 0) + r.down; n++; }
    const body = Object.keys(table).map(Number).sort((a, b) => a - b).map(k => `  ${k}: ${table[k]}`).join(',\n');
    fs.writeFileSync(OUTF, '// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)\n// SPDX-License-Identifier: GPL-3.0-or-later\n// GENERATED by tools/supermod/loud.js --spec --apply: the whole dB the master volume of a preset (by number) goes down, after a loud chord at velocity 1 peaked above the target\n// before the output stage (beta 0.3.4). Read by tools/spec.js (MASTER_ADJ). The 22 TOP Sounds are never in it.\n\'use strict\';\nmodule.exports = {\n' + body + '\n};\n');
    console.log(`master_adjust.js: ${n} presets lowered more (${Object.keys(table).length} in the table)`);
    process.exit(0);
  }
  if (process.argv.includes('--apply')) {
    let js = fs.readFileSync(FILE, 'utf8');
    const crlf = /\r\n/.test(js); js = js.replace(/\r\n/g, '\n');
    let n = 0;
    for (const r of rows) {
      if (!r.down) continue;
      const key = JSON.stringify(r.name), at = js.indexOf('{ name: ' + key);
      if (at < 0) continue;
      const end = js.indexOf('} },', at), seg = js.slice(at, end);
      const m = /"master":(-?[\d.]+)/.exec(seg);
      const nv = Math.round(r.master * 10) / 10;
      const seg2 = m ? seg.replace(m[0], `"master":${nv}`) : seg.replace(/v: \{/, `v: {"master":${nv},`);
      js = js.slice(0, at) + seg2 + js.slice(end); n++;
    }
    fs.writeFileSync(FILE, crlf ? js.replace(/\n/g, '\r\n') : js);
    console.log(`master values lowered in tools/presets_lfo3.js for ${n} presets`);
  }
}
