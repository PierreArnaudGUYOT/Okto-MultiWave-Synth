// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Okto MultiWave Synth — single source of truth (based on the Wavelet Synthesizer beta 0.7).
// Created by Pierre Arnaud GUYOT ("OktoPierre"). Release history: see RELEASE_HISTORY.md
// Okto MultiWave Synth beta 0.1 (2026-10-18) — the Wavelet Synthesizer beta 0.7 with TWO OSCILLATORS PER ENGINE (A1 A2 subtractive,
//   B1 B2 additive, each with its own wavelet, filter, window, level, tuning, own envelope and pitch envelope), its 22 TOP
//   Sounds, 200 new presets to evaluate (EVALUATE SOUNDS), a CHORD MODE (chord-harp-style chord keyboard) and the findings of
//   the CPU load study. The history of the base synthesizer is in RELEASE_HISTORY.md.
// Parameters, panel layout and factory presets are defined here once and
// generated into web/js/spec.js and vst/src/generated/spec.h by gen_spec.js.
// Parameter order defines the VST3 ParamIDs: append only, never reorder.
'use strict';

const DEVICE = { w: 1100, h: 860 };   // the panel; CHORD MODE adds CHORD_H below the keyboard row (the chord card)
const APP = {
  name: 'Okto MultiWave Synth',
  author: 'Pierre Arnaud GUYOT',
  credit: 'created by OktoPierre',   // the vendor line (manuals)
  panelCredit: 'By OktoPierre',      // beta 0.7: the panel's credit (bottom left, small and discreet)
  copyright: 'Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)',
  license: 'GPL v3',                 // shown on the panel; the licence is GPL-3.0-or-later (file LICENSE)
  version: 'beta 0.2',
  versionNum: '0.2.0',
  date: '2026-10-19',
  doi: '',                           // no Zenodo record yet (the base synthesizer's is 10.5281/zenodo.23431760)
  base: 'Wavelet Synthesizer beta 0.7',   // the synthesizer Okto MultiWave Synth is built on
};
// curve: lin | exp | pow2 | int | choice
// fmt:   pct | db | sec | hz | cents | band | dbband | int | choice | deg | cyc | semi | bipct | bandamt
const P = [];
// perf: a performance setting (Okto MultiWave Synth): on the panel and automatable, but never stored in a preset, never marking the
// preset modified; the plug-in's state and the web app's saved state keep it (like the keyboard, it is not a sound).
function add(key, name, short, o) { P.push(Object.assign({ key, name, short, curve: 'lin', fmt: 'pct', hidden: false, structural: false, perf: false }, o)); }

// the oscillator shown on the panel (A1 A2 | B1 B2); not a sound: switching it never marks a preset as modified
add('osc_view', 'Oscillator Shown', 'OSC', { curve: 'choice', fmt: 'choice', min: 0, max: 3, def: 0, structural: true,
  choices: ['A1 · Subtractive', 'A2 · Subtractive', 'B1 · Additive', 'B2 · Additive'], choiceShort: ['A1', 'A2', 'B1', 'B2'] });
add('wavelet', 'Wavelet', 'WAVELET', { curve: 'choice', fmt: 'choice', min: 0, max: 6, def: 2, structural: true,
  choices: ['Haar', 'Daubechies 2', 'Daubechies 4', 'Daubechies 8', 'Symlet 8', 'Coiflet 3', 'Daubechies 20'],
  choiceShort: ['HAAR', 'DB2', 'DB4', 'DB8', 'SYM8', 'COIF3', 'DB20'] });
add('a_wave', 'Source Wave', 'WAVE', { curve: 'choice', fmt: 'choice', min: 0, max: 5, def: 0, structural: true,
  choices: ['Saw', 'Square', 'Pulse', 'Triangle', 'Sine', 'Noise'], choiceShort: ['SAW', 'SQUARE', 'PULSE', 'TRI', 'SINE', 'NOISE'] });
add('a_width', 'Source Width', 'WIDTH', { min: 0.02, max: 0.98, def: 0.5, structural: true });
add('a_sparsity', 'Sparsity', 'SPARSITY', { min: 0, max: 1, def: 0, structural: true });
add('b_pattern', 'Atom Pattern', 'PATTERN', { curve: 'choice', fmt: 'choice', min: 0, max: 5, def: 0, structural: true,
  choices: ['Ramp', 'Mirror', 'Alternate', 'Walsh', 'Impulse', 'Random'], choiceShort: ['RAMP', 'MIRROR', 'ALT', 'WALSH', 'IMPULSE', 'RANDOM'] });
add('b_seed', 'Random Seed', 'SEED', { curve: 'int', fmt: 'int', min: 0, max: 99, def: 1, structural: true });
add('b_tilt', 'Tilt', 'TILT', { fmt: 'dbband', min: -24, max: 12, def: -6 });
for (let b = 1; b <= 11; b++) add('b_bar' + b, 'Band ' + b + ' Level', String(b), { min: 0, max: 1, def: 1 });
add('b_atk', 'Scale Attack', 'ATTACK', { curve: 'exp', fmt: 'sec', min: 0.001, max: 5, def: 0.005 });
add('b_spread', 'Attack Spread', 'SPREAD', { fmt: 'bipct', min: -1, max: 1, def: 0 });
add('b_body', 'Body Decay', 'BODY', { curve: 'exp', fmt: 'sec', min: 0.01, max: 20, def: 20 });
add('b_bright', 'Bright Decay', 'BRIGHT', { curve: 'exp', fmt: 'sec', min: 0.01, max: 20, def: 20 });
add('b_sus', 'Scale Sustain', 'SUSTAIN', { min: 0, max: 1, def: 1 });
add('f_type', 'Filter Type', 'TYPE', { curve: 'choice', fmt: 'choice', min: 0, max: 3, def: 0,
  choices: ['Low-pass', 'High-pass', 'Band-pass', 'Band-reject'], choiceShort: ['LOW-PASS', 'HIGH-PASS', 'BAND-PASS', 'BAND-REJ'] });
add('f_cutoff', 'Cutoff', 'CUTOFF', { fmt: 'band', min: 0, max: 12, def: 12 });   // 12 = fully open
add('f_slope', 'Slope', 'SLOPE', { fmt: 'dbband', min: 6, max: 96, def: 24 });
add('f_res', 'Resonance', 'RESO', { fmt: 'db', min: 0, max: 24, def: 0 });
add('f_keytrk', 'Key Tracking', 'KEY TRK', { min: 0, max: 1, def: 1 });
add('f_env', 'Envelope Amount', 'ENV AMT', { fmt: 'band', min: -11, max: 11, def: 0 });
add('f_vel', 'Velocity Amount', 'VEL AMT', { fmt: 'band', min: -6, max: 6, def: 0 });
add('p_center', 'Position', 'POSITION', { fmt: 'deg', min: 0, max: 1, def: 0 });
add('p_width', 'Window Width', 'WIDTH', { fmt: 'pct', min: 0.05, max: 1, def: 0.5 });
add('p_depth', 'Window Depth', 'DEPTH', { min: 0, max: 1, def: 0 });
add('amp_a', 'Amp Attack', 'ATTACK', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.003 });
add('amp_d', 'Amp Decay', 'DECAY', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.4 });
add('amp_s', 'Amp Sustain', 'SUSTAIN', { min: 0, max: 1, def: 0.8 });
add('amp_r', 'Amp Release', 'RELEASE', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.3 });
add('amp_vel', 'Amp Velocity', 'VELOCITY', { min: 0, max: 1, def: 0.5 });
add('mod_a', 'Mod Attack', 'ATTACK', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.003 });
add('mod_d', 'Mod Decay', 'DECAY', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.5 });
add('mod_s', 'Mod Sustain', 'SUSTAIN', { min: 0, max: 1, def: 0.3 });
add('mod_r', 'Mod Release', 'RELEASE', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.5 });
add('lfo_shape', 'LFO 1 Shape', 'SHAPE', { curve: 'choice', fmt: 'choice', min: 0, max: 4, def: 0,
  choices: ['Sine', 'Triangle', 'Saw', 'Square', 'Sample & Hold'], choiceShort: ['SINE', 'TRI', 'SAW', 'SQR', 'S&H'] });
