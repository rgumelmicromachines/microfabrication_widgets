/* Flicker check for MFW widgets (browser, dev only).
   MFWFlicker.run() drags every slider in Explore mode through its range in small steps, forwards and backwards, and
   also wiggles it by one step at many positions (a hand never holds still). For every frame it records where each
   canvas label is drawn, whether it has a background box, and which KaTeX overlays are visible. It reports labels
   that jump back and forth (A → B → A in consecutive frames), boxes that blink, and overlays that blink.
   A label may move once when its place gets taken; it must not alternate. */
(function () {
  'use strict';
  // the same label stays the same key when its number, exponent or unit changes (that is new text, not a blink)
  const norm = s => String(s || '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, '').replace(/[−-]?\d[\d.,]*/g, '#')
    .replace(/(nm|µm|mm|cm|m|km|s|min|h|Pa|mPa|kPa|MPa|GPa|mΩ·cm|Ω·cm|kΩ·cm)/g, 'U').replace(/\s+/g, ' ').trim().slice(0, 50);

  function frameOf(w, log) {
    log.length = 0;
    w.renderNow();
    const seen = new Map(), out = new Map();
    for (const t of log) {
      const k0 = t.s, n = (seen.get(k0) || 0) + 1; seen.set(k0, n);
      out.set(k0 + '#' + n, t);
    }
    w.texEls.forEach((it, i) => out.set('tex#' + i, { tex: parseFloat(it.d.style.opacity || '1') > 0.01 }));
    return out;
  }
  const JUMP = 10;                                   // px: a move this large that comes straight back is a flicker
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function analyse(frames, label, issues) {
    const keys = new Set(); frames.forEach(f => f.forEach((_, k) => keys.add(k)));
    for (const k of keys) {
      const seq = frames.map(f => f.get(k));
      let rev = 0, ex = '';
      const desc = t => (!t ? 'absent' : t.tex !== undefined ? (t.tex ? 'shown' : 'hidden') : `(${Math.round(t.x)},${Math.round(t.y)})${t.bg ? ' boxed' : ''}`);
      for (let i = 2; i < seq.length; i++) {
        const a = seq[i - 2], b = seq[i - 1], c = seq[i];
        let flick = false;
        if (!a !== !b && !a === !c) flick = true;                                         // blinks on/off
        else if (a && b && c && a.tex !== undefined) flick = a.tex !== b.tex && a.tex === c.tex;
        else if (a && b && c) flick = (dist(a, b) > JUMP && dist(a, c) < 3) || (a.bg !== b.bg && a.bg === c.bg);
        if (flick) { rev++; if (!ex) ex = `${desc(a)} → ${desc(b)} → ${desc(c)}`; }
      }
      if (rev >= 2) issues.push({ slider: label, label: k, reversals: rev, example: ex });
    }
  }

  function run(o = {}) {
    const w = [...MFW.instances][0], p = w.painter, N = o.steps || 240;
    if (w.hasTour) w.setMode('explore');
    const log = [];
    const text0 = p.text;
    p.text = function (str, x, y, opt = {}) { log.push({ s: norm(str), x: this.X(x), y: this.Y(y), bg: !!opt.bg }); return text0.call(this, str, x, y, opt); };
    const issues = [];
    try {
      for (const [name, c] of Object.entries(w.controls)) {
        const d = c.d;
        if (!c.inp || c.inp.type !== 'range' || c.lab.hidden) continue;
        const P0 = { ...w.P };
        const at = u => (d.log ? 10 ** (Math.log10(d.min) + u * (Math.log10(d.max) - Math.log10(d.min))) : d.min + u * (d.max - d.min));
        const set = u => { w.P[name] = at(Math.min(1, Math.max(0, u))); };
        // monotonic sweeps
        for (const dir of [1, -1]) {
          const frames = [];
          for (let i = 0; i <= N; i++) { set(dir > 0 ? i / N : 1 - i / N); frames.push(frameOf(w, log)); }
          analyse(frames, `${name} sweep ${dir > 0 ? 'up' : 'down'}`, issues);
        }
        // hand jitter: ±1 step around 60 positions
        for (let j = 1; j < 60; j++) {
          const u = j / 60, du = 1 / N, frames = [];
          for (const k of [0, 1, 0, 1, 0, -1, 0, -1, 0]) { set(u + k * du); frames.push(frameOf(w, log)); }
          analyse(frames, `${name} jitter at ${at(u).toPrecision(3)}`, issues);
        }
        Object.assign(w.P, P0);
      }
    } finally { p.text = text0; w.renderNow(); }
    const by = new Map();
    for (const i of issues) { const k = i.label + ' @ ' + i.slider.split(' ')[0]; const e = by.get(k) || { ...i, count: 0 }; e.count++; by.set(k, e); }
    return [...by.values()].sort((a, b) => b.count - a.count);
  }
  window.MFWFlicker = { run };
}());
