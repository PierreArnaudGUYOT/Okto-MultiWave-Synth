// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Contact sheets of the presets of beta 0.2 (envelope and spectrogram of each, a held C major 7 chord with its bass, 4 s): a sound can be
// judged by eye. node tools/supermod/sheets.js [category ...]  ->  tools/out/super-<category>.png (numbers of the presets in the cells)
'use strict';
const path = require('path');
const lab = require('../preset_lab.js');
const A = require('./audit.js');
const SPEC = lab.SPEC, OUT = path.join(__dirname, '..', 'out');
const fi = process.argv.indexOf('--first'), first = fi >= 0 ? +process.argv[fi + 1] : 0, want = process.argv.slice(2).filter((a, i, arr) => a !== '--first' && arr[i - 1] !== '--first');
const cats = [...new Set(SPEC.PRESETS.slice(SPEC.NEW_FIRST).filter(p => /^\d{3}/.test(p.name) && +p.name.slice(0, 3) >= 201).map(p => p.cat))];
for (const cat of cats) {
  if (want.length && !want.includes(cat)) continue;
  const list = SPEC.PRESETS.filter(p => p.cat === cat && +p.name.slice(0, 3) >= 201).slice(0, first || 1e9);
  const cells = list.map((p) => {
    const r = A.chord(p.values, { root: 60, seconds: 4.2, hold: 3.2 });
    r.note = 60;
    return { label: p.name.slice(0, 3), r };
  });
  const file = path.join(OUT, 'super-' + cat.replace(/[^A-Za-z]+/g, '') + '.png');
  lab.sheet(cells, file, { cols: 5, cw: 260, ch: 120, secs: 4.2 });
  console.log(`${cat}: ${list.length} presets -> ${file}`);
}