add('lfo_rate', 'LFO 1 Rate', 'RATE', { curve: 'exp', fmt: 'hz', min: 0.05, max: 20, def: 4 });
add('lfo_pitch', 'LFO 1 to Pitch', 'PITCH', { fmt: 'cents', min: 0, max: 100, def: 0 });
add('lfo_cut', 'LFO 1 to Cutoff', 'CUTOFF', { fmt: 'bandamt', min: 0, max: 6, def: 0 });
add('lfo_pos', 'LFO 1 to Position', 'POSITION', { fmt: 'cyc', min: 0, max: 0.5, def: 0 });
add('v_oct', 'Octave', 'OCTAVE', { curve: 'int', fmt: 'int', min: -3, max: 3, def: 0 });
add('v_fine', 'Fine Tune', 'FINE', { fmt: 'cents', min: -100, max: 100, def: 0 });
add('v_voices', 'Voices', 'VOICES', { curve: 'int', fmt: 'int', min: 1, max: 16, def: 8 });
add('v_glide', 'Glide', 'GLIDE', { curve: 'pow2', fmt: 'sec', min: 0, max: 2, def: 0 });
add('v_unison', 'Unison', 'UNISON', { curve: 'int', fmt: 'int', min: 1, max: 4, def: 1 });
add('v_detune', 'Unison Detune', 'DETUNE', { fmt: 'cents', min: 0, max: 50, def: 12 });
add('v_width', 'Stereo Width', 'STEREO', { min: 0, max: 1, def: 0.7 });
add('fx_drive', 'Drive', 'DRIVE', { min: 0, max: 1, def: 0 });
add('fx_dtime', 'Delay Time', 'TIME', { curve: 'exp', fmt: 'sec', min: 0.01, max: 1, def: 0.35 });
add('fx_dfb', 'Delay Feedback', 'FEEDBACK', { min: 0, max: 0.9, def: 0.35 });
add('fx_dmix', 'Delay Mix', 'DLY MIX', { min: 0, max: 1, def: 0 });
add('fx_rsize', 'Reverb Size', 'SIZE', { min: 0, max: 1, def: 0.6 });
add('fx_rmix', 'Reverb Mix', 'REV MIX', { min: 0, max: 1, def: 0 });
add('master', 'Master Volume', 'VOLUME', { fmt: 'db', min: -36, max: 6, def: -3 });
add('bend', 'Pitch Bend', 'BEND', { fmt: 'bipct', min: -1, max: 1, def: 0, hidden: true });
add('modwheel', 'Mod Wheel', 'MOD', { min: 0, max: 1, def: 0, hidden: true });
add('hold', 'Sustain Pedal', 'HOLD', { min: 0, max: 1, def: 0, hidden: true });
// sub oscillator (beta 0.1): a pure sine/triangle/square one or two octaves below the note, not filtered
add('sub_level', 'Sub Level', 'LEVEL', { min: 0, max: 1, def: 0 });
add('sub_oct', 'Sub Octave', 'OCT', { curve: 'choice', fmt: 'choice', min: 0, max: 1, def: 0,
  choices: ['−1 octave', '−2 octaves'], choiceShort: ['−1', '−2'] });
add('sub_shape', 'Sub Shape', 'SHAPE', { curve: 'choice', fmt: 'choice', min: 0, max: 2, def: 0,
  choices: ['Sine', 'Triangle', 'Square'], choiceShort: ['SIN', 'TRI', 'SQR'] });
// portamento mode (beta 0.1): Off; Poly = polyphonic portamento (every voice glides from its own previous note;
// one note at a time = from the previous note); Legato only = glide only while another key is held
add('v_porta', 'Portamento', 'PORTA', { curve: 'choice', fmt: 'choice', min: 0, max: 2, def: 1,
  choices: ['Off', 'Poly', 'Legato only'], choiceShort: ['OFF', 'POLY', 'LEGATO'] });
// beta 0.2: a string-machine triple chorus.
add('ch_mix', 'Chorus', 'CHORUS', { min: 0, max: 1, def: 0 });
add('ch_rate', 'Chorus Rate', 'RATE', { curve: 'exp', fmt: 'hz', min: 0.1, max: 3, def: 0.7 });
add('ch_depth', 'Chorus Depth', 'DEPTH', { min: 0, max: 1, def: 0.6 });
// beta 0.3: WAVELET MORPH. The sound is also built with WAVELET 2 and crossfaded with the main one: position MORPH
// (0 = WAVELET, 1 = WAVELET 2) + LFO x LFO TO WAVELET + mod envelope x ENV TO WAVELET. Audible where the wavelet
// shapes the sound: scale filter (CUTOFF, RESO), sparsity, position window, and all of engine B. The defaults (all 0)
// keep the sound of older presets and Live Sets bit-identical.
add('wav2', 'Wavelet 2', 'WAVELET 2', { curve: 'choice', fmt: 'choice', min: 0, max: 6, def: 0, structural: true,
  choices: ['Haar', 'Daubechies 2', 'Daubechies 4', 'Daubechies 8', 'Symlet 8', 'Coiflet 3', 'Daubechies 20'],
  choiceShort: ['HAAR', 'DB2', 'DB4', 'DB8', 'SYM8', 'COIF3', 'DB20'] });
add('wmorph', 'Wavelet Morph', 'MORPH', { min: 0, max: 1, def: 0 });
add('lfo_wav', 'LFO 1 to Wavelet Morph', 'WAVELET', { min: 0, max: 1, def: 0 });
add('env_wav', 'Envelope to Wavelet Morph', 'ENV>WAV', { fmt: 'bipct', min: -1, max: 1, def: 0 });
// beta 0.3: LFO 2, a second free-running LFO on one parameter of the SCALE FILTER or the POSITION window (the TARGET menu
// next to its title, LFO2_TARGETS below). AMOUNT moves the target by up to ± half its range (kept in range; POSITION wraps
// round the cycle); 0 % (the default) leaves every older sound bit-identical.
add('lfo2_shape', 'LFO 2 Shape', 'SHAPE', { curve: 'choice', fmt: 'choice', min: 0, max: 4, def: 0,
  choices: ['Sine', 'Triangle', 'Saw', 'Square', 'Sample & Hold'], choiceShort: ['SINE', 'TRI', 'SAW', 'SQR', 'S&H'] });
