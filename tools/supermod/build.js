// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Builds tools/presets_super.js: the 300 new presets of Okto MultiWave Synth beta 0.2 (numbers 201-500). Many candidates are composed
// (tools/supermod/compose.js) and measured (audit.js) in parallel; the ones that pass (they sound, they do not crackle, the oscillators
// of a kind are very different, the sound moves in time as asked) are chosen so that the set is as varied as possible, also against
// the 222 existing presets; their loudness is matched to the TOP Sounds.
//   node tools/supermod/build.js [--per 6] [--seed 1] [--procs 20]       candidates -> tools/out/super_cand.json, selection -> presets_super.js
//   node tools/supermod/build.js --pool                                    also keeps every measured candidate in tools/out/super_pool.json
//                                                                          and chooses among all the pools' candidates (several seeds add up)
//   node tools/supermod/build.js --select-only                             only the selection, from the pool (no new candidates)
//   node tools/supermod/build.js --report                                  the statistics of the written set
// Run with MW_NO_SUPER=1 node tools/gen_spec.js first: the existing presets the candidates are compared with are the 222 of beta 0.1.
'use strict';
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const OUT = path.join(__dirname, '..', 'out');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };

// how many presets of each category (300 in all): SuperModulation first, then the usual categories in their menu order
const QUOTA = [['SuperModulation', 120], ['Bass', 22], ['Lead', 22], ['Keys', 20], ['Organ', 8], ['Pad', 26], ['Strings', 12], ['Brass & Wind', 14], ['Pluck', 20],
  ['Bells & Mallets', 20], ['FX', 16]];
const SUSTAINED = new Set(['pad', 'strings', 'organ', 'lead', 'bass', 'brass']);

