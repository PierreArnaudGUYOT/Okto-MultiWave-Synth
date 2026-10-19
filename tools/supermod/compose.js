// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// The composer of the beta 0.2 presets: builds one preset from the layers (tools/supermod/layers.js) and the modulation recipes
// (tools/supermod/mods.js) with a seeded generator. Two oscillators of the same kind are chosen to be very different (the contrast
// score: family, role, wavelet class, wave or pattern, brightness, tuning, filter, own envelope), the category sets the envelope, the
// voices, the effects and the speed of the LFOs, and the recipes make the wavelet-domain controls move in time.
//   const { compose } = require('./compose.js');   compose(r, cat, { taken: Set of names }) -> a preset { cat, title, desc, v, meta } or null
'use strict';
const { P } = require('../preset_dsl.js');
const LAY = require('./layers.js');
const { MODS, aOsc, bOsc, allOsc } = require('./mods.js');
const { wclass } = LAY;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const FORM = {
  bass: ['Bass', 'Low End', 'Growl', 'Sub', 'Rumble', 'Undertow', 'Foundation'], lead: ['Lead', 'Cry', 'Call', 'Line', 'Voice', 'Signal'],
  keys: ['Keys', 'Tines', 'Clav', 'Chords', 'Piano'], pad: ['Pad', 'Cloud', 'Wash', 'Haze', 'Bed', 'Fog', 'Aurora'], strings: ['Strings', 'Bows', 'Ensemble', 'Section'],
  brass: ['Horns', 'Brass', 'Reeds', 'Fanfare'], pluck: ['Pluck', 'Harp', 'Strum', 'Lute', 'Pick'], bell: ['Bells', 'Chimes', 'Gong', 'Mallets', 'Bars'],
  organ: ['Organ', 'Pipes', 'Drawbars'], fx: ['Texture', 'Scape', 'Event', 'Machine', 'Storm', 'Signal'],
};
// category -> the kind of sound (SuperModulation draws one) and the speed of its LFOs (Hz, slow..fast, log scale)
const CATS = {
  'SuperModulation': { kind: null }, 'Bass': { kind: 'bass', speed: [0.2, 6] }, 'Lead': { kind: 'lead', speed: [0.4, 8] }, 'Keys': { kind: 'keys', speed: [0.25, 5] },
  'Organ': { kind: 'organ', speed: [0.3, 7] }, 'Pad': { kind: 'pad', speed: [0.06, 1.4] }, 'Strings': { kind: 'strings', speed: [0.12, 4] },
  'Brass & Wind': { kind: 'brass', speed: [0.3, 6] }, 'Pluck': { kind: 'pluck', speed: [0.25, 5] }, 'Bells & Mallets': { kind: 'bell', speed: [0.08, 2.5] },
  'FX': { kind: 'fx', speed: [0.05, 9] },
};
const SPEED = { bass: [0.2, 6], lead: [0.4, 8], keys: [0.25, 5], organ: [0.3, 7], pad: [0.06, 1.4], strings: [0.12, 4], brass: [0.3, 6], pluck: [0.25, 5], bell: [0.08, 2.5], fx: [0.05, 9] };
const SUPER_KINDS = [['pad', 4], ['lead', 3], ['bass', 2.5], ['keys', 2], ['pluck', 2], ['strings', 1.2], ['fx', 3], ['brass', 1], ['bell', 1.2], ['organ', 0.6]];

// which layers a kind of sound may use for each role
const okLayer = (l, kind) => {
  if (l.role === 'sub') return kind === 'bass' || kind === 'pad' || kind === 'lead' || kind === 'fx';
  if (kind === 'bass') return l.bright <= 3 && l.id !== 'noisewash';
  if (kind === 'pad' || kind === 'strings') return l.role !== 'attack' || ['chiff', 'bellbar', 'thumptri'].includes(l.id) || l.bright <= 3;
  if (kind === 'bell') return l.role === 'attack' || l.role === 'color' || l.role === 'air' || l.bright >= 3;
  if (kind === 'organ') return l.mode === 'B' || l.role !== 'attack';
  return true;
};
const bodyOk = (l, kind) => l.role === 'body' || (l.role === 'color' && (kind === 'lead' || kind === 'fx' || kind === 'keys' || kind === 'brass' || kind === 'pluck'));