add('lfo2_rate', 'LFO 2 Rate', 'RATE', { curve: 'exp', fmt: 'hz', min: 0.05, max: 20, def: 1 });
add('lfo2_amt', 'LFO 2 Amount', 'AMOUNT', { fmt: 'bipct', min: -1, max: 1, def: 0 });
// Okto MultiWave Synth beta 0.2: SUPERMODULATION. LFO 2 reaches every control of the wavelet oscillators (the choices from SPARSITY on are
// appended): SPARSITY and SOURCE WIDTH (the subtractive oscillators' tables are then built at several values and each voice
// crossfades between the two nearest, like SOURCE PHASE), TILT, ODD BARS, EVEN BARS and SCALE SUSTAIN (the additive ones), and the
// WAVELET MORPH position. LFO 1 gains three more amounts: SPARSITY, RESO and ENV>WAV (the envelope's reach on the morph).
add('lfo2_target', 'LFO 2 Target', 'TARGET', { curve: 'choice', fmt: 'choice', min: 0, max: 16, def: 0,
  choices: ['Cutoff', 'Slope', 'Resonance', 'Key Tracking', 'Envelope Amount', 'Velocity Amount', 'Position', 'Window Width', 'Window Depth',
    'Source Phase', 'Sparsity', 'Source Width', 'Tilt', 'Odd Bars', 'Even Bars', 'Scale Sustain', 'Wavelet Morph'],
  choiceShort: ['CUTOFF', 'SLOPE', 'RESO', 'KEY TRK', 'ENV AMT', 'VEL AMT', 'POSITION', 'WIDTH', 'DEPTH', 'PHASE', 'SPARSITY', 'SRC WIDTH',
    'TILT', 'ODD BARS', 'EVEN BARS', 'SCALE SUS', 'MORPH'] });
// beta 0.4: SOURCE PHASE (engine A). The source wave is moved inside the cycle before the wavelet transform: sample i is
// the wave at frac(i/N + phase) (the noise cycle is shifted by round(phase·N) samples). The transform is shift-variant, so
// the scale filter, the sparsity and the position window meet other atoms and the timbre changes: strongly with Haar and
// Daubechies 2/4, weakly with Daubechies 20; a shift by a multiple of 2^(12-b) samples leaves band b as it was. 0 (the
// default) is the source of beta 0.3: older sounds stay bit-identical. LFO 2 can move it (its last TARGET): the tables
// are then also built at PHASE_K positions round the cycle and each voice crossfades between the two nearest (core.js).
add('a_phase', 'Source Phase', 'PHASE', { fmt: 'deg', min: 0, max: 1, def: 0, structural: true });
// beta 0.6: TEMPO SYNC (VST plug-in: the host's tempo, 120 BPM when the host gives none). SYNC on: the delay's TIME and the
// LFOs' RATE become note values (T = triplet, x 2/3; D = dotted, x 1.5), listed by length (the knob goes one way); the
// delay holds up to 4 s. The web app has no tempo: it keeps seconds and hertz (its panel has no SYNC). Off by default.
const noteBeats = n => {   // '1/8 D' -> 0.75 beat (a quarter note = 1)
  const m = /^(\d+)\/(\d+)( [TD])?$/.exec(n);
  return 4 * m[1] / m[2] * (m[3] === ' T' ? 2 / 3 : m[3] === ' D' ? 1.5 : 1);
};
const DELAY_NOTES = ['1/32', '1/16 T', '1/16', '1/8 T', '1/16 D', '1/8', '1/4 T', '1/8 D', '1/4', '1/2 T', '1/4 D', '1/2', '1/2 D', '1/1'];
const LFO_NOTES = ['4/1', '2/1', '1/1', '1/2 D', '1/2', '1/4 D', '1/2 T', '1/4', '1/8 D', '1/4 T', '1/8', '1/16 D', '1/8 T', '1/16',
  '1/16 T', '1/32'];
const syncChoice = { curve: 'choice', fmt: 'choice', min: 0, max: 1, def: 0, choices: ['Off', 'On'], choiceShort: ['OFF', 'SYNC'] };
const notes = (list, def) => ({ curve: 'choice', fmt: 'choice', min: 0, max: list.length - 1, def: list.indexOf(def), choices: list,
  choiceShort: list.map(n => n.replace(' ', '')) });
add('fx_dsync', 'Delay Sync', 'SYNC', syncChoice);
add('fx_ddiv', 'Delay Time (sync)', 'TIME', notes(DELAY_NOTES, '1/8'));
add('lfo_sync', 'LFO 1 Sync', 'SYNC', syncChoice);
add('lfo_div', 'LFO 1 Rate (sync)', 'RATE', notes(LFO_NOTES, '1/4'));
add('lfo2_sync', 'LFO 2 Sync', 'SYNC', syncChoice);
add('lfo2_div', 'LFO 2 Rate (sync)', 'RATE', notes(LFO_NOTES, '1/4'));

// ---------------------------------------------------------------- Okto MultiWave Synth: the chord keyboard (beta 0.1)
// The chord types: label (the pads, the selector keys), suffix (the chord name after the root; "" = major), iv = the
// notes in semitones above the root. Append only: chord_type stores the index. The first twelve are on the selector keys.
const CHORDS = [
  { label: 'Maj', name: 'Major', suffix: '', iv: [0, 4, 7] },
  { label: 'Min', name: 'Minor', suffix: 'm', iv: [0, 3, 7] },
  { label: '7', name: 'Dominant 7', suffix: '7', iv: [0, 4, 7, 10] },
  { label: 'm7', name: 'Minor 7', suffix: 'm7', iv: [0, 3, 7, 10] },
  { label: 'Maj7', name: 'Major 7', suffix: 'maj7', iv: [0, 4, 7, 11] },
  { label: 'Sus2', name: 'Sus2', suffix: 'sus2', iv: [0, 2, 7] },
  { label: 'Sus4', name: 'Sus4', suffix: 'sus4', iv: [0, 5, 7] },
  { label: 'Dim', name: 'Diminished', suffix: 'dim', iv: [0, 3, 6] },
  { label: 'Aug', name: 'Augmented', suffix: 'aug', iv: [0, 4, 8] },
  { label: '5', name: 'Power chord', suffix: '5', iv: [0, 7] },
  { label: 'Add9', name: 'Add 9', suffix: 'add9', iv: [0, 4, 7, 14] },
  { label: 'Note', name: 'Single note', suffix: '', iv: [0] },
  { label: '6', name: 'Major 6', suffix: '6', iv: [0, 4, 7, 9] },
  { label: 'm6', name: 'Minor 6', suffix: 'm6', iv: [0, 3, 7, 9] },
  { label: 'm7b5', name: 'Half-diminished', suffix: 'm7b5', iv: [0, 3, 6, 10] },
  { label: 'Dim7', name: 'Diminished 7', suffix: 'dim7', iv: [0, 3, 6, 9] },
  { label: '9', name: 'Dominant 9', suffix: '9', iv: [0, 4, 7, 10, 14] },
  { label: 'm9', name: 'Minor 9', suffix: 'm9', iv: [0, 3, 7, 10, 14] },
  { label: 'Maj9', name: 'Major 9', suffix: 'maj9', iv: [0, 4, 7, 11, 14] },
  { label: '7sus4', name: '7 sus4', suffix: '7sus4', iv: [0, 5, 7, 10] },
  { label: 'mMaj7', name: 'Minor-major 7', suffix: 'mMaj7', iv: [0, 3, 7, 11] },
  { label: '6/9', name: '6/9', suffix: '6/9', iv: [0, 4, 7, 9, 14] },
];
// The chord type of each key of the selector octave, C to B: the white keys carry the major / bright family, the black keys
// the minor, altered or bare chords, so the left hand finds them without looking (C Maj, C# Min, D 7, D# m7, E Maj7,
// F Sus2, F# Dim, G Sus4, G# Aug, A Add9, A# 5, B Note).
const CHORD_KEYS = [0, 1, 2, 3, 4, 5, 7, 6, 8, 10, 9, 11];
const CHORD_OCTAVES = ['C1–B1', 'C2–B2', 'C3–B3', 'C4–B4', 'C5–B5'];   // selector octave k = MIDI 24 + 12 k .. + 11
add('chord_mode', 'Chord Keyboard', 'CHORD', { curve: 'choice', fmt: 'choice', min: 0, max: 1, def: 0, perf: true, choices: ['Off', 'On'], choiceShort: ['OFF', 'ON'] });
add('chord_type', 'Chord Type', 'TYPE', { curve: 'choice', fmt: 'choice', min: 0, max: CHORDS.length - 1, def: 0, perf: true,
  choices: CHORDS.map(c => c.name), choiceShort: CHORDS.map(c => c.label) });
