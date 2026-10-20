// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// The two user manuals of Okto MultiWave Synth: Manual A (the subtractive oscillators A1 A2) and Manual B (the additive oscillator B1).
// The chapters they share are written once; the controls tables, ranges and defaults come from the spec (`tools/spec.js`), so they never
// drift from the instrument. The deeper theory of the wavelet engines is in the Wavelet Synthesizer's manuals (linked at the end).
'use strict';
const L = require('./lib.js');
const { ctl, kbd, P, controls, table, tip, note, warn, deep, fig, figInline, annotated, C, PK, SPEC } = L;
const TOP_DESC = require('./top_desc.js');

const SL = SPEC.SLOTS, isA = E => E === 'a';
// the spec's slot tables hold parameter indices: the parameter keys of each oscillator's fields
const SLK = SL.map(sl => Object.fromEntries(Object.entries(sl.k).map(([f, i]) => [f, SPEC.PARAMS[i].key])));
const WS_MANUALS = 'https://pierrearnaudguyot.github.io/Free-Wavelet-Synthesizer-VST/web/manual/';
const VST_URL = (() => {
  const m = /VST_RELEASES\s*=\s*'([^']+)'/.exec(require('fs').readFileSync(require('path').join(L.ROOT, 'web', 'js', 'ui.js'), 'utf8'));
  if (!m) throw new Error('web/js/ui.js: VST_RELEASES not found');
  return m[1];
})();
const CREDIT = `${SPEC.APP.panelCredit} · ${SPEC.APP.version} · ${SPEC.APP.license}`;
const NEW = SPEC.PRESETS.slice(SPEC.NEW_FIRST);   // beta 0.3: the 600 of beta 0.3 (501-1100), the presets of beta 0.2 (201-500), then those of beta 0.1 (001-200) that do not use B2 (removed)
const numOf = p => parseInt(p.name, 10);   // the number written first in a new preset's name (3 or 4 digits)
const N03 = NEW.filter(p => numOf(p) >= 501).length, N02 = NEW.filter(p => numOf(p) >= 201 && numOf(p) < 501).length, N01 = NEW.length - N03 - N02;   // presets of beta 0.3, of beta 0.2 and of beta 0.1 (left)
const SUPER = SPEC.PRESETS.filter(p => p.cat === 'SuperModulation');
const firstNo03 = String(Math.min(...NEW.map(numOf).filter(n => n >= 501))), lastNo03 = String(Math.max(...NEW.map(numOf)));
const SET_SIZE = 40;   // sounds per EVALUATE SOUNDS set (one file each)
const title = t => { const p = NEW.find(q => q.name.slice(4).split(' · ')[1] === t); if (!p) throw new Error('manual: no preset titled ' + t); return `<b>${p.name}</b>`; };
const topName = n => { if (!SPEC.PRESETS.slice(0, SPEC.TOP).some(p => p.name === n)) throw new Error('manual: no TOP Sound ' + n); return `<b>${n}</b>`; };
const nCat = c => SPEC.PRESETS.filter(p => p.cat === c).length;
// presets of beta 0.3 (numbers 501 and up) of a category, as bold names for a "look at" column; withFilter: only those that use the voice FILTER (cutoff below its maximum)
const VFC = SPEC.PARAMS.findIndex(q => q.key === 'vf_cut');
const fromBeta03 = (cat, n, withFilter) => NEW.filter(p => numOf(p) >= 501 && p.cat === cat && (!withFilter || p.values[VFC] < SPEC.PARAMS[VFC].max)).slice(0, n).map(p => `<b>${p.name}</b>`).join(', ');
const catList = SPEC.CATEGORIES.slice(0, -1).join(', ') + ' and ' + SPEC.CATEGORIES[SPEC.CATEGORIES.length - 1];

// ---------------------------------------------------------------- hero
function hero(E) {
  const a = isA(E);
  return `<header class="hero">
<p class="eyebrow">OKTO MULTIWAVE SYNTH · USER MANUAL ${E.toUpperCase()}</p>
<h1><span class="tag">OSCILLATORS ${a ? 'A1 · A2' : 'B1'}</span>Wavelet ${a ? 'Subtractive' : 'Additive'}</h1>
<p class="lead">${a
    ? 'The oscillators A1 and A2 are subtractive, with a wavelet twist. Each starts from a bright waveform — saw, square, pulse, triangle, sine or a noise cycle — and shapes it with a filter that cuts <em>scales</em> instead of frequencies: a wavelet transform breaks every cycle into 11 octave bands of small building blocks, the atoms; the SCALE FILTER turns the bands up and down, SPARSITY keeps only the most important atoms, the POSITION window confines the filter to one part of the cycle, and SOURCE PHASE moves the wave under the atoms.'
    : 'The oscillator B1 is additive, with a wavelet twist. It is built from wavelet atoms: an atom pattern writes the coefficients of the 11 octave bands, the drawbars set the level of every band, and each band has its own envelope — so the fine detail of a note can die away before its body, as in a real string or bell. The same SCALE FILTER and POSITION window as the subtractive oscillators shape the result.'}
Okto MultiWave Synth has <b>two subtractive oscillators and one additive one</b> and mixes them: this manual is about the ${a ? 'subtractive pair' : 'additive oscillator'}; <a href="manual-${a ? 'b' : 'a'}.html">Manual ${a ? 'B' : 'A'}</a> describes the ${a ? 'additive oscillator' : 'subtractive pair'}.</p>
<div class="hero-meta"><span class="pill">For the web app and the VST3 / VST2 plug-in for Windows</span><span class="pill">Version ${SPEC.APP.version} · ${SPEC.APP.date}</span><a class="pill other-${a ? 'b' : 'a'}" href="manual-${a ? 'b' : 'a'}.html">Oscillator${a ? ' B1 — read Manual B' : 's A1 · A2 — read Manual A'}</a></div>
</header>`;
}

// ---------------------------------------------------------------- 1. quick start
function quickStart(E) {
  const a = isA(E);
  return `<p>From closed to sounding in a few steps — pick the column for the version you use.</p>
<div class="cols2">
<div class="card"><h4>Web app <span class="badge">BROWSER</span></h4><ol class="steps">
<li>Double-click <code>web/index.html</code> to open it in Chrome or Edge (Firefox also works). No installation and no web server are needed — or open the page of the project: ${SPEC.APP.url ? '' : ''}<code>pierrearnaudguyot.github.io/Okto-MultiWave-Synth</code>.</li>
<li>Click <b>Play the synth</b> in the welcome window (or <b>Run the demo</b> for a tour of the presets): browsers only allow sound after a click. The status bar turns green: <i>Audio on</i>.</li>
<li>The app opens on <b>${SPEC.PRESETS[SPEC.DEFAULT_PRESET].name}</b>. Play with the mouse on the keyboard, the digit keys ${kbd('1')} … ${kbd('0')}, the letter row ${kbd('A')} ${kbd('S')} ${kbd('D')} ${kbd('F')} …, or a MIDI keyboard.</li>
<li>Click the folder tabs ${ctl('OSC1 A1')} ${ctl('OSC2 A2')} ${ctl('OSC3 B1')} under the header to see each oscillator's cards. The tabs only choose the <em>panel shown</em>: what you hear is set by the three levels in the <b>OSC MIX</b> card (a lit dot on a folder tab says the oscillator is heard).</li>
<li>${a ? `Hold a note, show the ${ctl('A1')} panel and slowly turn ${P(SLK[0].fcut)} of the SCALE FILTER down. In the SCALOGRAM the rows switch off from the top as bands are removed. Then step the wavelet with ◀ ▶ and sweep again: same filter, different atoms.`
    : `Click the folder tab ${ctl('OSC3 B1')}, raise ${P(SLK[2].lvl)} in OSC MIX and lower ${P(SLK[0].lvl)} to hear the additive oscillator alone. Pull the drawbars down one by one from the right: the sound loses brightness band by band. Then click the ${ctl('PATTERN')} buttons to hear the other atom patterns.`}</li>
</ol></div>
<div class="card"><h4>Ableton Live <span class="badge">VST3 / VST2</span></h4><ol class="steps">
<li>Download the plug-in zip from its <a href="${VST_URL}">release page</a> (the web app's ${ctl('DOWNLOAD VST')} button opens it) and unzip it. Copy the whole <code>OktoMultiWaveSynth.vst3</code> folder into your VST3 folder (<code>C:\\Program Files\\Common Files\\VST3</code>; <code>vst\\install.bat</code> does it and asks for administrator rights) <b>or</b> into your VST2 plug-in folder.</li>
<li>In Live open <b>Preferences → Plug-ins</b>, switch on <b>Use VST3 Plug-in System Folders</b> (or <b>Use VST2 Plug-in Custom Folder</b>) and click <b>Rescan</b>.</li>
<li>In the browser open <b>Plug-ins → ${SPEC.APP.credit.replace(/^created by /, '')} → Okto MultiWave Synth</b> and drag it onto a MIDI track. A new instance starts on <b>${SPEC.PRESETS[SPEC.DEFAULT_PRESET].name}</b>.</li>
<li>Arm the track and play a MIDI keyboard, or press ${kbd('M')} to use Live's Computer MIDI Keyboard. The panel is the same as in the web app.</li>
</ol></div>
</div>
${tip(`<p>Want to hear what it can do first? ${ctl('▶ DEMO')} (web app) plays Beethoven's <i>Appassionata</i> while the presets change every few seconds; <b>EVALUATE SOUNDS</b> (web app and plug-in) lets you hear each of the ${SPEC.NEW_COUNT} new presets and rate them — see <a href="#evaluate">Evaluate sounds</a>.</p>`)}`;
}