function contrast(a, b) {   // how different two layers (with their oscillator values) are: 0 .. 8
  let s = 0;
  if (a.l.fam !== b.l.fam) s++; else return 0;
  if (a.l.role !== b.l.role) s++;
  if (a.l.mode === b.l.mode) {
    if (wclass(a.o.wavelet || 'db4') !== wclass(b.o.wavelet || 'db4')) s++;
    if ((a.o.wave || a.o.pattern) !== (b.o.wave || b.o.pattern)) s++;
    if ((a.o.ftype || 'lp') !== (b.o.ftype || 'lp')) s++;
  } else s += 2;
  if (Math.abs(a.l.bright - b.l.bright) >= 2) s++;
  if (((a.o.oct || 0) * 12 + (a.o.semi || 0)) !== ((b.o.oct || 0) * 12 + (b.o.semi || 0))) s++;
  if (!!a.o.env !== !!b.o.env) s++;
  return s;
}

// ---- the sound's tuning relation between a layer and the body, by its role
function placeLayer(r, kind, role, o, isBody) {
  const lowKind = kind === 'bass';
  if (isBody) { o.oct = lowKind ? r.pick([-1, 0]) : 0; return; }
  if (role === 'sub') { o.oct = lowKind ? r.pick([-2, -1]) : r.pick([-1, -2]); return; }
  if (role === 'attack') { o.oct = r.wpick([[0, 4], [1, 3], [2, 1], [-1, lowKind ? 3 : 1]]); if (lowKind && o.oct > 0) o.oct = 0; return; }
  if (role === 'air') { o.oct = r.wpick([[1, 3], [2, 2], [0, 2]]); return; }
  // color: another octave, a fifth, or the same pitch detuned
  // (never a third or a fourth: stacked on every note of a chord they make clusters)
  const way = r.wpick([['oct+', 3], ['oct-', 2.2], ['fifth', 1.3], ['same', 2.6]]);
  if (way === 'oct+') o.oct = 1; else if (way === 'oct-') o.oct = -1; else if (way === 'fifth') { o.oct = 0; o.semi = 7; }
  else { o.oct = 0; o.fine = r.pick([-1, 1]) * +r.f(5, 14).toFixed(1); }
  if (lowKind && o.oct > 0) o.oct = 0;
}
function levelFor(r, role) {
  return +({ body: () => r.f(0.72, 1), color: () => r.f(0.38, 0.8), attack: () => r.f(0.5, 0.95), sub: () => r.f(0.4, 0.85), air: () => r.f(0.18, 0.45) }[role]()).toFixed(2);
}