// ----------------------------------------------------------------------------- worker: composes and measures candidates
if (process.argv[2] === '--worker') {
  const k = +arg('worker', 0), per = +arg('per', 6), seed = +arg('seed', 1), procs = +arg('procs', 1);
  const { Rng } = require('./rng.js');
  const { compose } = require('./compose.js');
  const A = require('./audit.js');
  const lab = require('../preset_lab.js');
  const SPEC = lab.SPEC, P = lab.P;
  const top = SPEC.PRESETS.slice(0, SPEC.TOP).map(p => lab.chordLoudness(p.values, 0.2).db).sort((a, b) => a - b);
  const target = top[Math.floor(top.length / 2)] - 1;   // the TOP Sounds' median loudness, a dB under: headroom for the chords
  const taken = new Set(SPEC.PRESETS.map(p => (p.name.split(' · ')[1] || p.name).toLowerCase()));
  const r = Rng(seed * 7919 + k * 104729 + 13);
  const mp = SPEC.PARAMS[P.master];
  const rows = [];
  const stats = { composed: 0, nulls: 0, errors: 0 };
  for (const [cat, quota] of QUOTA) {
    const want = Math.ceil(quota * per / procs);
    for (let n = 0, tries = 0; n < want && tries < want * 12; tries++) {
      let pr = null;
      try { pr = compose(r, cat, { taken }); } catch (e) { stats.errors++; if (stats.errors < 4) console.error('compose error:', e.message); continue; }
      if (!pr) { stats.nulls++; continue; }
      stats.composed++;
      // the loudness: the master (and the levels when the sound is too quiet for +3 dB)
      let values = A.fullValues(pr.v);
      const cur = pr.v.master !== undefined ? pr.v.master : mp.def;
      const m0 = lab.chordLoudness(values);
      let master = Math.round((cur + target - m0.db) * 2) / 2;
      if (master > 3) {
        const f = Math.pow(10, (master - 3) / 20), lv = ['a1_lvl', 'a2_lvl', 'b1_lvl', 'b2_lvl'];
        const mx = Math.max(...lv.map(key => (pr.v[key] !== undefined ? pr.v[key] : SPEC.PARAMS[P[key]].def)));
        const f2 = Math.min(f, 1 / mx);
        if (f2 > 1.01) for (const key of lv) if (pr.v[key] > 0) pr.v[key] = Math.round(pr.v[key] * f2 * 1000) / 1000;
        values = A.fullValues(pr.v);
        const m1 = lab.chordLoudness(values);
        master = Math.round((cur + target - m1.db) * 2) / 2;
      }
      master = Math.max(mp.min, Math.min(mp.max, master));
      pr.v.master = master; values[P.master] = master;
      // headroom: the chord with its bass must stay under the limiter's knee: the master goes down (up to 6 dB) until it does
      for (let it = 0; it < 6; it++) {
        const r60 = A.chord(values, { root: 60, seconds: 3.2, hold: 2.4 });
        if (A.peakOf(r60) <= 0.9 && A.limiterShare(values, r60, { root: 60, seconds: 3.2, hold: 2.4 }) <= 0.003) break;
        master = Math.max(mp.min, master - 1); pr.v.master = master; values[P.master] = master;
      }
      // the pairs of oscillators of one kind (A1 A2, B1 B2) to compare
      const used = pr.used.match(/[AB]\d/g), ids = A.SLOT_IDS, pairs = [];
      for (let a = 0; a < used.length; a++) for (let b = a + 1; b < used.length; b++) if (used[a][0] === used[b][0]) pairs.push([ids.indexOf(used[a]), ids.indexOf(used[b])]);
      const kindOf = pr.meta.kind;
      let au = A.audit(values, { pairs, stage1: (a) => A.judgeSound(a, kindOf) });
      if (au.stopped) { rows.push({ cat, title: pr.title, desc: pr.desc, used: pr.used, v: pr.v, meta: pr.meta, audit: Object.assign(au, { features: [0] }), refused: A.judgeSound(au, kindOf) }); taken.add(pr.title.toLowerCase()); n++; continue; }
      // a modulation that is too shy is made bolder (the LFO amounts x 1.45, within their ranges), up to twice
      for (let it = 0; it < 2 && au.moveDelta < (cat === 'SuperModulation' ? 3.4 : 1.2) && au.limDist <= 0.004 && au.peak <= 0.97; it++) {
        const v = pr.v, cap = (key, mx) => { if (v[key] !== undefined && v[key] !== 0) v[key] = Math.round(Math.max(-mx, Math.min(mx, v[key] * 1.45)) * 1000) / 1000; };
        cap('lfo_sp', 1); cap('lfo_res', 24); cap('lfo_cut', 6); cap('lfo_pos', 0.5); cap('lfo_wav', 1); cap('lfo_ew', 1); cap('lfo2_amt', 1);
        values = A.fullValues(v);
        au = A.audit(values, { pairs, stage1: (a) => A.judgeSound(a, kindOf) });
        if (au.stopped) break;
      }
      delete au.r60; delete au.frames;
      rows.push({ cat, title: pr.title, desc: pr.desc, used: pr.used, v: pr.v, meta: pr.meta, audit: au });
      taken.add(pr.title.toLowerCase());
      n++;
    }
  }
  fs.writeFileSync(path.join(OUT, `super_cand_${k}.json`), JSON.stringify({ rows, stats }));
  process.exit(0);
}

