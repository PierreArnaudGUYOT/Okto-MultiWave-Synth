// Copyright (C) 2026 Pierre Arnaud GUYOT (OktoPierre)
// SPDX-License-Identifier: GPL-3.0-or-later
// Okto MultiWave Synth — EVALUATE SOUNDS: a listening session on the new presets (beta 0.3: the 600 of this version, 501-1100, then the 175 of beta 0.2 and the 133 of beta 0.1),
// started by the header's button. Each new preset plays the same 3.5 s of Beethoven's Appassionata (III) — the busy passage from 0:13 of the demo — and then a C minor
// chord (2 s: a sustained sound can be judged too; "Skip to vote" ends the music at once), then a window
// asks for a rating from 1 to 10 stars. Above 5 stars it offers to modify the preset: the preset is reloaded exactly as
// designed, the window shrinks to a bar, the player changes the panel (mouse or MIDI controller) and plays it (MIDI
// keyboard), then keeps the initial settings or records the change. The ratings and the recorded changes are kept in this
// browser (stop and resume later) and written to a .txt file after every rating or change (Edge / Chrome: the file chosen at
// the start; otherwise "Save as…", which downloads a copy under a name the player chooses; it also keeps a copy of a session stopped half
// way). The sounds are rated in SETS OF 40: the player types the number of the first sound; every set has its own file, "sound 502 to sound 541.txt", which is
// downloaded when the set is finished. The .txt files are read later to keep, rank and correct the good presets.
// (Adapted from the listening test of the Wavelet-Synthesizer-TEST project.)
function WSEvaluate(api) {
  'use strict';
  const P = api.P, PARAMS = api.PARAMS, C = api.C;
  const START = 12.9, LEN = 3.5;               // the passage (seconds of the default demo) and its length (beta 0.3.1: 30 % shorter than 5 s)
  const LEAD = 0.12;                           // seconds between loading a preset and its first note
  const STORE = 'mw.votes';
  const FIRST = WS_SPEC.NEW_FIRST, PRESETS = WS_SPEC.PRESETS.slice(FIRST);   // the presets to rate, in the order of the factory list (the newest first)
  const SET = 40;                              // sounds per set (one ratings file each)
  const KEY = (p) => p.name.split(' ')[0];     // the preset's number as written in its name ('001', '502', '1000')
  const DESC = WS_SPEC.DESCRIPTIONS || {};
  const TITLE = `LISTEN AND RATE · ${PRESETS.length} NEW PRESETS`;
  const ASK_ABOVE = 5;                         // a rating above this offers to modify the preset
  // the same playing rules as the demo's preset tour: polyphonic, normal octave, no glide, short attacks, short echoes
  const SAFE = { v_voices: 16, v_oct: 0, v_glide: 0 };
  const MAX_ATTACK = 0.08, MAX_DMIX = 0.1, MAX_DFB = 0.3;
  // parameters a recorded change may contain: the sound only (not the oscillator shown, the wheels or the pedal)
  const EDITABLE = PARAMS.map((p, i) => i).filter(i => !PARAMS[i].hidden && !PARAMS[i].perf && PARAMS[i].key !== 'osc_view');

  // the 5 s passage: notes starting in [START, START + LEN), cut at the end of the passage
  const song = WS_DEMO_SONGS[0], notes = [];
  for (let i = 0; i < song.notes.length; i += 4) {
    const t = song.notes[i];
    if (t < START || t >= START + LEN) continue;
    notes.push(t - START, Math.min(song.notes[i + 1], START + LEN - t), song.notes[i + 2], song.notes[i + 3]);
  }
  const t0 = notes[0];
  for (let i = 0; i < notes.length; i += 4) notes[i] -= t0;   // starts on its first note
  // then a chord, C minor (C3 G3 C4 Eb4 G4), held 2 s after a short pause: the same notes and times as the plug-in's passage (tools/gen_spec.js)
  const CHORD_AT = LEN + 0.4, CHORD_LEN = 2, CHORD_VEL = 0.7, TOTAL = CHORD_AT + CHORD_LEN;
  for (const n of [48, 55, 60, 63, 67]) notes.push(CHORD_AT, CHORD_LEN, n, CHORD_VEL);

  const store = {
    get() {
      try {
        const v = JSON.parse(localStorage.getItem(STORE) || 'null');
        if (v && typeof v.votes === 'object') { if (typeof v.changes !== 'object' || !v.changes) v.changes = {}; return v; }
      } catch (_) { /* unreadable */ }
      return { votes: {}, changes: {} };
    },
    set(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (_) { /* storage unavailable */ } },
  };
  let data = store.get();            // { votes: { '001': 7, ... }, changes: { '012': { f_cutoff: [7, 5.5], ... } } }
  let s = null;                      // session: { k, saved, timer, phase: 'start'|'play'|'vote'|'ask'|'edit'|'end', base }
  let win = null, fileHandle = null, writing = Promise.resolve();
  const num = (k) => KEY(PRESETS[k]);
  const voted = (n) => data.votes[n] !== undefined;
  const nextFree = () => { const k = PRESETS.findIndex(p => !voted(KEY(p))); return k < 0 ? PRESETS.length : k; };
  const nVotes = () => Object.keys(data.votes).length;
  const fmt = (i, v) => C.format(PARAMS[i], v);
  const stars = (n) => n + (n === 1 ? ' star' : ' stars');

  // ---------------------------------------------------------------- ratings file
  // fileText(): every sound; fileText(lo, hi): the sounds lo..hi of the list (a set of 40)
  function fileText(lo, hi) {
    const L = [];
    const list = lo === undefined ? PRESETS : PRESETS.slice(lo, hi + 1);
    const nv = list.filter(p => voted(KEY(p))).length;
    const d = new Date(), pad = (x) => String(x).padStart(2, '0');
    L.push('Okto MultiWave Synth - preset ratings (1 star = poor ... 10 stars = excellent)');
    L.push('Listening: Beethoven, Appassionata (III), 3.5 s from 0:13 of the demo, then a C minor chord (2 s); each preset played polyphonic at its normal octave.');
    L.push('Presets: A1 A2 = subtractive oscillators, B1 = the additive oscillator; the letters of a name say which oscillators the preset uses.');
    if (lo !== undefined) L.push(`Set: sound ${num(lo)} to sound ${num(hi)} (${list.length} sounds)`);
    L.push(`Saved: ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}   ` +
      `Rated: ${nv} / ${list.length}   Presets with a recorded change: ${list.filter(p => data.changes[KEY(p)]).length}`);
    L.push('');
    L.push('NUMBER | STARS | CHANGED | PRESET');
    for (const p of list) {
      const n = KEY(p);
      L.push(`${n} | ${voted(n) ? String(data.votes[n]).padStart(2) : ' -'} | ${data.changes[n] ? 'yes    ' : '       '} | ${p.name.slice(p.name.indexOf(" ") + 1)}`);
    }
    L.push('');
    L.push('RANKING (best first)');
    const ranked = list.filter(p => voted(KEY(p))).sort((a, b) => data.votes[KEY(b)] - data.votes[KEY(a)] || (a.name < b.name ? -1 : 1));
    for (const p of ranked) L.push(`${String(data.votes[KEY(p)]).padStart(2)} | ${p.name}${data.changes[KEY(p)] ? '   (changed)' : ''}`);
    L.push('');
    L.push('PRESET CHANGES (recorded by the player: apply them to the preset)');
    L.push('Format: parameter key: value in the preset -> new value   (name: shown value -> new shown value)');
    const changed = list.filter(p => data.changes[KEY(p)]);
    if (!changed.length) L.push('(none)');
    for (const p of changed) {
      const n = KEY(p), ch = data.changes[n];
      L.push('');
      L.push(`${p.name}   (${voted(n) ? data.votes[n] + ' stars' : 'not rated'})`);
      for (const key of Object.keys(ch)) {
        const i = P[key]; if (i === undefined) continue;
        const [a, b] = ch[key];
        L.push(`  ${key}: ${+a.toFixed(6)} -> ${+b.toFixed(6)}   (${PARAMS[i].name}: ${fmt(i, a)} -> ${fmt(i, b)})`);
      }
    }
    return L.join('\r\n') + '\r\n';
  }
  function saveFile() {
    store.set(data);
    if (!fileHandle) return;
    const h = fileHandle, text = fileText();
    writing = writing.then(async () => { const w = await h.createWritable(); await w.write(text); await w.close(); })
      .catch((e) => { status('Could not write the ratings file (' + e.message + '); the ratings stay saved in this browser.'); });
  }
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text !== undefined ? text : fileText()], { type: 'text/plain' }));
    a.download = name || 'okto-multiwave-ratings.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // "Save as…": a copy of the ratings so far under a name of the player's choice (stop half way, keep this state); the ratings file
  // being rewritten (if any) stays as it is. Edge / Chrome: the save window; other browsers: a question for the name, then a download.
  const copyName = () => {
    if (s && s.k0 !== undefined) { const r = setRange(s.k); return setName(r[0], r[1]); }   // the set being rated
    const d = new Date(), pad = (x) => String(x).padStart(2, '0');
    return `okto-multiwave-ratings-${nVotes()}of${PRESETS.length}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.txt`;
  };
  const copyText = () => (s && s.k0 !== undefined ? (r => fileText(r[0], r[1]))(setRange(s.k)) : fileText());
  async function saveCopy() {
    let name = copyName();
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }] });
        const w = await h.createWritable(); await w.write(copyText()); await w.close();
        status(`Copy saved: ${h.name}.`);
      } catch (e) { if (!e || e.name !== 'AbortError') status('Could not save the copy: ' + (e && e.message)); }
      return;
    }
    const asked = window.prompt('Name of the file (a copy of your ratings so far):', name);
    if (asked === null) return;
    name = asked.trim().replace(/[\\/:*?"<>|]+/g, '_') || name;
    if (!/\.txt$/i.test(name)) name += '.txt';
    download(name, copyText());
    status(`Copy downloaded: ${name}.`);
  }
  async function chooseFile() {
    if (!window.showSaveFilePicker) { status('This browser cannot write a file directly: use "Save as…" (it downloads a copy; Edge or Chrome can also keep a file up to date).'); return false; }
    try {
      fileHandle = await window.showSaveFilePicker({ suggestedName: 'okto-multiwave-ratings.txt', types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }] });
      saveFile();
      return true;
    } catch (_) { return false; }   // cancelled
  }

  // ---------------------------------------------------------------- sets of 40 sounds
  // The first set starts at the sound the session began at (s.k0), the next ones every 40 sounds; each has its own file, downloaded when the set is finished
  // (every sound rated) and the player moves on, stops or finishes. The ratings themselves stay one list, kept in this browser (and in the ratings file chosen).
  const setRange = (k) => { const b = Math.floor((k - s.k0) / SET), lo = Math.max(0, s.k0 + b * SET); return [lo, Math.min(PRESETS.length - 1, s.k0 + b * SET + SET - 1), b]; };
  const setName = (lo, hi) => `sound ${num(lo)} to sound ${num(hi)}.txt`;
  const setComplete = (r) => { for (let k = r[0]; k <= r[1]; k++) if (!voted(num(k))) return false; return true; };
  function sendSet(r) {   // a finished set: its file is downloaded (once per session)
    if (!s || !r || !setComplete(r)) return;
    s.sent = s.sent || {};
    if (s.sent[r[0]]) return;
    s.sent[r[0]] = true;
    download(setName(r[0], r[1]), fileText(r[0], r[1]));
  }

  // ---------------------------------------------------------------- window
  function build() {
    const st = document.createElement('style');
    st.textContent = `
.vote-win { position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%); width: min(700px, 94vw); z-index: 200;
  background: rgba(13,16,20,0.97); border: 1px solid #2fd4c6; border-radius: 12px; box-shadow: 0 16px 50px rgba(0,0,0,0.7);
  color: #e9edf2; font: 13px Segoe UI, system-ui, sans-serif; padding: 14px 18px 12px; display: none; }
.vote-win h3 { margin: 0 0 4px; font-size: 12px; letter-spacing: .12em; color: #2fd4c6; }
.vote-win .vname { font-size: 19px; font-weight: 700; margin: 2px 0 2px; }
.vote-win .vdesc { color: #9aa3b0; min-height: 18px; }
.vote-win .vstars { display: flex; gap: 5px; margin: 12px 0 8px; }
.vote-win .vstars button { flex: 1; height: 46px; border-radius: 8px; border: 1px solid #343b47; background: #1d2129; color: #ffcf4a;
  font-size: 17px; cursor: pointer; line-height: 1.05; padding: 0; }
.vote-win .vstars button small { display: block; font-size: 9.5px; color: #9aa3b0; }
.vote-win .vstars button:hover, .vote-win .vstars button.on { background: #ffcf4a; color: #0d1014; }
.vote-win .vstars button:hover small, .vote-win .vstars button.on small { color: #0d1014; }
.vote-win .vstars.off button { opacity: .35; pointer-events: none; }
.vote-win .vstars.hide { display: none; }
.vote-win .vbar { height: 4px; background: #262c35; border-radius: 2px; overflow: hidden; margin: 6px 0 8px; }
.vote-win .vbar i { display: block; height: 100%; width: 0; background: #2fd4c6; }
.vote-win .vrow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.vote-win .vrow button { padding: 6px 12px; border-radius: 6px; border: 1px solid #343b47; background: #1d2129; color: #e9edf2; cursor: pointer; font-size: 12px; }
.vote-win .vrow button.main { border-color: #2fd4c6; color: #2fd4c6; font-weight: 700; }
.vote-win .vrow button:hover { border-color: #2fd4c6; }
.vote-win .vstat { color: #9aa3b0; font-size: 11.5px; margin-top: 8px; min-height: 15px; }
.vote-win .vhelp { color: #6f7885; font-size: 11px; margin-top: 4px; }
.vote-win.compact { bottom: 6px; padding: 8px 14px 8px; border-color: #ffcf4a; width: min(900px, 96vw); }
.vote-win.compact h3 { color: #ffcf4a; }
.vote-win.compact .vname { font-size: 14px; }
.vote-win.compact .vdesc { font-size: 12px; min-height: 0; margin-bottom: 6px; }
.vote-win.compact .vbar, .vote-win.compact .vhelp { display: none; }
.vote-win.compact .vstat { margin-top: 6px; }`;
    document.head.appendChild(st);
    const w = document.createElement('div');
    w.className = 'vote-win';
    w.setAttribute('role', 'dialog');
    w.innerHTML = '<h3 class="vtitle"></h3><div class="vname"></div><div class="vdesc"></div>' +
      '<div class="vbar"><i></i></div><div class="vstars"></div><div class="vrow"></div><div class="vstat"></div>' +
      '<div class="vhelp">Keys: 1–9 rate, 0 = 10 stars · R replays · ← previous · S skips · Esc stops. Your ratings are kept in this browser.</div>';
    document.body.appendChild(w);
    win = { el: w, title: w.querySelector('.vtitle'), name: w.querySelector('.vname'), desc: w.querySelector('.vdesc'),
      bar: w.querySelector('.vbar i'), stars: w.querySelector('.vstars'), row: w.querySelector('.vrow'), stat: w.querySelector('.vstat') };
    for (let n = 1; n <= 10; n++) {
      const b = document.createElement('button');
      b.innerHTML = `${n}<small>${n === 1 ? 'poor' : n === 10 ? 'excellent' : '★'}</small>`;
      b.title = stars(n);
      b.onclick = () => vote(n);
      win.stars.appendChild(b);
    }
  }
  function status(t) { if (win) win.stat.textContent = t; }
  function buttons(list) {
    win.row.innerHTML = '';
    for (const [label, fn, main] of list) {
      const b = document.createElement('button');
      b.textContent = label; if (main) b.className = 'main';
      b.onclick = fn;
      win.row.appendChild(b);
    }
  }
  function showStars(mode, current) {   // mode: 'on' | 'off' | 'hide'
    win.stars.classList.toggle('off', mode === 'off');
    win.stars.classList.toggle('hide', mode === 'hide');
    [...win.stars.children].forEach((b, i) => b.classList.toggle('on', current === i + 1));
  }
  const compact = (on) => win.el.classList.toggle('compact', !!on);
  const fileLabel = () => (fileHandle ? `Ratings file: ${fileHandle.name} (rewritten after every rating).` : 'No ratings file chosen yet: the ratings are kept in this browser; you can also download them.');
  const voteNote = (n) => (voted(n) ? `Already rated: ${stars(data.votes[n])}${data.changes[n] ? ', change recorded' : ''}. ` : '');

  // ---------------------------------------------------------------- session
  async function start() {
    if (s) return;
    api.stopDemo();
    await api.startAudio();
    if (!win) build();
    data = store.get();
    s = { k: nextFree(), k0: undefined, saved: api.snapshot(), timer: 0, phase: 'start' };
    api.ui.setEvaluating(true);
    win.el.style.display = 'block';
    showStart();
  }
  function showStart() {
    s.phase = 'start';
    clearTimeout(s.timer);
    compact(false);
    win.title.textContent = TITLE;
    const done = nVotes();
    win.name.textContent = done ? `${done} of ${PRESETS.length} presets rated` : `${PRESETS.length} new presets to rate`;
    win.desc.textContent = 'Each preset plays 3.5 s of Beethoven (Appassionata, the busy passage at 0:13) and then a C minor chord, then rate it from 1 (poor) to 10 stars (excellent). ' +
      `Above ${ASK_ABOVE} stars you can modify the preset and record the change. The sounds come in sets of ${SET}: each set has its own file, "sound xx to sound yy".`;
    win.bar.style.width = (100 * done / PRESETS.length) + '%';
    showStars('off');
    const next = nextFree();
    const list = [];
    if (window.showSaveFilePicker) list.push([fileHandle ? 'Change the ratings file…' : 'Choose the ratings file (.txt)…', async () => { await chooseFile(); status(fileLabel()); showStart(); }, !fileHandle]);
    list.push([done ? 'Start at…' : `Start at ${num(next < PRESETS.length ? next : 0)}…`, askStart, !!fileHandle || !window.showSaveFilePicker || !done]);
    if (done && next < PRESETS.length) list.push([`Continue at ${num(next)}`, () => startAt(next)]);
    if (done) list.push(['Save as…', saveCopy, next >= PRESETS.length]);
    if (done) list.push(['Clear all ratings', () => { if (confirm('Clear all your ratings and recorded changes?')) { data = { votes: {}, changes: {} }; saveFile(); showStart(); } }]);
    list.push(['Close', stop]);
    buttons(list);
    status(fileLabel());
  }
  // "Start at…": the player types the number of the first sound (the first one not rated yet is offered)
  function askStart() {
    const next = nextFree(), def = num(next < PRESETS.length ? next : 0);
    const nums = PRESETS.map(p => parseInt(KEY(p), 10)), lo = String(Math.min(...nums)).padStart(3, '0'), hi = String(Math.max(...nums));   // the list starts at 501 but its numbers run from 001 to 1100
    const t = window.prompt(`Number of the first sound to rate (the list starts at ${num(0)}; numbers go from ${lo} to ${hi}):`, def);
    if (t === null) return;
    const v = parseInt(String(t).trim(), 10), k = Number.isFinite(v) ? PRESETS.findIndex(p => parseInt(KEY(p), 10) === v) : -1;
    if (k < 0) { status('No sound numbered "' + String(t).trim() + '" in the list (numbers ' + lo + ' to ' + hi + ').'); return; }
    startAt(k);
  }
  function startAt(k) { s.k0 = k; s.sent = {}; play(k); }
  function stopSound() { api.post({ t: 'seqstop' }); api.post({ t: 'soundoff' }); }
  function loadForListening(k) {
    stopSound();   // no tail of the previous preset
    api.applyPreset(PRESETS[k].name);
    const v = api.values();
    for (const key in SAFE) api.setParam(P[key], SAFE[key]);
    if (v[P.amp_a] > MAX_ATTACK) api.setParam(P.amp_a, MAX_ATTACK);
    if (v[P.fx_dmix] > MAX_DMIX) api.setParam(P.fx_dmix, MAX_DMIX);
    if (v[P.fx_dfb] > MAX_DFB) api.setParam(P.fx_dfb, MAX_DFB);
    api.setPresetLabel(PRESETS[k].name, false);
  }
  function playPassage() { setTimeout(() => api.post({ t: 'seq', notes, delay: 0 }), LEAD * 1000); }
  function play(k) {
    if (!s) return;
    if (s.k0 === undefined) s.k0 = Math.max(0, Math.min(PRESETS.length - 1, k));
    if (k >= PRESETS.length) { finish(); return; }
    if (s.phase !== 'start' && k > setRange(s.k)[1]) sendSet(setRange(s.k));   // moving on to the next set
    s.k = Math.max(0, k);
    s.phase = 'play';
    clearTimeout(s.timer);
    compact(false);
    loadForListening(s.k);
    const n = num(s.k);
    win.title.textContent = `PRESET ${s.k + 1} OF ${PRESETS.length} · ${PRESETS[s.k].cat} · SET ${num(setRange(s.k)[0])}–${num(setRange(s.k)[1])}`;
    win.name.textContent = PRESETS[s.k].name;
    win.desc.textContent = 'Playing… ' + (DESC[PRESETS[s.k].name] || '');
    showStars('off', data.votes[n]);
    buttons([['Skip to vote', askVote, true], ['Stop', stop]]);   // beta 0.3.1: Skip ends the music at once and goes to the rating
    status(voteNote(n) || fileLabel());
    playPassage();
    const t1 = performance.now();
    const tick = () => {
      if (!s || s.phase !== 'play') return;
      const x = Math.min(1, (performance.now() - t1) / ((LEAD + TOTAL) * 1000));
      win.bar.style.width = (100 * x) + '%';
      if (x < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    s.timer = setTimeout(askVote, (LEAD + TOTAL) * 1000);
  }
  function askVote() {
    if (!s) return;
    clearTimeout(s.timer);
    api.post({ t: 'seqstop' });   // the notes end, their release and the effects fade out
    s.phase = 'vote';
    win.desc.textContent = DESC[PRESETS[s.k].name] || 'How do you like this preset?';
    showStars('on', data.votes[num(s.k)]);
    buttons([['▶ Replay', () => play(s.k), true], ['◀ Previous', () => play(s.k - 1)], ['Skip', () => play(s.k + 1)], ['Save as…', saveCopy], ['Stop', stop]]);
    status(voteNote(num(s.k)) + 'Rate 1–10 (you can also play the keyboard to try the preset).');
  }
  function vote(n) {
    if (!s || s.phase !== 'vote') return;
    data.votes[num(s.k)] = n;
    showStars('on', n);
    saveFile();
    if (n > ASK_ABOVE) askModify(n); else play(s.k + 1);
  }
  // ---- above 5 stars: modify the preset?
  function askModify(n) {
    s.phase = 'ask';
    win.desc.textContent = `You gave ${stars(n)}. Do you want to modify this preset? You will change the panel (mouse or MIDI controller) ` +
      'and play it on your MIDI keyboard, then keep the initial settings or record the change.';
    showStars('on', n);
    buttons([['Yes, modify it', startEdit, true], ['No, next preset', () => play(s.k + 1)], ['Stop', stop]]);
    status('Keys: Y = yes, N = no.');
  }
  function startEdit() {
    if (!s) return;
    s.phase = 'edit';
    clearTimeout(s.timer);
    stopSound();
    // the preset exactly as designed (without the listening rules), and the values the change is measured from
    api.applyPreset(PRESETS[s.k].name);
    const prev = data.changes[num(s.k)];
    if (prev) for (const key of Object.keys(prev)) if (P[key] !== undefined) api.setParam(P[key], prev[key][1]);   // continue a recorded change
    s.base = Float64Array.from(WS_SPEC.PRESETS.find(p => p.name === PRESETS[s.k].name).values);
    api.setPresetLabel(PRESETS[s.k].name, !!prev);
    compact(true);
    win.title.textContent = `MODIFY ${PRESETS[s.k].name}`;
    win.name.textContent = 'Change the sound on the panel, play it on your MIDI keyboard';
    win.desc.textContent = 'The preset is loaded exactly as designed (normal octave, voices, attack and echoes of the preset).' +
      (prev ? ' Your previous recorded change is applied.' : '');
    showStars('hide');
    buttons([['▶ Play the passage', () => { stopSound(); playPassage(); }], ['Keep initial settings', keepInitial],
      ['Record preset change', recordChange, true], ['Stop', stop]]);
    status('');
  }
  function diff() {
    const v = api.values(), ch = {};
    for (const i of EDITABLE) if (Math.abs(v[i] - s.base[i]) > 1e-9) ch[PARAMS[i].key] = [s.base[i], v[i]];
    return ch;
  }
  function keepInitial() {
    if (!s) return;
    delete data.changes[num(s.k)];
    saveFile();
    play(s.k + 1);
  }
  function recordChange() {
    if (!s) return;
    const ch = diff(), keys = Object.keys(ch);
    if (!keys.length) { status('Nothing has changed yet: move a control on the panel, or choose "Keep initial settings".'); return; }
    data.changes[num(s.k)] = ch;
    saveFile();
    status(`Recorded: ${keys.map(k => PARAMS[P[k]].name).join(', ')}.`);
    play(s.k + 1);
  }
  function finish() {
    if (s.k0 !== undefined) sendSet(setRange(s.k));
    s.phase = 'end';
    clearTimeout(s.timer);
    compact(false);
    api.post({ t: 'seqstop' });
    win.title.textContent = 'LISTEN AND RATE · FINISHED';
    win.name.textContent = `${nVotes()} of ${PRESETS.length} presets rated — thank you!`;
    const top = PRESETS.filter(p => voted(KEY(p))).sort((a, b) => data.votes[KEY(b)] - data.votes[KEY(a)]).slice(0, 5);
    win.desc.textContent = (top.length ? 'Your top 5: ' + top.map(p => `${KEY(p)} (${data.votes[KEY(p)]})`).join(', ') + '. ' : '') +
      `${Object.keys(data.changes).length} preset change(s) recorded.`;
    win.bar.style.width = '100%';
    showStars('off');
    buttons([['Save as…', saveCopy, true], ['Back to the start', showStart], ['Close', stop]]);
    status(fileLabel());
  }
  function stop() {
    if (!s) return;
    if (s.k0 !== undefined && s.phase !== 'start') sendSet(setRange(s.k));   // a finished set is not lost
    clearTimeout(s.timer);
    stopSound();
    const saved = s.saved;
    s = null;
    if (win) { win.el.style.display = 'none'; compact(false); }
    api.ui.setEvaluating(false);
    api.restore(saved);
  }
  // keys while the window is open (before the app's computer-keyboard notes); while modifying a preset the keys play
  // notes as usual
  document.addEventListener('keydown', (e) => {
    if (!s || s.phase === 'edit' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    let used = true;
    if (e.key === 'Escape') stop();
    else if (s.phase === 'vote' && /^(Digit|Numpad)[0-9]$/.test(e.code)) vote(+e.code.slice(-1) || 10);
    else if (s.phase === 'vote' && e.code === 'KeyR') play(s.k);
    else if (s.phase === 'ask' && e.code === 'KeyY') startEdit();
    else if (s.phase === 'ask' && e.code === 'KeyN') play(s.k + 1);
    else if ((s.phase === 'vote' || s.phase === 'play') && (e.code === 'ArrowLeft' || e.code === 'Backspace')) play(s.k - 1);
    else if ((s.phase === 'vote' || s.phase === 'play') && e.code === 'KeyS') play(s.k + 1);
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  return { start, stop, running: () => !!s, phase: () => (s ? s.phase : 'off'), votes: () => Object.assign({}, data.votes),
    changes: () => JSON.parse(JSON.stringify(data.changes)), fileText };
}
