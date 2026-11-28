/* Overlap audit for MFW widgets (browser, dev only).
   Usage in the console of a widget page:
     const s = document.createElement('script'); s.src = '../../tests/overlap-audit.js'; document.head.appendChild(s);
     // then
     MFWAudit.run()            // → { states, issues: [{sig, kind, a, b, count, example}] }
   It records every canvas text box, stroked segment and dot (Painter.rec), plus the KaTeX overlays,
   for every tour step and for sweeps / random combinations of the parameters in Explore mode, and reports
   text–text, text–line, text–dot, overlay–anything overlaps, text or formulas under a button on the figure and text
   outside the stage. */
(function () {
  'use strict';
  const norm = s => String(s || '').replace(/[−-]?\d[\d.,]*/g, '#').replace(/\s+/g, ' ').trim().slice(0, 60);
  const inter = (a, b, pad = 0) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > pad && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > pad;
  const shrink = (r, d) => ({ ...r, x0: r.x0 + d, x1: r.x1 - d, y0: r.y0 + d, y1: r.y1 - d });

  // segment vs axis-aligned rectangle (Liang–Barsky clip)
  function segHitsRect(s, r) {
    let t0 = 0, t1 = 1;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const p = [-dx, dx, -dy, dy], q = [s.x1 - r.x0, r.x1 - s.x1, s.y1 - r.y0, r.y1 - s.y1];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) return false; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    }
    return t1 - t0 > 1e-6;
  }

  function collect(w) {
    const p = w.painter;
    w.renderNow();
    const rec = p.occ.slice();
    const cr = w.canvas.getBoundingClientRect();
    const overlays = [];
    w.texEls.forEach(it => {
      if (parseFloat(it.d.style.opacity || '1') > 0.01) {
        const k = it.d.querySelector('.katex-html') || it.d, r = k.getBoundingClientRect();
        overlays.push({ kind: 'tex', str: it.last, x0: r.left - cr.left, x1: r.right - cr.left, y0: r.top - cr.top, y1: r.bottom - cr.top });
      }
    });
    // buttons on the figure (run, restart …) are HTML above the canvas: nothing may lie under them
    const buttons = [...w.stage.querySelectorAll('.mfw-stagebar button')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return { str: b.title || b.textContent, x0: r.left - cr.left, x1: r.right - cr.left, y0: r.top - cr.top, y1: r.bottom - cr.top }; });
    return { rec, overlays, buttons, W: cr.width, H: cr.height };
  }

  function check(snap) {
    const out = [];
    const texts = snap.rec.filter(r => r.kind === 'text' && r.str.trim());
    const reserved = snap.rec.filter(r => r.kind === 'box');
    const segs = snap.rec.filter(r => r.kind === 'seg' && !r.grid);
    const dots = snap.rec.filter(r => r.kind === 'dot');
    const boxes = texts.concat(snap.overlays);
    for (const t of boxes) {
      if (t.x0 < -1 || t.y0 < -1 || t.x1 > snap.W + 1 || t.y1 > snap.H + 1) out.push({ kind: 'outside', a: t.str, b: '' });
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.str === b.str && Math.abs(a.x0 - b.x0) < 1 && Math.abs(a.y0 - b.y0) < 1) continue;   // the same label drawn twice
      if (inter(shrink(a, 1), shrink(b, 1), 0.5)) out.push({ kind: a.kind === 'tex' || b.kind === 'tex' ? 'formula–text' : 'text–text', a: a.str, b: b.str });
    }
    for (const t of boxes) {
      const r = shrink(t, 1.5);
      const hits = new Map();
      for (const s of segs) {
        const rr = { x0: r.x0 - s.w / 2 + 1, x1: r.x1 + s.w / 2 - 1, y0: r.y0 - s.w / 2 + 1, y1: r.y1 + s.w / 2 - 1 };
        if (segHitsRect(s, rr)) hits.set(s.color, (hits.get(s.color) || 0) + 1);
      }
      for (const [c] of hits) out.push({ kind: (t.kind === 'tex' ? 'formula' : t.bg ? 'text(bg)' : 'text') + '–line', a: t.str, b: 'line ' + c });
      for (const d of dots) if (inter(r, d, 0.5)) out.push({ kind: (t.kind === 'tex' ? 'formula' : 'text') + '–dot', a: t.str, b: 'dot' });
    }
    for (const bt of snap.buttons || []) for (const t of boxes) if (inter(bt, shrink(t, 1), 0.5)) out.push({ kind: 'button–' + (t.kind === 'tex' ? 'formula' : 'text'), a: 'button ' + bt.str, b: t.str });
    for (const bx of reserved) {
      const r = shrink(bx, 1);
      for (const t of boxes) if (inter(r, t, 0.5)) out.push({ kind: 'legend–text', a: 'legend', b: t.str });
      const cols = new Set();
      for (const sg of segs) if (segHitsRect(sg, r)) cols.add(sg.color);
      for (const c of cols) out.push({ kind: 'legend–line', a: 'legend', b: 'line ' + c });
      for (const d of dots) if (inter(r, d, 0.5)) out.push({ kind: 'legend–dot', a: 'legend', b: 'dot' });
    }
    return out;
  }

  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function states(w, nRandom) {
    const cfg = w.cfg, list = [];
    const defs = {};
    for (const [k, d] of Object.entries(cfg.params || {})) defs[k] = d.value;
    (cfg.steps || []).forEach((st, i) => list.push({ label: `step ${i + 1} ${st.name || ''}`, step: i }));
    const vals = (d, n) => {
      if (d.options) return Object.keys(d.options);
      if (typeof d.value === 'boolean') return [false, true];
      const out = [];
      for (let i = 0; i < n; i++) { const u = i / (n - 1); out.push(d.log ? 10 ** (Math.log10(d.min) + u * (Math.log10(d.max) - Math.log10(d.min))) : d.min + u * (d.max - d.min)); }
      return out;
    };
    const optKeys = Object.entries(cfg.params || {}).filter(([, d]) => d.options).map(([k]) => k);
    // sweep each parameter for each combination of the first select (mode / etchant / dopant), others at default
    const firstSel = optKeys[0];
    const bases = firstSel ? Object.keys(cfg.params[firstSel].options).map(o => ({ ...defs, [firstSel]: o })) : [defs];
    for (const base of bases) for (const [k, d] of Object.entries(cfg.params || {})) {
      if (k === firstSel) continue;
      for (const x of vals(d, 9)) list.push({ label: `explore ${firstSel ? firstSel + '=' + base[firstSel] + ' ' : ''}${k}=${typeof x === 'number' ? +x.toPrecision(3) : x}`, P: { ...base, [k]: x } });
    }
    const R = rng(12345);
    for (let i = 0; i < nRandom; i++) {
      const P = {};
      for (const [k, d] of Object.entries(cfg.params || {})) { const vs = vals(d, 50); P[k] = vs[Math.floor(R() * vs.length)]; }
      list.push({ label: 'random ' + JSON.stringify(Object.fromEntries(Object.entries(P).map(([k, x]) => [k, typeof x === 'number' ? +x.toPrecision(3) : x]))), P });
    }
    return list;
  }

  function run(opts = {}) {
    const w = opts.widget || [...MFW.instances][0];
    const list = states(w, opts.random === undefined ? 60 : opts.random);
    const issues = new Map();
    const saved = { P: { ...w.P }, mode: w.mode, step: w.step };
    for (const s of list) {
      if (s.step !== undefined) { w.stop(); w.goStep(s.step, { instant: true }); }
      else {
        if (w.mode !== 'explore' && w.hasTour) w.setMode('explore');
        Object.assign(w.P, s.P);
      }
      const snap = collect(w);
      for (const it of check(snap)) {
        const sig = `${it.kind} | ${norm(it.a)} | ${norm(it.b)}`;
        const e = issues.get(sig) || { sig, kind: it.kind, a: it.a, b: it.b, count: 0, example: s.label };
        e.count++; issues.set(sig, e);
      }
    }
    // restore
    Object.assign(w.P, saved.P);
    if (saved.mode === 'tour') w.goStep(Math.max(0, saved.step), { instant: true }); else w.renderNow();
    return { states: list.length, issues: [...issues.values()].sort((a, b) => b.count - a.count) };
  }

  window.MFWAudit = { run, collect, check };
}());