// ---------------------------------------------------------------- 2. the panel
// The numbered callouts of the panel screenshot: a pin sits 4 px inside the top left corner of a widget (panel coordinates, from the layout of tools/spec.js).
const secOf = id => { const s = SPEC.SECTIONS.find(q => q.id === id); if (!s) throw new Error('manual: no section ' + id); return s; };
const at = (id, wx = 0, wy = 0) => { const s = secOf(id); return { x: s.x + wx + 4, y: s.y + wy + 4 }; };
const pins = E => {
  const a = isA(E);
  const tid = a ? 'tone_a1' : 'tone_b1';
  const tone = a ? [
    { ...at(tid, 12, 32), title: 'WAVE', desc: 'the source waveform of the oscillator.', href: 'tone' },
    { ...at(tid, 12, 70), title: 'ATOM SHAPE', desc: 'one atom of the selected wavelet.', href: 'tone' },
    { ...at(tid, 12, 180), title: 'WAVELET · WAVELET 2', desc: 'the atom shape; the second one is for WAVELET MORPH.', href: 'tone' },
    { ...at(tid, 276, 70), title: 'SOURCE CYCLE', desc: 'the wave before (grey) and after sparsity; “K / nz atoms kept”.', href: 'tone' },
    { ...at(tid, 408, 70), title: 'PHASE', desc: 'SOURCE PHASE: moves the wave inside the cycle before the analysis.', href: 'tone' },
    { ...at(tid, 280, 146), title: 'WIDTH · SPARSITY', desc: 'pulse width / triangle skew; how many atoms are kept.', href: 'tone' },
  ] : [
    { ...at(tid, 12, 32), title: 'PATTERN', desc: 'the atom pattern that writes the coefficients.', href: 'tone' },
    { ...at(tid, 12, 70), title: 'Drawbars 1–11', desc: 'the level of each of the 11 bands.', href: 'tone' },
    { ...at(tid, 356, 70), title: 'ATOM SHAPE · WAVELET', desc: 'one atom of the selected wavelet; the wavelet below it.', href: 'tone' },
    { ...at(tid, 356, 180), title: 'TILT · SEED', desc: 'dB per band across the drawbars; the seed of the RANDOM pattern.', href: 'tone' },
    { ...at(tid, 12, 198), title: 'Band envelope', desc: 'SCALE ATTACK, SPREAD, BODY, BRIGHT, SCALE SUSTAIN: the time behaviour of each band.', href: 'tone' },
  ];
  const fid = a ? 'filter_a1' : 'filter_b1', pid = a ? 'position_a1' : 'position_b1', oid = a ? 'osc_a1' : 'osc_b1';
  const header = (x, y, title, desc, href) => ({ x, y, title, desc, href });
  return [
    { ...at('oscframe', 12, 4), title: 'Folder tabs', desc: 'OSC1 A1 · OSC2 A2 · OSC3 B1: which oscillator\'s cards are shown on the plate; a lit dot = it is heard (the sound is set by OSC MIX).', href: 'oscillators' },
    header(392, 12, 'Preset browser', '◀ ▶ step through the presets; click the name for the list.', 'presets'),
    header(758, 12, 'EVALUATE SOUNDS', 'the listening test of the new presets.', 'evaluate'),
    header(868, 12, 'DOWNLOAD VST / SAVE PRESET', 'the web app links to the plug-in; the plug-in has SAVE PRESET here.', 'plugin'),
    header(942, 12, 'MANUAL', 'this manual on an A tab, the other one on a B tab.', 'panel'),
    header(1032, 8, 'VOLUME and meter', 'master level and stereo peak meter.', 'effects'),
    ...tone,
    { ...at('mix'), title: 'OSC MIX', desc: 'three levels, one per oscillator; below them the SUB OSC.', href: 'oscillators' },
    { ...at('display'), title: 'SCOPE · SCALOGRAM', desc: 'one cycle of the whole sound (every oscillator that plays) and its atoms in the 11 bands.', href: 'tone' },
    { ...at(fid), title: 'SCALE FILTER', desc: 'a gain for each wavelet band: type, cutoff, slope, resonance, key tracking, envelope, velocity.', href: 'filter' },
    { ...at(pid), title: 'POSITION', desc: 'confines the filter or the detail to part of the cycle.', href: 'filter' },
    { ...at(oid), title: 'TUNE · OWN ENVELOPE · PITCH ENVELOPE', desc: 'the oscillator\'s own pitch, its own loudness envelope and its pitch envelope.', href: 'osc-card' },
    { ...at('flt'), title: 'FILTER', desc: 'a 24 dB resonant low-pass in every voice (LADDER or OTA), with its own envelope; open by default.', href: 'flt' },
    { ...at('ampenv'), title: 'AMP ENVELOPE', desc: 'loudness of the whole sound.', href: 'env' },
    { ...at('modenv'), title: 'MOD ENVELOPE', desc: 'moves the cutoff of every oscillator by its ENV AMT.', href: 'env' },
    { ...at('lfo'), title: 'LFO 1', desc: 'pitch, cutoff, position, wavelet morph, sparsity, resonance and envelope-to-wavelet.', href: 'lfo' },
    { ...at('lfo2'), title: 'LFO 2 / LFO 3', desc: 'each moves one control chosen by TARGET: any scale-filter, wavelet or FILTER control, in every oscillator.', href: 'lfo' },
    { ...at('voice'), title: 'VOICE', desc: 'portamento, octave, tuning, polyphony, glide, unison.', href: 'voice' },
    { ...at('fx'), title: 'EFFECTS', desc: 'saturation, chorus, ping-pong delay and reverb.', href: 'effects' },
    { ...at('play', 14, 36), title: 'CHORD MODE · BASS', desc: 'shows the chord-harp card and turns the keyboard into chords; BASS adds the low note.', href: 'chord' },
    { ...at('play', 146, 36), title: 'TUNING', desc: 'the three-position switch of the oriental keyboard: Western, Arabic, Turkish.', href: 'oriental' },
    { ...at('keys', 82, 0), title: 'Wheels · keyboard', desc: 'pitch bend, modulation; five octaves.', href: 'panel' },
  ];
};

function panelChapter(E) {
  const a = isA(E);
  const ann = annotated(`panel-${E}.png`, `The whole instrument with the ${a ? 'A1' : 'B1'} oscillator shown`, pins(E));
  const hdr = [
    ['▶ DEMO ▾ (web app)', 'Plays the default demo, a tour of the presets; the ▾ opens other pieces and "Load a MIDI file…".'],
    ['Folder tabs', `The strip of three tabs under the header — ${ctl('OSC1 A1')} · SUBTRACTIVE and ${ctl('OSC2 A2')} · SUBTRACTIVE (yellow), ${ctl('OSC3 B1')} · ADDITIVE (blue) — chooses the oscillator whose cards are shown on the plate below it; a lit dot says the oscillator is heard. It does not change the sound, and does not mark a preset as modified.`],
    ['Preset box', 'The name of the sound; a dot after it means it was modified since it was loaded. ◀ ▶ step; a click opens the preset browser.'],
    ['EVALUATE SOUNDS', 'The listening test of the new presets (see <a href="#evaluate">Evaluate sounds</a>); it lights up and says STOP while a session runs.'],
    ['DOWNLOAD VST · SAVE PRESET', 'The web app\'s button opens the plug-in\'s release page; in the plug-in the same place holds SAVE PRESET.'],
    ['MANUAL', 'Opens the manual of the oscillator shown — Manual A on A1 or A2, Manual B on B1; each links to the other.'],
    ['VOLUME · meter', 'Master level (−36 … +6 dB) and the stereo peak meter.'],
  ];
  return `<p>The panel is the same in the web app and the plug-in, apart from a few buttons (the web app's DEMO and DOWNLOAD VST, the plug-in's size button, SAVE PRESET and the SYNC buttons of the tempo sync). From top to bottom: the header; the strip of three <b>folder tabs</b> with the plate under it that holds the cards of the oscillator shown (WAVELET, SCALE FILTER, POSITION, TUNE · OWN ENVELOPE · PITCH ENVELOPE) and, at the top right and common to every oscillator, <b>OSC MIX</b> and the <b>SCOPE</b> of the whole sound; the voice <b>FILTER</b>, the AMP ENVELOPE and the MOD ENVELOPE; LFO 1, <b>LFO 2/3</b> and VOICE; EFFECTS and the <b>PLAY</b> card (CHORD MODE, BASS, TUNING); the keyboard row. With <b>CHORD MODE</b> on, the chord-harp card appears below and the window grows. The credit line “${CREDIT}” sits under the wheels.</p>
<figure>${ann.image}<figcaption>The web app with the ${a ? 'A1' : 'B1'} oscillator shown. Click a number to jump to its description.</figcaption></figure>
${ann.legend}
<h3 id="header-controls">The header</h3>
${table(['Control', 'What it does'], hdr.map(r => [ctl(r[0]), r[1]]), 'compact')}
<h3 id="handling">Working with the controls</h3>
${table(['Gesture', 'Effect'], [
    ['Drag up / down', 'Changes the value; a full sweep takes about 180 pixels (120 on a drawbar).'],
    [`${kbd('Shift')} + drag`, 'Five times finer.'],
    ['Mouse wheel', `Steps of 1 % of the range (0.2 % with ${kbd('Shift')}); one step on stepped controls.`],
    [`Double-click, or ${kbd('Ctrl')} + click`, 'Resets the control to its default.'],
    ['Hover', 'The label under a knob shows its value with its unit.'],
    ['Right-click (web app)', 'MIDI learn: then move a knob or fader on your controller (Esc cancels, Delete unlinks).'],
    ['Greyed-out control', `Has no effect with the current settings (WIDTH unless the wave is PULSE or TRI, SEED unless the pattern is RANDOM, the sub oscillator's OCT and SHAPE while its LEVEL is 0).`],
  ], 'compact')}`;
}

// ---------------------------------------------------------------- 3. three oscillators
function oscillatorsChapter(E) {
  const mix = [
    [SLK[0].lvl, 'The level of oscillator A1 (subtractive). 100 % on a new patch.', 'The tone card of each oscillator has the same knob.'],
    [SLK[1].lvl, 'The level of A2 (subtractive).', 'A second subtractive voice: a detuned copy, an octave, a different wave or filter.'],
    [SLK[2].lvl, 'The level of B1 (additive).', 'Often the body, the choir or the shimmer on top of the subtractive oscillators.'],

    ['sub_level', 'The sub oscillator: a sine, triangle or square one or two octaves below the note, unfiltered, once per voice.', 'Adds weight; it does not go through the scale filters.'],
    ['sub_oct', '−1 or −2 octaves.', ''],
    ['sub_shape', 'Sine, triangle or square.', ''],
  ];
  return `<p>Okto MultiWave Synth plays <b>up to three oscillators in every voice</b>: <b>A1</b> and <b>A2</b> (wavelet subtractive) and <b>B1</b> (wavelet additive). A new patch plays A1 alone; the three levels in the <b>OSC MIX</b> card decide which oscillators sound and how loud. Each oscillator is a small instrument of its own — its tone, its SCALE FILTER, its POSITION window, its tuning, its own envelope and its pitch envelope — while the AMP ENVELOPE, MOD ENVELOPE, LFOs, VOICE settings, effects and sub oscillator are shared by the whole voice.</p>