// ----------------------------------------------------------------------------- report of the written set
if (process.argv.includes('--report')) {
  const rows = require('../presets_super.js');
  const cnt = (f) => { const c = {}; for (const x of rows) { const k = f(x); c[k] = (c[k] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '); };
  console.log(rows.length + ' presets');
  console.log('categories: ' + cnt(x => x.cat));
  console.log('oscillators: ' + cnt(x => x.name.split(' ')[1]));
  process.exit(0);
}

// ----------------------------------------------------------------------------- main: workers, filters, selection, output
const per = +arg('per', 6), seed = +arg('seed', 1), procs = +arg('procs', 20);
fs.mkdirSync(OUT, { recursive: true });
let done = 0;
const t0 = Date.now();
if (process.argv.includes('--select-only')) select(true);
else for (let k = 0; k < procs; k++) fork(__filename, ['--worker', String(k), '--per', String(per), '--seed', String(seed), '--procs', String(procs)]).on('exit', () => { if (++done === procs) select(false); });

function select(selectOnly) {
  const lab = require('../preset_lab.js'), SPEC = lab.SPEC;
  let cands = [], stats = { composed: 0, nulls: 0, errors: 0 };
  const poolFile = path.join(OUT, 'super_pool.json');
  if (!selectOnly) for (let k = 0; k < procs; k++) {
    const j = JSON.parse(fs.readFileSync(path.join(OUT, `super_cand_${k}.json`), 'utf8'));
    cands = cands.concat(j.rows); for (const s of Object.keys(stats)) stats[s] += j.stats[s];
  }
  if ((process.argv.includes('--pool') || selectOnly) && fs.existsSync(poolFile)) {
    const old = JSON.parse(fs.readFileSync(poolFile, 'utf8')), have = new Set(cands.map(c => c.title.toLowerCase()));
    for (const c of old) if (!have.has(c.title.toLowerCase())) { cands.push(c); have.add(c.title.toLowerCase()); }
  }
  if (process.argv.includes('--pool') || selectOnly) fs.writeFileSync(poolFile, JSON.stringify(cands));
  console.log(`${cands.length} candidates measured (${stats.composed} composed, ${stats.nulls} refused by the composer, ${stats.errors} errors) in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  // ---- the filters
  const reasons = {};
  const bad = (why) => { reasons[why] = (reasons[why] || 0) + 1; return false; };
  const A = require('./audit.js');
  const ok = cands.filter((c) => {
    // a third or a fourth stacked on every chord note makes clusters on the chord keyboard: only octaves, fifths and detunings
    if (Object.keys(c.v).some(k => /_semi$/.test(k) && [3, 4, 5].includes(c.v[k]))) return bad('a third or a fourth above every note');
    const a = c.audit, why = A.judgeSound(a, c.meta.kind) || (a.stopped ? 'stopped' : A.judgeMotion(a, c.cat) || A.judgeContrast(a));
    return why ? bad(why) : true;
  });
  console.log(`${ok.length} pass the filters. Refused: ` + Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  // ---- the selection: farthest point first in each category, against the presets already chosen and the 222 existing ones
  const cal = JSON.parse(fs.readFileSync(path.join(OUT, 'calib.json'), 'utf8'));
  const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]); return Math.sqrt(s / a.length); };
  const fixed = cal.map(r => r.features);
  const chosen = [], titles = new Set();
  for (const [cat, quota] of QUOTA) {
    const pool = ok.filter(c => c.cat === cat);
    const mine = [];
    const minD = pool.map(c => Math.min(...fixed.map(f => dist(c.audit.features, f)), ...chosen.map(x => dist(c.audit.features, x.audit.features))));
    for (let n = 0; n < quota && pool.length; n++) {
      let best = -1, bd = -1;
      for (let i = 0; i < pool.length; i++) if (pool[i] && !titles.has(pool[i].title.toLowerCase()) && minD[i] > bd) { bd = minD[i]; best = i; }
      if (best < 0) break;
      const pick = pool[best]; pool[best] = null; mine.push(pick); titles.add(pick.title.toLowerCase());
      for (let i = 0; i < pool.length; i++) if (pool[i]) minD[i] = Math.min(minD[i], dist(pool[i].audit.features, pick.audit.features));
    }
    for (const m of mine) chosen.push(m);
    console.log(`${cat.padEnd(18)} ${mine.length} / ${quota} chosen from ${ok.filter(c => c.cat === cat).length}`);
  }
  // ---- numbers and file
  const firstNo = 201;
  let js = '// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)\n// SPDX-License-Identifier: GPL-3.0-or-later\n' +
    '// GENERATED by tools/supermod/build.js (compose.js, layers.js, mods.js, audit.js): the new presets of beta 0.2, numbers 201-500, loudness matched.\n' +
    "'use strict';\nmodule.exports = [\n";
  chosen.forEach((c, i) => {
    const name = `${String(firstNo + i).padStart(3, '0')} ${c.used} · ${c.title}`;
    js += `  { name: ${JSON.stringify(name)}, cat: ${JSON.stringify(c.cat)}, desc: ${JSON.stringify(c.desc)},\n    v: ${JSON.stringify(c.v)} },\n`;
  });
  js += '];\n';
  fs.writeFileSync(path.join(__dirname, '..', 'presets_super.js'), js);
  fs.writeFileSync(path.join(OUT, 'super_chosen.json'), JSON.stringify(chosen.map(c => ({ cat: c.cat, title: c.title, used: c.used, meta: c.meta, audit: Object.assign({}, c.audit, { features: undefined }) }))));
  console.log(`written tools/presets_super.js (${chosen.length} presets)`);
  if (!selectOnly && !process.argv.includes('--keep')) for (let k = 0; k < procs; k++) fs.unlinkSync(path.join(OUT, `super_cand_${k}.json`));
}