add('chord_oct', 'Chord Keys Octave', 'KEYS OCT', { curve: 'choice', fmt: 'choice', min: 0, max: CHORD_OCTAVES.length - 1, def: 2, perf: true,
  choices: CHORD_OCTAVES, choiceShort: CHORD_OCTAVES.map(s => s.slice(0, 2)) });
add('chord_voicing', 'Chord Voicing', 'VOICING', { curve: 'choice', fmt: 'choice', min: 0, max: 1, def: 1, perf: true, choices: ['Stacked', 'Folded'], choiceShort: ['STACKED', 'FOLDED'] });
// beta 0.2: BASS is on by default: a bass note two octaves below the chord's root plays with the chord, a little louder
add('chord_bass', 'Chord Bass', 'BASS', { curve: 'choice', fmt: 'choice', min: 0, max: 1, def: 1, perf: true, choices: ['Off', 'On'], choiceShort: ['OFF', 'BASS'] });
add('chord_strum', 'Chord Strum', 'STRUM', { fmt: 'sec', min: 0, max: 0.1, def: 0, perf: true });
// ---------------------------------------------------------------- Okto MultiWave Synth: four oscillators (beta 0.1)
// Two oscillators per engine: A1 A2 (wavelet subtractive) and B1 B2 (wavelet additive). Each one is a complete little voice:
// its own wavelet and source (or atom pattern and drawbars), SCALE FILTER, POSITION window, LEVEL, tuning (octave, semitones,
// cents), an optional OWN ENVELOPE (it multiplies the AMP ENVELOPE: a short one gives a percussive attack) and a PITCH
// ENVELOPE (the pitch falls from AMOUNT semitones in TIME seconds). A1 and B1 are the two oscillators of the Wavelet
// Synthesizer beta 0.7 and keep its parameters (a_wave, f_cutoff, b_bar1 ...), so its 22 TOP Sounds are unchanged; their
// level, tuning and envelope parameters are new, and so are the filter and window of B1 (they were shared with A1).
// The SLOTS table maps the fields of an oscillator to its parameters: the engine and both panels are written once for any slot.
const WAVELET_KEYS = { A: { wavelet: 'wavelet', wave: 'a_wave', width: 'a_width', sparsity: 'a_sparsity', phase: 'a_phase' },
  B: { wavelet: 'wavelet', pattern: 'b_pattern', seed: 'b_seed', tilt: 'b_tilt', atk: 'b_atk', spread: 'b_spread', body: 'b_body',
    bright: 'b_bright', sus: 'b_sus' } };
for (let b = 1; b <= 11; b++) WAVELET_KEYS.B['bar' + b] = 'b_bar' + b;
const FILTER_KEYS = { ftype: 'f_type', fcut: 'f_cutoff', fslope: 'f_slope', fres: 'f_res', fkey: 'f_keytrk', fenv: 'f_env', fvel: 'f_vel',
  pcen: 'p_center', pwid: 'p_width', pdep: 'p_depth' };
