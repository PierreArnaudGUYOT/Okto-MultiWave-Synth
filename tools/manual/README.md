# Manual generator

Builds the two user manuals of Okto MultiWave Synth in `web/manual/` from the project's single source of truth, so the control
tables (ranges, defaults, host names), the preset tables and every plot follow `tools/spec.js` and `web/js/core.js`
automatically: Manual A (the subtractive oscillators A1 A2) and Manual B (the additive oscillators B1 B2).

```bash
node tools/gen_spec.js            # only if tools/spec.js changed (the manuals read web/js/spec.js)
node tools/manual/build.js a b    # regenerate manual-a.html, manual-b.html and the SVG figures in web/manual/img/
node tools/manual/shots.js        # re-capture the UI screenshots (PNG) with headless Edge (muted); set EDGE=... if needed
```

After a panel layout change, run `shots.js` and check the numbered callouts on the panel screenshots (the `pins` of `mw.js`, in
panel coordinates of `tools/spec.js`).

| File | Contents |
|---|---|
| `build.js` | entry point: writes `web/manual/manual-a.html` and `manual-b.html` |
| `mw.js` | the text: both manuals share their chapters; the oscillator-specific one (tone) and the controls tables follow the kind |
| `lib.js` | helpers: spec-driven control tables, callouts, annotated screenshot, page shell and sidebar |
| `figs.js` | figures computed with `core.js` (SVG files in `web/manual/img/` + the inline diagrams) |
| `top_desc.js` | descriptions of the 22 TOP Sounds (the new presets carry theirs in `tools/presets_new.js`) |
| `shots.js`, `cdp.js` | screenshot capture through the Chrome DevTools Protocol (no dependencies) |

The stylesheet `web/manual/manual.css` is hand-written. Edit the text in these scripts, not in the generated HTML. The deeper theory of
the wavelet engines is in the Wavelet Synthesizer's own manuals (linked from the "More" chapter).