// ---- the envelope, voices and effects of a kind of sound
function globals(r, kind) {
  const g = {};
  const mono = (kind === 'bass' || kind === 'lead') && r.p(kind === 'lead' ? 0.55 : 0.45);
  g.voices = mono ? 1 : r.pick([6, 8, 10, 12]);
  if (mono) { g.porta = 'legato'; g.glide = +r.f(0.02, 0.12).toFixed(3); }
  switch (kind) {
    case 'bass': g.amp = [r.f(0.002, 0.01), r.f(0.3, 0.9), r.f(0.5, 0.9), r.f(0.08, 0.25), r.f(0.4, 0.8)]; g.uni = [1, 0]; g.width = 0.3;
      g.reverb = [r.f(0.15, 0.3), r.f(0.04, 0.12)]; if (r.p(0.3)) g.drive = +r.f(0.05, 0.25).toFixed(2); if (r.p(0.25)) g.chorus = [r.f(0.15, 0.35), 0.5, 0.5]; break;
    case 'lead': g.amp = [r.f(0.004, 0.03), r.f(0.3, 0.8), r.f(0.6, 0.9), r.f(0.15, 0.4), 0.5]; g.uni = [r.pick([1, 1, 2]), r.f(6, 14)]; g.width = 0.7;
      if (r.p(0.65)) g.delay = [r.pick([0.25, 0.33, 0.375, 0.5]), r.f(0.25, 0.4), r.f(0.1, 0.25)]; g.reverb = [r.f(0.4, 0.7), r.f(0.1, 0.3)]; break;
    case 'keys': g.amp = [r.f(0.002, 0.01), r.f(0.5, 2.5), r.f(0, 0.4), r.f(0.2, 0.6), 0.6]; g.uni = [1, 0]; g.width = 0.7;
      if (r.p(0.6)) g.chorus = [r.f(0.25, 0.5), r.f(0.4, 0.9), 0.55]; g.reverb = [r.f(0.3, 0.6), r.f(0.1, 0.25)]; break;
    case 'organ': g.amp = [r.f(0.003, 0.02), 0.2, r.f(0.85, 1), r.f(0.05, 0.15), 0.3]; g.uni = [1, 0]; g.width = 0.6;
      g.chorus = [r.f(0.25, 0.5), r.f(0.6, 1.6), 0.6]; g.reverb = [r.f(0.2, 0.45), r.f(0.1, 0.2)]; break;
    case 'pad': g.amp = [r.f(0.5, 1.6), 0.8, r.f(0.7, 1), r.f(1.4, 3), 0.3]; g.uni = [r.pick([2, 3]), r.f(8, 14)]; g.width = r.f(0.8, 1);
      g.chorus = [r.f(0.3, 0.6), r.f(0.35, 0.7), 0.6]; g.reverb = [r.f(0.7, 0.92), r.f(0.3, 0.55)]; break;
    case 'strings': g.amp = [r.f(0.15, 0.6), 0.8, r.f(0.8, 1), r.f(0.5, 1.4), 0.5]; g.uni = [r.pick([2, 3]), r.f(6, 12)]; g.width = 0.9;
      g.chorus = [r.f(0.3, 0.5), 0.6, 0.6]; g.reverb = [r.f(0.5, 0.8), r.f(0.2, 0.4)]; break;
    case 'brass': g.amp = [r.f(0.03, 0.2), r.f(0.3, 0.8), r.f(0.7, 0.95), r.f(0.15, 0.4), 0.6]; g.uni = [r.pick([1, 2]), r.f(5, 10)]; g.width = 0.6;
      g.reverb = [r.f(0.35, 0.6), r.f(0.1, 0.25)]; break;
    case 'pluck': g.amp = [r.f(0.001, 0.004), r.f(0.3, 1.2), 0, r.f(0.15, 0.5), 0.7]; g.uni = [1, 0]; g.width = 0.7;
      if (r.p(0.5)) g.delay = [r.pick([0.25, 0.33, 0.375]), r.f(0.25, 0.4), r.f(0.1, 0.22)]; g.reverb = [r.f(0.35, 0.65), r.f(0.12, 0.28)]; break;
    case 'bell': g.amp = [0.002, r.f(1.5, 4), 0, r.f(0.6, 1.8), 0.5]; g.uni = [1, 0]; g.width = 0.8; g.reverb = [r.f(0.6, 0.85), r.f(0.2, 0.4)];
      if (r.p(0.3)) g.delay = [r.pick([0.33, 0.5]), r.f(0.25, 0.4), r.f(0.1, 0.2)]; break;
    default: g.amp = [r.f(0.005, 1.2), r.f(0.5, 2), r.f(0.3, 1), r.f(0.5, 2.5), 0.4]; g.uni = [r.pick([1, 2, 3]), r.f(6, 16)]; g.width = r.f(0.7, 1);   // fx
      g.delay = [r.pick([0.25, 0.33, 0.5, 0.75]), r.f(0.3, 0.45), r.f(0.15, 0.3)]; g.reverb = [r.f(0.6, 0.9), r.f(0.25, 0.5)]; if (r.p(0.4)) g.chorus = [0.4, 0.5, 0.6];
  }
  g.amp = g.amp.map((x, i) => (i < 4 ? +x.toFixed(3) : x));
  if (g.uni) g.uni = [g.uni[0], +g.uni[1].toFixed(1)];
  if (g.reverb) g.reverb = g.reverb.map(x => +x.toFixed(2));
  if (g.chorus) g.chorus = g.chorus.map(x => +x.toFixed(2));
  if (g.delay) g.delay = g.delay.map(x => +x.toFixed(2));
  if (g.width !== undefined) g.width = +g.width.toFixed(2);
  return g;
}