<ul>
<li><b>One panel at a time.</b> The folder tabs ${ctl('OSC1 A1')} ${ctl('OSC2 A2')} ${ctl('OSC3 B1')} under the header choose the oscillator: they show one oscillator's cards on the plate (yellow for A1 and A2, blue for B1) while the other two keep their settings and keep sounding. A lit dot on a folder tab says its oscillator is heard (its level is above 0). Switching a tab never changes the sound and never marks a preset as modified. <b>OSC MIX</b> and the <b>SCOPE</b> are common to every oscillator, so they stay in place at the top right whatever tab is shown; the scope and the scalogram draw one cycle of the <em>whole</em> sound (every oscillator that plays, and the sub oscillator, at C4).</li>
<li><b>Levels cost nothing at 0.</b> An oscillator whose level is 0 is not computed and its wave tables are not even built, so presets that use two oscillators cost about twice one — not three times. A level is smoothed over 20 ms, so it can be moved while playing.</li>
<li><b>Every preset uses at least two oscillators</b> (the 22 TOP Sounds keep their one or two of the Wavelet Synthesizer). The letters in the names of the new presets — <code>A1A2</code>, <code>A1B1</code>, <code>A1A2B1</code> — say which.</li>
</ul>
<h3 id="mix">OSC MIX and SUB OSC</h3>
${controls(mix)}
<h3 id="osc-card">TUNE, OWN ENVELOPE and PITCH ENVELOPE</h3>
<p>The wide card at the bottom of the plate belongs to the oscillator shown (the folder tab says which). It is what turns three oscillators into a sound with a front and a body.</p>
${controls([
    [SLK[0].oct, 'Transposes the oscillator by whole octaves.', 'A2 an octave down under A1 is the classic "saw + sub saw".'],
    [SLK[0].semi, 'Transposes by semitones.', '+7 gives a fifth; +12 an octave.'],
    [SLK[0].fine, 'Fine tuning in cents.', '±6–15 cents between two oscillators gives a beating, chorused sound.'],
    [SLK[0].eon, `Switches the oscillator's <b>own envelope</b> on. The oscillator is then multiplied by its own ADSR <em>as well as</em> the AMP ENVELOPE, so it can only be shorter than the voice: a short decay makes it a percussive attack (a click, a pluck, a breath); a slow attack makes it fade in under the others.`, 'The ADSR display next to it draws the shape.'],
    [SLK[0].ea, 'Attack of the own envelope (linear).', ''],
    [SLK[0].ed, 'Decay to the sustain level (exponential; the time to fall by 60 dB).', '20–80 ms for a click, 200–600 ms for a pluck.'],
    [SLK[0].es, 'Sustain level.', '0 % makes a one-shot attack that dies by itself.'],
    [SLK[0].er, 'Release after the key is released.', ''],
    [SLK[0].pamt, `The <b>pitch envelope</b>: the oscillator starts this many semitones away from the note and glides to it (negative = it starts below).`, '+12 … +30 with a short TIME is a kick or a zap; a small value is a "blip" on every note.'],
    [SLK[0].ptime, 'How long the glide takes to come back to the note: exponential, the time to fall by 60 dB (half of the distance is covered in about a tenth of it).', ''],
  ])}
<p class="small muted">The table shows the ranges and defaults of A1's controls; A2 and B1 have the same ones. The own envelope has no effect while its switch is off.</p>
<h3 id="ideas">Ideas, and presets to study</h3>
${table(['Idea', 'How', 'Look at'], [
    ['A percussive attack', `One oscillator with its own envelope: a noise cycle played low (OCTAVE −2 or −3) through a high-pass at band 6–9, DECAY 20–40 ms, SUSTAIN 0; the other oscillator is the body.`, `${title('Pick Bass')}, ${title('Snare')}, ${title('Clap')}`],
    ['A pitch drop', 'A sine with PITCH ENV +12 … +30 semitones and a TIME of 30–60 ms.', `${title('Kick')}, ${title('Sub Drop')}, ${title('Tom')}`],
    ['A fat pair', 'Two oscillators of the same kind a few cents apart, or an octave apart with different cutoffs.', `${title('Reese Duo')}, ${title('Deep Saw Bass')}, ${title('Velvet Pad')}`],
    ['Additive body, subtractive attack', 'B1 for the body (drawbars, atoms), A1 as a short, bright start.', `${title('Rhodes Warm')}, ${title('Dream Keys')}, ${title('Solo Violin')}`],
    ['Two LFOs on the wavelet', 'LFO 2 on one wavelet control (the SPARSITY, the window position, the SOURCE PHASE …), LFO 3 on another, at unrelated speeds; then set their amounts to 0 one at a time to hear what each does.', fromBeta03('SuperModulation', 3)],
    ['A real filter on top', 'The voice FILTER with an envelope: a low cutoff, some RESO and a positive ENV AMT with a short decay is the classic synth bass or pluck; aim LFO 3 at FILTER CUTOFF for a wah.', fromBeta03('Bass', 3, true)],
  ], 'compact')}`;
}

// ---------------------------------------------------------------- 4. the tone of the oscillator
function toneChapter(E) {
  const a = isA(E), k = a ? SLK[0] : SLK[2];
  const wavelets = SPEC.WAVELETS.map(w => w.h.length);
  const wdesc = a ? [
    'A square step up and down: sharp, digital, 8-bit; every removed band halves the number of steps of the wave.',
    'Short and lopsided: asymmetric ringing, gritty and slightly metallic.', 'A good all-rounder with mild, asymmetric ringing.',
    'Longer and smoother; filter sweeps start to sound analogue.', 'Almost symmetric: cleaner, more balanced edges than Daubechies 8.',
    'Nearly symmetric and very smooth for its length.', 'Long and almost sine-like: each band is close to a pure octave of harmonics — the smoothest, most "Fourier-like" filtering.',
  ] : [
    'Each band is a square-wave pattern: hard, bright, chip-like. RAMP with TILT −6 dB/band builds an exact sawtooth staircase.',
    'Short and lopsided: buzzy, slightly metallic band timbres.', 'A good all-rounder; bands still carry a few neighbouring harmonics.',
    'Smooth bands; the octave structure becomes clear and organ-like.', 'Like Daubechies 8 but almost symmetric: a little rounder.',
    'Nearly symmetric and very smooth for its length.', 'Each RAMP band is practically a sine at its octave: the cleanest drawbar-organ sound.',
  ];
  const wtable = table(['Wavelet', 'Taps', 'Character'], SPEC.WAVELETS.map((w, i) => [`<b>${w.name}</b>`, String(wavelets[i]), wdesc[i]]), 'compact');
  const bands = `<p>Every oscillator plays <b>one cycle of 2048 samples</b>, analysed by a periodic wavelet transform into <b>11 bands</b>: band <i>b</i> has 2<sup><i>b</i>−1</sup> atoms and covers about one octave of harmonics (band 1 the fundamental, band 2 the 2nd harmonic, band 3 harmonics 3–4, band 4 harmonics 5–8 …). The analysis is pitch-synchronous, so the bands follow the note. To keep high notes alias-free each band is stored in octave-wise band-limited versions: <b>the finest bands only exist on low notes</b> — at middle C only bands 1–7 are played, at C2 bands 1–9. The SCALOGRAM draws the atoms of the 11 bands of the oscillator shown (B1 at the bottom).</p>
${a ? figInline('tiling-a', '<b>Figure 1.</b> Left: in the Fourier view each harmonic spans the whole cycle. Right: the 11 bands of one cycle, shaded by the atoms of a SAW analysed with Daubechies 4.') : figInline('tiling-b', '<b>Figure 1.</b> The 11 bands of one cycle: 1 to 1024 atoms. An atom pattern (RAMP, MIRROR, …) writes which atoms exist; the drawbars set how loud each band is.')}`;
  const wl = `<h3 id="wavelets">The wavelet chooses the atom</h3>
<p>Each oscillator has its own ${ctl('WAVELET')} (the step control under the atom picture): seven classic wavelets from the 2-tap Haar step to the 40-tap Daubechies 20. Short wavelets are precise in time — sharp edges, crisp POSITION window borders — but their bands overlap; long wavelets separate the octaves cleanly. ${a ? 'For sweeps that sound like a conventional filter choose Daubechies 8 or longer; for stepped, digital colours Haar or Daubechies 2.' : 'For a clean, organ-like staircase choose Daubechies 8 or longer; for hard, chip-like bands Haar.'}</p>
${fig(`atoms-${E}.svg`, '<b>Figure 2.</b> One atom of each wavelet, as the ATOM SHAPE display draws it. “Taps” is the length of the wavelet filter.')}
${wtable}
<p><b>WAVELET MORPH</b> builds every oscillator with a second wavelet too (${ctl('WAVELET 2')}) and moves between the two with ${P('wmorph')}, LFO 1 (its ${ctl('WAVELET')} knob) and the mod envelope (${ctl('ENV&gt;WAV')}); it acts on each oscillator that plays and is heard where the wavelet shapes the sound.</p>`;
  let body;
  if (a) {
    const rows = [
      [{ key: k.wave, range: 'SAW · SQUARE · PULSE · TRI · SINE · NOISE' }, 'The waveform that is analysed: one cycle, its average removed and its peak normalised.', 'SAW and NOISE have detail in every band: the most to filter.'],
      [k.width, `Only for ${ctl('PULSE')} and ${ctl('TRI')} (greyed out otherwise). PULSE: the part of the cycle spent high. TRI: where the peak sits — 50 % is symmetric.`, 'With Haar, 25 %, 50 % and 75 % leave almost nothing to filter.'],
      [k.sparsity, 'Keeps only the largest atoms of the cycle and silences the rest: 0 % keeps every atom the wave needs, 50 % about the square root of that number, 100 % a single atom. The SOURCE CYCLE display reads “K / nz ATOMS KEPT”.', 'A lossy-codec timbre: glassy, slightly digital tones. Each change rebuilds the tables (crossfaded).'],
      [{ key: k.phase, range: '0 – 360°' }, 'SOURCE PHASE: moves the wave inside the cycle before the analysis. The wavelet transform is not shift-invariant, so the same wave at another phase is made of other atoms and the filter, SPARSITY and the window act on it differently.', 'Strong with Haar, Daubechies 2 and 4; weak with Daubechies 20. LFO 2 can move it (TARGET PHASE).'],
      [{ key: k.wavelet, range: 'Haar · DB2 · DB4 · DB8 · Sym8 · Coif3 · DB20' }, 'The shape of the atoms.', 'Changing it while holding a note crossfades.'],
    ];
    body = `<p>An <b>A</b> oscillator creates its raw material from a source wave: draw the cycle, analyse it, optionally thin out the atoms, split it into 11 band layers (plus a "dry" layer: their sum, the unfiltered wave). Every voice then plays these layers with gains set by the SCALE FILTER.</p>
${bands}
${controls(rows)}
${table(['Wave', 'One cycle', 'Character'], [
      [ctl('SAW'), 'Ramps down across the cycle, jumps back up at the start.', 'All harmonics; fine atoms only at the jump. The classic subtractive source.'],
      [ctl('SQUARE'), 'High for the first half, low for the second.', 'Odd harmonics, hollow. With Haar it is a single atom: nothing to filter.'],
      [ctl('PULSE'), 'High for WIDTH of the cycle.', 'Thinner and more nasal away from 50 %.'],
      [ctl('TRI'), 'Rises to the peak at WIDTH × 360°, then falls.', 'Soft, flute-like.'],
      [ctl('SINE'), 'One sine cycle.', 'Little to filter; a pure reference, or a sub body.'],
      [ctl('NOISE'), 'One fixed random cycle.', 'Played at the note\'s pitch it is a buzzy, pitched timbre, not hiss. A noise oscillator is band-limited at the note: for dense, loud noise (hats, clicks) play it low (OCTAVE −2 or −3) and use the high bands.'],
    ], 'compact')}
