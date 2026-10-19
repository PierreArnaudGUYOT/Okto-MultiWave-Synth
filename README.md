# Okto MultiWave Synth

*Created by **Pierre Arnaud GUYOT** ("OktoPierre") — **beta 0.2**, a test version (2026-10-19), see
[RELEASE_HISTORY.md](RELEASE_HISTORY.md). Architecture and maintenance notes: [CLAUDE.md](CLAUDE.md).*

Okto MultiWave Synth is the [Wavelet Synthesizer](https://github.com/PierreArnaudGUYOT/Free-Wavelet-Synthesizer-VST)
(beta 0.7) with **four oscillators instead of two engines**: two subtractive wavelet oscillators (**A1, A2**) and two
additive wavelet oscillators (**B1, B2**). It is a polyphonic synthesizer that shapes sound with the **discrete wavelet
transform** instead of Fourier filters: one cycle of each tone is split into 11 octave-spaced wavelet bands and resynthesised
band by band. It comes as a **web application** and a **VST3 / VST2 instrument** for Windows x64 (Ableton Live and other
hosts).

This is a *test version*: its 300 new presets (beta 0.2) and the 200 of beta 0.1 are waiting for your ears. **EVALUATE
SOUNDS** plays a piece of music with each of them and asks for 1 to 10 stars; the ratings (and the changes you make to the
sounds you like) are saved in a text file you can send back.

**Play online:** https://pierrearnaudguyot.github.io/Okto-MultiWave-Synth/ (Chrome or Edge; a MIDI keyboard plays it
directly, no DAW needed).
**Download the plug-in:** the [Releases](https://github.com/PierreArnaudGUYOT/Okto-MultiWave-Synth/releases) page
(a zip for Windows 64-bit, VST3 and VST2). The web app also works offline: download the repository and open `web/index.html`.
The Wavelet Synthesizer itself, and its macOS plug-in, stay on its own page; this test version is built for Windows and the web
(the code is portable, but no macOS build is made or tested here).

## What beta 0.2 adds

- **SuperModulation**. What makes this synthesizer different is that every timbre control acts on the *scales* of one wave
  cycle — and now both LFOs reach all of them. **LFO 1** gets three more amounts: **SPARSITY** (the atoms that are kept come
  and go), **RESO** (the resonance of the scale filter pulses) and **ENV>WAV** (how far each note's envelope pushes the
  wavelet morph, swinging with the LFO). **LFO 2** can move every control of the wavelet oscillators and of the scale filter: its
  TARGET menu now also offers **SPARSITY, SRC WIDTH, TILT, ODD BARS, EVEN BARS, SCALE SUS and MORPH** after the cutoff, slope,
  resonance, key tracking, envelope and velocity amounts, the position window and the source phase. (SPARSITY, SRC WIDTH and
  PHASE build the oscillator's tables at several values — 9, 9 and 12 — and each voice crossfades between the two nearest.)
- **300 new presets** (`201`–`500`), composed from oscillator layers that are *very different from each other* (a saw of
  Haar atoms against a Daubechies 20 sine, a noise tick against a mirrored-atom choir, …) and a library of LFO recipes, then
  measured one by one: no crackle (the chord with its bass stays under the limiter), a spectrum that really moves, loudness of
  the TOP Sounds. The new **SuperModulation** category (120 presets, the first one in the lists) holds the sounds whose life is
  the LFOs moving the wavelet controls. The 22 TOP Sounds and the 200 presets of beta 0.1 are unchanged (**Wobble Bass** is now
  the first of the Bass list).
- **Chord mode**: **BASS** (the button under CHORD MODE, on by default) plays the root two octaves below with the chord, a little
  louder; a chord keeps the level of a triad whatever its size. **The chord follows your left hand**: change the chord on the
  selector octave while the right-hand note is held and the held chord changes at once (only the notes of the current chord
  sound); the left hand remembers its last chord.
- **Oriental keyboard**: a three-position switch **TUNING** (Western · Arabic · Turkish) under CHORD MODE retunes the keys with
  **quarter tones** (Arabic, 24 tones to the octave) or **commas** (Turkish makams, 53 to the octave), by scale (**Rast, Bayati,
  Hijaz, Saba, Nahawand**) and tonic; the keys it moves are marked on the keyboard. The demo and EVALUATE SOUNDS stay in equal
  temperament.
- The **preset browser at the right follows the preset box**: step with ◀ ▶ or the menu and it shows the sound's category and the
  sound itself.

## What is new compared with the Wavelet Synthesizer

- **Four oscillators**, **A1 A2 B1 B2**, one tab each at the top of the panel. Every oscillator has its **own** tone
  (subtractive: source wave, atom shape, wavelet, sparsity, phase; additive: atom pattern, drawbars, tilt, band envelopes),
  **scale filter**, **position window**, **tuning** (octave, semitones, cents), **own envelope** (it multiplies the AMP
  ENVELOPE, so one oscillator can be a short attack and another a long pad) and **pitch envelope** (a fall or rise in
  semitones over a time: kicks, plucks, zaps). Only one oscillator's cards are shown at a time, so the panel stays as clear as
  the original's.
- **OSC MIX** (the card next to the scope): four level knobs, one per oscillator, replace the A/B MIX knob. A1 plays at 100 %
  on a new patch, the others at 0. The sub oscillator is in the same card.
- **522 presets: the 22 TOP Sounds** (OktoPierre's favourites, unchanged: they sound exactly as in beta 0.7), **300 new ones**
  of beta 0.2 (`201`–`500`) **and the 200 of beta 0.1** (`001`–`200`, unchanged), in 12 categories (SuperModulation, Bass, Lead,
  Keys, Organ, Pad, Strings, Brass & Wind, Pluck, Bells & Mallets, FX, Drums & Perc). Every new preset uses at least two
  oscillators; the letters of its name say which (`A1A2`, `B1B2`, `A1B1`, `A1A2B1` …); an oscillator is often the attack (a click, a
  breath, a pluck) of another.
- **EVALUATE SOUNDS** (header, web app and plug-in): see below.
- **CHORD MODE** (button next to the keyboard): the panel grows and a *chord harp* card appears (twelve chord pads, the chord
  name, KEYS OCT, STACKED / FOLDED voicing, BASS, STRUM and a strum plate): one octave of the keyboard chooses the chord type, one
  finger plays the whole chord. With CHORD MODE off the panel is the plain synthesizer and none of it is shown.
- **LFO 2** moves its target in **every** oscillator at once (and the wavelet morph and the phase LFO act on each oscillator).
- **Lighter on the CPU**: playing the same 22 TOP Sounds with twelve held notes takes about **20 % less time** than in the Wavelet
  Synthesizer beta 0.7 (JavaScript engine, measured: 2.65 s → 2.15 s for 3 s of audio each). The review of its load (`Revue.md` of the CPU study) is applied: `exp`
  instead of `pow(10, ·)`, a two-sine chorus, no `%` in the wavelet transform, idle instances skip their silent blocks, the
  smoothing constants no longer depend on the host's sample rate, table builds run in a Web Worker, the plug-in's builder
  thread and library are safer. What was left out, and why, is in [RELEASE_HISTORY.md](RELEASE_HISTORY.md).

## EVALUATE SOUNDS

Click **EVALUATE SOUNDS** in the header.
- The window plays 5 seconds of Beethoven's *Appassionata* (III, the busy passage at 0:13) with the first preset (**201**; the list is the
  factory order: the 300 new presets first, then the 200 of beta 0.1), then asks for
  **1 to 10 stars** (a click; in the web app also the keys 1–9 and 0 = 10). It goes on with the next preset; **Skip**,
  **Previous**, **Replay** and **Stop** are always there.
- **Stop half way whenever you like** — nothing is lost (every answer is saved) — and keep this state under a name of your own with
  **Save as…** (on the start, rating and end windows): it saves a copy of the ratings so far, e.g.
  `okto-multiwave-ratings-45of500-2026-10-19.txt`, and the session goes on with its own file.
- **More than 5 stars** offers to *modify* the preset: it loads exactly as designed, you change the panel with the mouse and
  play it on your keyboard, then **Keep initial settings** or **Record preset change**. The parameters that differ from the
  preset are written in the file.
- Every rating is saved at once, so you can stop and **continue where you stopped** (the file is read again at the next
  session).
- **Web app**: the ratings are kept in the browser meanwhile; in Edge or Chrome you choose the file at the start
  (`okto-multiwave-ratings.txt`) and it is rewritten after every rating or change; in other browsers **Save as…** downloads it.
- **Plug-in**: the file is `Documents\Okto MultiWave Synth\okto-multiwave-ratings.txt` (the local application data folder when
  there is no Documents folder), written after every rating or change; **Change file…** chooses another one, **Show file**
  opens its folder, **Save now** writes it again. Both versions write the same readable text: the stars of every preset, a
  ranking, and the recorded changes as `parameter key: value in the preset -> new value`.

## Use it

### Web app
Open `web/index.html` in Chrome, Edge or Firefox (double-click; no server or install needed). A welcome window offers **Run
the demo**, **Play the synth** or **Download the VST**. **MANUAL** (header) opens the manual of the oscillator shown.
- Play with the mouse on the keyboard, a MIDI keyboard (Web MIDI), or the computer keyboard: digits **1 2 3 4 5 6 7 8 9 0** =
  C D E F G A B C D E; the letter rows A W S E D F T G Y H U J K O L P = a chromatic piano; **Z** / **X** = octave down / up.
- **MIDI**: notes, pitch bend, mod wheel, sustain; Program Change selects a preset; **MIDI learn** by a right-click on a control.
- Presets: the **preset browser** at the right of the panel (TOP Sounds and the categories, ↑ ↓ ← → keys), ◀ ▶ and the
  preset name's menu. **Save preset / Export / Import** are in the status bar.
- **▶ DEMO** plays Beethoven's *Appassionata* (III), in equal temperament, while touring 29 presets (the TOP Sounds mixed with new ones that show
  the oscillators at work); **▾** opens other pieces or *Load a MIDI file…*.

### VST3 / VST2 in Ableton Live (Windows)
1. Build the plugin (see below), or take the zip of the Releases page.
2. Copy the **whole** `OktoMultiWaveSynth.vst3` folder into **either** your VST3 folder `C:\Program Files\Common Files\VST3`
   (`vst\install.bat` does this and asks for administrator rights) **or** your VST2 plug-in folder (no administrator rights).
3. In Live: *Preferences → Plug-ins* → enable **Use VST3 Plug-in System Folders** (or **Use VST2 Plug-in Custom Folder**) →
   **Rescan**. Drag *Plug-ins → Okto MultiWave Synth* onto a MIDI track.

The plugin is a single self-contained DLL that only needs Windows system libraries: a VST3 plug-in
(`Contents\x86_64-win\OktoMultiWaveSynth.vst3`) and, as a copy next to it, a VST2 plug-in (`OktoMultiWaveSynth.dll`).
Pitch bend, mod wheel, sustain pedal and **tempo SYNC** (delay and LFOs in note values of the host's tempo) are supported,
and every sound parameter can be automated. The chord harp's six settings are plug-in parameters too (saved with the Live Set,
never in a preset). In the plug-in, **SAVE PRESET**, **DELETE**, ▲ ▼ and a **user bank** keep your adjustments in one
readable text file, `OKTOMULTIWAVE presets.txt`, next to the plug-in folder.

It installs next to the Wavelet Synthesizer: its own name, class IDs and VST2 ID, its own presets file.

## Build the VST3

Requirements: the portable [llvm-mingw](https://github.com/mstorsjo/llvm-mingw/releases) toolchain
(`llvm-mingw-<date>-ucrt-x86_64.zip`, extract it anywhere; no admin rights, no Visual Studio, no CMake). Node.js is optional:
if present, the build regenerates the C++ parameter table and the listening passage from `tools/spec.js`.

```bat
set LLVM_MINGW=C:\Users\<you>\tools\llvm-mingw   (default: %USERPROFILE%\tools\llvm-mingw)
vst\build.bat
```
Output: `build\OktoMultiWaveSynth.vst3\Contents\x86_64-win\OktoMultiWaveSynth.vst3` + `Contents\Resources\manual\`. The build
uses `-ffp-contract=off`, so that the C++ and JavaScript engines do the same floating-point operations.

## Project layout

```
tools/spec.js          single source of truth: parameters, the four oscillators, panel layout, presets
tools/gen_spec.js      generates web/js/spec.js, vst/src/generated/spec.h and vote_data.h (the listening passage)
tools/presets_top.js   the 22 TOP Sounds;  tools/presets_new.js  the 200 presets of beta 0.1;  tools/presets_super.js  the 300 of beta 0.2
tools/make_presets.js  builds the presets of beta 0.1 from tools/recipes_*.js (tools/preset_dsl.js, preset_lab.js: loudness
                       matching, distinctness check, contact sheets)
tools/supermod/        composes the presets of beta 0.2 from oscillator layers and LFO recipes, measures and selects them
tools/dsp_selftest.js  engine self-test;  tools/dsp_compare.js  C++ engine against the JavaScript reference
tools/manual/          generator of the user manuals
web/                   web application (vanilla JS, Web Audio AudioWorklet, no libraries)
  js/core.js           DSP reference implementation (also runs inside the AudioWorklet and the table-building Worker)
  js/ui.js, app.js     panel UI, presets, MIDI, computer keyboard;  js/evaluate.js  the rating session
  js/demo.js           demo player (a tour of the presets)
vst/                   VST3 / VST2 plugin (C++17)
  src/dsp.h            C++ port of core.js;  src/plugin.cpp  processor, controller, factory
  src/editor.cpp       the panel window (draws through editor_platform.h; editor_win.cpp is its Windows side)
  src/bank.h, platform.h   the presets file and the operating-system calls
tests/                 test tools (VST3 host, browser driver, regression against beta 0.7, idle-skip rule)
```

## How the engine works (short)

- Each note plays one **cycle of 2048 samples** per oscillator, analysed with a periodic orthogonal DWT into **11 bands**.
  Band *b* has 2^(b−1) atoms and covers roughly harmonics 2^(b−2)…2^(b−1): one band ≈ one octave of harmonics. Because the
  analysis is pitch-synchronous, the bands follow the note.
- Every band is resynthesised into its own layer and stored as **band-limited mip tables**, so the oscillator stays
  alias-free. A voice mixes the layers of each oscillator with per-band gains at audio rate, then the oscillators with their
  levels (smoothed over 20 ms); filter sweeps and envelopes are smooth. An oscillator whose level is 0 costs nothing.
- Structural changes (wavelet, source, sparsity, pattern, seed, an oscillator switched on or off) rebuild the tables on a
  background thread (a Worker in the web app) and crossfade over about 10 ms.

## Development checks

```bash
node tools/gen_spec.js            # after editing tools/spec.js or the presets
node tests/quick.js               # 20 s: syntax, engine, VST3 host sections, web smoke test
node tests/supermod.js            # beta 0.2: the SuperModulation destinations, the chord layer, the oriental tunings
node tests/regress_v07.js         # the 22 TOP Sounds against the published beta 0.7 engine (within 1.5e-7)
node tests/idle_skip.js           # the idle rule does not cut a delay echo or a reverb tail
node tests/web/smoke.js           # the four oscillator views and CHORD MODE in headless Edge
```
To cross-check the C++ engine, compile `vst/devtest/dsp_render.cpp` (with `-ffp-contract=off`) and run
`node tools/dsp_compare.js <dir>`: all 577 cases (the 522 presets and 55 variants of every feature) agree within 2e-6 of full scale (worst: 1.8e-7). `vst/devtest/vote_session.cpp`
drives the plug-in's EVALUATE SOUNDS window like a player (and CHORD MODE) in an off-screen window.

## Licence

Copyright (C) 2026 Pierre Arnaud GUYOT ("OktoPierre").

Okto MultiWave Synth (web app, VST3 plugin, tools and tests) is free software: you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version. It is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
Public License in the file `LICENSE` for more details.

If you share the compiled plugin (`OktoMultiWaveSynth.vst3`) or the web app, share the source code with it as well (for
example a link to the project's repository), as the GPL requires.

Parts that keep their own licence:
- `vst/external/pluginterfaces/`: Steinberg VST3 interface headers, MIT licence (compatible with the GPL; its licence text is
  kept in the folder and copied into the plugin bundle).
- `tools/demo/*.mid` and `web/js/demo_data.js`: demo music from the Mutopia Project, public domain except the *Moonlight*
  Sonata III (CC BY-SA 2.5, Stewart Holmes). This music data is not covered by the GPL (see `tools/demo/SOURCE.md`).

## Credits

Created by Pierre Arnaud GUYOT ("OktoPierre"), on the basis of his
[Wavelet Synthesizer](https://github.com/PierreArnaudGUYOT/Free-Wavelet-Synthesizer-VST)
(DOI [10.5281/zenodo.23431760](https://doi.org/10.5281/zenodo.23431760)). The chord keyboard comes from his WaveChord work.

- Demo music: MIDI from the [Mutopia Project](https://www.mutopiaproject.org): J. S. Bach *Toccata in D minor* BWV 565 and
  Beethoven's Op. 57 III, Op. 129, Op. 67 I (piano), Op. 13 I, Op. 31/2 I, Op. 111 I — public domain; Beethoven *Moonlight*
  Sonata Op. 27/2 III typeset by Stewart Holmes — CC BY-SA 2.5. The listening passage of EVALUATE SOUNDS is a part of Op. 57 III.
- VST3 interface headers: Steinberg Media Technologies, MIT licence.
- Wavelet filter coefficients were generated with PyWavelets (MIT licence) and are stored in `tools/wavelets.json`.

## Acknowledgments

Thanks to Jeremi Palmigani (aka Saoul Machine) and Flo (aka Go Tiger) for testing the Wavelet Synthesizer and providing
valuable feedback and improvement suggestions, and to Arnaud Grignard for the technical review of the concept.