const SLOT_IDS = ['a1', 'a2', 'b1', 'b2'];
const SLOTS = [];
const paramByKey = k => P.find(p => p.key === k);
// clones the parameter `base` (a template from the Wavelet Synthesizer's list) as key `key` of slot `name`
function cloneParam(key, name, base) {
  const t = paramByKey(base);
  const o = Object.assign({}, t); delete o.key; delete o.name; delete o.short;
  add(key, name + ' ' + t.name, t.short, o);
}
for (const id of SLOT_IDS) {
  const mode = id[0] === 'a' ? 0 : 1, name = id.toUpperCase(), k = {};
  // the oscillator's tone: the Wavelet Synthesizer's own keys for A1 and B1 (A1 also its filter and window), clones for the others
  // (B1 has its own wavelet, filter and window: it shared A1's)
  for (const [f, base] of Object.entries(WAVELET_KEYS[mode ? 'B' : 'A'])) {
    if (id === 'a1' || (id === 'b1' && f !== 'wavelet')) k[f] = base; else { k[f] = id + '_' + f; cloneParam(k[f], name, base); }
  }
  for (const [f, base] of Object.entries(FILTER_KEYS)) {
    if (id === 'a1') k[f] = base; else { k[f] = id + '_' + f; cloneParam(k[f], name, base); }
  }
  // level, tuning, own envelope, pitch envelope (all new)
  k.lvl = id + '_lvl'; add(k.lvl, name + ' Level', name, { min: 0, max: 1, def: id === 'a1' ? 1 : 0 });
  k.oct = id + '_oct'; add(k.oct, name + ' Octave', 'OCTAVE', { curve: 'int', fmt: 'int', min: -3, max: 3, def: 0 });
  k.semi = id + '_semi'; add(k.semi, name + ' Semitones', 'SEMI', { curve: 'int', fmt: 'semi', min: -12, max: 12, def: 0 });
  k.fine = id + '_fine'; add(k.fine, name + ' Fine Tune', 'FINE', { fmt: 'cents', min: -100, max: 100, def: 0 });
  k.eon = id + '_eon'; add(k.eon, name + ' Own Envelope', 'OWN ENV', { curve: 'choice', fmt: 'choice', min: 0, max: 1, def: 0,
    choices: ['Off', 'On'], choiceShort: ['OFF', 'ON'] });
  // the four envelope parameters stay consecutive (the ADSR display reads param .. param + 3)
  k.ea = id + '_ea'; add(k.ea, name + ' Env Attack', 'ATTACK', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.001 });
  k.ed = id + '_ed'; add(k.ed, name + ' Env Decay', 'DECAY', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.25 });
  k.es = id + '_es'; add(k.es, name + ' Env Sustain', 'SUSTAIN', { min: 0, max: 1, def: 0 });
  k.er = id + '_er'; add(k.er, name + ' Env Release', 'RELEASE', { curve: 'exp', fmt: 'sec', min: 0.001, max: 10, def: 0.15 });
  k.pamt = id + '_pamt'; add(k.pamt, name + ' Pitch Env Amount', 'PITCH ENV', { curve: 'lin', fmt: 'semi', min: -48, max: 48, def: 0 });
  k.ptime = id + '_ptime'; add(k.ptime, name + ' Pitch Env Time', 'TIME', { curve: 'exp', fmt: 'sec', min: 0.005, max: 2, def: 0.08 });
  SLOTS.push({ id, mode, name, k });
}
// beta 0.2 (appended after the oscillators' clones): three more amounts of LFO 1. SPARSITY moves every subtractive oscillator's
// sparsity by ± the amount (its tables are built at several sparsities, see core.js), RESO the resonance of every scale filter by ±
// the amount in dB (kept in 0 .. 24), ENV>WAV makes the reach of the mod envelope on the WAVELET MORPH swing with the LFO
// (env_wav + amount · LFO).
add('lfo_sp', 'LFO 1 to Sparsity', 'SPARSITY', { fmt: 'pct', min: 0, max: 1, def: 0 });
add('lfo_res', 'LFO 1 to Resonance', 'RESO', { fmt: 'db', min: 0, max: 24, def: 0 });
add('lfo_ew', 'LFO 1 to Envelope>Wavelet', 'ENV>WAV', { fmt: 'pct', min: 0, max: 1, def: 0 });
// beta 0.2: ORIENTAL KEYBOARD, quarter tones as on the oriental keyboards of Yamaha. A three-position switch (TUNING: Western, Arabic,
// Turkish) re-tunes the keys; MAQAM chooses the scale and TONIC the key it starts on. Arabic: 24-tone equal temperament (quarter tones
// of 50 cents); Turkish: the 53-comma system (a comma = 1200/53 = 22.64 cents, the Arel-Ezgi-Uzdilek values). A key that is not a
// degree of the scale keeps its equal-tempered pitch, so the sharps and flats stay playable. Each key's pitch is moved from its
// equal-tempered value by MICRO_TABLES[tuning][scale][semitones above the tonic] cents, whatever plays it (a key, a chord's notes).
// A performance setting, like CHORD MODE: never in a preset, off in the demo and in EVALUATE SOUNDS.
const COMMA = 1200 / 53;
const MICRO_SCALES = [   // degrees: semitone above the tonic -> cents (Arabic) / commas (Turkish) above the tonic
  { name: 'Rast', short: 'RAST', ar: { 2: 200, 4: 350, 5: 500, 7: 700, 9: 900, 11: 1050 }, tr: { 2: 9, 4: 17, 5: 22, 7: 31, 9: 40, 11: 48 } },
  { name: 'Bayati / Uşşak', short: 'BAYATI', ar: { 2: 150, 3: 300, 5: 500, 7: 700, 8: 800, 10: 1000 }, tr: { 2: 8, 3: 13, 5: 22, 7: 31, 8: 35, 10: 44 } },
  { name: 'Hijaz / Hicaz', short: 'HIJAZ', ar: { 1: 100, 4: 400, 5: 500, 7: 700, 8: 800, 10: 1000 }, tr: { 1: 5, 4: 17, 5: 22, 7: 31, 8: 36, 10: 44 } },
  { name: 'Saba', short: 'SABA', ar: { 2: 150, 3: 300, 4: 400, 7: 700, 8: 800, 10: 1000 }, tr: { 2: 8, 3: 13, 4: 18, 7: 31, 8: 35, 10: 44 } },
  { name: 'Nahawand / Buselik', short: 'NAHAWAND', ar: { 2: 200, 3: 300, 5: 500, 7: 700, 8: 800, 10: 1000 }, tr: { 2: 9, 3: 13, 5: 22, 7: 31, 8: 35, 10: 44 } },
];
const MICRO_TABLES = ['ar', 'tr'].map(t => MICRO_SCALES.map(s => {
  const o = new Array(12).fill(0);
  for (const [pc, v] of Object.entries(s[t])) o[+pc] = (t === 'ar' ? v : v * COMMA) - 100 * pc;   // cents above or below the equal-tempered key
  return o;
}));
const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
add('mt_mode', 'Oriental Tuning', 'TUNING', { curve: 'choice', fmt: 'choice', min: 0, max: 2, def: 0, perf: true,
  choices: ['Western', 'Arabic', 'Turkish'], choiceShort: ['WEST', 'ARAB', 'TURK'] });
add('mt_scale', 'Oriental Scale', 'MAQAM', { curve: 'choice', fmt: 'choice', min: 0, max: MICRO_SCALES.length - 1, def: 0, perf: true,
  choices: MICRO_SCALES.map(s => s.name), choiceShort: MICRO_SCALES.map(s => s.short) });
add('mt_tonic', 'Oriental Tonic', 'TONIC', { curve: 'choice', fmt: 'choice', min: 0, max: 11, def: 0, perf: true, choices: NOTE_LETTERS, choiceShort: NOTE_LETTERS });

const DELAY_BEATS = DELAY_NOTES.map(noteBeats), LFO_BEATS = LFO_NOTES.map(noteBeats);
for (const b of [DELAY_BEATS, LFO_BEATS]) for (let i = 1; i < b.length; i++)
  if ((b === DELAY_BEATS) !== (b[i] > b[i - 1])) throw new Error('note values must be listed by length');

// the parameters LFO 2 can move, in the order of the TARGET choices (all linear: the move is in plain units). With four oscillators
// the target is a ROLE of an oscillator (cutoff, slope ...): LFO 2 moves that parameter of every oscillator that has it
// (SOURCE PHASE: the subtractive oscillators only), by the same amount; LFO2_TARGETS names the parameters of A1.
// beta 0.2: the targets after SOURCE PHASE. LFO2_TARGETS[i] is the parameter whose range gives the size of the move (the first oscillator
// that has the role; ODD BARS / EVEN BARS: a drawbar; MORPH: the global WAVELET MORPH) and ROLES[i] the role: the field of an oscillator
// it moves ("odd", "even" and "morph" have no single field: the engine moves the drawbars of odd / even bands and the morph itself).
const LFO2_TARGETS = ['f_cutoff', 'f_slope', 'f_res', 'f_keytrk', 'f_env', 'f_vel', 'p_center', 'p_width', 'p_depth', 'a_phase',
  'a_sparsity', 'a_width', 'b_tilt', 'b_bar1', 'b_bar2', 'b_sus', 'wmorph'];
const ROLES = ['fcut', 'fslope', 'fres', 'fkey', 'fenv', 'fvel', 'pcen', 'pwid', 'pdep', 'phase', 'sparsity', 'width', 'tilt', 'odd', 'even', 'sus', 'morph'];
const LFO2_ROLE = ROLES.slice();   // target i moves role i