<div class="callout feature"><span class="ttl">A BEAUTIFUL CONSEQUENCE</span><h3>The square wave that will not filter</h3>
<p>With the Haar wavelet the band-1 atom <em>is</em> one cycle of a square wave, so a ${ctl('SQUARE')} analysed with Haar is exactly <b>one atom</b>: the low-pass has nothing to remove. For progressive sweeps on a square choose a smooth wavelet (Daubechies 8, Symlet 8, Daubechies 20), or use the effect on purpose.</p>
${fig('haar-square.png', '<b>Haar + SQUARE:</b> a single atom, in band 1.', 'shot')}${fig('db20-square.png', '<b>Daubechies 20 + SQUARE:</b> atoms in every band, clustered at the two edges.', 'shot')}</div>
<h3 id="sparsity">Sparsity</h3>
<p>Keeping only the K largest atoms is what wavelet lossy codecs do to save bits; here it is a timbre control. The range is relative to the wave: a SAW analysed with Daubechies 8 has only ${sparse(0, 3, 0).nz} non-zero atoms (a straight ramp needs no fine atoms, only the jump does). SPARSITY keeps K = nz<sup>1 − SPARSITY</sup> of them, so the knob does something over its whole range for every wave; sources that need few atoms change in clear jumps.</p>
${fig('sparsity-a.svg', `<b>Figure 3.</b> A SAW analysed with Daubechies 8 (${sparse(0, 3, 0).nz} non-zero atoms) at five SPARSITY settings (grey = the original).`)}
${wl}`;
  } else {
    const rows = [
      [k.pattern, `The atom pattern that writes the coefficients: ${ctl('RAMP')}, ${ctl('MIRROR')}, ${ctl('ALT')}, ${ctl('WALSH')}, ${ctl('IMPULSE')}, ${ctl('RANDOM')}. Each band layer is peak-normalised, so the drawbars set the real level of a band.`, 'RAMP + TILT −6 dB/band with Haar is a sawtooth staircase; MIRROR is hollow and organ-like; IMPULSE puts all the detail at 0°; RANDOM is bell-like.'],
      [k.seed, `Only for the ${ctl('RANDOM')} pattern: which random atoms.`, 'Different seeds are different bells.'],
      [k.tilt, 'Slopes the drawbars: dB per band, positive = brighter, negative = darker, applied on top of the drawbars.', 'A quick way to change the brightness of a whole sound.'],
      [k.bar1, 'The drawbars 1 … 11: the level of each band (band 1 at the left). The level is normalised by max(1, the sum of the bars), so pulling bars down makes the sound darker and quieter.', 'Hover a bar to read its band.'],
      [k.atk, 'SCALE ATTACK: how long the finer bands take to arrive after the body.', 'A slow attack on the high bands makes a bowed or breathy start.'],
      [k.spread, 'SPREAD: moves the band timing up or down the bands (positive: the fine bands are late and die early; negative: the other way).', ''],
      [k.body, 'BODY: how long the low bands last.', 'With BRIGHT shorter than BODY the fine detail dies before the body, as in a real string.'],
      [k.bright, 'BRIGHT: how long the high bands last.', ''],
      [k.sus, 'SCALE SUSTAIN: the level the bands settle on while the key is held.', ''],
      [{ key: k.wavelet, range: 'Haar · DB2 · DB4 · DB8 · Sym8 · Coif3 · DB20' }, 'The shape of the atoms.', 'Changing it while holding a note crossfades.'],
    ];
    body = `<p>A <b>B</b> oscillator builds its sound from atoms: a pattern writes the coefficients of the 11 bands, the drawbars (with TILT) set their levels, and a <b>scale envelope</b> gives every band its own time behaviour — before the oscillator's filter, window, own envelope and the AMP ENVELOPE shape the whole.</p>
${bands}
${controls(rows)}
${fig('patterns-b.svg', '<b>Figure 3.</b> The six atom patterns, drawn with the same drawbars.')}
${fig('scaleenv-b.svg', '<b>Figure 4.</b> The scale envelope: the level of each band over the life of a note (BODY, BRIGHT, SPREAD, SCALE ATTACK).')}
${fig('organ.png', 'B1 with a RAMP pattern: the drawbars at their positions, the scope and the scalogram.', 'shot')}
${wl}`;
  }
  return body;
}
function sparse(wave, wavelet, s, width) {
  const p = C.defaults(); const Q = C.P;
  p[Q.osc_view] = 0; p[Q.a_wave] = wave; p[Q.wavelet] = wavelet; p[Q.a_sparsity] = s || 0; p[Q.a_width] = width == null ? 0.5 : width;
  const t = C.buildTables(p, false);
  return { K: t.kept, nz: t.nonzero };
}

// ---------------------------------------------------------------- 5. filter and position
function filterChapter(E) {
  const a = isA(E), k = a ? SLK[0] : SLK[2];
  const rows = [
    [k.ftype, `Shape of the gain curve over the bands: ${ctl('LOW-PASS')} keeps the coarse bands, ${ctl('HIGH-PASS')} the fine ones, ${ctl('BAND-PASS')} about one band around the cutoff, ${ctl('BAND-REJ')} removes the band at the cutoff.`, 'Band-pass on a low cutoff gives thin, nasal tones.'],
    [k.fcut, 'Where the filter acts, in bands: 1 = the fundamental, 11 = the finest atoms, 12 = beyond them (a low-pass is fully open).', a ? 'At middle C only bands 1–7 exist: cutoffs 8–12 sound the same there.' : 'Default 12 = open.'],
    [k.fslope, 'How steeply the bands beyond the cutoff are attenuated; one band ≈ one octave, so 24 dB/band behaves like a 24 dB/octave filter. For BAND-REJ it sets the notch width.', 'Steep slopes act like faders that switch bands on and off.'],
    [k.fres, 'Boosts the bands around the cutoff by up to 24 dB. A band boost, not feedback: it never self-oscillates.', 'Resonance adds level: watch the meter.'],
    [k.fkey, '100 %: the cutoff follows the note. 0 %: it stays at a fixed frequency (C4 = 261.63 Hz).', '50 % is the familiar "darker as you go up".'],
    [k.fenv, 'How far the MOD ENVELOPE moves this oscillator\'s cutoff: −11 … +11 bands at its peak.', 'Each oscillator has its own amount: the same envelope can open one and close another.'],
    [k.fvel, 'Velocity → cutoff: the shift is amount × (velocity − 1).', '+2 … +3 bands: soft notes darker.'],
  ];
  const pos = [
    [k.pcen, 'Centre of the window inside the cycle, 0° … 360°.', a ? '180° is the falling edge of SQUARE.' : 'With IMPULSE all the detail sits at 0°.'],
    [k.pwid, 'How much of the cycle the window covers.', 'Narrow windows are automatically widened on high notes (no aliasing).'],
    [k.pdep, a ? 'How strongly the window confines the filter: 0 % = off (the filter acts everywhere); 100 % = the filter acts only inside the window, outside it the dry cycle plays.'
      : 'How strongly the window confines the detail: 0 % = off; 100 % = bands 2–11 exist only inside the window, outside it only band 1 sounds.', 'LFO 1 and LFO 2 can move the window.'],
  ];
  return `<p>${a ? 'The <b>SCALE FILTER</b> does not cut frequencies: it gives each of the 11 bands its own gain and the sound is the sum of the band layers. A low-pass removes the fine atoms and keeps the coarse ones. There is no phase shift and no feedback, and the <em>character</em> of a sweep depends on the wavelet: with Haar every removed band halves the number of steps of the wave, with Daubechies 20 the bands are nearly pure octaves.'
    : 'The <b>SCALE FILTER</b> multiplies the band levels set by the drawbars, the tilt and the scale envelope: think of it as a second set of drawbars you can move with an envelope, an LFO, velocity and the keyboard. Its default cutoff of 12 is open. The level normalisation of the drawbars is computed before the filter, so closing the filter really makes the sound darker and quieter.'}
Every oscillator has its own filter and window; the tabs show the cards of the oscillator selected. The table lists the controls of ${a ? 'A1' : 'B1'}; the other oscillators of the same kind have the same ones.</p>
<h3 id="filter">SCALE FILTER</h3>
${controls(rows)}
${fig(`filter-${E}.svg`, '<b>Gain per band at CUTOFF 6</b> for the four filter types, computed with the instrument\'s own code (24 dB/band).')}
<p>The cutoff actually used by a voice, recomputed every 32 samples: <code>cutoff = CUTOFF + ENV AMT × mod envelope + LFO 1 CUTOFF × LFO 1 (+ LFO 2 and LFO 3 aimed at CUTOFF) + VEL AMT × (velocity − 1) + (1 − KEY TRK) × log₂(261.63 Hz ÷ note frequency)</code>. (The voice <b>FILTER</b> of the next chapters is another filter, on frequencies: do not mix them up.)</p>
<h3 id="position">POSITION window</h3>
<p>${a ? 'Wavelet atoms live at definite places in the cycle, so an A oscillator can filter <em>one part</em> of the cycle and leave the rest untouched: soften only the falling edge of a square, or darken only the reset of a saw.' : 'Atoms live at definite places in the cycle, so a B oscillator can decide <em>where</em> the detail is allowed to exist: coarse band 1 everywhere, bands 2–11 only in part of the cycle — a moving "focus", a pulse-width-like effect locked to the pitch.'}</p>
${controls(pos)}
${fig(`window-${E}.svg`, '<b>The window over one cycle</b> (centre 180°, width 40 %) at three depths; the WINDOW display draws the same curve.')}`;
}

// ---------------------------------------------------------------- 6. envelopes
function envChapter() {
  return `<p>Two ADSR envelopes run for every voice, plus the <b>own envelope</b> and <b>pitch envelope</b> of each oscillator (see <a href="#osc-card">TUNE, OWN ENVELOPE and PITCH ENVELOPE</a>). Attacks are linear; decays and releases are exponential (the time given is the time to fall by 60 dB).</p>
<h3 id="amp-env">AMP ENVELOPE</h3>
${controls([
    ['amp_a', 'Rise from silence to full level.', '1–5 ms is click-free for most sounds; 0.3–1 s for pads.'],
    ['amp_d', 'Fall from full level to the sustain level.', 'For plucks set SUSTAIN 0 % and use DECAY as the note length.'],
    ['amp_s', 'Level held while the key (or the sustain pedal) is down.', ''],
    ['amp_r', 'Fade after the key is released. The voice is freed at −100 dB.', 'Long releases overlap: raise VOICES for pads.'],
    ['amp_vel', 'How much velocity sets the loudness. 0 % = every note equally loud.', 'The computer keyboard plays at velocity 80 %.'],
  ])}
