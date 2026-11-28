/* Flicker check for MFW widgets (browser, dev only).
   MFWFlicker.run() drags every slider in Explore mode through its range in small steps, forwards and backwards, and
   also wiggles it by one step at many positions (a hand never holds still). For every frame it records where each
   canvas label is drawn, whether it has a background box, and which KaTeX overlays are visible. It reports labels
   that jump back and forth (A → B → A in consecutive frames), boxes that blink, and overlays that blink.
   A label may move once when its place gets taken; it must not alternate.
   Not counted as flicker:
   - a label whose text changes at a threshold (nm ↔ µm, "medium vacuum" ↔ "high vacuum"): another label takes
     exactly its place in the frame where it is missing;
   - a label that exists only on one side of a slider value (a marker, a warning, an axis tick entering the range):
     in the jitter test it comes and goes by construction. These are listed in `result.thresholds` for information;
     a label that comes and goes during a one-way sweep is still an issue;
   - a label that follows the data smoothly: in the jitter test it necessarily moves back and forth with the slider.
     It is told apart from a hop between two places by drawing the half step – a smooth label is then in between. */
(function () {
  'use strict';
  // the same label stays the same key when its number, exponent or unit changes (that is new text, not a blink)
  const norm = s => String(s || '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, '').replace(/[−-]?\d[\d.,]*/g, '#')
    .replace(/(nm|µm|μm|mm|cm|m|km|s|min|h|Pa|mPa|kPa|MPa|GPa|mΩ·cm|Ω·cm|kΩ·cm)/g, 'U').replace(/\s+/g, ' ').trim().slice(0, 50);

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
  // is some other label drawn exactly where t is (same anchor, same backdrop)? → the text was swapped, nothing blinked
  const swapped = (frame, k, t) => { for (const [k2, t2] of frame) if (k2.replace(/#\d+$/, '') !== k.replace(/#\d+$/, '') && t2.tex === undefined && t.tex === undefined && dist(t, t2) < 3 && !!t.bg === !!t2.bg) return true; return false; };
  const base = k => (k.startsWith('tex#') ? k : k.replace(/#\d+$/, ''));   // formulas keep their own key
  /** One sequence per label over the frames. A text drawn several times (axis ticks, repeated marks) is followed by
      position, not by drawing order – otherwise a tick entering at the edge would renumber all the others. */
  function tracks(frames) {
    const groups = new Map();
    frames.forEach((f, i) => f.forEach((t, k) => { const g = groups.get(base(k)) || groups.set(base(k), frames.map(() => [])).get(base(k)); g[i].push(t); }));
    const out = [];
    for (const [s, lists] of groups) {
      if (lists.every(l => l.length <= 1)) { out.push({ s, seq: lists.map(l => l[0]) }); continue; }
      const tr = [];                                                   // { seq, last }
      lists.forEach((list, i) => {
        const free = list.slice();
        for (const t of tr.slice().sort((a, b) => (a.seq[i - 1] ? 0 : 1) - (b.seq[i - 1] ? 0 : 1))) {
          let best = -1, bd = Infinity;
          free.forEach((c, j) => { const d = c.tex === undefined && t.last.tex === undefined ? dist(c, t.last) : Infinity; if (d < bd) { bd = d; best = j; } });
          if (best >= 0 && bd < 40) { t.seq[i] = free[best]; t.last = free[best]; free.splice(best, 1); }
        }
        for (const c of free) { const seq = frames.map(() => undefined); seq[i] = c; tr.push({ seq, last: c }); }
      });
      tr.forEach((t, j) => out.push({ s: s + '#' + (j + 1), seq: t.seq }));
    }
    return out;
  }
  /** jitter = true: the slider is wiggled by one step. A label that is simply there on one side of a threshold and
      not on the other then comes and goes by construction – that goes to `notes`, not to `issues`. */
  function analyse(frames, label, issues, mids, notes) {
    for (const { s: k, seq } of tracks(frames)) {
      let rev = 0, ex = '', onoff = 0, exOn = '';
      const desc = t => (!t ? 'absent' : t.tex !== undefined ? (t.tex ? 'shown' : 'hidden') : `(${Math.round(t.x)},${Math.round(t.y)})${t.bg ? ' boxed' : ''}`);
      for (let i = 2; i < seq.length; i++) {
        const a = seq[i - 2], b = seq[i - 1], c = seq[i];
        let flick = false;
        if (!a !== !b && !a === !c) {                                                       // comes and goes
          const swap = b ? swapped(frames[i - 2], k, b) && swapped(frames[i], k, b) : swapped(frames[i - 1], k, a);
          if (!swap) { if (notes) { onoff++; if (!exOn) exOn = `${desc(a)} → ${desc(b)} → ${desc(c)}`; } else flick = true; }
        } else if (a && b && c && a.tex !== undefined) flick = a.tex !== b.tex && a.tex === c.tex;
        else if (a && b && c) {
          flick = (dist(a, b) > JUMP && dist(a, c) < 3) || (a.bg !== b.bg && a.bg === c.bg);
          // smooth motion: at the half step the label is clearly between the two positions
          if (flick && a.bg === b.bg && mids && mids.some(f => { for (const [k2, t] of f) if (base(k2) === base(k) && t.tex === undefined && dist(t, a) > 0.2 * dist(a, b) && dist(t, b) > 0.2 * dist(a, b)) return true; return false; })) flick = false;
        }
        if (flick) { rev++; if (!ex) ex = `${desc(a)} → ${desc(b)} → ${desc(c)}`; }
      }
      if (rev >= 2) issues.push({ slider: label, label: k, reversals: rev, example: ex });
      else if (onoff >= 2) notes.push({ slider: label, label: k, reversals: onoff, example: exOn });
    }
  }

  function run(o = {}) {
    const w = [...MFW.instances][0], p = w.painter, N = o.steps || 240;
    if (w.hasTour) w.setMode('explore');
    const log = [];
    const text0 = p.text;
    p.text = function (str, x, y, opt = {}) { log.push({ s: norm(str), x: this.X(x), y: this.Y(y), bg: !!opt.bg }); return text0.call(this, str, x, y, opt); };
    const issues = [], notes = [];
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
          const mids = [0.5, -0.5].map(k => { set(u + k * du); return frameOf(w, log); });
          analyse(frames, `${name} jitter at ${at(u).toPrecision(3)}`, issues, mids, notes);
        }
        Object.assign(w.P, P0);
      }
    } finally { p.text = text0; w.renderNow(); }
    const group = list => {
      const by = new Map();
      for (const i of list) { const k = i.label + ' @ ' + i.slider.split(' ')[0]; const e = by.get(k) || { ...i, count: 0 }; e.count++; by.set(k, e); }
      return [...by.values()].sort((a, b) => b.count - a.count);
    };
    const out = group(issues);
    out.thresholds = group(notes);            // labels that exist only on one side of a slider value: informational
    return out;
  }
  window.MFWFlicker = { run };
}());