const idx = Object.fromEntries(P.map((p, i) => [p.key, i]));
if (LFO2_TARGETS.length !== P[idx.lfo2_target].choices.length || LFO2_TARGETS.length !== ROLES.length || P[idx.lfo2_target].max !== ROLES.length - 1 ||
    LFO2_TARGETS.some(k => !(k in idx) || (P[idx[k]].curve || 'lin') !== 'lin'))
  throw new Error('LFO2_TARGETS must match the lfo2_target choices and be linear parameters');
for (const r of ROLES) {   // a role has the same range in every oscillator that has it (LFO 2 moves them by the same amount)
  const first = SLOTS.find(s => s.k[r]);
  for (const s of SLOTS) {
    if (!s.k[r]) continue;
    const a = P[idx[first.k[r]]], b = P[idx[s.k[r]]];
    if (a.min !== b.min || a.max !== b.max) throw new Error('role ' + r + ': ranges differ in ' + s.id);
  }
}
for (const s of SLOTS) for (const [i, f] of ['ed', 'es', 'er'].entries()) if (idx[s.k[f]] !== idx[s.k.ea] + i + 1)
  throw new Error('own envelope parameters of ' + s.id + ' must be consecutive');
for (const s of SLOTS) if (s.mode === 1) for (let b = 0; b < 11; b++) if (idx[s.k.bar1] + b !== idx[s.k.bar1.replace('1', String(b + 1))])
  throw new Error('drawbars of ' + s.id + ' must be consecutive');

// ---------------------------------------------------------------- layout
// Sections are cards; widget coordinates are relative to their section. A section with `view` n (0..3 = A1 A2 B1 B2) is shown
// while that oscillator is the one shown on the panel (the osc_view parameter); -1 = always. `vis` (a parameter) + `visOn`:
// the section is shown only while that parameter is on / off (the chord card).
// widget types: knobL knobM knobS knobT seg step drawbar scope scalogram atom source
//               window adsr leds fxheads keyboard wheels logo presets manual download meter zoom credit menu toggle label
//               chordpads chordname strumplate evaluate (Okto MultiWave Synth)
// widget fields: only 'web' / 'vst' (shown in one of them), vis + visOn (shown while that parameter is on / off,
// the plug-in's SYNC), style 'value' (a knob labelled with its value: note values), text (toggle, label, menu caption)
const S = [];
function section(id, title, x, y, w, h, view, widgets, opts) { S.push(Object.assign({ id, title, x, y, w, h, view, widgets }, opts || {})); }
const kn = (key, x, y, t) => ({ type: t || 'knobM', param: key, x, y, w: t === 'knobL' ? 80 : 52, h: t === 'knobL' ? 92 : 60 });
const row = (keys, x0, y) => keys.map((k, i) => kn(k, x0 + i * 52, y));
const CHORD_H = 120;   // the chord card (shown by CHORD MODE) adds this much to the panel's height

section('header', '', 0, 0, 1100, 48, -1, [
  { type: 'logo', x: 16, y: 8, w: 200, h: 32 },
  { type: 'zoom', x: 222, y: 14, w: 50, h: 20 },
  { type: 'seg', param: 'osc_view', style: 'engine', x: 296, y: 9, w: 224, h: 30 },   // the four oscillators: A1 A2 | B1 B2
  { type: 'presets', x: 526, y: 9, w: 220, h: 30 },
  { type: 'evaluate', x: 752, y: 9, w: 104, h: 30 },
  { type: 'download', only: 'web', x: 862, y: 9, w: 68, h: 30 },   // the plug-in has SAVE PRESET there
  { type: 'manual', x: 936, y: 9, w: 68, h: 30 },
  { type: 'knobS', param: 'master', x: 1028, y: 6, w: 36, h: 36 },
  { type: 'meter', x: 1072, y: 9, w: 14, h: 30 },
]);

// ---- the oscillator shown (one card of each kind per oscillator, all at the same place)
const bars = (s) => { const o = []; for (let b = 1; b <= 11; b++) o.push({ type: 'drawbar', param: s.k.bar1.replace('1', String(b)), x: 12 + (b - 1) * 30, y: 70, w: 24, h: 98 }); return o; };
SLOTS.forEach((s, v) => {
  const K = s.k;
  if (s.mode === 0) {
    section('tone_' + s.id, `OSC ${s.name} · WAVELET SUBTRACTIVE`, 12, 56, 544, 260, v, [
      { type: 'seg', param: K.wave, x: 12, y: 32, w: 520, h: 28 },
      { type: 'atom', x: 12, y: 70, w: 250, h: 104 },
      { type: 'step', param: K.wavelet, x: 12, y: 180, w: 250, h: 28 },
      { type: 'step', param: 'wav2', x: 12, y: 214, w: 250, h: 28 },   // WAVELET MORPH (all oscillators)
      { type: 'source', x: 276, y: 70, w: 126, h: 64 },
      kn(K.phase, 408, 70),
      kn('wmorph', 470, 64), kn('env_wav', 470, 122),
      kn(K.width, 280, 146, 'knobL'),
      kn(K.sparsity, 376, 146, 'knobL'),
      kn(K.lvl, 470, 180),
    ]);
  } else {
    section('tone_' + s.id, `OSC ${s.name} · WAVELET ADDITIVE`, 12, 56, 544, 260, v, [
      { type: 'seg', param: K.pattern, x: 12, y: 32, w: 520, h: 28 },
      ...bars(s),
      { type: 'atom', x: 356, y: 70, w: 176, h: 64 },
      { type: 'step', param: K.wavelet, x: 356, y: 140, w: 176, h: 28 },
      kn(K.tilt, 356, 180), kn(K.seed, 412, 180), kn(K.lvl, 470, 180),
      ...row([K.atk, K.spread, K.body, K.bright, K.sus], 12, 198),
    ]);
  }
  section('filter_' + s.id, 'SCALE FILTER', 12, 324, 336, 140, v, [
    { type: 'seg', param: K.ftype, x: 12, y: 30, w: 312, h: 24 },
    ...row([K.fcut, K.fslope, K.fres, K.fkey, K.fenv, K.fvel], 12, 64),
  ]);
  section('position_' + s.id, 'POSITION', 356, 324, 180, 140, v, [
    { type: 'window', x: 12, y: 30, w: 156, h: 24 },
    ...row([K.pcen, K.pwid, K.pdep], 12, 64),
  ]);
  // tuning, the oscillator's own envelope (on top of the AMP ENVELOPE) and its pitch envelope
  section('osc_' + s.id, `OSC ${s.name} · TUNE · OWN ENVELOPE · PITCH ENVELOPE`, 544, 324, 544, 140, v, [
    { type: 'label', text: 'TUNE', x: 12, y: 32, w: 80, h: 14 },
    kn(K.oct, 12, 64), kn(K.semi, 64, 64), kn(K.fine, 116, 64),
    { type: 'toggle', param: K.eon, text: 'OWN ENVELOPE', x: 184, y: 28, w: 104, h: 22 },
    { type: 'adsr', env: 'own', param: K.ea, x: 296, y: 28, w: 112, h: 22 },
    ...row([K.ea, K.ed, K.es, K.er], 184, 64),
    { type: 'label', text: 'PITCH ENVELOPE', x: 420, y: 32, w: 110, h: 14 },
    kn(K.pamt, 420, 64), kn(K.ptime, 472, 64),
  ]);
});