<h3 id="mod-env">MOD ENVELOPE</h3>
<p>It moves the cutoff of <b>every oscillator</b> by that oscillator's ${ctl('ENV AMT')} (so with ENV AMT at 0 it does nothing there), and the WAVELET MORPH by ${ctl('ENV&gt;WAV')}. It ignores velocity — use ${ctl('VEL AMT')} for that.</p>
${controls([
    ['mod_a', 'Attack of the modulation envelope.', 'A slow mod attack gives brassy swells.'], ['mod_d', 'Decay to the mod sustain level.', ''],
    ['mod_s', 'Mod level held while the key is down.', ''], ['mod_r', 'Mod release.', ''],
  ])}`;
}

// ---------------------------------------------------------------- 7. LFOs
function lfoChapter() {
  return `<p>Three LFOs: <b>LFO 1</b>, and <b>LFO 2</b> and <b>LFO 3</b>, which share a card (its two tabs, ${ctl('LFO 2')} and ${ctl('LFO 3')}, show one or the other; a lit dot on a tab says that LFO is on, its AMOUNT is not 0). They are shared by all voices and oscillators and run freely (not restarted by new notes): in a chord every voice moves together. For a movement that starts with each note use the MOD ENVELOPE.</p>
<h3 id="lfo1">LFO 1</h3>
${controls([
    ['lfo_shape', `${ctl('SINE')}, ${ctl('TRI')}, ${ctl('SAW')}, ${ctl('SQR')} or ${ctl('S&amp;H')} (sample &amp; hold: a new random value per cycle).`, ''],
    ['lfo_rate', 'Speed, one cycle per 20 s to 20 per second. In the plug-in, with SYNC on, a note value at the host\'s tempo.', '5–6 Hz for vibrato.'],
    ['lfo_pitch', 'Vibrato depth in cents (the mod wheel adds up to 50 more).', ''],
    ['lfo_cut', 'Moves the cutoff of every oscillator by up to ± this many bands.', ''],
    ['lfo_pos', 'Moves the POSITION window of every oscillator by up to ± this many degrees.', 'Only audible where the window\'s DEPTH is above 0 %.'],
    ['lfo_wav', 'Moves the WAVELET MORPH.', 'Needs a WAVELET 2 different from the oscillator\'s WAVELET.'],
    ['lfo_sp', 'Moves the SPARSITY of every subtractive oscillator by up to ± this share of the range: the atoms that are kept come and go, and the timbre swings between a rich tone and a few atoms.', 'Starts to show where the wavelet is not Haar (a Daubechies 8 saw has only 96 atoms). The tables are built at nine sparsities while this is above 0 %.'],
    ['lfo_res', 'Moves the RESO of every scale filter by up to ± this many dB (kept between 0 and 24 dB): the resonant peak of the filter pulses.', 'Needs a cutoff inside the sound (bands 3–8) and a little resonance to start from.'],
    ['lfo_ew', 'Makes the reach of the MOD ENVELOPE on the WAVELET MORPH (ENV&gt;WAV) swing: ENV&gt;WAV + this amount × LFO 1.', 'Needs a WAVELET 2 different from the oscillator\'s WAVELET, and an ENV&gt;WAV above 0 or a MORPH to move.'],
  ])}
<h3 id="lfo2">LFO 2 and LFO 3</h3>
<p>LFO 2 and LFO 3 are the same LFO twice: each moves <b>one control, in every oscillator at once</b>, by the same amount: the one chosen in its ${ctl('TARGET')} menu — ${ctl('CUTOFF')}, ${ctl('SLOPE')}, ${ctl('RESO')}, ${ctl('KEY TRK')}, ${ctl('ENV AMT')} or ${ctl('VEL AMT')} of the scale filters, ${ctl('POSITION')}, ${ctl('WIDTH')} or ${ctl('DEPTH')} of the windows, the ${ctl('PHASE')}, ${ctl('SPARSITY')} or ${ctl('SRC WIDTH')} of the subtractive oscillators, the ${ctl('TILT')}, ${ctl('ODD BARS')}, ${ctl('EVEN BARS')} or ${ctl('SCALE SUS')} of the additive ones, the ${ctl('MORPH')} between two wavelets, or the ${ctl('FILTER CUTOFF')} or ${ctl('FILTER RESONANCE')} of the voice FILTER: every control of the wavelet oscillators, of the scale filter and of the voice filter. Each oscillator keeps its own base value; the LFO moves them in step. The two LFOs can aim at different controls (two independent movements) or at the same one (their moves add up). A target acts on <em>every</em> oscillator that has the control, and cannot be limited to one: aim it at a control that only one kind has (SPARSITY, PHASE or SRC WIDTH for the subtractive oscillators; TILT, ODD BARS, EVEN BARS or SCALE SUS for the additive one) to move that kind only.</p>
${controls([
    ['lfo2_target', 'What LFO 2 moves (the menu at the right of the three knobs; the mouse wheel steps through it). LFO 3 has the same menu.', 'LFO 1 already has CUTOFF and POSITION: give LFO 2 another target for two independent movements.'],
    ['lfo2_shape', 'The same five shapes as LFO 1, on a knob with five positions after AMOUNT (SINE, TRI, SAW, SQR, S&amp;H; the name of the shape is under the knob; a click steps to the next shape).', ''],
    ['lfo2_rate', 'Speed, independent of LFO 1; note values with SYNC in the plug-in.', 'A rate that does not divide LFO 1\'s makes the two drift against each other.'],
    ['lfo2_amt', 'How far the target moves: up to ± this share of half its range, kept in range (FILTER CUTOFF: half of its ten octaves, so 30 % is about ± 1.5 octaves). 0 % (the default) switches LFO 2 off.', 'Start around 20–30 %.'],
    ['lfo3_target', 'What LFO 3 moves: the same menu as LFO 2. When both aim at the same control their moves add.', 'Use LFO 3 for a second control of the wavelet oscillators: LFO 2 on SPARSITY, LFO 3 on the WINDOW position, for instance.'],
    ['lfo3_shape', 'The same five shapes.', ''],
    ['lfo3_rate', 'Speed, independent of the two other LFOs; note values with SYNC in the plug-in.', 'Rates that do not divide each other make the LFOs drift apart.'],
    ['lfo3_amt', 'How far the target moves, as for LFO 2. 0 % (the default) switches LFO 3 off.', ''],
  ])}
