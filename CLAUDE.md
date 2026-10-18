# CLAUDE.md — Okto MultiWave Synth: architecture and maintenance guide

**Okto MultiWave Synth** (beta 0.1, 2026-10-18, a test version) is the Wavelet Synthesizer beta 0.7 (commit f16b46a of
https://github.com/PierreArnaudGUYOT/Free-Wavelet-Synthesizer-VST, whose history this repository keeps) with **four
oscillators** instead of two engines (§3.3), the **chord keyboard** of the WaveChord work (§3.3f, shown by a CHORD MODE
button), 200 new presets, the **EVALUATE SOUNDS** listening test (§4, §5) and the CPU remarks of the load study (§3.5, §3.6).
Everything else in this guide is the synthesizer's and still applies; "beta 0.x" below are the Wavelet Synthesizer's versions
unless it says Okto MultiWave Synth. Identity: bundle `OktoMultiWaveSynth.vst3`, VST3 class IDs, VST2 ID 'OkMW', window / view
class names, presets file `OKTOMULTIWAVE presets.txt`, web storage keys `mw.*` / `ws.*`, so it installs next to the
Wavelet Synthesizer. The panel is 1100 × **860** (+ 120 while CHORD MODE is on, `CHORD_H`); `APP.version` restarts at beta 0.1
(`APP.base` names the synthesizer). Platforms: web and Windows (VST3 / VST2); the macOS files of the Wavelet Synthesizer are
still in the tree (the shared code stays portable) but no Mac build is made or tested: `mac.yml` only runs by hand.

The synthesizer is polyphonic and based on the discrete wavelet transform, created by Pierre Arnaud GUYOT
("OktoPierre"), GPL-3.0-or-later. It ships as a **web app** (plain JavaScript, Web Audio AudioWorklet, no dependency)
and a **VST3 / VST2 instrument** for Windows x64 (one self-contained DLL, native Win32/GDI+ editor). They run the same
engine, panel layout and presets. This file explains how the code is organised and the rules that keep the two
products identical. Read it before changing the DSP, the parameters or the presets.

## 1. Repository map

| Path | Role |
|---|---|
| `tools/spec.js` | **Single source of truth**: app metadata, parameters, panel layout, factory presets and their order. |
| `tools/gen_spec.js` | Generates `web/js/spec.js` (`WS_SPEC`) and `vst/src/generated/spec.h` (`kParams`, `kPresets`, layout tables) from `tools/spec.js` + `tools/wavelets.json`. Never edit the generated files. |
| `tools/wavelets.json` | Wavelet filter coefficients (generated with PyWavelets, MIT). |
| `web/js/core.js` | **Reference DSP** (`WSCoreFactory(SPEC)`): transforms, table building, `Engine`, formats. |
| `vst/src/dsp.h` | **1:1 C++ port** of `core.js` (same algorithm, same operation order). |
| `web/` | Web app: `index.html`, `css/synth.css`, `js/{spec,core,worklet,ui,app,demo,evaluate,midi,demo_data}.js`, `manual/` (generated). |
| `vst/src/` | Plugin: `plugin.cpp` (VST3 processor, controller, factory), `editor.cpp` (GUI, every system) + `editor_platform.h` (its drawing / window interface) + `editor_win.cpp` (Win32, GDI+) + `editor_mac.mm` (Cocoa), `platform.h` (files, folders, text: Windows / macOS), `bank.h` (presets library), `vst2.cpp` (VST2 entry point, Windows), `common.h`, `iids.cpp`, `version.rc`. |
| `vst/external/pluginterfaces/` | Steinberg VST3 interface headers (MIT, licence kept). No other SDK code is used. |
| `vst/build.bat`, `vst/install.bat` | Build with the portable llvm-mingw toolchain (`-static`); install to the VST3 system folder (elevated, path never pasted into a command). |
| `vst/build_mac.sh`, `vst/INSTALL-mac.txt` | macOS build (Xcode command line tools, universal arm64 + x86_64, ad-hoc signature) → `build/mac/`; the Mac zip's install guide. |
| `.github/workflows/mac.yml`, `tests/machost/` | The Mac plug-in built and tested on GitHub's Macs at every push (artifacts: release zip, test output). |
| `vst/devtest/` | Developer checks: `dsp_render.cpp` (C++ renders for the JS cross-check), `vst2_smoke.cpp` (VST2 host-like test). |
| `tools/dsp_compare.js`, `tools/dsp_cases.js`, `tools/dsp_selftest.js` | C++ ↔ JS comparison (251 cases, limit 2e-6); JS engine self-test (`dsp_selftest.js` still describes the Wavelet Synthesizer's two engines: not run for beta 0.1). |
| `tools/presets_top.js`, `tools/presets_new.js` | The 22 TOP Sounds (beta 0.7 parameters, converted by `convertLegacy`) and the 200 new presets (**generated**: do not edit). |
| `tools/make_presets.js`, `preset_dsl.js`, `preset_lab.js`, `recipes_*.js` | The new presets: one recipe file per group (`P(category, title, description, {A1, A2, B1, B2, g, win})`), the loudness / distinctness / contact-sheet tooling. `node tools/make_presets.js [--sheets] [-v]`. |
| `web/js/evaluate.js`, `vst/devtest/vote_session.cpp` | EVALUATE SOUNDS in the web app; the plug-in's is in `editor.cpp` (`vote*`), tested by `vote_session.cpp`. |
| `tools/make_demo.js`, `tools/midi.js`, `tools/demo/` | Demo songs: MIDI files (+ `SOURCE.md` licences) → `web/js/demo_data.js`. |
| `tools/manual/` | Manual generator: `mw.js` (the text of both manuals; tables from the spec), `lib.js` (helpers, page shell), `figs.js` (SVG figures computed with `core.js`), `shots.js` (screenshots), `top_desc.js` (the TOP Sounds' descriptions), `build.js`. |
| `tests/` | Independent test suites (see §8), `tests/quick.js`, `regress_v07.js` (+ `ref/v07/`, the published beta 0.7 engine), `idle_skip.js`. |
| `index.html`, `.nojekyll` | GitHub Pages home: redirects to `web/index.html`. |

## 2. The specification (`tools/spec.js`)

- **Parameters** (`add(key, name, short, {curve, fmt, min, max, def, structural, hidden, choices})`).
  The array order **is the VST3 ParamID**: *append only, never reorder or delete* — saved Live Sets and automation
  depend on it. `structural: true` means "rebuilds the wave tables" (see §3.4). `hidden` = bend, mod wheel, sustain
  (driven by MIDI, not shown on the panel).
- **Curves** `lin | exp | pow2 | int | choice` map normalized 0..1 ↔ plain values (`toPlain` / `toNorm`, identical in
  JS and C++). **Formats** (`fmt`) give the display text; adding a format means updating `FMTS` in `gen_spec.js`,
  `format`/`parse` in `core.js` and `formatValue`/`parseValue` in `dsp.h`.
- **Layout**: sections (cards) with widgets in panel coordinates (1100 × 860). Both GUIs (`web/js/ui.js` and
  `vst/src/editor.cpp`) are generated from it. `section(id, title, x, y, w, h, view, widgets, opts)`: `view` 0..3 = the card is
  shown only while that oscillator's tab is (A1 A2 B1 B2), −1 = always; `opts.vis` (+ `visOn`) = shown only while that parameter is on
  / off (the chord card: `chord_mode`). Widget fields (generated into `WidgetDef` too): `only: 'web' | 'vst'` (C++ `only` 1 / 2: the
  other GUI skips the widget), `vis` + `visOn` (the SYNC'd RATE / TIME knobs share their place with the free ones), `style`
  (`'engine'`: the four oscillator tabs, coloured A teal / B amber; `'value'`: a knob labelled with its value), `text`, `env`
  (an ADSR display: 0 amp, 1 mod, 2 an oscillator's own envelope, whose `param` is its `eon` + 1 .. + 4). Types include `manual`
  (the manual of the oscillator shown), `download` (web only, the GitHub releases page), `toggle`, `label`, `evaluate` (the
  EVALUATE SOUNDS button), `chordpads`, `chordname`, `strumplate`.
  Panel (beta 0.1): header y 0 (logo, zoom, **osc_view** tabs 296 w 224, preset box 526 w 220, EVALUATE 752, SAVE PRESET 862 (plug-in)
  / DOWNLOAD VST (web), MANUAL 936, master, meter); row 1 y 56: the tone card of the oscillator shown (544 × 260) | **OSC MIX**
  (564, 124 wide: four level knobs + SUB OSC) | SCOPE (696, 392); row 2 y 324: SCALE FILTER, POSITION, the oscillator card (TUNE |
  OWN ENVELOPE | PITCH ENVELOPE); row 3 y 472: AMP ENVELOPE, MOD ENVELOPE, EFFECTS; row 4 y 608: LFO 1, LFO 2, VOICE; keys section
  y 744 (CHORD MODE button, wheels, keyboard 898 wide); the chord card y 864, shown only while CHORD MODE is on (the plug-in
  window and the web `fit()` grow by `CHORD_H`). The credit `APP.panelCredit` is at the bottom left.
- **Oscillators** (§3.3): `SLOTS[s] = {id, mode, name, k: {field → parameter key}}` for A1 A2 B1 B2. The generated tables
  `kSlots` / `kSlotRole` (C++) and `SPEC.SLOTS` / `ROLES` / `LFO2_ROLE` (web) let the engine and both panels be written once for
  any oscillator. Validation at generation time: a LFO 2 role has the same range in every oscillator, the four envelope
  parameters of an oscillator are consecutive, the eleven bars are consecutive.
- **Presets**: `tools/presets_top.js` (the 22 TOP Sounds in the *beta 0.7* parameter form: `convertLegacy` in `spec.js` turns
  `ab_mix` / `engine` into `a1_lvl` / `b1_lvl` and gives B1 copies of the shared wavelet, filter and window) then
  `tools/presets_new.js` (200 presets in this version's parameters, names `"NNN A1A2 · Title"` where the letters say the
  oscillators used, `desc` = their one-line description, category one of `CATEGORIES` = Bass, Lead, Keys, Organ, Pad, Strings,
  Brass & Wind, Pluck, Bells & Mallets, FX, Drums & Perc). `PRESETS` = TOP then new, `TOP` = 22, `NEW_FIRST` / `NEW_COUNT`
  (C++ `kFirstNew` / `kNumNew`) = the presets EVALUATE SOUNDS rates. `rank` = the factory order, which is every category's
  list order. `TOUR` = the demo's preset sequence (`TOUR_PICKS`: a TOP Sound by name, a new preset as `new:<title>`; the first
  two are not heard). `DESCRIPTIONS` (name → text) is generated into `vote_data.h` (`kPresetDesc`) and the web spec. Values
  are validated against the ranges at generation time. Menus: web `presetList()` groups ★ TOP SOUNDS + one folding group per
  category + USER PRESETS; VST `editor.cpp presetMenu` = the library's lists. The VST stores the preset by name, so
  reordering never breaks saved Live Sets. `DEFAULT_PRESET` is the opening sound (`A · Warm Pad`).

## 3. The sound engine

### 3.1 Transform and tables
(This is per oscillator: four sets of layers can exist, §3.3. "Engine A / B" below means the subtractive / additive kind of oscillator.)
- One cycle = `N = 2048` samples. A periodic orthogonal DWT splits it into `NB = 11` detail bands; band *b* holds
  roughly harmonics 2^(b−2)…2^(b−1). Each band is resynthesised (inverse DWT of that band only) into a **layer**;
  engine A adds a `DRY` layer (the whole source) → `NL = 12` layers.
- Layers become **band-limited mip tables** (`NMIP = 11` levels, level *m* keeps harmonics 1…1024≫m) through an FFT,
  stored interleaved (`TW = (N+1)·NL` floats per level, one guard sample). A voice picks the mip level from its highest
  frequency so nothing aliases below `fmax`.
- **Engine A (subtractive)**: `sourceCycle` (saw, square, pulse, triangle, sine, noise) → DWT → `sparsify` (keep the K
  largest atoms) → layers. Per voice, `filterGains` gives one gain per band (low/high/band-pass/reject in *bands*, slope,
  resonance, key tracking, envelope, velocity); the **position window** (`windowValue`) cross-fades dry ↔ filtered
  inside part of the cycle.
- **Engine B (additive)**: `patternCoeffs` (ramp, mirror, alternate, Walsh, impulse, random) writes the atoms; each
  band layer is peak-normalised. Per voice: drawbars × tilt × per-band **scale envelope**, through the same scale
  filter, normalised by max(1, Σ drawbars).

### 3.2 Voices (`Engine.control`, `renderVoice`, `block`)
- Control rate `CTRL = 32` samples. Per block, once for all voices (`prepBlock`): LFO 2's role and amount, the unison pans and
  detune, the smoothed oscillator levels `lvlSm` (20 ms) → `m0` / `m1` / `live`, each oscillator's filter values, the additive
  bands' bar × tilt, attack rates, decays. Per voice and block: `control()` (pitch with glide, octave, fine, bend, LFO, mod wheel,
  each oscillator's tuning and pitch envelope, mip level, band gains ramped per sample, band envelopes of the additive
  oscillators, the window), `ampPass` (the AMP ENVELOPE with the velocity gain, per sample, into `envA`) and `ownPass` (an
  oscillator's own envelope, which multiplies `envA`).
- `renderSlot` → `renderTable` → `renderVoice(vc, n, s, mode, mips, rms, fade0, fadeInc, invert, gain0, gainInc)` renders one
  oscillator of a voice: unison copies (≤ 4, detuned and panned) with its own envelope × the amp envelope per sample;
  `renderSub` the **sub oscillator** (sine / triangle / PolyBLEP square, −1 or −2 octaves, unfiltered, once per voice). No render
  mutates the voice: the end state goes to `endLevel/endStage/endPh/endSubPhase` so that several renders of the same oscillator
  (table crossfade, morph, phase sets) start from the same state; `block()` commits it.
- Safety: the phase is wrapped with `x -= floor(x)` (a step can exceed one cycle), voices whose fundamental is above
  Nyquist are silent, notes are bounded 0–127.
- Polyphony 1–16 (mono = legato with last-note priority); portamento modes Off / Poly (each voice glides from its own
  last pitch, glide-aware voice allocation) / Legato only.
- **noteOff never depends on VOICES** (beta 0.4 fix, both engines): a preset can switch mono <-> poly between a note on
  and its note off. The key leaves the mono list first; the mono legato branch is taken only when voice 0 plays that
  note and another key is held; otherwise every gated voice playing that note is released (a stuck note before).

### 3.3 The four oscillators (Okto MultiWave Synth beta 0.1; replaces beta 0.2's A/B MIX)
- Oscillators **A1 A2** (mode 0, subtractive) and **B1 B2** (mode 1, additive). Fields of one oscillator (`SLOTS[s].k`): `lvl`;
  `wavelet`; the source (`wave width sparsity phase` | `pattern seed tilt bar1..bar11 atk spread body bright sus`); the scale
  filter (`ftype fcut fslope fres fkey fenv fvel`); the window (`pcen pwid pdep`); the tuning (`oct semi fine`); the own envelope
  (`eon ea ed es er`); the pitch envelope (`pamt` semitones at the start, `ptime` s to fall to 0; the pitch is
  `semis + tune + pamt · pe`, `pe` decaying per block like an envelope). **A1 and B1 keep the Wavelet Synthesizer's parameter
  names** (`a_wave`, `f_cutoff`, `b_bar1` …; A1 also `wavelet` and the filter / window; B1 has its own `b1_wavelet` and
  `b1_f*` / `b1_p*`); the others are clones named `a2_*`, `b1_*`, `b2_*` (`cloneParam`). `osc_view` (0..3) replaces `engine`: it is
  only the panel shown (structural so that the displays rebuild, but neither the processor nor the web app rebuild the sound's
  tables for it). `ab_mix` is gone.
- **Levels**: `lvlSm[s]` follows `p[lvl]` with a 20 ms time constant per block and is ramped per sample inside it; before the
  first block it simply takes the value (a sound loaded into a new engine never fades in: `E.setParam` / `setParam` snap it
  while `!started`). An oscillator whose smoothed level is < `LVL_EPS` is not rendered (`live[s] = 0`), and its tables are not
  built: `buildTables(params, true)` → `{needs, slots: [{mode, mips, rms, ph?, w2?} | null × 4]}` (C++ `Tables::slot[NS]`,
  `TableRef`, `SlotRef`). `buildTables(params, false)` builds the raw layers of the oscillator **shown** for the displays.
  Rebuild only when an oscillator's level reaches or leaves 0 (`levelEnds`: web `setParam`, VST `process`).
- **Own envelope**: when `eon` is on, the oscillator's output is multiplied by its own ADSR (`ownPass`, advanced even while the
  oscillator is not rendered, so it is in step when it re-enters); it multiplies the AMP ENVELOPE, so it can only shorten.
  A re-entering additive oscillator restarts its band envelopes. **Pitch envelope**: `sl.pe` starts at 1 on every note.
- **LFO 2** targets are *roles* (`ROLES`, `LFO2_ROLE`, `kSlotRole[4][10]`): each role is applied to every oscillator that has it
  (SOURCE PHASE only to the subtractive ones) by the same amount. WAVELET MORPH (`wav2`, `wmorph`, `lfo_wav`, `env_wav`) and
  SOURCE PHASE moved by LFO 2 act on each oscillator (`w2` sets, `ph` sets, §3.3b / d).
- **Compatibility**: the 22 TOP Sounds are the beta 0.7 sounds (`tests/regress_v07.js`: ≤ 1.5e-7 of the peak against the published
  engine in `tests/ref/v07/`; that test sets the old engine's `mixSm` to the preset value because the old engine ramped
  it from the default). A Wavelet Synthesizer state is not read (a different plug-in).

### 3.3b WAVELET MORPH (beta 0.3; per oscillator since Okto MultiWave Synth: the `w2` sets are built for every oscillator that plays)
- Parameters `wav2` (structural), `wmorph`, `lfo_wav`, `env_wav` (appended; all default 0). `morphNeeded(params)` =
  (`wmorph > 0 || lfo_wav > 0 || env_wav ≠ 0`) and `wav2 ≠ wavelet`. Then `buildTables` also builds the whole sound
  (`buildSound`, with its own alt set when A and B are mixed) with `wavelet = wav2`: JS `tb.w2 = {mode, mips, rms, alt}`,
  C++ `Tables::w2*` / `TableRef::w2*`.
- Per voice, `control()` computes the morph position `clamp(wmorph + lfo_wav·lfo + env_wav·mod, 0, 1)` at the end of the
  block (`wm1`, from `wm0`); `renderMorph` renders the main set with share 1 − wm and the WAVELET 2 set with share wm
  (`renderSetK`, ramped per sample, sub oscillator only once). Without WAVELET 2 tables `renderMorph` is exactly
  `renderSet`: **bit-identical** sound when the morph is off.
- Rebuild when `morphNeeded` changes: web `setParam`, VST `process` (`morphEnds`: one of the three amounts leaves or
  reaches 0; `wav2` is structural).

### 3.3c LFO 2 (beta 0.3; its targets are roles applied to every oscillator, §3.3)
- `lfo2_shape`, `lfo2_rate`, `lfo2_amt`, `lfo2_target` (appended; AMOUNT 0 by default = bit-identical). `LFO2_TARGETS` in
  `tools/spec.js` (the lfo2_target choices, all linear parameters) → web `SPEC.LFO2_TARGETS`, C++ `kLfo2Targets`.
  `lfo2Tick` (own phase, S&H `rng(778)`) after `lfoTick`; in `control()` `d2 = amt · lfo2 · 0.5 · (max − min)` of the
  target and `lfo2Value(p, i, t2, d2)` replaces the target's value (clamped; POSITION wraps with the window). The layout
  widget `menu` (W_MENU) shows a choice parameter as a drop-down (web `ui.menu`, VST `choiceMenu`).

### 3.3d SOURCE PHASE (beta 0.4; subtractive oscillators only, the phase sets are built per oscillator)
- `a_phase` (appended, structural, `fmt: 'deg'`, 0–1 of a cycle, default 0). `sourceCycle(wave, width, phase)` reads the
  wave at `frac(i/N + phase)` exactly (no interpolation); the NOISE cycle is shifted by `round(phase·N)` whole samples; mean
  removal and peak normalisation unchanged. Phase 0 is the beta 0.3 source **bit for bit** (`dsp_selftest` 8; all older
  presets render identically). Engine A only (a shifted engine-B cycle has the same timbre); the knob sits right of the
  SOURCE CYCLE display, which draws the moved wave. Why it matters: the periodic DWT is shift-variant (band b commutes only
  with shifts by multiples of 2^(12−b) samples), so the scale filter, sparsity and window act on other atoms.
- **Moved by LFO 2**: the last `LFO2_TARGETS` entry. `phaseModNeeded(params)` = target `a_phase`, amount ≠ 0, engine A
  playing. Then `buildTables` also builds every engine-A set (main, alt, WAVELET 2, WAVELET 2 alt) at the other
  `PHASE_K − 1` phases `a_phase + k/PHASE_K` (`PHASE_K = 12` in `core.js` and `dsp.h`; not a power of two, so neighbours
  differ in every band): JS `set.ph[k − 1] = {mode, mips, rms}`, C++ `Tables::phMips[slot][k − 1]`, `TableRef::phM[slot][k]`
  (k = 0 the set itself; slots 0 main, 1 alt, 2 w2, 3 w2 alt). `control()` puts the voice at `q = d2·PHASE_K` wrapped into
  [0, PHASE_K) (`ap0` → `ap1` across the block); `renderTable` renders the sets on each side of q with shares
  `1 − |q − k|` (round the cycle; the shares of a block start and end each add up to 1), the sub oscillator once; without
  `ph` it is exactly `renderVoice`. Rebuild when `phaseModNeeded` changes (web `setParam`; VST `process` `phaseEnds`: AMOUNT
  leaves / reaches 0, TARGET to / from PHASE). Cost (measured): 12.4 MB of tables instead of 1.0 (24.8 MB with WAVELET MORPH), builds of 38 ms
  in C++ and 77 ms in JS instead of 3 and 8 (68 / 159 ms with the morph), about 1.5 × the voice CPU; nothing when off.
- Compatibility: states and presets without `a_phase` get 0 (web `applyKeyed` defaults, VST `readState` `sawPhase`, the
  library starts from the defaults). Adding the PHASE target appended a choice to `lfo2_target` (plain values unchanged).
- Presets: the "Source Phase" section: 100 engine-A presets in beta 0.4 (then last), every phase checked by
  `tools/phase_effect.js` (≥ 6 dB on some harmonic, ≥ 4 dB among those within 20 dB of the strongest); beta 0.5 keeps 44,
  second in `CATEGORIES` (last again since beta 0.7).

### 3.3e TEMPO SYNC (beta 0.6, plug-in only)
- `fx_dsync` / `fx_ddiv`, `lfo_sync` / `lfo_div`, `lfo2_sync` / `lfo2_div` (appended; SYNC off by default). The note values
  are `DELAY_NOTES` / `LFO_NOTES` in `tools/spec.js`, ordered by length (T = triplet, D = dotted), their lengths in beats
  `DELAY_BEATS` / `LFO_BEATS` (web `SPEC.*`, C++ `kDelayBeats` / `kLfoBeats`).
- `Engine.tempo` (BPM, 0 = none): `setTempo` (anything not finite or ≤ 0 → 0). `delaySec()` = TIME, or with SYNC on and a
  tempo `beats · 60 / tempo` capped at `DLY_MAX = 4` s; `lfoHz(sync, div, rate)` = RATE, or `tempo / 60 / beats`. The note
  index is rounded and clamped (`noteAt`). The delay buffer holds `DLY_MAX + 0.1` s (it was 1.1 s).
- The web app never sets a tempo (no DAW): its SYNC widgets are `only: 'vst'` and its sound ignores the SYNC parameters.
  The VST3 processor asks for the tempo (`getProcessContextRequirements` → `kNeedTempo`) and calls `setTempo` at each
  `process` with `ProcessContext::tempo` when `kTempoValid`, else 120 BPM; VST2 (`vst2.cpp`) reads it through
  `audioMasterGetTime` (the `TimeInfo` layout, `kTempoValid = 1 << 10`) into the same `ProcessContext`.
- The longer delay buffer changes rounding of the read position: 2 presets (Steel Pluck, Phase Glitch) differ from
  beta 0.5 by < 4e-9 (−170 dB); the 148 others are bit-identical.

### 3.3f CHORD KEYBOARD (Okto MultiWave Synth beta 0.1)
- Spec: `CHORDS` (label, name, suffix, intervals; append only, `chord_type` stores the index), `CHORD_KEYS` (the type of each
  selector key C..B: white = major / bright family, black = minor / altered / bare), six **perf** parameters appended:
  `chord_mode`, `chord_type`, `chord_oct` (selector octave = MIDI 24 + 12·k, default k 2 = C3–B3, middle C = C4 = 60),
  `chord_voicing` (Stacked / Folded, default Folded), `chord_bass`, `chord_strum` (0–0.1 s). Generated: web `SPEC.CHORDS` /
  `CHORD_KEYS`, C++ `kChords` / `kChordKeys` / `ParamDef::perf`.
- **perf** = a performance setting: on the panel and automatable, saved in the plug-in state (`WSY1`) and the web state
  (`oc.state`), but **never in a preset**: web `toKeyed()` (presets, export) skips it, `applyKeyed` / `loadPreset` / the demo's
  `applyPreset` leave it as it is, it never marks the preset modified; VST `applySound`, `exactPreset`, `performEditPlain`
  (dirty) and the library (`paramLines`, `parseParamLine`, `adjust`, the adjusted-equals-built-in test) skip it.
- **Chord layer** (`core.js` `keyOn` / `keyOff` …, ported 1:1 in `dsp.h`): every player key goes through it (web worklet
  `'on'` / `'off'`, VST3 note events, VST2 MIDI, the editors' keyboards via `SharedState::Ev` kind 0); the demo sequencer
  calls `noteOn` / `noteOff` directly. CHORD off: `keyOn` = `noteOn` (bit-identical). CHORD on: selector key = sets
  `p[chord_type]` + `chordTypeChanged`, silent; above it the first key held is the root → `startChord` (`chordNotes`: the type's
  intervals, Folded = pitch classes in the C..B octave of the root, BASS = root pitch class an octave below, cut from the
  top to VOICES with the root then the bass kept, > 127 dropped), other keys = plain notes; below it = plain notes.
  Notes are **reference-counted** (`holdCnt`, `holdOn` / `holdOff`): a note shared by the chord and a held key sounds until
  both release it. STRUM: `strumDue[k] = clock + k·strum·sr`, started by `strumTick()` at the start of each `block`
  (block boundaries, identical in JS and C++; `clock` counts samples). `setParam(chord_mode | chord_oct)` →
  `chordReset`; `allNotesOff` / `allSoundOff` → `chordClear`.
- **Strum plate**: `plateNotes(root, type)` (the chord's pitch classes over the three octaves above the root's octave, ≤ 12),
  `plateOn` / `plateOff` (plain counted notes whatever CHORD says; web `'plateon'` / `'plateoff'`, VST `Ev` kind 1). The plate
  uses the last root (`chordLastRoot`) when no root is held.
- **Chord type from a selector key → the host**: the VST3 processor writes it to `plain[]` and to
  `data.outputParameterChanges`; `SharedState::chordTypeEdits` lets the editor push it to the controller too (hosts that do
  not forward output changes); VST2 (`vst2.cpp`) gives the processor an `outChanges` list and forwards it (host automate,
  controller sync). Web: the worklet's `disp` message carries `chord` {root, last, notes, type, changed}; `app.js` follows
  `type` only when `changed`.
- Panel: the **CHORD MODE** button (a `toggle` on `chord_mode` in the keys section, left of the wheels; the web app draws toggles too) shows
  the card `section('chord')` at y 864 (`vis: chord_mode`; the panel grows by `CHORD_H` = 120: web `fit()`, plug-in `requestResize`, which
  `onTimer` calls when the parameter changes) with `chordpads` (W_CHORDPADS, the 12 pads in
  the selector octave's layout; a click sets the type and switches CHORD on), `chordname` (W_CHORDNAME), KEYS OCT step,
  voicing seg, BASS toggle, STRUM knob, `strumplate` (W_STRUMPLATE, drag across = plate notes). The keyboards tint the
  selector octave while CHORD is on. Same geometry in `ui.js` (`padRects`) and `editor.cpp` (`padRects`).
- Tests: `dsp_selftest` 11 (18 cases), `dsp_compare` / `dsp_render` 3 chord scenarios (`CHORD_SCRIPT` / `kChordScript`: keys,
  plate, all notes off), `quick.js` (a strummed chord and a plate note in the JS engine), `vst2_smoke` (MIDI selector key →
  Chord Type + automation, a root → the chord, release). Manual: `shared.js chordSection` (both manuals), screenshots
  `chord-card.png`, `chord-keys.png`.

### 3.4 Table rebuilds
- Structural changes rebuild tables **off the audio thread** and switch with a 512-sample crossfade (`setTables`).
- Web: `app.js` builds the tables in a **Worker** (`startWorker` / `scheduleBuild` / `deliver`; a `data:` URL made of
  `WSCoreFactory.toString()`, so it works from `file://`; every request carries a sequence number and a result older than the last
  delivered is dropped; the display tables (`build(inWorker)` for the oscillator shown) use the same path; without Worker it falls
  back to the main thread). A preset load builds synchronously (the sound must be there at once); `heldTables` keeps the tables
  built before the audio starts. The arrays are transferred to the worklet (`'tables'` message).
- VST: `Processor` owns 4 `Tables` sets with states `kFree/kBuilding/kPending/kActive`, a worker thread builds them
  (`structVersion` / `builtVersion`), the audio thread picks up `pendingIdx` and recycles released sets. In **offline
  rendering** (`kOffline`) the rebuild is synchronous so exports never depend on thread timing.

### 3.5 Effects and output (`block`)
Voices → **drive** (tanh) → **triple chorus** (beta 0.2: three 6–12 ms delay lines swept by a slow and a fast LFO 120°
apart, L / C / R, on the mono sum) → **ping-pong delay** (up to 4 s, tempo sync §3.3e) → **reverb** (Freeverb topology) → 10 Hz **DC blocker** →
master volume (smoothed) → **soft limiter** (`LIMIT_T = 0.7`, never above 0 dBFS). `VOICE_GAIN = 0.4` gives chord headroom.
The C++ side also sets FTZ/DAZ during `process`. Okto MultiWave Synth beta 0.1 (CPU remarks, `Revue.md`):
- the chorus' LFOs are rotating vectors: `sin` / `cos` of both phases once per block, turned by one step per sample
  (`cosA sinA cosB sinB`), the three taps use `sin(a + 2πc/3) = sin a · CH_COS[c] + cos a · CH_SIN[c]`;
- `exp(x · LN10/20)` instead of `pow(10, x/20)` (filter gains, drive, master); `dwt` / `idwt` wrap with `& (M − 1)`;
- the smoothing constants of the delay time (0.0005), its filter (0.35), the master level (0.002) and the reverb damping (0.25) are
  *per sample at 48 kHz* (`rateCoef`: `1 − (1 − a)^(48000/sr)`, exactly `a` at 48 kHz), so the sound no longer depends on the host's rate;
- **idle rule** (`block`): with no voice, no table fade and `quiet ≥ quietNeed` the block is not computed (zeros out, `vol` and
  `dlyT` take their targets, the display state is published). `quiet` counts the samples whose output stayed under `QUIET_PEAK` = 1e-9
  with no voice; `quietNeed = 1.5 · max(delay time, dlyT) + 4096` while the delay can sound (an echo's gap must never fit in it),
  else 4096. `tests/idle_skip.js` checks that dry, delay, reverb and chorus sounds are identical with and without it;
- the reverb's 16 combs and 8 all-pass filters are flat arrays in JS (`cB cLen cI cF aB aLen aI`).

### 3.6 JS ↔ C++ parity (non-negotiable)
`core.js` is the reference; `dsp.h` must follow it operation for operation (same constants, same order of floating-point
operations, Float32 buffers where JS uses `Float32Array`). **Both builds use `-ffp-contract=off`** (`vst/build.bat`, the
cross-check): clang would fuse multiply-adds on Apple silicon and change the sound. The rule is "same operations, same order";
what differs is the maths library (`sin`, `exp`, `tanh`) and float rounding of the buffers: the cross-check limit is **2e-6 of full
scale** (it was 1e-5 in the earlier code, 400 times looser than the real 2.4e-7; the beta 0.1 worst case is 1.8e-7). After
**any** DSP change, compile `vst/devtest/dsp_render.cpp` (`-ffp-contract=off`) and run `node tools/dsp_compare.js <dir>`
(`--list <dir>` first to write the cases), then `node tests/regress_v07.js` and `node tests/idle_skip.js`.

## 4. Web app (`web/`)
- `spec.js` (generated) → `core.js` → `worklet.js` (AudioWorkletProcessor; also a sample-accurate **sequencer** for the
  demo) → `ui.js` (`SynthUI`: builds the panel from the layout; knobs, segments, drawbars, canvases, preset menu,
  demo button, MIDI-learn right-click) → `app.js` (parameters, presets, tables, audio lifecycle, MIDI, keyboard,
  manuals overlay) → `demo.js` (demo player) with `midi.js` (Standard MIDI File reader) and `demo_data.js` (generated);
  `evaluate.js` (rating session).
- The worklet code is serialised (`WSCoreFactory.toString()`, `WSWorkletMain.toString()`) and loaded from a **data:
  URL** so the app works from `file://` (blob: URLs fail there).
- Audio lifecycle: one playing window at a time (`localStorage 'mw.audioOwner'` + `storage` event), `pagehide` closes
  the AudioContext.
- MIDI (Web MIDI, all inputs): notes, bend, CC1, CC64, CC120/123, **channel filter** (`ws.midiCh`), **Program Change**
  → preset, **MIDI learn** (`ws.ccMap`: CC → parameter key; validated on load). Stored data is untrusted: names are
  escaped / set with `textContent`, values clamped.
- Demo: songs from `demo_data.js`; every song plays the **preset tour** `WS_SPEC.TOUR` (`tools/spec.js` `TOUR_PICKS`, written out so
  that new presets never change the demo), one preset about every 4 s snapped to chord onsets (`tourScenes`); the window shows
  `TOUR_INTRO` (the idea of four oscillators in plain words) during the first presets, then `presetSummary` (the oscillators that
  play, their waves / patterns, tuning, own and pitch envelopes, effects). The old animated-scene demos were removed.
  (The paragraph below is the Wavelet Synthesizer's.) `make_demo.js` `start` cuts the opening chords; the song keeps `origin` (7.84 s) and
  `tourScenes(..., origin)` computes the grid on the whole piece, then starts with the preset playing at the cut, so the
  cut changes nothing after it. `demo.tourPlan(i)` (`WS_TEST.demoTour`) returns the plan for tests and the manual.
  beta 0.7 tour: OktoPierre's 16 sounds of the earlier tour mixed one by one with his TOP Sounds (`EXPECTED_TOUR` in
  `test_demo.js`); during the first presets the demo window shows `TOUR_INTRO` (the idea in plain words, one sentence
  per preset) instead of the preset summary.
  Other songs use animated scenes.
- Preset browser (beta 0.3, `ui.makeBrowser` / `renderBrowser`): a `#browser` element beside `#device` (the panel keeps
  its 1100 × 720 box: the test suites locate it by that shape), scaled with it by `fit()`; lists = TOP Sounds (the first
  `TOP` presets) and the categories sorted by `rank`, as the plug-in's defaults; selection only. beta 0.5: the arrow keys
  (`app.js` keydown → `ui.browserKey`: ↑ ↓ the sound above / below, ← → the category; browser hidden: `presetStep`). Open state
  in `localStorage 'mw.browser'`; `#nobrowser` in the address leaves it out (manual screenshots, `tools/manual/shots.js`).
  The preset name opens it when hidden, else the classic menu.
- beta 0.6 **welcome window** (`index.html` `.welcome`, shown at page open): "Run the demo" (`#w-demo`), "Play the synth"
  (`#start-btn`, starts the audio, plays no note; "MIDI supported"), "Download the VST" (`#w-vst`, the GitHub releases
  page, `target _blank rel noopener`). Browsers allow sound only after a click: each choice is that click. `setOverlay`
  makes the panel `inert` while it is shown; it comes back (paused audio, another window playing) with the reason in
  `#w-sub`. Header: DOWNLOAD VST (`VST_RELEASES` in `ui.js`) and one MANUAL button (the manual of the engine shown, in
  the overlay viewer).
- **EVALUATE SOUNDS** (`evaluate.js`, `WSEvaluate(api)`): the header button; a window over the panel (a bar over the keyboard while a
  preset is modified). Passage = notes of `WS_DEMO_SONGS[0]` starting in [12.9 s, 17.9 s) cut at the end, played by the worklet's
  sequencer after `LEAD` = 0.12 s with the demo's playing rules (`SAFE`: 16 voices, octave 0, no glide, attack ≤ 0.08 s, delay mix ≤ 0.1,
  feedback ≤ 0.3). Stars 1–10 (keys 1–9, 0), above 5 `ASK`: modify → the preset as designed (+ the recorded change), `Keep initial
  settings` / `Record preset change` (the parameters that differ, `EDITABLE` = sound parameters only). State in `localStorage`
  `mw.votes`; the file `okto-multiwave-ratings.txt` through `showSaveFilePicker` (Edge / Chrome, rewritten after every answer) or a
  download. The plug-in writes the same text (§5); the line formats are the contract between them.
- Test hooks: `window.WS_TEST` (used by the test suites). `node.onprocessorerror` tells the player when the worklet fails. The animated
  canvases are drawn when `setLive` saw a change (`liveVer`), while the meter falls back and twice a second at rest.
- Other storage keys: `ws.user` (user presets), `ws.state`.

## 5. Plugin (`vst/src/`)
- **No SDK helper library**: `plugin.cpp` implements `IComponent`/`IAudioProcessor` (Processor) and
  `IEditController`/`IMidiMapping` (Controller) directly on the interface headers, plus the factory and minimal
  `IMessage`/`IAttributeList` (argument-checked).
- Processor ↔ controller: `IConnectionPoint` messages `"ws.hello"` / `"ws.shared"` carry the id of a process-wide
  `SharedState` registry entry (`weak_ptr`, never a raw pointer): live display data and on-screen keyboard notes.
- **State**: processor `"WSY1"` = (id, double) pairs, validated (count, id range, finite, clamped); controller `"WSC2"`
  = zoom, modified flag, **preset name** (older `"WSC1"` index states are translated through `kBeta01Order`). beta 0.5: a
  name of `kLeftOutPresets` is kept as `formerName` (`EditorHost::formerPresetName`: the panel shows it, getState
  writes it back, SAVE PRESET saves it to the user bank); any other unknown name is still ignored.
- `editor.cpp`: the panel, drawn from the layout tables, zoom menu, preset popup, the MANUAL button (beta 0.6: one button,
  opens `Contents/Resources/manual/manual-a.html` or `manual-b.html` of the bundle for the engine shown), the SYNC toggles
  (`W_TOGGLE`, a gesture 0 / 1; widgets with `vis` are redrawn when their choice parameter changes) — the same code on
  both systems. It draws through `Canvas`
  (`editor_platform.h`: rectangles, rounded rectangles, ellipses, arcs, lines, polygons, linear gradients, text with
  GDI+'s layout — 1/6 em margins —, a nearest-neighbour image) and talks to the system window through `EditorWindow`
  (invalidate, size, capture, modifier keys, pop-up menus as a `MenuItem` tree, message / Yes-No / save windows, save-file
  dialog, reveal, open). The window calls back through `EditorEvents` (paint, timer, mouse, wheel, `key`, `testCommand`). beta 0.5 keys: a click in
  the browser calls `EditorWindow::takeFocus` (Windows `SetFocus`, `WM_GETDLGCODE` = arrows, other keys sent on to the
  parent window; macOS first responder once wanted, `keyDown:` passes other keys up the responder chain); hosts also call
  `IPlugView::onKeyDown` (VST2 `effEditKeyDown`); `Editor::key` counts a key arriving both ways within 12 ms once.
  - `editor_win.cpp`: Win32 child window + GDI+ into a back buffer, DPI-aware (exactly the beta 0.3 Windows code: keep
    its screenshots identical, `tests/vst3host` compares them); the save window is an in-memory dialog template.
  - `editor_mac.mm` (ARC): a flipped NSView of a class created at run time under a name unique to the binary (two
    versions in one host never share a class), Core Graphics + Core Text (system font at 95 %: it is ~5 % wider than Segoe
    UI), sizes in points (no `setContentScaleFactor`: macOS scales for Retina), a 30 Hz `CFRunLoopTimer` in the common
    modes, NSMenu (target/action, tab → "  (n)"), NSAlert windows (the save window: an accessory view, text field
    `ws.name`), NSSavePanel; Cmd = Ctrl (reset), Control-click = right-click; modifier keys read from the mouse event;
    `wsTestCommand:` = the Windows `WM_APP + 1` test hook.
- **Preset library** (beta 0.3, VST only): `bank.h`, `Library::get()` (one per process, mutex, reads the file again
  when its write time or size changes: several instances; Okto MultiWave Synth: readers look at the file at most every 500 ms, every edit
  and `refresh()` look first; the plug-in's folder is asked once; a file longer than 16 MB is read cut and `tooBig` makes every edit
  refuse, so it is never written back cut; `writeTextFile` flushes before it replaces). One text file `OKTOMULTIWAVE presets.txt` next to the `.vst3`
  bundle folder (`libraryFolder`; `WS_PRESETS_FILE` / `WS_PRESETS_EXPORT` / `WS_PRESETS_IMPORT` for tests), written atomically after every
  edit (an error leaves the state unchanged): `######## FACTORY PRESETS` (every preset: `Preset:` its name now,
  `Factory:` its built-in name = the key, `Adjusted: yes|no`, optional `Deleted: yes`, then `  key: value   (Name: shown)`
  for the parameters that differ from the defaults, ENGINE and A/B MIX always; only adjusted blocks override the built-in
  values), `######## LIST ORDER v3` (beta 0.5 "v2", beta 0.7 "v3": what TOP Sounds and each category hold, in order,
  `N. built-in name`; a preset the file does not know — no `Factory:` block — takes its default places, a known one in no
  category goes back to its own; files without "v3" — beta 0.3 to 0.6 — keep their adjusted / deleted presets and bank but
  not their lists, which are rebuilt with this version's TOP Sounds and categories;
  an adjusted block equal to the built-in preset is not "adjusted"), `######## USER BANK` (12 `kBankSections`, `Preset:`, `From:`, values). A
  beta 0.3 user-bank file (`Okto MultiWave Synth user bank.txt`) is read when the library file does not exist. Parsing
  ignores unknown lines and clamps values. `importFrom` (beta 0.4 IMPORT) reads and checks another file (a `Preset:` line), parses it
  over the built-in state, keeps the current file as `OKTOMULTIWAVE presets (backup YYYY-MM-DD HHMM[ n]).txt` (never over an
  earlier backup), then commits; an error leaves the library unchanged. The controller takes factory values and names from the library (`loadPreset`,
  `exactPreset`, `findPreset` = name now or built-in name, new instances' default preset, VST2 program names).
- **Editor, presets** (beta 0.3): the **preset browser** (`kBrowserW` = 360 logical px added at the right while open;
  `browserOpen` kept by the controller, written in `"WSC2"` as a trailing int32 only when closed, so other states stay
  byte-identical): FACTORY / USER BANK tabs, the lists of the library, one click loads, ▲ ▼ `moveInList` / `moveUser`,
  buttons TO BANK, RESTORE, DELETE, EXPORT, IMPORT (beta 0.4, `bankImport`, `kCmdBankImport` 903, `openFileDialog`:
  GetOpenFileNameW / NSOpenPanel; FILE = "Show the presets file" in the right-click menu); the list's scroll bar
  (beta 0.4, `bScrollR` 12 px, `bThumb` ≥ 28 px, hit code 30: drag the thumb, a click on the bar centres it there);
  beta 0.5: a row dragged onto a category (`rowDrag` / `dropCat`, the category lit, the name under the pointer) =
  `moveFactory` (`Library::moveToCategory`, back to its own category at its rank; TOP Sounds = `setTop`) or, in the
  user tab, `moveBank` (`moveUserTo`, refused on a namesake); right-click on a row = its menu (Move to ▸, Back to …,
  Add to / Remove from TOP Sounds: `kCmdMoveTo` 7000 + list, `kCmdTopAdd` 7100, `kCmdTopRemove` 7101 on `ctxRow`; as test
  commands they act on the sound playing); ★ = in TOP Sounds now (`Library::inTop`); **SAVE PRESET** (`kSaveBtn`, the preset box is shorter) adjusts the
  factory preset (`Library::adjust`, then `presetStored`) or replaces the bank sound; DELETE = `setDeleted` (lists and
  ◀ ▶ skip it; the right-click menu's "Deleted presets" brings it back). The preset name opens the browser, a right-click
  the classic menu. Save window: an in-memory dialog template (name, optional section and note). Commands also reachable
  as `WM_APP + 1` (test hook). Controller: `loadUserSound` (group edit, keeps `presetIdx` for ◀ ▶), `userPresetName()`;
  the state `"WSC2"` stores `"USER · name"` for a bank sound (name buffer 512, no NUL byte; an unknown name is taken only
  with that prefix). Knobs with ≤ 5 positions: 24 px per step, a click = next value (web `dragBehaviour` too). The
  panel's logo reads OKTOMULTIWAVE / WAVELET SYNTHESIZER (both products; the plug-in keeps its name).
- **EVALUATE SOUNDS in the plug-in** (`editor.cpp`, the `vote*` block; phases `V_START V_PLAY V_VOTE V_ASK V_EDIT V_END`): drawn on the
  `Canvas` (the card `kVoteCard`, the bar `kVoteBar` over the keyboard while a preset is modified), buttons laid out at paint time
  (`voteButtons` stores their rectangles; hit-testing needs one paint first). The **passage** is played by the processor, not
  the editor: `vote_data.h` (generated by `gen_spec.js`: `kVotePassage` events, `kVotePassageLen`, `kPresetDesc`);
  `SharedState` `seqStart` (+1 = play from the start) / `seqStop` (1 = release, 2 = silence everything) / `seqDone` / `seqTime`;
  `Processor::process` merges the passage events with the host's in sample order (`engine.noteOn` / `noteOff` directly, not
  through the chord layer, counted per pitch) after the tables of the preset just loaded are in use (`seqWait`). `EditorHost::setSound`
  (controller: `applySound`, `presetIdx`, `dirty`) loads a preset's raw values (`kPresets[k].v`, not the library's adjusted ones) and the
  session restores the sound played before it on Stop. The ratings file: `voteDir()` = `MW_VOTES_DIR` (tests) or `Documents\Okto
  MultiWave Synth` (`userDocumentsFolder()` in `platform.h`: the Documents known folder, else the local application data folder, else
  the temporary folder; `makeFolder`), `ratings-location.txt` remembers a file chosen with "Change file…"; an existing file must start
  with `Okto MultiWave Synth - preset ratings`. Rewritten after every rating or change (`voteSave`, atomic), read at the next session.
  While a session runs the browser, SAVE PRESET, the arrow keys and the preset arrows are blocked.
- `vst2.cpp`: `VSTPluginMain` with VST 2.4 declarations written from the public binary layout (no Steinberg VST2 file).
  It hosts the same Processor + Controller in-process (parameter queues, event list, chunk `"WSV2"` = both states,
  programs = factory presets, editor via `IPlugView` + `IPlugFrame`).
- **Bundle**: `OktoMultiWaveSynth.vst3/Contents/x86_64-win/OktoMultiWaveSynth.vst3` (VST3) + a copy named
  `OktoMultiWaveSynth.dll` (found by hosts scanning a VST2 folder) + `Contents/Resources/` (manuals, licences).
  Only Windows system DLLs and the UCRT are imported.
- **macOS bundle**: `OktoMultiWaveSynth.vst3/Contents/MacOS/OktoMultiWaveSynth` (universal Mach-O bundle exporting only
  `GetPluginFactory`, `bundleEntry`, `bundleExit`; `-fvisibility=hidden`), `Info.plist` (BNDL,
  `com.oktopierre.oktomultiwavesynth.vst3`, version from `WS_VERSION`), `PkgInfo`, `Resources/` (manuals, licences),
  ad-hoc signed. Same class IDs as on Windows. The presets file is written next to the bundle (`libraryFolder`: up from
  `Contents/MacOS`), so the player installs into `~/Library/Audio/Plug-Ins/VST3`. Flush-to-zero: MXCSR on x86, FPCR.FZ on
  Apple silicon. No VST2 on macOS.

## 6. Security hardening already in place (keep it)
MIDI file reader bounds every length to the bytes present (VLQ ≤ 4 bytes, binary-search tempo map); oscillator phase
wrap and above-Nyquist silence (prevented an out-of-bounds read); state/chunk/attribute parsing validated; MIDI-learn
and channel data validated; `install.bat` relaunches itself elevated instead of building a command line.
beta 0.6 (independent security review, no intentional malicious code found): `reveal` starts explorer.exe by its full
path (`GetSystemWindowsDirectoryW`); the presets library limits a file from someone else (`kMaxBankSounds` 2000 — IMPORT
refused above, `putUser` refuses a new sound when full —, `kMaxNameBytes` 160 via `clipName`, IMPORT refused at 16 MB);
`setTempo` holds the tempo at 1000 BPM (JS and C++); the processor and VST2 ignore sample rates outside `kMinRate` /
`kMaxRate` (8 kHz – 1.536 MHz, `common.h`); the web app keeps only well-formed `ws.user` entries. Known and accepted: the
test hooks (`WS_PRESETS_*` environment variables, `WM_APP + 1`, `wsTestCommand:`) stay in the release build because the
suites drive the shipped binary (they cross no privilege boundary); no CSP meta (the worklet is a `data:` URL and the app
runs from `file://`); GitHub Actions pinned by tag.

## 7. Building and manuals
- `vst/build_mac.sh` (macOS): `plugin editor iids` + `editor_mac.mm` (ARC) + `funknown.cpp`, universal, **`-ffp-contract=off`**
  (clang fuses multiply-adds on Apple silicon by default, which would change the sound), ad-hoc `codesign`. The Mac zip is
  made by the workflow (`ditto`, so the bundle keeps its permissions and signature), not on Windows.
- `vst\build.bat`: regenerates the spec (if Node is present), compiles `plugin editor editor_win iids vst2` + `funknown.cpp`
  (`-ffp-contract=off`), links statically (`-lgdiplus -lgdi32 -luser32 -lshell32 -lole32 -luuid`), copies the `.dll`, manuals and licences
  into the bundle. The DLL cannot be relinked while a host has it loaded.
- Manuals: `node tools/manual/shots.js` (UI screenshots, muted headless Edge) then `node tools/manual/build.js a b`.
  The text is generated from the spec (ranges, defaults) and from `core.js` (figures).

## 8. Tests
Okto MultiWave Synth beta 0.1 status. **Maintained and passing**: `tests/quick.js` (20 s: syntax, generated files up to date, JS engine
on the 222 presets + chord layer + hostile MIDI, the VST3 host's `params,audio,offline,attrlist` sections, the web app's first
checks), `tests/regress_v07.js`, `tests/idle_skip.js`, `tests/web/smoke.js` (four oscillator views, CHORD MODE, no console error),
`tools/dsp_compare.js` + `vst/devtest/dsp_render.cpp` (251 cases), `vst/devtest/vote_session.cpp` (the plug-in's EVALUATE SOUNDS
window and CHORD MODE in an off-screen window: the host-side parameters, the audio, the ratings file, screenshots; build line at its
top; it needs `MW_VOTES_DIR`, which it sets itself, so it never touches the player's file), `tests/web/test_web.js` (adapted: the
oscillator tabs, 860 px panel, no Source Phase, a neutral patch made of the spec defaults — there is no Init preset; the full run plays all
222 presets and takes about 10 minutes), `tests/web/test_demo.js` (every song is a preset tour: the plan against the spec's `TOUR`, the
welcome sentences, the forced playing rules, stop paths, MIDI files; `--smoke` about 2 minutes), `tools/dsp_selftest.js` (12 sections; 12 =
the four oscillators), `vst/devtest/library_test.cpp` (the presets file, no window), `vst/devtest/vst2_smoke.cpp`. **Not ported** (they drive
the Wavelet Synthesizer's presets, panel or screenshots, or the macOS build): `vst/devtest/bank_session.cpp`, the editor and reload sections
of `tests/vst3host`, `tests/machost`. Run them only after porting them. The old descriptions follow.
- `tests/vst3host/vst3host.exe <bundle> <outdir> [--quick] [--only a,b]`: DAW-like VST3 host (parameters, audio,
  state, controller state, offline, presets, sub, portamento, high notes, attribute list, editor screenshots, reload).
- `tests/web/test_web.js`, `tests/web/test_demo.js [--smoke]`: browser suites through `tests/web/cdp.js`.
- `vst/devtest/vst2_smoke.cpp`, `tools/dsp_compare.js`, `tools/dsp_selftest.js`; `tests/quick.js` (fast check).
- `vst/devtest/bank_session.cpp` (beta 0.3): the preset library driven through the editor like a player (browser clicks,
  SAVE PRESET / rename / refused name, RESTORE, DELETE and back, ▲ ▼, the user bank, EXPORT, OCT click, LFO 2 menu, HIDE,
  unwritable folder, the file read back after the plug-in is unloaded and loaded; beta 0.4: the scroll bar dragged and
  clicked on the Source Phase sounds, IMPORT with its backup copies and a refused file; beta 0.5: a sound dragged onto
  Bass and back by its menu, onto TOP Sounds and out, the arrow keys (window messages and `onKeyDown`), a bank sound
  dragged to another section). The save windows and message boxes are
  answered by a helper thread (a single-OK message box closes with IDCANCEL).
- `tools/dsp_compare.js` / `dsp_render.cpp` also render LFO 2 on each of its targets, and (beta 0.4) four SOURCE PHASE
  variants: static (Haar saw, noise) and moved by LFO 2 with WAVELET MORPH and with A/B MIX (every phase-set slot).
- beta 0.4: `node tools/phase_effect.js` measures every phased preset (phase 0 against its phase, static cycle at middle
  C); `dsp_selftest` 8 checks phase 0 = the beta 0.3 source, the Haar band-6 effect (> 10 dB), the noise shift, the phase
  sets; `dsp_selftest` 9: no stuck note when a preset switches VOICES while a key is held. The 153 older presets were checked bit-identical against beta 0.3 (old and new `core.js`, same scenario). beta 0.5:
  the 144 presets kept unchanged are bit-identical with beta 0.4 (commit 2a929cb), the 6 adjusted differ only in the
  values OktoPierre changed; `tests/vst3host` checks a WSC1 / WSC2 state naming a left-out preset.
- `tests/vst3host`: `scaled()` maps layout points with the height scale (the browser makes the editor wider).
- beta 0.6 (tempo sync): `tests/vst3host --only sync` measures the first echo of a note with the delay SYNC'd at several
  host tempos (`Instance::hostTempo`; 1/4, 1/8 D, 1/8 T, 1/1 held at 4 s, SYNC off); `dsp_compare` / `dsp_render` take a
  tempo and render 3 sync variants (delay, LFO 1, LFO 2); `dsp_selftest` 10 checks note lengths at several tempos, the
  4 s cap (a 1/1 echo at 60 BPM after 4 s), no tempo or SYNC off = the knobs' values; `bank_session` step 9b clicks the three SYNC buttons and steps TIME with the wheel; `machost`
  clicks the delay SYNC. The 150 presets were rendered against beta 0.5 (commit bc4196a): see §3.3e.
- beta 0.7: `bank_session` locates the browser's categories through `L_TOP`, `L_BASS`, `L_KEYS`, `L_ORGAN`, `L_SP` (checked
  against `kCategories` first, so a new category order fails with a clear message) and imports a "LIST ORDER v2" file to
  check that its lists are rebuilt (written back as v3 with the 22 TOP Sounds, adjusted preset and bank kept);
  `tests/vst3host/presets_spec.txt` is regenerated with `node tests/vst3host/make_presets.js` after any change of the
  factory order.
- macOS (`.github/workflows/mac.yml`, `macos-14`, Apple silicon + Rosetta for Intel): `dsp_render.cpp` + `dsp_compare.js` on
  both architectures, then `tests/machost/machost <bundle> <outdir>` (built by `tests/machost/build.sh`): bundle and
  exports, sound, states, editor in a window (PNG screenshots, synthetic mouse events at logical points, Cmd-click), HIDE /
  browser, the zoom and preset menus (chosen through `NSMenuDidBeginTrackingNotification` + `performActionForItemAtIndex`),
  SAVE PRESET / TO BANK / DELETE / undelete / EXPORT / IMPORT (903, `WS_PRESETS_IMPORT`) through `wsTestCommand:` with the NSAlert windows answered by a timer
  (`stopModalWithCode`). The presets file's header quotes "Adjusted: yes" / "Deleted: yes": look for them at a line start.
  Results: the run's page in the repository's Actions tab, or the Actions REST API (artifacts `OktoMultiWaveSynth-mac`
  = the release zip, `mac-test-output` = logs and screenshots).
- **Headless Edge must always run with `--mute-audio`** (otherwise test audio plays on the user's speakers) and be
  closed in `finally`; check that no `msedge --headless` process is left.
- beta 0.2: the VST host offline test switches `A/B Mix` (not the panel's `Engine`); `test_demo.js` checks the tour
  against `WS_TEST.demoTour` and the agreed sequence `EXPECTED_TOUR`; `quick.js` waits up to 2 s for slow attacks.
  `tests/web/test_web.js` and the full VST host run were not re-run for beta 0.2 (quick + demo smoke + VST2 smoke were).
- beta 0.3: the 46 new presets come from the TEST branch (`preset-test`, votes file of the listening test);
  their values were checked equal to the TEST presets plus the recorded changes, and the 107 older presets unchanged.

## 9. Common changes — checklist
- **New parameter**: append in `tools/spec.js` (never insert), choose `structural`, place a widget in the layout, run
  `gen_spec`, implement in `core.js` **and** `dsp.h`, add the manual control text (`shared.js`/`engX.js`, `PLABEL`),
  think about compatibility of old states (default must reproduce the old sound), run the cross-check and the suites.
- **New preset** (the 200 are generated): add a `P(...)` line to the right `tools/recipes_*.js`, run `node tools/make_presets.js -v`
  (it numbers the presets, matches the loudness to the TOP Sounds' median ≈ −13.9 dB — a short sound is measured over 50 ms and
  3 dB lower —, raises oscillator levels before it would need more than +3 dB of master, limits the peak to 0.98, flags QUIET /
  SILENT sounds and the closest pairs; `--sheets` writes the contact sheets to `tools/out/`), then `node tools/gen_spec.js`. Never
  edit `presets_new.js`. A noise oscillator is a 2048-sample cycle band-limited at the note's pitch: play it low (octave −2 / −3)
  and use high band cutoffs, or it is silent. The demo sequence is `TOUR_PICKS` in `tools/spec.js`: add a preset there only on purpose.
- **DSP change**: both engines (same operations, same order), cross-check (§3.6), `regress_v07`, `idle_skip`, the VST3 host and the
  web suite. The 22 TOP Sounds must keep matching beta 0.7.
- **Release**: version in `tools/spec.js` (APP) **and** `vst/src/version.rc` (DLL version info), build, manuals, tests (muted), release zip (`OktoMultiWaveSynth.vst3` + `INSTALL.txt`, made with
  Windows `tar` so paths use `/`), README + RELEASE_HISTORY. Publishing to GitHub uses a repo-local identity
  (GitHub noreply address), never the author's work identity.

## 10. Conventions
- Every source file starts with the copyright line and `SPDX-License-Identifier: GPL-3.0-or-later`; demo music keeps
  its own licences (`tools/demo/SOURCE.md`).
- UI text is English; comments explain *why*; match the existing density and naming (`P.key` / `P_KEY`, `kParams`).
- Keep the web app dependency-free and runnable from `file://`; keep the plugin a single static DLL (Windows) and a
  self-contained bundle using only system frameworks (macOS).
- Shared plug-in code (`editor.cpp`, `plugin.cpp`, `bank.h`, `dsp.h`) calls no operating system directly: add the call
  to `platform.h` or to the `EditorWindow` interface, with both implementations.