// ---- always shown: the mixer of the four oscillators with the sub oscillator, the scope, envelopes, LFOs, effects, voice, keys
section('mix', 'OSC MIX', 564, 56, 124, 260, -1, [
  kn('a1_lvl', 4, 30), kn('a2_lvl', 64, 30), kn('b1_lvl', 4, 98), kn('b2_lvl', 64, 98),
  { type: 'label', text: 'SUB OSC', x: 8, y: 170, w: 100, h: 14 },
  { type: 'knobT', param: 'sub_level', x: 2, y: 192, w: 40, h: 46 },
  { type: 'knobT', param: 'sub_oct', x: 42, y: 192, w: 40, h: 46 },
  { type: 'knobT', param: 'sub_shape', x: 82, y: 192, w: 40, h: 46 },
]);
// beta 0.2: the oriental tuning's MAQAM and TONIC sit under the scalogram and show while TUNING (next to the keyboard) is not Western
section('display', 'SCOPE', 696, 56, 392, 260, -1, [
  { type: 'scope', x: 12, y: 30, w: 368, h: 80 },
  { type: 'label', text: 'SCALOGRAM', x: 12, y: 114, w: 368, h: 14 },
  { type: 'scalogram', x: 12, y: 130, w: 368, h: 72 },
  { type: 'menu', param: 'mt_scale', text: 'MAQAM', x: 12, y: 228, w: 176, h: 24, vis: 'mt_mode', visOn: true },
  { type: 'label', text: 'TONIC', x: 200, y: 212, w: 100, h: 14, vis: 'mt_mode', visOn: true },
  { type: 'step', param: 'mt_tonic', x: 200, y: 226, w: 100, h: 26, vis: 'mt_mode', visOn: true },
]);
section('ampenv', 'AMP ENVELOPE', 12, 472, 284, 128, -1, [
  { type: 'adsr', env: 'amp', x: 12, y: 30, w: 260, h: 26 },
  ...row(['amp_a', 'amp_d', 'amp_s', 'amp_r', 'amp_vel'], 12, 62),
]);
section('modenv', 'MOD ENVELOPE', 304, 472, 284, 128, -1, [
  { type: 'adsr', env: 'mod', x: 12, y: 30, w: 260, h: 26 },
  ...row(['mod_a', 'mod_d', 'mod_s', 'mod_r'], 38, 62),
]);
// the effects in the order of the sound: saturation, chorus, ping-pong delay, reverb; the plug-in's SYNC buttons swap RATE / TIME
// for a note value
const synced = (key, div, sync, x, y) => [Object.assign(kn(key, x, y), { vis: sync, visOn: false }),
  Object.assign(kn(div, x, y), { vis: sync, visOn: true, only: 'vst', style: 'value' })];
const syncBtn = (key, x, y) => ({ type: 'toggle', param: key, text: 'SYNC', only: 'vst', x, y, w: 42, h: 17 });
section('fx', 'EFFECTS', 596, 472, 492, 128, -1, [
  { type: 'fxheads', x: 0, y: 30, w: 492, h: 18 },
  syncBtn('fx_dsync', 332, 27),
  ...row(['fx_drive', 'ch_mix', 'ch_rate', 'ch_depth'], 12, 58),
  ...synced('fx_dtime', 'fx_ddiv', 'fx_dsync', 220, 58),
  ...row(['fx_dfb', 'fx_dmix', 'fx_rsize', 'fx_rmix'], 272, 58),
]);
// beta 0.2: LFO 1 has seven amounts (PITCH CUTOFF POSITION WAVELET SPARSITY RESO ENV>WAV), so its card is wider; LFO 2 and VOICE are narrower
section('lfo', 'LFO 1', 12, 608, 440, 128, -1, [
  { type: 'seg', param: 'lfo_shape', x: 12, y: 28, w: 260, h: 24 },
  syncBtn('lfo_sync', 386, 6),
  ...synced('lfo_rate', 'lfo_div', 'lfo_sync', 12, 58),
  ...row(['lfo_pitch', 'lfo_cut', 'lfo_pos', 'lfo_wav', 'lfo_sp', 'lfo_res', 'lfo_ew'], 64, 58),
]);
section('lfo2', 'LFO 2', 460, 608, 246, 128, -1, [
  { type: 'seg', param: 'lfo2_shape', x: 12, y: 28, w: 222, h: 24 },
  syncBtn('lfo2_sync', 192, 6),
  ...synced('lfo2_rate', 'lfo2_div', 'lfo2_sync', 12, 58),
  kn('lfo2_amt', 64, 58),
  { type: 'menu', param: 'lfo2_target', text: 'TARGET', x: 120, y: 78, w: 116, h: 24 },
]);
section('voice', 'VOICE', 714, 608, 374, 128, -1, [
  { type: 'seg', param: 'v_porta', x: 76, y: 6, w: 150, h: 18 },
  { type: 'leds', x: 236, y: 6, w: 128, h: 18 },
  ...['v_oct', 'v_fine', 'v_voices', 'v_glide', 'v_unison', 'v_detune', 'v_width'].map((k, i) => kn(k, 10 + i * 51, 40)),
]);
// the keyboard row: CHORD MODE (switches the chord card on), the wheels, the keyboard (C2-C7, 36 white keys)
section('keys', '', 0, 744, 1100, 112, -1, [
  { type: 'toggle', param: 'chord_mode', text: 'CHORD MODE', x: 12, y: 6, w: 100, h: 34 },
  // beta 0.2: BASS (on by default) sits under CHORD MODE and shows with it: a bass note two octaves below the root, a little louder
  { type: 'toggle', param: 'chord_bass', text: 'BASS', x: 12, y: 40, w: 100, h: 26, vis: 'chord_mode', visOn: true },
  // beta 0.2: the three-position TUNING switch (Western | Arabic | Turkish): the oriental keyboard with quarter tones
  { type: 'seg', param: 'mt_mode', x: 12, y: 72, w: 100, h: 20 },
  { type: 'wheels', x: 122, y: 0, w: 60, h: 100 },
  { type: 'keyboard', x: 190, y: 0, w: 898, h: 100 },
  { type: 'credit', x: 14, y: 97, w: 170, h: 15 },
]);
// Okto MultiWave Synth: the CHORD KEYBOARD card, shown below the keyboard while CHORD MODE is on (the panel grows by CHORD_H):
// the twelve chord pads (the white-key family above, the black-key family below, as on the selector octave); the chord
// shown (name and notes); KEYS OCT, VOICING, BASS, STRUM; and the strum plate: drag across it to strum the chord, as on an
// electronic chord harp.
section('chord', 'CHORD KEYBOARD', 12, 864, 1076, 104, -1, [
  { type: 'chordpads', x: 12, y: 26, w: 364, h: 70 },
  { type: 'chordname', x: 388, y: 26, w: 170, h: 70 },
  { type: 'label', text: 'KEYS OCT', x: 570, y: 8, w: 110, h: 14 },
  { type: 'step', param: 'chord_oct', x: 570, y: 26, w: 110, h: 26 },
  { type: 'seg', param: 'chord_voicing', x: 570, y: 64, w: 110, h: 24 },
  kn('chord_strum', 746, 22),
  { type: 'strumplate', x: 812, y: 26, w: 252, h: 70 },
], { vis: 'chord_mode', visOn: true });