<p><b>PHASE, SPARSITY and SRC WIDTH</b> (SOURCE WIDTH: the pulse width of a PULSE source or the skew of a TRI one) change what the wavelet transform sees, so the subtractive oscillators' tables are built at several values — 12 phases round the cycle, 9 sparsities from 0 to 100 %, 9 widths from 2 to 98 % (about 1 MB per set) — and each voice crossfades between the two nearest: a smooth scan through the timbres. At AMOUNT 0 nothing extra is built. One kind of scan per oscillator at a time: SPARSITY (from LFO 1, LFO 2 or LFO 3) comes first, then PHASE, then SRC WIDTH. TILT, ODD BARS, EVEN BARS and SCALE SUS move the additive oscillators' drawbars (odd = bands 1, 3, 5 …; even = bands 2, 4, 6 …) and the level their bands decay to; MORPH adds to the WAVELET MORPH position. <b>FILTER CUTOFF</b> moves the cutoff of the voice FILTER (in octaves: the whole range is ten octaves) and <b>FILTER RESONANCE</b> its resonance; either one switches the filter on, even while its own settings are open.</p>
<h3 id="supermod">SuperModulation</h3>
<p>The idea of the instrument is that every timbre control acts on the <em>scales</em> of one cycle of the wave — and so can an LFO, while the note sounds. Moving the cutoff of a scale filter, the resonance, the SPARSITY, the window, the SOURCE PHASE or the morph between two wavelets does not sweep a Fourier filter: the harmonics are re-coupled according to the wavelet, so the timbre swims in a way an ordinary filter sweep does not. The <b>SuperModulation</b> section of the presets (the first one in the lists, ${SUPER.length} sounds) is made of such sounds: two oscillators of very different character, and LFO 1, LFO 2 and LFO 3 each moving one to three of these controls at unrelated speeds. In every preset of beta 0.3, LFO 2 and / or LFO 3 move wavelet controls — mostly of the subtractive oscillators — and the SuperModulation ones use both. Open one, then set the amounts of the LFOs to 0 one by one to hear what each does.</p>
<h3 id="lfo-sync">Tempo sync (plug-in only)</h3>
<p>In the plug-in a ${ctl('SYNC')} button sits at the right of the LFO 1 title, on the LFO 2/3 card (one for each of the two LFOs) and at the delay heading. Lit, the RATE (or the delay's TIME) becomes a note value at the host's tempo (120 BPM when the host gives none) and follows its tempo changes. The note values run from ${PK.lfo_div.choiceShort[0]} to ${PK.lfo_div.choiceShort[PK.lfo_div.choiceShort.length - 1]} for the LFOs and ${PK.fx_ddiv.choiceShort[0]} to ${PK.fx_ddiv.choiceShort[PK.fx_ddiv.choiceShort.length - 1]} for the delay (T = triplet, D = dotted). SYNC sets the speed only; the LFO is not restarted on the beat. SYNC is off by default, and the web app has none (a browser page has no tempo).</p>`;
}

// ---------------------------------------------------------------- 8. voice and effects
function voiceChapter() {
  return `<h3 id="voice">VOICE</h3>
${controls([
    [{ key: 'v_porta', label: 'PORTAMENTO', range: 'OFF · POLY · LEGATO', def: 'POLY' }, 'When notes glide; GLIDE sets how long (0 = nothing glides). POLY: every voice glides from its own previous note, so chord changes glide voice by voice. LEGATO: only while another key is held.', 'LEGATO for expressive leads, POLY for gliding chords.'],
    ['v_oct', 'Transposes the whole instrument by octaves (each oscillator also has its own TUNE).', ''],
    ['v_fine', 'Fine tuning in cents.', ''],
    ['v_voices', 'Notes sounding at once; 1 = monophonic legato with last-note priority.', 'Pads need 8 or more.'],
    ['v_glide', 'Portamento time.', '30–80 ms for leads.'],
    ['v_unison', 'Stacked copies of every note (1–4).', 'Cost = voices × unison × oscillators.'],
    ['v_detune', 'Spread of the unison copies in cents.', '8–15 cents for warmth.'],
    ['v_width', 'Spreads the unison copies across the stereo field.', 'No effect with UNISON 1.'],
  ])}
<p>When all voices are busy a new note takes the oldest released voice first, then the oldest held one. Each note plays at about −8 dB to leave headroom for chords. A preset can switch mono ↔ poly; a note off always finds its voice.</p>
<h3 id="flt">FILTER</h3>
<p>The <b>FILTER</b> card (under the plate, left of the AMP ENVELOPE) is a conventional filter in every voice: a <b>four-pole (24 dB per octave) resonant low-pass</b> that works on the voice <em>after</em> its oscillators are mixed and <em>before</em> its AMP ENVELOPE. It cuts <em>frequencies</em>, on top of the SCALE FILTERs, which cut scales. Two characters, chosen with the ${ctl('LADDER')} | ${ctl('OTA')} switch: <b>LADDER</b> saturates at every stage — dark and gritty, and the resonance thins the low end as it rises; <b>OTA</b> saturates only the input of its feedback loop and keeps part of the low end — rounder and smoother. The cutoff a voice uses is <code>CUTOFF × 2<sup>ENV AMT × 8 × FILTER ENVELOPE + KEY TRK × (note − C4) ÷ 12 + LFO 2 + LFO 3</sup></code> (the exponent is in octaves). <b>It is open by default</b> (CUTOFF at its maximum, no resonance, no drive, no envelope): then it is not even computed, and every sound made before it exists is unchanged. Turning any of its controls, or aiming an LFO at it, switches it on.</p>
${controls([
    ['vf_type', `${ctl('LADDER')}: every stage saturates, the resonance takes the low end away; ${ctl('OTA')}: only the input of the loop saturates, the low end is partly kept.`, 'LADDER for gritty basses and leads, OTA for rounder pads and keys.'],
    ['vf_cut', 'The frequency above which the sound is attenuated (24 dB per octave); exponential scale, 20 Hz to 20 kHz. At the top it is open.', 'Play a note and sweep it; add RESO for the classic wah.'],
    ['vf_res', 'Feeds the output back to the input: a peak at the cutoff. At 100 % the filter is just above the point where it sings by itself.', 'The resonance adds level: watch the meter.'],
    ['vf_drive', 'Saturates the sound before the filter (a tanh, level-compensated): 0 % = clean.', 'With a resonance it makes the filter growl.'],
    ['vf_key', 'How much the cutoff follows the note (100 % = one octave of cutoff per octave of pitch, from C4).', 'High notes stay as bright as low notes.'],
    ['vf_env', 'How far the FILTER ENVELOPE (the ADSR next to it) moves the cutoff: up to ± 8 octaves. Negative values close the filter as the envelope rises.', 'Combine a moderate cutoff with a positive ENV AMT and a short decay for the classic "pluck" of a synth bass.'],
    ['vf_a', 'Attack of the FILTER ENVELOPE.', 'A slow attack opens a pad.'], ['vf_d', 'Decay to the sustain level.', ''],
    ['vf_s', 'Level the envelope holds while the key is down (0 % = the filter closes again, 100 % = it stays open).', ''], ['vf_r', 'Release.', ''],
  ])}
<p>Each voice has its own filter and its own FILTER ENVELOPE, started by its note; the cutoff glides smoothly from block to block, so it does not zipper. LFO 2 and LFO 3 can move the CUTOFF (<code>FILTER CUTOFF</code>) and the RESONANCE (<code>FILTER RESONANCE</code>) of every voice together.</p>
<h3 id="effects">EFFECTS</h3>
<p>After the voice FILTER (above), in the order of the sound: <b>saturation</b> → <b>string-machine triple chorus</b> → <b>ping-pong delay</b> → <b>reverb</b> → DC blocker → master volume → soft limiter (never above 0 dBFS).</p>
${controls([
    ['fx_drive', 'Saturation: a smooth tanh soft-clipper driven by up to +24 dB, level-compensated. 0 % = bypassed.', '20–40 % thickens basses.'],
    ['ch_mix', 'Chorus amount: three delay lines swept by a slow and a fast LFO, 120° apart, spread left / centre / right.', 'Widens pads, strings and organs.'],
    ['ch_rate', 'Speed of the chorus LFOs.', ''], ['ch_depth', 'Depth of the sweep.', ''],
    ['fx_dtime', 'Delay time (up to 4 s). Changing it while echoes ring makes them glide in pitch. With SYNC on in the plug-in, a note value.', ''],
    ['fx_dfb', 'Feedback: more repeats. The echoes alternate left and right and get darker.', 'Above 70 % the repeats last for seconds.'],
    ['fx_dmix', 'Level of the echoes.', ''], ['fx_rsize', 'Reverb decay, from a small room to a long hall.', ''], ['fx_rmix', 'Level of the reverb.', '15–25 % for most sounds; 40 % + for pads.'],
    [{ key: 'master', label: 'VOLUME' }, 'Master output level, the small knob in the header.', 'Lower it when the meter sits at the top.'],
  ])}
<p>The smoothing of the delay, its filter, the master level and the reverb damping have the same time constants at 44.1, 48 and 96 kHz. An instance with nothing sounding and no echo left to come does not compute its effects (it costs nothing while idle).</p>`;
}

// ---------------------------------------------------------------- 9. chord mode
function chordChapter() {
  return `<p>The <b>CHORD MODE</b> button of the <b>PLAY</b> card (above the keyboard, at the right) turns the keyboard into a <b>chord harp</b>: the panel grows and the <b>CHORD KEYBOARD</b> card appears below it. With CHORD MODE off the card is not shown and the keyboard plays plain notes.</p>
${fig('chord-card.png', 'The CHORD KEYBOARD card with G major 7 held (FOLDED) and a string of the strum plate touched.', 'shot')}
<ul>
<li><b>One octave chooses the chord type</b> and makes no sound: ${ctl('KEYS OCT')} (C3–B3 by default, tinted purple on the keyboard). Every key <b>above</b> it plays the whole chord with one finger; keys pressed while the root is held play as themselves; keys <b>below</b> it play a bass line.</li>
<li><b>Twelve pads</b> in the layout of the selector octave — Maj, Min, 7, m7, Maj7, Sus2, Sus4, Dim, Aug, 5, Add9, Note: the white keys carry the major and bright chords, the black keys the minor, altered or bare ones. A click on a pad chooses the type and switches CHORD MODE on. ${SPEC.CHORDS.length} chord types in all (the Chord Type parameter has the others: 6, m6, m7b5, dim7, 9, m9, maj9, 7sus4, mMaj7, 6/9).</li>
<li>${ctl('VOICING')}: ${ctl('STACKED')} (root + intervals) or ${ctl('FOLDED')} (the chord's notes inside the octave of the root, as on an electronic chord harp); ${ctl('STRUM')} (0–100 ms) starts the notes one after the other; the <b>strum plate</b> strums the chord with the mouse.</li>
<li>${ctl('BASS')} (the button under CHORD MODE, <b>on by default</b>) adds a bass note with every chord: the root <b>two octaves below</b>, a little louder (+3 dB), never lower than C1. A chord keeps the level of a triad whatever its size (the notes of a seventh with its bass are turned down a little), so chords never press on the limiter.</li>
<li><b>The chord follows the left hand.</b> Hold a note with the right hand and press another chord on the selector octave: the held chord changes <i>at once</i>, even for the note already pressed. Only the notes of the chord now played sound — the notes that are not in the new chord fade out in a few milliseconds, the ones the two chords share go on without being played again. The left hand has a <b>memory</b>: the last chord chosen stays chosen after its key is released and applies to the next right-hand note. Clicking a pad, ${ctl('VOICING')} or ${ctl('BASS')} while a note is held changes the held chord the same way.</li>
<li>The chord's notes are ordinary notes: sustain, portamento, voice allocation and every sound parameter work as usual, and a chord never uses more voices than VOICES. A note shared by the chord and a held key sounds until both release it.</li>
<li>The chord settings are plug-in parameters (automatable, saved with the Live Set) but <b>never part of a preset</b>: loading a sound does not change how you play. A selector key updates the Chord Type parameter.</li>
</ul>`;
}

// ---------------------------------------------------------------- 9b. oriental keyboard
function orientalChapter() {
  const sc = SPEC.PARAMS[SPEC.PARAMS.findIndex(p => p.key === 'mt_scale')].choices;
  return `<p>Beta 0.2 adds an <b>oriental keyboard</b> with quarter tones, as on the oriental keyboards of Yamaha. The three-position switch ${ctl('TUNING')} sits in the <b>PLAY</b> card, to the right of CHORD MODE:</p>
<ul>
<li>${ctl('WEST')} — equal temperament, as always (the default).</li>
<li>${ctl('ARAB')} — the <b>Arabic</b> tuning: 24 tones to the octave, the quarter tone being 50 cents. The keys that are half-flat in the scale chosen are lowered by a quarter tone.</li>
<li>${ctl('TURK')} — the <b>Turkish</b> tuning of the makams: 53 commas to the octave (a comma is 22.6 cents; the values of the Arel-Ezgi-Uzdilek system), so a third or a seventh is a comma or two away from the Western one.</li>
</ul>
<p>Outside WEST two more controls show in the PLAY card, under the switch: ${ctl('MAQAM')} chooses the scale (${sc.join(', ')}) and ${ctl('TONIC')} the key it starts on (the scale is moved to it: Rast on D is Rast starting at D). The keys the tuning moves carry a small amber arrow on the keyboard (pointing down: lower than the piano key). A key that is not a degree of the scale keeps its piano pitch, so the sharps and flats you need stay in tune.</p>
<ul>
<li>Every note follows the tuning: the keys, the chord harp's notes (a chord on Rast has its half-flat third), the sub oscillator, the notes a MIDI file plays — except the <b>demo</b> and <b>EVALUATE SOUNDS</b>, which always play in equal temperament so that they are not out of tune with the music.</li>
<li>TUNING, MAQAM and TONIC are <em>playing</em> settings, like CHORD MODE: they are automatable parameters, saved with the Live Set, and never part of a preset.</li>
<li>Outside WEST the panel changes its colours: the accent (knob rings, tabs, scope, buttons) is <b>terracotta</b> for the subtractive oscillators and <b>turquoise</b> for the additive one, and the PLAY card has a pattern of octagons and eight-pointed stars.</li>
<li>Examples. <b>Rast on C, Arabic</b>: play C D E F G A B C — E and B are a quarter tone low, the rest is as on the piano. <b>Bayati on D</b>: D then E, a quarter tone flat, F G A B♭ C. <b>Hicaz on D, Turkish</b>: D E♭ F♯ G A B♭ C with the commas of the Turkish system.</li>
</ul>
<p class="small muted">The tunings are the usual approximations of keyboards (half-flat = −50 cents; Turkish values rounded to a comma): they do not replace an oud or a ney, but they make the characteristic intervals playable on a piano keyboard. In the Arabic tuning Rast retunes the third and the seventh, Bayati and Saba the second degree, and Hijaz and Nahawand use the piano's semitones (nothing to retune); the Turkish tuning gives all five their commas.</p>`;
}

// ---------------------------------------------------------------- 10. presets
const oscOf = p => SL.filter(s => p.values[s.k.lvl] > 0).map(s => s.name).join(' + ');   // SPEC.SLOTS holds parameter indices
function presetTable() {
  const head = ['Preset', 'Oscillators', 'Sound'];
  let body = '';
  for (const cat of SPEC.CATEGORIES) {
    const list = SPEC.PRESETS.filter(p => p.cat === cat);
    if (!list.length) continue;
    body += `<tr class="cat"><td colspan="${head.length}">${cat} · ${list.length}</td></tr>`;
    for (const p of list) {
      const top = SPEC.PRESETS.indexOf(p) < SPEC.TOP;
      const d = top ? TOP_DESC[p.name][1] : (SPEC.DESCRIPTIONS[p.name] || '');
      if (!d) console.warn('manual: no description for ' + p.name);
      const star = top ? '<span class="fav" title="One of OktoPierre\'s TOP Sounds">★</span> ' : '';
      const def = p.name === SPEC.PRESETS[SPEC.DEFAULT_PRESET].name ? ' <span class="small muted">(default sound)</span>' : '';
      body += '<tr>' + [star + p.name + def, `<span class="small">${oscOf(p)}</span>`, d.replace(/^./, c => c.toUpperCase())].map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
  }
  return `<div class="tbl"><table class="presets"><thead><tr>${head.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function presetsChapter(E) {
  return `<p>Okto MultiWave Synth has <b>${SPEC.PRESETS.length} factory presets</b>: OktoPierre's ${SPEC.TOP} <b>TOP Sounds</b> (unchanged from the Wavelet Synthesizer beta 0.7: they sound exactly as there, from <b>${SPEC.PRESETS[0].name}</b> to <b>${SPEC.PRESETS[SPEC.TOP - 1].name}</b>) and <b>${SPEC.NEW_COUNT} new presets</b>: <b>${N03} of beta 0.3</b> (numbers <code>${firstNo03}</code>–<code>${lastNo03}</code>: ${Math.round(N03 / SPEC.CATEGORIES.length)} in each of the ${SPEC.CATEGORIES.length} categories), in which LFO 2 and / or LFO 3 move wavelet controls of the oscillators (mostly of the subtractive ones) and about two in three also use the new voice FILTER; <b>${N02} of beta 0.2</b> (numbers <code>201</code>–<code>500</code>), in which LFO 1 and LFO 2 move the controls of the wavelet oscillators and A1 and A2 are very different from each other; and <b>${N01} of beta 0.1</b> (<code>001</code>–<code>200</code>, unchanged), sorted into the categories ${catList}. Beta 0.3 removed the second additive oscillator (B2): the presets that used it left the list, and their numbers are not used again, so the ratings you gave to the others stay valid. A new preset's name is its number, the oscillators it uses (<code>A1A2</code>, <code>A1B1</code>, <code>A1A2B1</code> …) and a title: <code>${NEW[0].name}</code>. Every new preset uses at least two oscillators, often one of them as the attack; their loudness is matched to the TOP Sounds. The <b>SuperModulation</b> category (${SUPER.length} sounds) holds the ones whose life is the LFOs moving the scale filter, the sparsity, the window, the source phase, the morph and the additive scales (see <a href="#supermod">SuperModulation</a>). The preset browser at the right follows the preset box: step with ◀ ▶ or the name's menu and it shows the category of the sound and the sound itself. ◀ ▶ step through them in that order; clicking the name opens the list (the <b>preset browser</b> at the right of the panel: TOP Sounds and the categories, one click plays a sound, the arrow keys ${kbd('↑')} ${kbd('↓')} ${kbd('←')} ${kbd('→')} too).</p>
<h3 id="saving">Saving your own sounds</h3>
<ul>
<li><b>Web app.</b> The buttons at the right of the status bar: <b>Save preset</b> keeps the sound in this browser's storage (the USER PRESETS group), <b>Export</b> downloads it as a <code>.json</code> file, <b>Import</b> loads one. User presets live in that browser profile only: use Export for anything you want to keep.</li>
<li><b>Plug-in.</b> See <a href="#plugin">The plug-in</a>: SAVE PRESET, the user bank, the presets file. You can also keep sounds with Live (a device preset, an Instrument Rack, the Live Set).</li>
</ul>
<h3 id="preset-list">All the presets</h3>
<p class="small muted">★ = one of OktoPierre's TOP Sounds. The oscillators are the ones whose level is above 0.</p>
${presetTable()}`;
}

// ---------------------------------------------------------------- 11. evaluate
function evaluateChapter() {
  return `<p><b>EVALUATE SOUNDS</b> (header, web app and plug-in) is a listening test of the ${SPEC.NEW_COUNT} new presets: it plays a piece of music with each one, asks how much you like it, and writes your answers — and the changes you make to the sounds you like — in text files you can send back. The sounds come in <b>sets of ${SET_SIZE}</b>: every set has its own file.</p>
<ol class="steps">
<li>Click <b>EVALUATE SOUNDS</b>, then <b>Start at…</b>: a small window asks the <b>number of the first sound</b> to rate (it offers the first one not rated yet; a later session also offers <b>Continue at …</b>). The list is the factory order: the ${N03} presets of beta 0.3 first (${firstNo03}–${lastNo03}), then those of beta 0.2 (${N02}), then those of beta 0.1 (${N01}). The window plays <b>3.5 seconds of Beethoven's <i>Appassionata</i></b> (the busy passage at 0:13 of the demo) <b>and then a C minor chord</b> (two seconds: a sustained sound can be judged too, not only quick notes) with that preset — polyphonic, at its normal octave, with short echoes — and shows its name, category and one-line description.</li>
<li>When the passage ends, give <b>1 to 10 stars</b>: click a star (in the web app also the keys ${kbd('1')}–${kbd('9')}, ${kbd('0')} = 10). The answer is saved at once and the next preset plays. You can also play the preset on your MIDI keyboard while the window waits. <b>▶ Replay</b>, <b>◀ Previous</b>, <b>Skip</b> and <b>Stop</b> are always there, and <b>Skip to vote</b> ends the music at once and asks for the stars; <b>Stop</b> (or the lit EVALUATE button) gives back the sound you were playing.</li>
<li><b>More than 5 stars</b> asks whether to <b>modify</b> the preset. If yes, the preset loads exactly as designed, the window shrinks to a bar over the keyboard, and you change the panel with the mouse and play it on your keyboard. <b>▶ Play the passage</b> plays it again. <b>Keep initial settings</b> forgets your changes; <b>Record preset change</b> writes the parameters that differ from the preset in the file.</li>
<li><b>Sets of ${SET_SIZE} sounds.</b> The first set starts at the sound you chose, the next ones every ${SET_SIZE} sounds, and every set has <b>its own file</b>, named after its first and last sound: <code>sound ${firstNo03} to sound ${Number(firstNo03) + SET_SIZE - 1}.txt</code>. Send back the files of the sets you rated.</li>
<li><b>Stars in the preset browser</b> (beta 0.3.1): the browser shows five stars (half stars: 1 to 10) at the right of every sound, in normal playing too; click to rate, click the same rating to clear it. The ratings are saved in the presets file and <b>EXPORT carries them</b>, whenever you like.</li>
<li>Stop whenever you like: the files are rewritten after every answer, and the next session continues where you stopped (it reads the ratings file again).</li>
</ol>
<h3 id="evaluate-file">The ratings file</h3>
<ul>
<li><b>Plug-in:</b> <code>Documents\\Okto MultiWave Synth\\okto-multiwave-ratings.txt</code> (the local application data folder when the Documents folder is missing) holds every rating; the file of each set (<code>sound xxx to sound yyy.txt</code>) is written next to it after every answer. ${ctl('Change file…')} chooses another ratings file (an existing ratings file continues where it stopped; the choice is remembered; the set files go next to it), ${ctl('Show file')} opens its folder, ${ctl('Save as…')} saves a copy of the ratings so far under a name you choose (while a set is being rated, a copy of that set), ${ctl('Clear all')} starts over.</li>
<li><b>Web app:</b> the ratings are kept in the browser; in Edge or Chrome you can choose a ratings file at the start (it is rewritten after every answer), and the file of a set is <b>downloaded</b> when the set is finished (every sound rated) and you move on, stop or finish. In other browsers ${ctl('Save as…')} downloads a copy (it also works in Edge and Chrome, with the name you choose).</li>
<li>The text is the same in both, for the whole list and for a set: a header, <code>NUMBER | STARS | CHANGED | PRESET</code> for every preset, a ranking, and <b>PRESET CHANGES</b> as <code>parameter key: value in the preset -> new value (name: shown value -> new shown value)</code>.</li>
</ul>`;
}

// ---------------------------------------------------------------- 12. plug-in
function pluginChapter() {
  return `<p>The plug-in runs the same sound engine with the same panel. It is a single self-contained file inside an <code>OktoMultiWaveSynth.vst3</code> bundle folder, which also carries these manuals; nothing else needs to be installed. The same file is a VST3 and a VST2 plug-in (a copy named <code>OktoMultiWaveSynth.dll</code> sits next to it for VST2 hosts). Windows 10/11, 64-bit.</p>
<h3 id="plugin-install">Installation</h3>
<ol class="steps">
<li>Download the zip from the <a href="${VST_URL}">release page</a> and unzip it.</li>
<li>Copy the <b>whole</b> <code>OktoMultiWaveSynth.vst3</code> folder into <code>C:\\Program Files\\Common Files\\VST3</code> (<code>vst\\install.bat</code> does it and asks for administrator rights), or into the VST2 plug-in folder you use.</li>
<li>In Live: <b>Preferences → Plug-ins</b>, switch on <b>Use VST3 Plug-in System Folders</b> (or the VST2 custom folder), <b>Rescan</b>. If both are on and see the folder, Live lists the plug-in twice; use either.</li>
</ol>
<p class="small muted">It installs next to the Wavelet Synthesizer and the WaveChord Synth: its own name, class IDs, VST2 ID and presets file.</p>
<h3 id="vst-diff">What is specific to the plug-in</h3>
<ul>
<li><b>No welcome window, no DEMO or DOWNLOAD VST button, no status bar.</b> Audio runs as soon as the plug-in is loaded. The window-size button (70–150 %) is next to the logo.</li>
<li><b>Tempo sync</b>: the SYNC buttons of the delay and the two LFOs (see <a href="#lfo-sync">Tempo sync</a>).</li>
<li><b>Presets</b>: ◀ ▶ step through the factory presets (those you deleted are skipped); a click on the name opens the <b>preset browser</b> (FACTORY and USER BANK tabs; ${ctl('HIDE ▸')} folds it away), a right-click the classic menu. In the browser: ▲ ▼ move a sound within its list, a sound dragged onto a category moves there (onto TOP Sounds it joins them), the arrow keys choose, and the buttons ${ctl('TO BANK…')}, ${ctl('RESTORE')}, ${ctl('DELETE')}, ${ctl('EXPORT…')}, ${ctl('IMPORT…')} manage your sounds.</li>
<li><b>SAVE PRESET</b> (left of MANUAL) overwrites the preset playing: a factory preset is <em>adjusted</em> in place, optionally under a new name (RESTORE brings the original back); a sound of the user bank is replaced.</li>
<li><b>The presets file</b>: everything above lives in one readable text file, <code>OKTOMULTIWAVE presets.txt</code>, kept next to the <code>.vst3</code> folder (the folder must allow writing: <code>C:\\Program Files\\Common Files\\VST3</code> needs administrator rights, so install into a folder you own, or run Live as administrator once). It is written atomically after every edit and read again when another instance changes it. A file longer than 16 MB is never written over.</li>
<li><b>Automation</b>: every sound parameter and the chord harp's six settings can be automated; the oscillator tabs (OSC) are a panel choice, not part of a sound.</li>
<li><b>EVALUATE SOUNDS</b> works in the plug-in too, with the host's audio engine running (see <a href="#evaluate">Evaluate sounds</a>). While a session runs the preset browser, SAVE PRESET and the arrow keys are locked.</li>
</ul>`;
}

// ---------------------------------------------------------------- 13. troubleshooting
function troubleChapter() {
  const qa = [
    ['No sound at all in the web app', 'Browsers only allow sound after a click: click <b>Play the synth</b> in the welcome window (or a key of the keyboard). The status bar must say <i>Audio on</i>. Only one window or tab plays at a time: another tab of the app may have taken the audio.'],
    ['I click an oscillator tab and the sound does not change', 'By design: the tabs only choose the panel shown. The sound is set by the three levels in the OSC MIX card. A tab shows the cards of an oscillator whose level may be 0.'],
    ['A knob I turn has no effect', 'Check the level of the oscillator whose panel you are editing (OSC MIX) — an oscillator at 0 is silent — and whether the control is greyed out (WIDTH, SEED, the sub oscillator). With the filter wide open, the cutoff does nothing.'],
    ['The filter does nothing on a SQUARE with Haar', 'A square analysed with Haar is a single atom (see Manual A): choose a smoother wavelet.'],
    ['A preset sounds quieter or louder than another', 'The new presets are matched to the TOP Sounds, but very short sounds (hats, clicks) are measured over 50 ms. Use the master VOLUME, or the level knobs.'],
    ['The plug-in does not appear in Live', 'Copy the <b>whole</b> bundle folder (not only the file inside), check <b>Use VST3 Plug-in System Folders</b> and press <b>Rescan</b>; the folder must be 64-bit Windows.'],
    ['SAVE PRESET says it cannot write', 'The presets file sits next to the <code>.vst3</code> folder; that folder must allow writing (see <a href="#vst-diff">What is specific to the plug-in</a>).'],
    ['EVALUATE SOUNDS says the passage did not play', 'The host\'s audio engine must be running: in Live, turn the audio engine on and arm or enable the track. The window waits a few seconds, then continues so that you can still rate the preset.'],
    ['Where is my ratings file?', 'Plug-in: <code>Documents\\Okto MultiWave Synth\\okto-multiwave-ratings.txt</code> and, next to it, one <code>sound xxx to sound yyy.txt</code> per set (use <b>Show file</b>). Web app: the file you chose at the start, or the downloads (one file per finished set).'],
    ['The CPU is high', 'Cost = voices × unison copies × oscillators that are on, and the voice FILTER (about the cost of one more oscillator) when it is not open. Lower UNISON or VOICES, turn off oscillators you do not hear, open the FILTER, avoid an LFO on PHASE with many voices.'],
  ];
  return qa.map(([q, a]) => `<details class="qa"><summary>${q}</summary><p>${a}</p></details>`).join('\n');
}

// ---------------------------------------------------------------- 14. more
function moreChapter() {
  return `<p>Okto MultiWave Synth is built on the <b>Wavelet Synthesizer</b>. Its manuals explain the ideas behind each oscillator kind in depth — partials versus atoms, how many atoms a wave needs, source phase, the scale envelope, the full recipes — for the original panel, where the two engines shared one filter and one window:</p>
<ul>
<li><a href="${WS_MANUALS}manual-a.html">Wavelet Synthesizer — Manual A (Wavelet Subtractive)</a></li>
<li><a href="${WS_MANUALS}manual-b.html">Wavelet Synthesizer — Manual B (Wavelet Additive)</a></li>
</ul>
<p>Everything in them about a source wave, an atom pattern, the scale filter or the position window applies to each oscillator of Okto MultiWave Synth (each has its own); what they say about the A/B MIX knob is replaced by the three levels of OSC MIX.</p>
<h3 id="glossary">Glossary</h3>
${table(['Term', 'Meaning'], [
    ['Atom', 'One small wiggle of a wavelet transform; all atoms of a wavelet have the same shape, in sizes an octave apart.'],
    ['Band', 'All atoms of one size: band <i>b</i> has 2<sup><i>b</i>−1</sup> atoms, about one octave of harmonics. A cycle has 11 bands.'],
    ['Scale', 'The size of an atom, i.e. the octave: a "scale filter" acts on bands, not on frequencies.'],
    ['Wavelet', 'The shape of the atoms: Haar, Daubechies 2/4/8/20, Symlet 8, Coiflet 3.'],
    ['Sparsity', 'Keeping only the largest atoms of a cycle (like a lossy codec).'],
    ['Source phase', 'Moving the source wave inside the cycle before the analysis: other atoms, other timbre.'],
    ['Position window', 'A bump inside the cycle that confines the filter (A) or the detail (B) to one part of it.'],
    ['SuperModulation', 'An LFO moving the wavelet-domain controls — scale cutoff and resonance, sparsity, window, source phase and width, wavelet morph, additive scales — while a note sounds; also the first category of presets.'],
    ['FILTER', 'The voice filter: a four-pole resonant low-pass (LADDER or OTA character) with its own ADSR, before the AMP ENVELOPE. It is open by default.'],
    ['Scale filter', 'The filter of each oscillator, which gives each wavelet band its own gain (it cuts scales, not frequencies).'],
    ['Quarter tone, comma', 'Half of a semitone (50 cents), used by the Arabic tuning; the Turkish tuning divides the octave into 53 commas of 22.6 cents.'],
    ['Own envelope', 'An oscillator\'s private ADSR; it multiplies the AMP ENVELOPE.'],
    ['Pitch envelope', 'A glide of an oscillator from some semitones away to the note.'],
    ['OSC MIX', 'The three oscillator levels.'],
    ['TOP Sounds', 'OktoPierre\'s 22 favourite presets, first in the list.'],
  ], 'compact')}`;
}

// ---------------------------------------------------------------- 15. about
function aboutChapter() {
  return `<p><b>Okto MultiWave Synth</b> ${SPEC.APP.version}, a test version (${SPEC.APP.date}), created by <b>Pierre Arnaud GUYOT</b> (OktoPierre), on the basis of his Wavelet Synthesizer beta 0.7 and his chord keyboard (WaveChord). Free software under the GNU General Public License v3 or later, WITHOUT ANY WARRANTY: <a href="https://github.com/PierreArnaudGUYOT/Okto-MultiWave-Synth">github.com/PierreArnaudGUYOT/Okto-MultiWave-Synth</a>.</p>
<ul>
<li>Demo music: MIDI from the <a href="https://www.mutopiaproject.org">Mutopia Project</a> — J. S. Bach <i>Toccata in D minor</i> and Beethoven's Op. 57 III, Op. 129, Op. 67 I, Op. 13 I, Op. 31/2 I, Op. 111 I (public domain); Beethoven <i>Moonlight</i> Op. 27/2 III typeset by Stewart Holmes (CC BY-SA 2.5). The listening passage of EVALUATE SOUNDS is part of Op. 57 III.</li>
<li>VST3 interface headers: Steinberg Media Technologies, MIT licence. Wavelet filter coefficients generated with PyWavelets (MIT).</li>
<li>Thanks to Jeremi Palmigani (Saoul Machine), Flo (Go Tiger) and Arnaud Grignard for testing and review of the Wavelet Synthesizer.</li>
</ul>`;
}

// ---------------------------------------------------------------- pages
function manual(E) {
  const a = isA(E);
  const sections = [
    { id: 'quick', title: 'Quick start', html: quickStart(E) },
    { id: 'panel', title: 'The panel', html: panelChapter(E), subs: [{ id: 'header-controls', title: 'The header' }, { id: 'handling', title: 'Working with the controls' }] },
    { id: 'oscillators', title: 'Three oscillators', html: oscillatorsChapter(E), subs: [{ id: 'mix', title: 'OSC MIX and SUB OSC' }, { id: 'osc-card', title: 'Tune, own envelope, pitch envelope' }, { id: 'ideas', title: 'Ideas, and presets to study' }] },
    { id: 'tone', title: a ? 'The subtractive oscillators A1 · A2' : 'The additive oscillator B1', html: toneChapter(E), subs: [{ id: 'wavelets', title: 'The wavelet chooses the atom' }] },
    { id: 'filterpos', title: 'Scale filter and position window', html: filterChapter(E), subs: [{ id: 'filter', title: 'Scale filter' }, { id: 'position', title: 'Position window' }] },
    { id: 'env', title: 'Envelopes', html: envChapter(), subs: [{ id: 'amp-env', title: 'Amp envelope' }, { id: 'mod-env', title: 'Mod envelope' }] },
    { id: 'lfo', title: 'LFO 1, LFO 2 and LFO 3', html: lfoChapter(), subs: [{ id: 'lfo1', title: 'LFO 1' }, { id: 'lfo2', title: 'LFO 2 and LFO 3' }, { id: 'supermod', title: 'SuperModulation' }, { id: 'lfo-sync', title: 'Tempo sync' }] },
    { id: 'voicefx', title: 'Voice, filter and effects', html: voiceChapter(), subs: [{ id: 'voice', title: 'Voice' }, { id: 'flt', title: 'Filter' }, { id: 'effects', title: 'Effects' }] },
    { id: 'chord', title: 'Chord mode', html: chordChapter() },
    { id: 'oriental', title: 'Oriental keyboard', html: orientalChapter() },
    { id: 'presets', title: 'Presets', html: presetsChapter(E), subs: [{ id: 'saving', title: 'Saving your own sounds' }, { id: 'preset-list', title: 'All the presets' }] },
    { id: 'evaluate', title: 'Evaluate sounds', html: evaluateChapter(), subs: [{ id: 'evaluate-file', title: 'The ratings file' }] },
    { id: 'plugin', title: 'The plug-in', html: pluginChapter(), subs: [{ id: 'plugin-install', title: 'Installation' }, { id: 'vst-diff', title: 'What is specific to the plug-in' }] },
    { id: 'trouble', title: 'Troubleshooting', html: troubleChapter() },
    { id: 'more', title: 'More, and a glossary', html: moreChapter(), subs: [{ id: 'glossary', title: 'Glossary' }] },
    { id: 'about', title: 'About', html: aboutChapter() },
  ];
  return {
    engine: E, title: `Okto MultiWave Synth — Manual ${E.toUpperCase()}: ${a ? 'subtractive oscillators A1 A2' : 'additive oscillator B1'}`,
    description: `User manual of Okto MultiWave Synth, ${a ? 'the wavelet subtractive oscillators A1 and A2' : 'the wavelet additive oscillator B1'}: panel, controls, presets, chord mode, evaluate sounds.`,
    hero: hero(E), sections,
    footer: `<footer class="foot"><p>Okto MultiWave Synth ${SPEC.APP.version} · <a href="manual-${a ? 'b' : 'a'}.html">Manual ${a ? 'B' : 'A'}</a> · ${SPEC.APP.copyright} · GPL v3 or later</p></footer>`,
  };
}
module.exports = { manual };