// ---- layers of one mode that fit a kind of sound and a role
function candidates(mode, kind, roles) {
  return (mode === 'A' ? LAY.A : LAY.B).filter(l => roles.includes(l.role) && okLayer(l, kind));
}
const CONFIGS = [['A1A2', 24], ['B1B2', 15], ['A1B1', 24], ['A1A2B1', 13], ['A1B1B2', 9], ['A1A2B1B2', 6], ['A2B2', 3], ['A1B2', 3], ['A2B1', 3]];

function compose(r, cat, opts = {}) {
  const spec = CATS[cat];
  const kind = spec.kind || r.wpick(SUPER_KINDS);
  const super_ = cat === 'SuperModulation';
  const cfg = r.wpick(CONFIGS), slots = cfg.match(/[AB]\d/g);
  const want = (mode) => slots.filter(s => s[0] === mode);
  const picked = {};   // slot -> { l: layer, o: osc values, role }
  const usedFam = new Set();
  const take = (slot, l, role, isBody) => {
    const o = l.make(r);
    placeLayer(r, kind, role, o, isBody);
    o.lvl = levelFor(r, role);
    picked[slot] = { l, o, role };
    usedFam.add(l.fam);
  };
  // the body: the first slot gets a sustained layer fitting the kind; the others are chosen against it
  const order = r.shuffle(slots);
  let bodySlot = null;
  for (const s of order) {
    const mode = s[0];
    const pool = candidates(mode, kind, ['body', 'color']).filter(l => bodyOk(l, kind));
    if (!pool.length) continue;
    bodySlot = s; take(s, r.pick(pool), 'body', true); break;
  }
  if (!bodySlot) return null;
  for (const s of slots) {
    if (picked[s]) continue;
    const mode = s[0], same = slots.filter(x => x[0] === mode && picked[x]).map(x => picked[x]);
    // roles for this oscillator: a second sustained sound, an attack, the sub, or air; the percussive roles when the kind decays
    const rolePool = kind === 'bell' || kind === 'pluck' ? [['attack', 3], ['color', 3], ['air', 1]] : kind === 'bass' ? [['sub', 3], ['color', 3], ['attack', 2]]
      : kind === 'pad' || kind === 'strings' ? [['color', 4], ['air', 2], ['sub', 1], ['attack', 1.2]] : [['color', 4], ['attack', 2.5], ['air', 1.4], ['sub', kind === 'lead' ? 0.6 : 0.9]];
    let best = null;
    for (let tries = 0; tries < 14; tries++) {
      const role = r.wpick(rolePool), pool = candidates(mode, kind, [role]).filter(l => !usedFam.has(l.fam));
      if (!pool.length) continue;
      const l = r.pick(pool), o = l.make(r); placeLayer(r, kind, role, o, false); o.lvl = levelFor(r, role);
      const cand = { l, o, role };
      const worst = same.length ? Math.min(...same.map(x => contrast(x, cand))) : 9;
      const need = same.length ? 4 : 0;   // two oscillators of the same kind must be very different
      if (worst >= need) { best = cand; break; }
      if (!best || worst > best.score) { best = Object.assign(cand, { score: worst }); }
    }
    if (!best) return null;
    if (same.length && Math.min(...same.map(x => contrast(x, best))) < 3) return null;
    picked[s] = best; usedFam.add(best.l.fam);
  }
  // the preset in the language of preset_dsl: oscillators and globals
  const ctx = { osc: {}, g: globals(r, kind), kind, speed: SPEED[kind], variant: null };
  const id = (s) => s;   // slot ids are 'A1' 'A2' 'B1' 'B2'
  for (const s of slots) ctx.osc[id(s)] = picked[s].o;
  // the modulations
  const used = [];
  const apply = (m) => { if (!m.fits(ctx)) return false; const res = m.apply(ctx, r); if (!res) return false; used.push({ m, res }); return true; };
  const wd = MODS.filter(m => m.wd), by = (k) => wd.filter(m => m.kind === k);
  const nL1 = super_ ? r.wpick([[1, 3], [2, 4], [3, 2]]) : r.wpick([[0, 1.3], [1, 4], [2, 1.2]]);
  const doL2 = super_ ? r.p(0.92) : r.p(0.5);
  const doEnv = r.p(super_ ? 0.3 : 0.2);
  const shuffled = r.shuffle(by('lfo1'));
  let nDone = 0;
  for (const m of shuffled) { if (nDone >= nL1) break; if (apply(m)) nDone++; }
  if (doL2) { for (const m of r.shuffle(by('lfo2'))) if (apply(m)) break; }
  if (doEnv) { for (const m of by('env')) if (apply(m)) break; }
  const wdCount = new Set(used.filter(u => u.m.wd).map(u => u.m.dest)).size;
  if (super_ && (wdCount < 2 || used.length < 2 || !ctx.g.lfo || !ctx.g.lfo2)) return null;
  if (!super_ && wdCount < 1) return null;
  if (!super_ && wdCount > 2) return null;
  if (r.p(0.3) && ctx.g.lfo && ctx.g.lfo.pitch === undefined && kind !== 'bell' && kind !== 'pluck') { const m = MODS.find(x => x.id === 'pitchVib'); if (m.fits(ctx)) apply(m); }
  // an additive-only or attack-only kind keeps a safe resonance
  for (const sl of Object.keys(ctx.osc)) { const o = ctx.osc[sl]; if (o.fres !== undefined) o.fres = Math.min(o.fres, 12); }
  if (ctx.g.lfo && ctx.g.lfo.res) for (const sl of Object.keys(ctx.osc)) { const o = ctx.osc[sl]; if (o.fres !== undefined) o.fres = Math.min(o.fres, 6); }
  // the name and the description
  const layerWords = slots.map(s => r.pick(picked[s].l.words));
  const modWords = used.filter(u => u.m.wd).map(u => r.pick(u.m.words));
  const formKind = kind === 'strings' ? 'strings' : kind;
  const form = r.pick(FORM[formKind] || FORM.fx);
  const patterns = [() => `${r.pick(modWords)} ${form}`, () => `${r.pick(layerWords)} ${r.pick(modWords)}`, () => `${r.pick(layerWords)} ${form}`,
    () => `${r.pick(layerWords)} & ${r.pick(layerWords)}`, () => `${r.pick(modWords)} of ${r.pick(layerWords)}`, () => `${r.pick(layerWords)} ${r.pick(modWords)} ${form}`];
  let title = null;
  for (let t = 0; t < 40 && !title; t++) { const c = r.pick(patterns)(); if (!/^(\w+) & \1$/.test(c) && !opts.taken.has(c.toLowerCase())) title = c; }
  if (!title) return null;
  const rel = (o) => {
    const st = (o.oct || 0) * 12 + (o.semi || 0);
    const t = st === 12 ? 'an octave above' : st === 24 ? 'two octaves above' : st === -12 ? 'an octave below' : st === -24 ? 'two octaves below' : st === 7 ? 'a fifth above' : st === 5 ? 'a fourth above' : st === 3 ? 'a minor third above' : st === 4 ? 'a major third above' : '';
    return t ? ' ' + t : o.fine ? ', slightly detuned' : '';
  };
  const parts = slots.map(s => picked[s].l.desc + (s === bodySlot ? '' : rel(picked[s].o)));
  let desc = cap(parts[0]) + (parts.length > 1 ? ' against ' + parts.slice(1).join(', and ') : '');
  desc += '; ' + used.map(u => u.res.desc).join(', and ') + '.';
  // the oscillators and globals into a preset
  const specObj = { g: ctx.g };
  for (const s of slots) specObj[s] = ctx.osc[s];
  const pr = P(cat, title, desc, specObj);
  pr.meta = { cfg, kind, layers: slots.map(s => picked[s].l.id), roles: slots.map(s => picked[s].role), mods: used.map(u => u.m.id), dests: [...new Set(used.map(u => u.m.dest))] };
  return pr;
}

module.exports = { compose, CATS, contrast };