// ---------------------------------------------------------------- presets
// The 22 TOP Sounds of the Wavelet Synthesizer beta 0.7 (tools/presets_top.js, in that version's parameters) are converted to the
// oscillators of this version without changing the sound: the balance ab_mix becomes the levels of A1 and B1 (1 - mix, mix) and
// B1 gets the wavelet, filter and window the two engines shared; the panel shown (engine) becomes the oscillator shown.
function convertLegacy(v0) {
  const v = Object.assign({}, v0);
  const eng = v.engine || 0, mix = v.ab_mix !== undefined ? v.ab_mix : eng;
  delete v.engine; delete v.ab_mix;
  v.osc_view = eng * 2;
  v.a1_lvl = 1 - mix; v.b1_lvl = mix;
  for (const f of ['wavelet', ...Object.keys(FILTER_KEYS)]) {
    const src = SLOTS[0].k[f], dst = SLOTS[2].k[f];
    if (v[src] !== undefined) v[dst] = v[src];
  }
  return v;
}
// The new presets (tools/presets_new.js, written with tools/make_presets.js): { name, cat, v } in this version's parameters,
// numbered in their names ("012 A1A2 · Glass Bell": the oscillators they use) for the listening test (EVALUATE SOUNDS).
let OLD_RAW = [], SUPER_RAW = [];
try { OLD_RAW = require('./presets_new.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }   // the 200 presets of beta 0.1 (001-200), unchanged
// beta 0.2: 300 more (201-500, tools/supermod/build.js); MW_NO_SUPER=1 leaves them out (the builder measures the others)
if (!process.env.MW_NO_SUPER) try { SUPER_RAW = require('./presets_super.js'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
const NEW_RAW = [...SUPER_RAW, ...OLD_RAW];   // the presets EVALUATE SOUNDS rates: the new 300 first, then the 200 of beta 0.1
const DESCRIPTIONS = {};   // the new presets' one-line descriptions (the evaluation window shows them)
for (const r of NEW_RAW) if (r.desc) DESCRIPTIONS[r.name] = r.desc;

// Categories (preset menu groups, like the banks of a hardware synthesizer), in menu order.
// (beta 0.2: SuperModulation first: the presets whose life is the LFOs moving the wavelet-domain controls)
const CATEGORIES = ['SuperModulation', 'Bass', 'Lead', 'Keys', 'Organ', 'Pad', 'Strings', 'Brass & Wind', 'Pluck', 'Bells & Mallets', 'FX', 'Drums & Perc'];
const TOP_RAW = require('./presets_top.js');
const PRESETS = [];
for (const r of TOP_RAW) PRESETS.push({ name: r.name, cat: r.cat, v: convertLegacy(r.v) });
const TOP_COUNT = PRESETS.length;
for (const r of NEW_RAW) PRESETS.push({ name: r.name, cat: r.cat, v: r.v });
// the factory order is each category's order too (TOP Sounds first, then the new presets, then 001 ...). Beta 0.2: "Wobble Bass" is the first of the
// Bass list (it comes right after the TOP Sounds in the order of the lists; the numbering of the presets does not change)
{
  const order = PRESETS.map((p, i) => i), wob = PRESETS.findIndex(p => p.cat === 'Bass' && /· Wobble Bass$/.test(p.name));
  if (wob >= 0) { order.splice(wob, 1); order.splice(TOP_COUNT, 0, wob); }
  order.forEach((idx, rank) => { PRESETS[idx].rank = rank; });
}
for (const p of PRESETS) if (!CATEGORIES.includes(p.cat)) throw new Error(`preset ${p.name}: no category`);
if (new Set(PRESETS.map(p => p.name)).size !== PRESETS.length) throw new Error('preset names must be unique');
const DEFAULT_PRESET = 'A · Warm Pad';   // sound loaded when the app / a new plugin instance opens
// The preset tour of the demo (the default piece, about one preset every 4 s; it starts at 7.8 s, so the first two are not heard):
// the TOP Sounds mixed one by one with new presets that show the oscillators at work (a TOP Sound by its name, a new preset as
// "new:<title>": the number of its name may change). 29 presets are heard.
const TOUR_PICKS = ['A · Warm Pad', 'A · Wavelet Lead',
  'A · Noise Wash Pad', 'new:Velvet Pad', 'B · Mirror Sub Bass', 'B · Theatre Organ', 'new:Tine E-Piano', 'B · Space Choir',
  'new:Crystal Choir', 'A · Wavelet Lead', 'new:Classic Saw Lead', 'B · Flute Lead', 'new:Ensemble Strings', 'B · Choir Pad',
  'new:Harp', 'A · Wave Brass', 'new:Silk Cloud', 'A · Wave Attack Lead', 'new:Marimba', 'A · Warm Pad', 'new:Rhodes Warm',
  'AB · Glass Choir', 'new:Full Drawbar Organ', 'A · Dub Echo Lead', 'new:Solo Violin', 'A · Wave Pulse Lead', 'new:Brass Section',
  'A · Cello Section', 'new:Dream Keys', 'AB · Silk Strings', 'new:Orchestra Swell'];
const TOUR = TOUR_PICKS.map(n => {
  const p = n.startsWith('new:') ? PRESETS.slice(TOP_COUNT).find(q => q.name.slice(4).split(' · ')[1] === n.slice(4)) : PRESETS.find(q => q.name === n);
  if (!p) throw new Error('TOUR: preset not found: ' + n);
  return p.name;
});
if (!PRESETS.some(p => p.name === DEFAULT_PRESET)) throw new Error('DEFAULT_PRESET not found: ' + DEFAULT_PRESET);

// Validate preset keys and ranges at generation time.
for (const pr of PRESETS) for (const [k, v] of Object.entries(pr.v)) {
  if (!(k in idx)) throw new Error(`preset ${pr.name}: unknown param ${k}`);
  const p = P[idx[k]];
  if (v < p.min || v > p.max) throw new Error(`preset ${pr.name}: ${k}=${v} out of range`);
  if (p.perf) throw new Error(`preset ${pr.name}: ${k} is a performance setting, not a sound`);
}
for (const s of S) {
  if (s.vis && !(s.vis in idx)) throw new Error('layout: unknown section vis param ' + s.vis);
  for (const w of s.widgets) {
    if (w.param && !(w.param in idx)) throw new Error('layout: unknown param ' + w.param);
    if (w.vis && !(w.vis in idx)) throw new Error('layout: unknown vis param ' + w.vis);
    if (w.only && w.only !== 'web' && w.only !== 'vst') throw new Error('layout: only web or vst');
  }
}

module.exports = { DEVICE, CHORD_H, APP, DEFAULT_PRESET, PARAMS: P, INDEX: idx, SECTIONS: S, PRESETS, TOP: TOP_COUNT, CATEGORIES,
  LFO2_TARGETS, LFO2_ROLE, ROLES, SLOTS, DELAY_BEATS, LFO_BEATS, CHORDS, CHORD_KEYS, MICRO_TABLES, NEW_FIRST: TOP_COUNT, NEW_COUNT: NEW_RAW.length, DESCRIPTIONS, TOUR };
