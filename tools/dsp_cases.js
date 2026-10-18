// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// The cases of the C++ <-> JS cross-check: every factory preset, then variants of the engine's features (LFO 2 on each
// target, SOURCE PHASE, WAVELET MORPH, the four oscillators with their own envelopes and pitch envelopes, tempo sync, the
// chord keyboard). tools/dsp_compare.js writes them to a file (--list), vst/devtest/dsp_render.cpp renders them with the C++
// engine, tools/dsp_compare.js compares the JS render with the C++ one. kind 'note': one note, then a chord; 'chord': the
// chord keyboard played through keyOn / keyOff and the strum plate (CHORD_SCRIPT).
'use strict';
module.exports = function cases(SPEC, C) {
  const P = C.P, out = [];
  const add = (name, values, opt = {}) => out.push({ name, kind: opt.kind || 'note', tempo: opt.tempo || 0, values: Array.from(values) });
  SPEC.PRESETS.forEach(pr => add(pr.name, pr.values));
  const preset0 = () => SPEC.PRESETS[0].values.slice();
  const variant = (name, set, opt, from) => {
    const v = (from === undefined ? preset0() : SPEC.PRESETS[from].values.slice());
    for (const [k, x] of Object.entries(set)) { if (!(k in P)) throw new Error('unknown parameter ' + k); v[P[k]] = x; }
    add(name, v, opt);
  };
  // LFO 2 on each of its targets (every oscillator that has the parameter)
  SPEC.LFO2_TARGETS.forEach((target, t) => {
    const pi = (t * 17) % SPEC.PRESETS.length, v = SPEC.PRESETS[pi].values.slice();
    v[P.lfo2_target] = t; v[P.lfo2_amt] = t % 2 ? -0.8 : 0.8; v[P.lfo2_rate] = 3; v[P.lfo2_shape] = t % 5;
    add(`LFO 2 -> ${SPEC.PARAMS[target].key}`, v);
  });
  const PHT = SPEC.LFO2_ROLE.indexOf(SPEC.ROLES.indexOf('phase'));
  // SOURCE PHASE static, and moved by LFO 2 with WAVELET MORPH and with two oscillators (every phase set)
  variant('phase 37/2048, Haar saw', { wavelet: 0, a_wave: 0, a_phase: 37 / 2048, f_cutoff: 5 });
  variant('phase 0.3, noise', { wavelet: 1, a_wave: 5, a_phase: 0.3, a_sparsity: 0.4 });
  variant('LFO 2 -> phase + morph', { wavelet: 0, wav2: 2, wmorph: 0.4, a_phase: 0.1, lfo2_target: PHT, lfo2_amt: 0.7, lfo2_rate: 2.5, lfo2_shape: 0 });
  variant('LFO 2 -> phase on A1 + A2 + morph', { a1_lvl: 0.6, a2_lvl: 0.6, a2_wave: 1, a2_phase: 0.35, a2_wavelet: 2, wav2: 1, wmorph: 0.5,
    a_phase: 0.62, lfo2_target: PHT, lfo2_amt: -0.6, lfo2_rate: 4, lfo2_shape: 1 });
  // the four oscillators
  variant('A1 + A2: octave, own envelope, pitch envelope', { a1_lvl: 0.6, a2_lvl: 0.8, a2_oct: 1, a2_wave: 1, a2_eon: 1, a2_ea: 0.002, a2_ed: 0.12, a2_es: 0.1,
    a2_er: 0.3, a2_pamt: 12, a2_ptime: 0.06, a2_fcut: 7, a2_fres: 6 });
  variant('A2 click: noise burst, mono legato', { a1_lvl: 0.7, a2_lvl: 1, a2_wave: 5, a2_eon: 1, a2_ed: 0.04, a2_es: 0, a2_ftype: 1, a2_fcut: 6, v_voices: 1, v_glide: 0.05,
    amp_s: 0.9 });
  variant('B1 + B2: fifth, detuned partials, own envelope', { a1_lvl: 0, b1_lvl: 0.7, b2_lvl: 0.6, b2_semi: 7, b2_fine: -8, b2_pattern: 3, b2_bar2: 0.4, b2_bar3: 0.7,
    b2_atk: 0.01, b2_body: 1.2, b2_bright: 0.3, b2_eon: 1, b2_ed: 0.8, b2_es: 0.3, b2_tilt: -3, b_pattern: 1, b1_fcut: 8 });
  variant('A1 + B2: filters, window, key tracking', { a1_lvl: 0.5, b2_lvl: 0.7, b2_fcut: 5, b2_fres: 8, b2_fenv: 3, b2_pdep: 0.6, b2_pwid: 0.3, b2_fkey: 0.3, f_cutoff: 6,
    f_keytrk: 0.2, mod_d: 0.4 });
  variant('four oscillators, unison 3, morph, sub', { a1_lvl: 0.5, a2_lvl: 0.4, b1_lvl: 0.5, b2_lvl: 0.4, a2_oct: -1, b2_oct: 1, v_unison: 3, v_detune: 15, wav2: 1, wmorph: 0.5,
    lfo_wav: 0.3, a2_wavelet: 4, b2_wavelet: 5, sub_level: 0.4, ch_mix: 0.5 });
  variant('LFO 2 -> cutoff on four oscillators', { a1_lvl: 0.5, a2_lvl: 0.5, b1_lvl: 0.5, b2_lvl: 0.5, a2_fcut: 6, b1_fcut: 7, b2_fcut: 5, f_cutoff: 8,
    lfo2_target: 0, lfo2_amt: 0.7, lfo2_rate: 2, lfo2_shape: 1 });
  variant('pitch envelope down on B2, own envelope off', { a1_lvl: 0, b1_lvl: 0, b2_lvl: 1, b2_pamt: -24, b2_ptime: 0.2, b2_pattern: 0, b2_tilt: -9 });
  variant('LFO 1 and mod wheel on four oscillators', { a1_lvl: 0.4, a2_lvl: 0.4, b1_lvl: 0.4, b2_lvl: 0.4, lfo_pitch: 30, lfo_cut: 2, lfo_pos: 0.3, a2_pdep: 0.8, v_unison: 2 });
  // TEMPO SYNC of the delay and both LFOs at a tempo
  variant('sync delay 1/8 D @120', { fx_dsync: 1, fx_ddiv: 7, fx_dmix: 0.4, fx_dfb: 0.5 }, { tempo: 120 });
  variant('sync LFO 1 1/16 @97', { lfo_sync: 1, lfo_div: 13, lfo_cut: 3, lfo_pitch: 30 }, { tempo: 97 });
  variant('sync LFO 2 1/8 T + delay 1/1 @133', { lfo2_sync: 1, lfo2_div: 12, lfo2_amt: 0.7, lfo2_target: 0, fx_dsync: 1, fx_ddiv: 13, fx_dmix: 0.3 }, { tempo: 133 });
  // the chord keyboard (folded voicing with the bass; stacked with a strum and 4 voices; mono with a long strum); with two oscillators
  variant('chord folded + bass', { chord_mode: 1, chord_voicing: 1, chord_bass: 1 }, { kind: 'chord' });
  variant('chord stacked, strum, 4 voices', { chord_mode: 1, chord_voicing: 0, chord_strum: 0.02, v_voices: 4, chord_type: 2 }, { kind: 'chord' });
  variant('chord mono, strum 50 ms', { chord_mode: 1, v_voices: 1, chord_strum: 0.05 }, { kind: 'chord' });
  variant('chord with A1 + A2 own envelope', { chord_mode: 1, a2_lvl: 0.6, a2_oct: 1, a2_eon: 1, a2_ed: 0.1, a2_es: 0 }, { kind: 'chord' });
  return out;
};
