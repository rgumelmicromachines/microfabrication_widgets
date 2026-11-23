/*!
 * MFW Widget Engine 2.1.0
 * Interactive explainer widgets for teaching microfabrication.
 * MIT License.
 *
 * Classic script (no modules, no build step), so pages also work when opened straight from disk.
 * Formulas use KaTeX, loaded on demand from jsDelivr (set MFW.config.katexBase to self-host it).
 *
 * What changed against 1.x
 *  - light / dark theme (palette is swapped in place, every widget redraws)
 *  - sans-serif UI font, English number format (decimal point)
 *  - layout fills the screen: stage + side panel on wide screens, stage height fits the viewport
 *  - two explicit modes: "Guided tour" (steps drive some parameters, those sliders are locked)
 *    and "Explore" (every slider is free); parameters no step touches are never overwritten
 *  - playback speed control, hold time per step derived from reading time, progress bar
 *  - step text / caption may be functions of the live values, log-scale sliders, conditional controls
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '2.1.0';
  const config = {
    katexBase: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/',
    font: '"Archivo", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
    frameWidth: 14.2222,                    // frame width in scene units (height follows the aspect ratio)
    feedbackUrl: 'https://github.com/rgumelmicromachines/microfabrication_widgets/issues/new',   // suggestions and error reports
  };

  // ================================================================ palettes
  // Dark = Manim CE constants on a blue-black stage. Light = same roles, re-tuned for a white background
  // (dark-on-light, every line colour >= 3:1 against the light stage). Keys are roles, not hues:
  // 'white' means "strongest foreground", greyD/greyE mean "faint fills".
  const DARK = {
    bg: '#0B0E12', text: '#DDDDDD', white: '#FFFFFF', muted: '#8C8C8C', axis: '#6A6A6A', grid: '#1F252D',
    blueA: '#C7E9F1', blueB: '#9CDCEB', blue: '#58C4DD', blueD: '#29ABCA', blueE: '#236B8E',
    tealA: '#ACEAD7', tealB: '#76DDC0', teal: '#5CD0B3', tealD: '#55C1A7', tealE: '#49A88F',
    greenA: '#C9E2AE', greenB: '#A6CF8C', green: '#83C167', greenD: '#77B05D', greenE: '#699C52',
    yellowA: '#FFF1B6', yellowB: '#FFEA94', yellow: '#F7D96F', yellowD: '#F4D345', yellowE: '#E8C11C',
    goldA: '#F7C797', goldB: '#F9B775', gold: '#F0AC5F', goldD: '#E1A158', goldE: '#C78D46',
    redA: '#F7A1A3', redB: '#FF8080', red: '#FC6255', redD: '#E65A4C', redE: '#CF5044',
    maroonA: '#ECABC1', maroonB: '#EC92AB', maroon: '#C55F73', maroonD: '#A24D61', maroonE: '#94424F',
    purpleA: '#CAA3E8', purpleB: '#B189C6', purple: '#9A72AC', purpleD: '#715582', purpleE: '#644172',
    greyA: '#DDDDDD', greyB: '#BBBBBB', grey: '#888888', greyD: '#444444', greyE: '#222222',
    pink: '#D147BD', lightPink: '#DC75CD', orange: '#FF862F', lightBrown: '#CD853F', darkBrown: '#8B4513',
  };
  const LIGHT = {
    bg: '#FFFFFF', text: '#1D2228', white: '#000000', muted: '#5F6670', axis: '#8C949D', grid: '#E3E7EB',
    blueA: '#0B3954', blueB: '#0A4F75', blue: '#0072B2', blueD: '#2E8BC0', blueE: '#8CC3E0',
    tealA: '#0B4D3E', tealB: '#0A6551', teal: '#00846A', tealD: '#2A9C84', tealE: '#8FD0C0',
    greenA: '#24501A', greenB: '#2F6B22', green: '#3B8526', greenD: '#5C9E48', greenE: '#A9D19A',
    yellowA: '#4F3800', yellowB: '#6B4C00', yellow: '#8F6500', yellowD: '#A87A10', yellowE: '#E1C46A',
    goldA: '#5E3304', goldB: '#7F4507', gold: '#B35A00', goldD: '#C8731E', goldE: '#EFB47A',
    redA: '#6B1A14', redB: '#8F2219', red: '#C2372B', redD: '#D45549', redE: '#F0A69F',
    maroonA: '#4F1426', maroonB: '#6E1E37', maroon: '#99335C', maroonD: '#B15274', maroonE: '#E4A9BD',
    purpleA: '#3A1F57', purpleB: '#512B78', purple: '#7446A0', purpleD: '#8E66B5', purpleE: '#CDB8E2',
    greyA: '#2C3036', greyB: '#4A5058', grey: '#7F8690', greyD: '#C7CCD2', greyE: '#EBEEF1',
    pink: '#B02F9C', lightPink: '#C65AB4', orange: '#D55E00', lightBrown: '#9A5A1C', darkBrown: '#6B3410',
  };
  const C = { ...DARK };

  // Materials for cross-sections – the same colours in every widget of the site.
  const MAT_DARK = {
    si: { fill: '#3A3F4B', stroke: '#6C7383', label: 'Si' },
    sio2: { fill: '#1F4E66', stroke: '#58C4DD', label: 'SiO₂' },
    si3n4: { fill: '#2E5E52', stroke: '#5CD0B3', label: 'Si₃N₄' },
    poly: { fill: '#5A2E3A', stroke: '#C55F73', label: 'poly-Si' },
    metal: { fill: '#8C8C8C', stroke: '#DDDDDD', label: 'metal' },
    gold: { fill: '#8A6230', stroke: '#F0AC5F', label: 'Au' },
    resist: { fill: '#4B3A5C', stroke: '#9A72AC', label: 'resist' },
    chrome: { fill: '#A3A7AE', stroke: '#D0D3D8', label: 'Cr' },
    ndoped: { fill: 'rgba(88,196,221,0.35)', stroke: '#58C4DD', label: 'n' },
    pdoped: { fill: 'rgba(252,98,85,0.35)', stroke: '#FC6255', label: 'p' },
    glass: { fill: '#24343A', stroke: '#9CDCEB', label: 'glass' },
  };
  const MAT_LIGHT = {
    si: { fill: '#C7CBD3', stroke: '#6E7686', label: 'Si' },
    sio2: { fill: '#BFDDEC', stroke: '#0072B2', label: 'SiO₂' },
    si3n4: { fill: '#BFE2D6', stroke: '#00846A', label: 'Si₃N₄' },
    poly: { fill: '#E9C6D2', stroke: '#99335C', label: 'poly-Si' },
    metal: { fill: '#A9A9AE', stroke: '#4C4C52', label: 'metal' },
    gold: { fill: '#E3C58F', stroke: '#B35A00', label: 'Au' },
    resist: { fill: '#D9C7EA', stroke: '#7446A0', label: 'resist' },
    chrome: { fill: '#3A3A3E', stroke: '#222226', label: 'Cr' },
    ndoped: { fill: 'rgba(0,114,178,0.22)', stroke: '#0072B2', label: 'n' },
    pdoped: { fill: 'rgba(194,55,43,0.22)', stroke: '#C2372B', label: 'p' },
    glass: { fill: '#D6E6EA', stroke: '#0A4F75', label: 'glass' },
  };
  const MAT = {};
  for (const k of Object.keys(MAT_DARK)) MAT[k] = { ...MAT_DARK[k] };

  // ================================================================ colour helpers
  function parseColor(c) {
    if (typeof c !== 'string') return [0, 0, 0, 1];
    if (c[0] === '#') {
      const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7);
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(',').map(s => parseFloat(s)); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
    return [0, 0, 0, 1];
  }
  const hex2 = v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  /** Linear mix of two colours in sRGB: t = 0 → a, t = 1 → b. */
  function mix(a, b, t) {
    const A = parseColor(a), B = parseColor(b);
    return '#' + hex2(A[0] + (B[0] - A[0]) * t) + hex2(A[1] + (B[1] - A[1]) * t) + hex2(A[2] + (B[2] - A[2]) * t);
  }
  /** Colour with alpha: rgba(...). */
  function rgba(c, a) { const p = parseColor(c); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; }
  /** Resolve a palette key ('yellow') or pass a literal colour through. */
  const col = c => (c && C[c] !== undefined ? C[c] : c);

  // ================================================================ math
  const M = {
    clamp: (v, a, b) => Math.min(Math.max(v, a), b),
    lerp: (a, b, t) => a + (b - a) * t,
    sigmoid: x => 1 / (1 + Math.exp(-x)),
    linspace(a, b, n) { const out = []; for (let i = 0; i < n; i++) out.push(a + (b - a) * i / (n - 1)); return out; },
    logspace(a, b, n) { return M.linspace(Math.log10(a), Math.log10(b), n).map(e => 10 ** e); },
    /** Complementary error function (Numerical Recipes erfcc, |relative error| < 1.2e-7). */
    erfc(x) {
      const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
      const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
        t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
      return x >= 0 ? r : 2 - r;
    },
    erf(x) { return 1 - M.erfc(x); },
    /** Inverse of erfc on (0, 2) by bisection (robust, ~1e-12). */
    erfcinv(y) {
      if (!(y > 0)) return Infinity;
      if (!(y < 2)) return -Infinity;
      let lo = -7, hi = 7;
      for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (M.erfc(mid) > y) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    },
    gauss: (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)),
    /** Arrhenius law  A · exp(−Ea / kT);  Ea in eV, T in °C. */
    arrhenius: (A, Ea, TC) => A * Math.exp(-Ea / (8.617333e-5 * (TC + 273.15))),
  };
  const K = { kB: 8.617333e-5, q: 1.602177e-19, h: 6.62607e-34, c: 2.99792458e8, eps0: 8.8541878e-12, NA: 6.02214e23 };

  // ================================================================ easing
  const ease = {
    linear: t => t,
    smooth(t, inflection = 10) {
      const e = M.sigmoid(-inflection / 2);
      return M.clamp((M.sigmoid(inflection * (t - 0.5)) - e) / (1 - 2 * e), 0, 1);
    },
    inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  };

  // ================================================================ number formatting (English: decimal point)
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '+': '⁺' };
  function splitSci(v, d) {
    if (v === 0 || !isFinite(v)) return [String(v), 0];
    let e = Math.floor(Math.log10(Math.abs(v)));
    let m = (v / 10 ** e).toFixed(d);
    if (Math.abs(parseFloat(m)) >= 10) { e += 1; m = (v / 10 ** e).toFixed(d); }
    return [m, e];
  }
  const minus = s => s.replace(/^-/, '−');
  const fmt = {
    sup: n => String(n).split('').map(ch => SUP[ch] || ch).join(''),
    /** 0.4 → "0.40" */
    num(v, d = 2) { return isFinite(v) ? minus(v.toFixed(d)) : '–'; },
    /** 4.43e19 → "4.4×10¹⁹" */
    sci(v, d = 1) {
      if (!isFinite(v)) return '–';
      if (v === 0) return '0';
      const [m, e] = splitSci(v, d);
      return `${minus(m)}×10${fmt.sup(e)}`;
    },
    /** For LaTeX: 4.43e19 → "4.4 \times 10^{19}" */
    texSci(v, d = 1) {
      if (!isFinite(v)) return '-';
      if (v === 0) return '0';
      const [m, e] = splitSci(v, d);
      return `${m} \\times 10^{${e}}`;
    },
    texNum(v, d = 2) { return isFinite(v) ? v.toFixed(d) : '-'; },
    texAuto(v) {
      const a = Math.abs(v);
      if (!isFinite(v)) return '-';
      if (a !== 0 && (a < 1e-2 || a >= 1e4)) return fmt.texSci(v, 1);
      return fmt.texNum(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
    },
    /** 1234 → "1234", 12.3 → "12.3", 0.0123 → "0.0123" */
    auto(v) {
      if (!isFinite(v)) return '–';
      const a = Math.abs(v);
      if (a !== 0 && (a < 1e-3 || a >= 1e5)) return fmt.sci(v, 1);
      const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
      return fmt.num(v, d);
    },
    /** Significant figures without scientific notation for normal magnitudes. */
    sig(v, n = 3) {
      if (!isFinite(v)) return '–';
      if (v === 0) return '0';
      const a = Math.abs(v);
      if (a < 1e-3 || a >= 1e6) return fmt.sci(v, n - 1);
      const d = Math.max(0, n - 1 - Math.floor(Math.log10(a)));
      return fmt.num(v, d);
    },
    /** Duration given in hours → "45 min", "2.5 h". */
    hours(h) { return h < 1 ? `${fmt.sig(h * 60, 2)} min` : `${fmt.sig(h, 3)} h`; },
  };

  /** Plain-text approximation of a LaTeX string (used for snapshots and when KaTeX is unavailable). */
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', theta: 'θ',
    lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', Omega: 'Ω',
    cdot: '·', times: '×', approx: '≈', le: '≤', ge: '≥', leq: '≤', geq: '≥', pm: '±', infty: '∞', to: '→',
    Rightarrow: '⇒', rightarrow: '→', propto: '∝', partial: '∂', perp: '⊥', circ: '°', degree: '°',
    ln: 'ln', log: 'log', exp: 'exp', sin: 'sin', cos: 'cos', tan: 'tan', min: 'min', max: 'max', quad: ' ', qquad: '  ' };
  function texToText(tex) {
    let s = tex.replace(/\\(?:mathrm|text|mathbf|operatorname)\{([^{}]*)\}/g, '​$1​')
      .replace(/\\([dt]?frac)\b/g, '\\frac')
      .replace(/\\([A-Za-z]+)/g, (m0, w) => (w === 'frac' || w === 'sqrt' ? m0 : (GREEK[w] !== undefined ? GREEK[w] : '')));
    const scripts = t => t.replace(/\^\{([^{}]*)\}/g, (m0, g) => fmt.sup(g)).replace(/\^(\w)/g, (m0, g) => fmt.sup(g))
      .replace(/_\{([^{}]*)\}/g, '$1').replace(/_(\w)/g, '$1');
    for (let i = 0; i < 5; i++) {
      s = scripts(s).replace(/\\sqrt\{([^{}]*)\}/g, '√⟮$1⟯').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '⟮$1⟯/⟮$2⟯');
    }
    s = scripts(s).replace(/\\[,;!: ]/g, ' ').replace(/[{}​]/g, '').replace(/\s+/g, ' ').trim();
    return s.replace(/⟮([^⟮⟯\s+\-−·*/=]+)⟯/g, '$1').replace(/⟮/g, '(').replace(/⟯/g, ')');
  }

  /** Split "x_{j} = 10^{19}" into runs: mode 0 normal, −1 subscript, +1 superscript. */
  function parseRich(s) {
    const runs = [];
    let i = 0, cur = '';
    while (i < s.length) {
      const ch = s[i];
      if ((ch === '_' || ch === '^') && i + 1 < s.length && s[i + 1] !== ' ') {
        if (cur) { runs.push({ t: cur, mode: 0 }); cur = ''; }
        const mode = ch === '_' ? -1 : 1;
        if (s[i + 1] === '{') {
          const j = s.indexOf('}', i + 2), end = j < 0 ? s.length : j;
          runs.push({ t: s.slice(i + 2, end), mode }); i = end + 1;
        } else { runs.push({ t: s[i + 1], mode }); i += 2; }
      } else { cur += ch; i++; }
    }
    if (cur) runs.push({ t: cur, mode: 0 });
    return runs;
  }

  /** Same sub/superscript syntax as canvas text, for DOM text. Text between <b>…</b>, <i>…</i>, <em>…</em> keeps the tags. */
  function richToHTML(s) {
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const KEEP = /(<\/?(?:b|i|em|strong|sub|sup|span class="hl"|span)>)/g;
    return String(s).split(KEEP).map((part, i) => (i % 2 ? part
      : parseRich(part).map(r => (r.mode < 0 ? `<sub>${esc(r.t)}</sub>` : r.mode > 0 ? `<sup>${esc(r.t)}</sup>` : esc(r.t))).join(''))).join('');
  }

  // ================================================================ geometry helpers (label placement)
  function lbClip(s, r) {
    let t0 = 0, t1 = 1;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const p = [-dx, dx, -dy, dy], q = [s.x1 - r.x0, r.x1 - s.x1, s.y1 - r.y0, r.y1 - s.y1];
    for (let i = 0; i < 4; i++) {
      if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) return null; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; } }
    }
    return t1 - t0 > 1e-9 ? [t0, t1] : null;
  }
  /** Does segment s = {x1,y1,x2,y2} cross rectangle r = {x0,x1,y0,y1}? (Liang–Barsky) */
  const segHitsRect = (s, r) => lbClip(s, r) !== null;
  /** Clip segment s in place to rectangle r; false if nothing is left. */
  function clipSeg(s, r) {
    const t = lbClip(s, r);
    if (!t) return false;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, x1 = s.x1 + dx * t[0], y1 = s.y1 + dy * t[0];
    s.x2 = s.x1 + dx * t[1]; s.y2 = s.y1 + dy * t[1]; s.x1 = x1; s.y1 = y1;
    return true;
  }

  // ================================================================ Painter – all drawing in scene units
  class Painter {
    constructor(ctx, W, H, opt = {}) {
      this.ctx = ctx;
      this.font = opt.font || config.font;
      this.frameW = opt.frameWidth || config.frameWidth;
      this.layers = {};
      this.occ = [];                 // what was drawn this frame (text boxes, stroked segments, dots) in px – used by place()
      this._clipR = [];              // stack of active clip rectangles (px)
      this._placed = new Map();      // label key -> candidate index chosen last frame (hysteresis: labels do not hop around)
      this.resize(W, H);
    }
    resize(W, H) {
      this.W = W; this.H = H; this.k = W / this.frameW; this.frameH = H / this.k;
      this.left = -this.frameW / 2; this.right = this.frameW / 2; this.top = this.frameH / 2; this.bottom = -this.frameH / 2;
    }
    X(x) { return (x + this.frameW / 2) * this.k; }
    Y(y) { return (this.frameH / 2 - y) * this.k; }
    lw(sw) { return Math.max(0.75, sw * 0.01 * this.k); }                  // Manim stroke_width → px
    _withAlpha(o, fn) {
      const c = this.ctx, a0 = c.globalAlpha;
      c.globalAlpha = a0 * (o.alpha === undefined ? 1 : o.alpha);
      try { fn(c); } finally { c.globalAlpha = a0; }
    }
    _strokeFill(o, defStroke, defWidth) {
      const c = this.ctx;
      if (o.fill) {
        const a0 = c.globalAlpha;
        if (o.fillAlpha !== undefined) c.globalAlpha = a0 * o.fillAlpha;
        c.fillStyle = col(o.fill); c.fill();
        c.globalAlpha = a0;
      }
      const stroke = o.stroke === undefined ? (o.color === undefined ? defStroke : o.color) : o.stroke;
      if (stroke) {
        c.strokeStyle = col(stroke); c.lineWidth = this.lw(o.width === undefined ? defWidth : o.width);
        c.setLineDash(o.dash ? o.dash.map(v => v * this.k) : []);
        c.lineCap = o.cap || 'round'; c.lineJoin = 'round';
        c.stroke(); c.setLineDash([]);
      }
    }
    clear(color) { const c = this.ctx; c.save(); c.globalAlpha = 1; c.fillStyle = col(color || C.bg); c.fillRect(0, 0, this.W, this.H); c.restore(); this.occ = []; this._clipR = []; }
    /** Draw everything in fn with the opacity of a named layer (see Widget.show/hide). */
    layer(name, fn) {
      const a = this.layers[name] === undefined ? 1 : this.layers[name];
      if (a <= 0.001) return;
      this._withAlpha({ alpha: a }, fn);
    }
    alpha(a, fn) { if (a > 0.001) this._withAlpha({ alpha: a }, fn); }
    /** Current opacity of a named layer (1 if it is not a layer). */
    vis(name) { return this.layers[name] === undefined ? 1 : this.layers[name]; }

    /** Occupancy: every stroked segment is logged in px (clipped to the active clip), so labels can avoid it. */
    _recSegs(pts, o, defStroke) {
      const stroke = o.stroke === undefined ? (o.color === undefined ? defStroke : o.color) : o.stroke;
      if (!stroke || o.noOcc) return;
      const a = this.ctx.globalAlpha * (o.alpha === undefined ? 1 : o.alpha);
      if (a < 0.05) return;
      const w = this.lw(o.width === undefined ? 3 : o.width), colr = col(stroke), grid = colr === C.grid;
      const n = o.closed ? pts.length : pts.length - 1, cr = this._clipR[this._clipR.length - 1];
      for (let i = 0; i < n; i++) {
        const P = pts[i], Q = pts[(i + 1) % pts.length];
        const sg = { kind: 'seg', x1: this.X(P[0]), y1: this.Y(P[1]), x2: this.X(Q[0]), y2: this.Y(Q[1]), w, color: colr, grid, tag: o.tag };
        if (cr && !clipSeg(sg, cr)) continue;
        this.occ.push(sg);
      }
    }
    /** Pixel box of a text label (same geometry as text()). */
    _tbox(str, x, y, o = {}) {
      const c = this.ctx, s = String(str), px = (o.size || 0.3) * this.k;
      const style = `${o.italic ? 'italic ' : ''}${o.bold ? '600 ' : ''}`, fam = o.font || this.font;
      const runs = /[_^]./.test(s) ? parseRich(s) : [{ t: s, mode: 0 }];
      c.save();
      let total = 0;
      const widths = runs.map(r => { c.font = `${style}${r.mode ? px * 0.7 : px}px ${fam}`; const w = c.measureText(r.t).width; total += w; return w; });
      c.restore();
      const xp = o.align === 'center' ? -total / 2 : o.align === 'right' ? -total : 0;
      const bl = o.baseline || 'middle', hasSup = runs.some(r => r.mode > 0), hasSub = runs.some(r => r.mode < 0);
      let t0 = bl === 'top' ? 0.05 : bl === 'bottom' ? -0.95 : bl === 'alphabetic' ? -0.75 : -0.42, t1 = t0 + 0.88;
      if (hasSup) t0 -= 0.2;
      if (hasSub) t1 += 0.12;
      const corners = [[xp, t0 * px], [xp + total, t0 * px], [xp, t1 * px], [xp + total, t1 * px]];
      const ang = o.rotate ? -o.rotate * Math.PI / 180 : 0, ca = Math.cos(ang), sa = Math.sin(ang), X0 = this.X(x), Y0 = this.Y(y);
      const tc = corners.map(([u, w]) => [X0 + u * ca - w * sa, Y0 + u * sa + w * ca]);
      return { runs, widths, total, xp, px, style, fam, x0: Math.min(...tc.map(q => q[0])), x1: Math.max(...tc.map(q => q[0])),
        y0: Math.min(...tc.map(q => q[1])), y1: Math.max(...tc.map(q => q[1])) };
    }
    /** How badly a px box collides with what is already drawn (0 = free). */
    _collide(b, o = {}) {
      const pad = (o.pad === undefined ? 0.04 : o.pad) * this.k, r = { x0: b.x0 - pad, x1: b.x1 + pad, y0: b.y0 - pad, y1: b.y1 + pad };
      let score = 0;
      if (b.x0 < 1 || b.y0 < 1 || b.x1 > this.W - 1 || b.y1 > this.H - 1) score += 100;
      if (o.within) {
        const [wx0, wy0, wx1, wy1] = o.within, X0 = this.X(Math.min(wx0, wx1)), X1 = this.X(Math.max(wx0, wx1)), Y0 = this.Y(Math.max(wy0, wy1)), Y1 = this.Y(Math.min(wy0, wy1));
        if (b.x0 < X0 || b.x1 > X1 || b.y0 < Y0 || b.y1 > Y1) score += 50;
      }
      for (const it of this.occ) {
        if (o.ignore && it.tag && o.ignore.includes(it.tag)) continue;
        if (it.kind === 'seg') {
          if (it.grid) continue;
          const h = it.w / 2;
          if (segHitsRect(it, { x0: r.x0 - h, x1: r.x1 + h, y0: r.y0 - h, y1: r.y1 + h })) score += it.tag === 'soft' ? 0.3 : 1;
        } else if (Math.min(r.x1, it.x1) > Math.max(r.x0, it.x0) && Math.min(r.y1, it.y1) > Math.max(r.y0, it.y0)) score += it.kind === 'area' ? 0.5 : 4;
      }
      return score;
    }
    /** Mark a scene-unit rectangle as occupied (e.g. where a KaTeX formula sits above the canvas). */
    reserve(x1, y1, x2, y2, kind = 'box') {
      this.occ.push({ kind, x0: this.X(Math.min(x1, x2)), x1: this.X(Math.max(x1, x2)), y0: this.Y(Math.max(y1, y2)), y1: this.Y(Math.min(y1, y2)) });
    }
    /** Draw a label at the first free candidate position. cands: [[x, y, align?, baseline?], ...] in scene units.
        The choice is sticky (o.key): a label keeps its place while that place stays free, so it does not hop around
        while a slider moves. Returns the chosen candidate. */
    place(str, cands, o = {}) {
      if (!cands.length) return null;
      const key = o.key || String(str).replace(/[\d.,−-]+/g, '#'), last = this._placed.get(key);
      const boxOf = cd => this._tbox(str, cd[0], cd[1], { ...o, align: cd[2] || o.align, baseline: cd[3] || o.baseline });
      let best = -1, bestS = Infinity;
      if (last !== undefined && last < cands.length) { const sc = this._collide(boxOf(cands[last]), o); if (sc === 0) { best = last; bestS = 0; } }
      if (best < 0) {
        for (let i = 0; i < cands.length; i++) {
          const sc = this._collide(boxOf(cands[i]), o);
          if (sc < bestS - 1e-9) { best = i; bestS = sc; }
          if (sc === 0) break;
        }
      }
      this._placed.set(key, best);
      const cd = cands[best];
      this.text(str, cd[0], cd[1], { ...o, align: cd[2] || o.align, baseline: cd[3] || o.baseline, bg: o.bg === undefined ? bestS > 0 : o.bg });
      return cd;
    }
    line(x1, y1, x2, y2, o = {}) {
      this._recSegs([[x1, y1], [x2, y2]], o, C.text);
      this._withAlpha(o, c => { c.beginPath(); c.moveTo(this.X(x1), this.Y(y1)); c.lineTo(this.X(x2), this.Y(y2)); this._strokeFill({ ...o, fill: null }, C.text, 3); });
    }
    path(pts, o = {}) {
      if (!pts || pts.length < 2) return;
      this._recSegs(pts, o, o.fill ? null : C.text);
      this._withAlpha(o, c => {
        c.beginPath(); c.moveTo(this.X(pts[0][0]), this.Y(pts[0][1]));
        for (let i = 1; i < pts.length; i++) c.lineTo(this.X(pts[i][0]), this.Y(pts[i][1]));
        if (o.closed) c.closePath();
        this._strokeFill(o, o.fill ? null : C.text, 3);
      });
    }
    polygon(pts, o = {}) { this.path(pts, { stroke: o.fill ? null : C.text, ...o, closed: true }); }
    /** Rectangle with lower-left corner (x, y). Option radius (units) for rounded corners. */
    rect(x, y, w, h, o = {}) {
      this._withAlpha(o, c => {
        const X0 = this.X(x), Y0 = this.Y(y + h), W = w * this.k, H = h * this.k, r = Math.min((o.radius || 0) * this.k, W / 2, H / 2);
        c.beginPath();
        if (r > 0) {
          c.moveTo(X0 + r, Y0); c.lineTo(X0 + W - r, Y0); c.arcTo(X0 + W, Y0, X0 + W, Y0 + r, r);
          c.lineTo(X0 + W, Y0 + H - r); c.arcTo(X0 + W, Y0 + H, X0 + W - r, Y0 + H, r);
          c.lineTo(X0 + r, Y0 + H); c.arcTo(X0, Y0 + H, X0, Y0 + H - r, r);
          c.lineTo(X0, Y0 + r); c.arcTo(X0, Y0, X0 + r, Y0, r); c.closePath();
        } else c.rect(X0, Y0, W, H);
        if (!o.noOcc) this._recSegs([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, closed: true }, o.fill ? null : C.text);
        this._strokeFill(o, o.fill ? null : C.text, 2);
      });
    }
    /** Rectangle given by two corners – handy for cross-sections. */
    box(x1, y1, x2, y2, o = {}) { this.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), o); }
    /** Layer of a material from MAT (e.g. 'sio2') between x1..x2 and y1..y2, optional label. */
    material(name, x1, y1, x2, y2, o = {}) {
      const m = MAT[name] || { fill: name, stroke: null };
      this.box(x1, y1, x2, y2, { fill: m.fill, stroke: m.stroke, width: 1.5, ...o });
      if (o.label) this.text(o.label === true ? m.label : o.label, (x1 + x2) / 2, (y1 + y2) / 2,
        { size: o.labelSize || 0.26, color: o.labelColor || C.text, align: 'center' });
    }
    /** Polygon filled with a material. */
    materialPoly(name, pts, o = {}) {
      const m = MAT[name] || { fill: name, stroke: null };
      this.polygon(pts, { fill: m.fill, stroke: m.stroke, width: 1.5, ...o });
    }
    circle(cx, cy, r, o = {}) {
      this._withAlpha(o, c => { c.beginPath(); c.arc(this.X(cx), this.Y(cy), Math.max(r * this.k, 0.1), 0, 2 * Math.PI); this._strokeFill(o, o.fill ? null : C.text, 2); });
    }
    ellipse(cx, cy, rx, ry, o = {}) {
      this._withAlpha(o, c => { c.beginPath(); c.ellipse(this.X(cx), this.Y(cy), Math.max(rx * this.k, 0.1), Math.max(ry * this.k, 0.1), -(o.rotate || 0) * Math.PI / 180, 0, 2 * Math.PI); this._strokeFill(o, o.fill ? null : C.text, 2); });
    }
    /** Arc from angle a0 to a1 in degrees, counter-clockwise like in mathematics. */
    arc(cx, cy, r, a0, a1, o = {}) {
      this._withAlpha(o, c => { c.beginPath(); c.arc(this.X(cx), this.Y(cy), r * this.k, -a0 * Math.PI / 180, -a1 * Math.PI / 180, a1 > a0); this._strokeFill({ ...o, fill: o.fill }, C.text, 3); });
    }
    dot(x, y, o = {}) {
      if (this.ctx.globalAlpha * (o.alpha === undefined ? 1 : o.alpha) > 0.05) {
        const r = (o.r || 0.08) * this.k;
        this.occ.push({ kind: 'dot', x0: this.X(x) - r, y0: this.Y(y) - r, x1: this.X(x) + r, y1: this.Y(y) + r });
      }
      this.circle(x, y, o.r || 0.08, { fill: o.color || C.text, stroke: null, ...o });
    }
    /** Arrow from (x1, y1) to (x2, y2); options head (length, units), headWidth, both. */
    arrow(x1, y1, x2, y2, o = {}) {
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 1e-9) return;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L, hl = Math.min(o.head || 0.2, L * 0.45), hw = o.headWidth || hl * 0.55;
      const color = o.color || C.text;
      const sx = o.both ? x1 + ux * hl * 0.8 : x1, sy = o.both ? y1 + uy * hl * 0.8 : y1;
      this.line(sx, sy, x2 - ux * hl * 0.8, y2 - uy * hl * 0.8, { ...o, color });
      const tip = (tx, ty, dx, dy) => this.polygon([[tx, ty], [tx - dx * hl - dy * hw, ty - dy * hl + dx * hw], [tx - dx * hl + dy * hw, ty - dy * hl - dx * hw]],
        { fill: color, stroke: null, alpha: o.alpha });
      tip(x2, y2, ux, uy);
      if (o.both) tip(x1, y1, -ux, -uy);
    }
    /** Dimension line with arrow heads on both ends and a label next to its middle. */
    dim(x1, y1, x2, y2, label, o = {}) {
      this.arrow(x1, y1, x2, y2, { both: true, head: 0.13, width: 2, color: o.color || C.greyB, ...o });
      if (label) {
        const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L, off = o.offset === undefined ? 0.22 : o.offset;
        this.text(label, (x1 + x2) / 2 + nx * off, (y1 + y2) / 2 + ny * off, { size: o.size || 0.26, color: o.labelColor || o.color || C.greyA, align: o.align || 'center' });
      }
    }
    /** Text in scene units: size ≈ font height; align left|center|right; baseline middle|alphabetic|top|bottom.
        Supports simple sub/superscripts: "x_j", "C_{B}", "10^{19}". Option bg: draw a backdrop for legibility. */
    text(str, x, y, o = {}) {
      this._withAlpha(o, c => {
        const s = String(str);
        const b = this._tbox(s, x, y, o), px = b.px;
        if (c.globalAlpha > 0.05 && !o.noOcc) {
          const cr = this._clipR[this._clipR.length - 1];
          const box = { kind: 'text', str: s, bg: !!o.bg, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, tag: o.tag };
          if (!cr || (box.x1 > cr.x0 && box.x0 < cr.x1 && box.y1 > cr.y0 && box.y0 < cr.y1)) this.occ.push(box);
        }
        c.save();
        c.textBaseline = o.baseline || 'middle';
        c.translate(this.X(x), this.Y(y));
        if (o.rotate) c.rotate(-o.rotate * Math.PI / 180);
        let xp = b.xp;
        if (o.bg) {
          const pad = px * 0.25, top = c.textBaseline === 'top' ? 0 : c.textBaseline === 'bottom' ? -px : -px * 0.6;
          c.fillStyle = col(o.bg === true ? C.bg : o.bg); c.globalAlpha *= o.bgAlpha === undefined ? 0.85 : o.bgAlpha;
          c.fillRect(xp - pad, top - pad * 0.6, b.total + 2 * pad, px * 1.2 + pad * 1.2);
          c.globalAlpha /= o.bgAlpha === undefined ? 0.85 : o.bgAlpha;
        }
        c.fillStyle = col(o.color || C.text);
        c.textAlign = 'left';
        b.runs.forEach((r, i) => { c.font = `${b.style}${r.mode ? px * 0.7 : px}px ${b.fam}`; c.fillText(r.t, xp, r.mode < 0 ? px * 0.28 : r.mode > 0 ? -px * 0.36 : 0); xp += b.widths[i]; });
        c.restore();
      });
    }
    /** Width of a text string in scene units. */
    measure(str, size = 0.3) { const c = this.ctx; c.save(); c.font = `${size * this.k}px ${this.font}`; const w = c.measureText(String(str)).width / this.k; c.restore(); return w; }
    /** Graph of y = f(x) directly in scene units. */
    fn(f, x0, x1, o = {}) {
      const n = o.samples || 200, pts = [];
      for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = f(x); if (isFinite(y)) pts.push([x, y]); }
      this.path(pts, { color: C.yellow, width: 4, ...o });
    }
    /** Diagonal hatching inside a rectangle. */
    hatch(x, y, w, h, o = {}) {
      const c = this.ctx, step = o.spacing || 0.12;
      c.save(); c.beginPath(); c.rect(this.X(x), this.Y(y + h), w * this.k, h * this.k); c.clip();
      for (let s = -h; s < w + h; s += step) this.line(x + s, y, x + s + h, y + h, { color: o.color || C.greyD, width: o.width || 1.5, alpha: o.alpha });
      c.restore();
    }
    /** Draw fn clipped to the rectangle between corners (x1, y1) and (x2, y2). */
    clip(x1, y1, x2, y2, fn) {
      const c = this.ctx;
      c.save(); c.beginPath();
      c.rect(this.X(Math.min(x1, x2)), this.Y(Math.max(y1, y2)), Math.abs(x2 - x1) * this.k, Math.abs(y2 - y1) * this.k);
      c.clip();
      this._clipR.push({ x0: this.X(Math.min(x1, x2)), x1: this.X(Math.max(x1, x2)), y0: this.Y(Math.max(y1, y2)), y1: this.Y(Math.min(y1, y2)) });
      try { fn(); } finally { c.restore(); this._clipR.pop(); }
    }
    /** Draw fn clipped to a polygon. */
    clipPoly(pts, fn) {
      const c = this.ctx;
      c.save(); c.beginPath(); c.moveTo(this.X(pts[0][0]), this.Y(pts[0][1]));
      for (let i = 1; i < pts.length; i++) c.lineTo(this.X(pts[i][0]), this.Y(pts[i][1]));
      c.closePath(); c.clip();
      const xs = pts.map(q => this.X(q[0])), ys = pts.map(q => this.Y(q[1]));
      this._clipR.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
      try { fn(); } finally { c.restore(); this._clipR.pop(); }
    }
    axes(o) { return new Axes(this, o); }
  }

  // ================================================================ Axes – plots with linear or log scales
  function niceStep(range, target = 5) {
    const raw = range / target, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
    return (f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * mag;
  }
  class Axes {
    constructor(p, o = {}) {
      Object.assign(this, {
        x: -6, y: -3, w: 6, h: 3, xr: [0, 1], yr: [0, 1], xlog: false, ylog: false, color: null,
        labelColor: null, size: 0.25, xticks: null, yticks: null, xfmt: null, yfmt: null,
        xlabel: '', ylabel: '', grid: false, ticks: true, ylabelOffset: null, nticks: 5,
      }, o);
      this.p = p;
    }
    _t(v, r, log) {
      if (log) { const lv = Math.log10(Math.max(v, r[0] * 1e-9)); return (lv - Math.log10(r[0])) / (Math.log10(r[1]) - Math.log10(r[0])); }
      return (v - r[0]) / (r[1] - r[0]);
    }
    X(v) { return this.x + this._t(v, this.xr, this.xlog) * this.w; }
    Y(v) { return this.y + this._t(v, this.yr, this.ylog) * this.h; }
    /** Inverse of X (scene x → data value). */
    xVal(sx) { const t = (sx - this.x) / this.w; return this.xlog ? 10 ** (Math.log10(this.xr[0]) + t * (Math.log10(this.xr[1]) - Math.log10(this.xr[0]))) : this.xr[0] + t * (this.xr[1] - this.xr[0]); }
    pt(xv, yv) { return [this.X(xv), this.Y(yv)]; }
    _ticks(r, log, given) {
      if (given) return given;
      if (log) {
        const out = [], e0 = Math.ceil(Math.log10(r[0]) - 1e-9), e1 = Math.floor(Math.log10(r[1]) + 1e-9);
        const every = Math.max(1, Math.ceil((e1 - e0 + 1) / 8));
        for (let e = e0; e <= e1; e += every) out.push(10 ** e);
        return out;
      }
      const st = niceStep(r[1] - r[0], this.nticks), out = [];
      for (let v = Math.ceil(r[0] / st - 1e-9) * st; v <= r[1] + st * 1e-6; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
      return out;
    }
    _label(v, log, f, ticks) {
      if (f) return f(v);
      if (log) { const e = Math.round(Math.log10(v)); return e === 0 ? '1' : e === 1 ? '10' : '10' + fmt.sup(e); }
      const st = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
      let d = 0;
      while (d < 4 && Math.abs(Math.round(st * 10 ** d) - st * 10 ** d) > 1e-6) d++;
      return fmt.num(v, d);
    }
    draw() {
      const p = this.p, xt = this._ticks(this.xr, this.xlog, this.xticks), yt = this._ticks(this.yr, this.ylog, this.yticks), s = this.size;
      const axc = this.color || C.axis, lc = this.labelColor || C.muted;
      if (this.grid) {
        xt.forEach(v => p.line(this.X(v), this.y, this.X(v), this.y + this.h, { color: C.grid, width: 1.5 }));
        yt.forEach(v => p.line(this.x, this.Y(v), this.x + this.w, this.Y(v), { color: C.grid, width: 1.5 }));
      }
      p.line(this.x, this.y, this.x + this.w, this.y, { color: axc, width: 2, cap: 'butt' });
      p.line(this.x, this.y, this.x, this.y + this.h, { color: axc, width: 2, cap: 'butt' });
      if (this.ticks) {
        xt.forEach(v => { p.line(this.X(v), this.y, this.X(v), this.y - 0.06, { color: axc, width: 1.5 });
          p.text(this._label(v, this.xlog, this.xfmt, xt), this.X(v), this.y - 0.1, { size: s, color: lc, align: 'center', baseline: 'top' }); });
        yt.forEach(v => { p.line(this.x - 0.06, this.Y(v), this.x, this.Y(v), { color: axc, width: 1.5 });
          p.text(this._label(v, this.ylog, this.yfmt, yt), this.x - 0.12, this.Y(v), { size: s, color: lc, align: 'right' }); });
      }
      if (this.xlabel) p.text(this.xlabel, this.x + this.w / 2, this.y - 0.22 - 1.4 * s, { size: s * 1.08, color: C.greyA, align: 'center', baseline: 'top' });
      if (this.ylabel) p.text(this.ylabel, this.x - (this.ylabelOffset || 0.95), this.y + this.h / 2, { size: s * 1.08, color: C.greyA, align: 'center', rotate: 90 });
      return this;
    }
    _inside(yv) { return isFinite(yv) && (!this.ylog || yv > 0); }
    /** Plot y = f(x) over the x range (or o.from..o.to), clipped to the y range. */
    plot(f, o = {}) {
      const n = o.samples || 300, a = o.from === undefined ? this.xr[0] : o.from, b = o.to === undefined ? this.xr[1] : o.to;
      if (!(b > a)) return;
      const xs = this.xlog ? M.logspace(a, b, n + 1) : M.linspace(a, b, n + 1);
      this.curve(xs, xs.map(x => f(x)), o);
    }
    curve(xs, ys, o = {}) {
      const lo = this.yr[0], hi = this.yr[1], tr = v => (this.ylog ? Math.log10(v) : v);
      const L = tr(lo), Hh = tr(hi), segs = [];
      let cur = [], prev = null;
      const push = (xv, yv) => cur.push([this.X(xv), this.Y(yv)]);
      const flush = () => { if (cur.length > 1) segs.push(cur); cur = []; };
      for (let i = 0; i < xs.length; i++) {
        const yv = ys[i], ok = this._inside(yv);
        if (!ok) { flush(); prev = null; continue; }
        const ty = tr(yv), inside = ty >= L - 1e-12 && ty <= Hh + 1e-12;
        if (prev) {
          const [px, pty] = prev, pin = pty >= L - 1e-12 && pty <= Hh + 1e-12;
          const cross = (b) => { const f = (b - pty) / (ty - pty); return [px + (xs[i] - px) * f, this.ylog ? 10 ** b : b]; };
          if (pin && !inside) { const c = cross(ty > Hh ? Hh : L); push(c[0], c[1]); flush(); }
          else if (!pin && inside) { const c = cross(pty > Hh ? Hh : L); push(c[0], c[1]); }
          else if (!pin && !inside && (pty - Hh) * (ty - Hh) < 0 && (pty - L) * (ty - L) < 0) {
            const a = cross(pty > Hh ? Hh : L), b = cross(ty > Hh ? Hh : L); push(a[0], a[1]); push(b[0], b[1]); flush();
          }
        }
        if (inside) push(xs[i], yv);
        prev = [xs[i], ty];
      }
      flush();
      segs.forEach(sg => this.p.path(sg, { color: C.yellow, width: 4, ...o }));
    }
    /** Shade the region between y = f(x) and the bottom of the axes from a to b. */
    area(f, a, b, o = {}) {
      if (!(b > a)) return;
      const n = o.samples || 150, xs = this.xlog ? M.logspace(a, b, n + 1) : M.linspace(a, b, n + 1), base = this.ylog ? this.yr[0] : Math.max(this.yr[0], 0);
      const val = x => { const y = f(x); return this._inside(y) ? M.clamp(y, base, this.yr[1]) : base; };
      const pts = xs.map(x => [this.X(x), this.Y(val(x))]);
      pts.push([this.X(b), this.Y(base)], [this.X(a), this.Y(base)]);
      this.p.polygon(pts, { fill: o.color || C.yellow, fillAlpha: o.fillAlpha === undefined ? 0.2 : o.fillAlpha, stroke: null, alpha: o.alpha });
    }
    hline(v, o = {}) { this.p.line(this.X(o.from === undefined ? this.xr[0] : o.from), this.Y(v), this.X(o.to === undefined ? this.xr[1] : o.to), this.Y(v), { color: C.muted, width: 2, dash: [0.08, 0.08], ...o }); }
    vline(v, o = {}) { this.p.line(this.X(v), this.Y(o.from === undefined ? this.yr[0] : o.from), this.X(v), this.Y(o.to === undefined ? this.yr[1] : o.to), { color: C.muted, width: 2, dash: [0.08, 0.08], ...o }); }
    dot(xv, yv, o = {}) { this.p.dot(this.X(xv), this.Y(yv), { r: 0.07, color: C.yellow, ...o }); }
    text(str, xv, yv, o = {}) { this.p.text(str, this.X(xv) + (o.dx || 0), this.Y(yv) + (o.dy || 0), { size: 0.26, ...o }); }
    /** Plot rectangle in scene units [x0, y0, x1, y1]. */
    get box() { return [this.x, this.y, this.x + this.w, this.y + this.h]; }
    inRange(xv, yv) {
      const tx = this._t(xv, this.xr, this.xlog), ty = this._t(yv, this.yr, this.ylog);
      return isFinite(tx) && isFinite(ty) && tx >= -1e-9 && tx <= 1 + 1e-9 && ty >= -1e-9 && ty <= 1 + 1e-9 && (!this.ylog || yv > 0);
    }
    /** Scene candidates around the data point (xv, yv): right-above, right-below, left-above, left-below, above, below. */
    around(xv, yv, d = 0.14) {
      const X = this.X(xv), Y = this.Y(yv);
      return [[X + d, Y + d, 'left', 'bottom'], [X + d, Y - d, 'left', 'top'], [X - d, Y + d, 'right', 'bottom'],
        [X - d, Y - d, 'right', 'top'], [X, Y + d * 1.3, 'center', 'bottom'], [X, Y - d * 1.3, 'center', 'top']];
    }
    /** Label placed at the first free candidate (scene candidates, see Painter.place), kept inside the plot. */
    place(str, cands, o = {}) { return this.p.place(str, cands, { size: 0.22, within: o.inside === false ? undefined : this.box, ...o }); }
    /** Label a curve y = f(x): tries positions along the curve (above and below it) and takes the first free one. */
    labelCurve(str, f, o = {}) {
      const a = o.from === undefined ? this.xr[0] : o.from, b = o.to === undefined ? this.xr[1] : o.to;
      const fr = o.at || [0.85, 0.7, 0.55, 0.4, 0.25, 0.12, 0.95];
      const d = o.gap || 0.13, cands = [];
      for (const u of fr) {
        const xv = this.xlog ? 10 ** (Math.log10(a) + u * (Math.log10(b) - Math.log10(a))) : a + u * (b - a), yv = f(xv);
        if (!this.inRange(xv, yv)) continue;
        const X = this.X(xv), Y = this.Y(yv);
        const order = o.below ? [[X, Y - d, 'center', 'top'], [X, Y + d, 'center', 'bottom']] : [[X, Y + d, 'center', 'bottom'], [X, Y - d, 'center', 'top']];
        cands.push(...order);
      }
      return cands.length ? this.place(str, cands.concat(o.extra || []), o) : null;
    }
    /** Legend box. entries: [{label, color, dash, width, alpha, marker}] (alpha < 0.01 → left out).
        o.corner 'tr' | 'tl' | 'br' | 'bl' (inside the plot) or o.at [x, y] scene position of the top-left corner. */
    legend(entries, o = {}) {
      const p = this.p, s = o.size || 0.2, lh = s * 1.45, sw = 0.42, pad = 0.12;
      const vis = entries.filter(e => e && (e.alpha === undefined || e.alpha > 0.01));
      if (!vis.length) return null;
      const wText = Math.max(...vis.map(e => p.measure(String(e.label).replace(/[_^]/g, ''), s)));
      const W = pad * 2 + sw + 0.12 + wText, H = pad * 2 + lh * vis.length - (lh - s * 1.1);
      const cr = o.corner || 'tr', m = o.margin === undefined ? 0.1 : o.margin;
      const x0 = o.at ? o.at[0] : cr[1] === 'l' ? this.x + m : this.x + this.w - m - W;
      const y1 = o.at ? o.at[1] : cr[0] === 't' ? this.y + this.h - m : this.y + m + H;
      p.rect(x0, y1 - H, W, H, { fill: C.bg, fillAlpha: 0.88, stroke: C.grid, width: 1.5, radius: 0.06, noOcc: true });
      p.reserve(x0, y1 - H, x0 + W, y1);
      vis.forEach((e, i) => {
        const yy = y1 - pad - s * 0.55 - i * lh, a = e.alpha === undefined ? 1 : e.alpha;
        p.alpha(a, () => {
          if (e.marker) p.dot(x0 + pad + sw / 2, yy, { r: 0.07, color: e.color });
          else p.line(x0 + pad, yy, x0 + pad + sw, yy, { color: e.color, width: e.width || 3, dash: e.dash, noOcc: true });
          p.text(e.label, x0 + pad + sw + 0.12, yy, { size: s, color: e.textColor || e.color, noOcc: true });
        });
      });
      return [x0, y1 - H, x0 + W, y1];
    }
  }

  // ================================================================ shared state helpers
  function initialValues(cfg) {
    const v = {};
    for (const [name, d] of Object.entries(cfg.params || {})) v[name] = d.value;
    return v;
  }
  function withDerived(cfg, P, t) {
    const v = { ...P, time: t || 0 };
    if (cfg.derived) Object.assign(v, cfg.derived(v) || {});
    return v;
  }
  function fillTemplate(tex, v, digits) {
    return tex.replace(/\{\{(\w+)(?::(\w+))?\}\}/g, (m0, name, spec) => {
      const val = v[name];
      if (typeof val !== 'number') return val === undefined ? '?' : String(val);
      if (spec && spec.startsWith('sci')) return fmt.texSci(val, spec.length > 3 ? +spec.slice(3) : 1);
      if (spec === 'auto') return fmt.texAuto(val);
      return fmt.texNum(val, spec === undefined ? (digits === undefined ? 2 : digits) : spec === 'int' ? 0 : +spec);
    });
  }
  /** Cumulative state of step idx. Only parameters a step sets are returned in P (others belong to the user). */
  function stepState(cfg, idx) {
    const P = {}, layers = {};
    for (const [n, vis] of Object.entries(cfg.layers || {})) layers[n] = vis ? 1 : 0;
    let caption = '';
    (cfg.steps || []).slice(0, idx + 1).forEach(st => {
      Object.assign(P, st.set || {});
      (st.show || []).forEach(n => { layers[n] = 1; });
      (st.hide || []).forEach(n => { layers[n] = 0; });
      if (st.caption !== undefined) caption = st.caption;
    });
    return { P, layers, caption };
  }
  const resolveText = (t, v) => (typeof t === 'function' ? t(v) : (t || ''));

  // ================================================================ headless still (Node snapshots, thumbnails)
  function renderStill(cfg, ctx, W, H, opts = {}) {
    const st = stepState(cfg, opts.step === undefined ? -1 : opts.step);
    const P = { ...initialValues(cfg), ...st.P, ...(opts.set || {}) };
    const v = withDerived(cfg, P, opts.t || 0);
    const p = new Painter(ctx, W, H, { font: opts.font });
    p.layers = st.layers;
    p.clear(cfg.background || C.bg);
    cfg.draw(p, v, { alpha: n => (st.layers[n] === undefined ? 1 : st.layers[n]), smooth: (k, x) => x });
    return v;
  }

  // ================================================================ browser part
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const STRINGS = {
    play: 'Play', pause: 'Pause', prev: 'Back', next: 'Next', steps: 'All steps', chars: 'Characteristics',
    full: 'Enlarge figure', exitFull: 'Close',
    tour: 'Guided tour', explore: 'Explore', speed: 'Speed',
    free: 'Explore mode – every slider is yours. Change parameters and watch what happens.',
    locked: 'set by the tour', lockedHint: 'Sliders marked “set by the tour” follow the current step. Switch to <b>Explore</b> to set them yourself.',
    source: 'Sources & model notes',
  };
  const SPEEDS = [0.5, 0.75, 1, 1.5, 2];
  const widgets = new Set();
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable – fine */ } },
  };

  // ---------------------------------------------------------------- theme
  function currentTheme() {
    if (!isBrowser) return 'dark';
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return 'light';                                            // default until the reader picks a theme
  }
  function applyPalette(theme) {
    Object.assign(C, theme === 'light' ? LIGHT : DARK);
    const src = theme === 'light' ? MAT_LIGHT : MAT_DARK;
    for (const k of Object.keys(src)) Object.assign(MAT[k], src[k]);
  }
  function setTheme(theme, persist = true) {
    if (!isBrowser) { applyPalette(theme); return; }
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) store.set('mfw-theme', theme);
    applyPalette(theme);
    widgets.forEach(w => w._themeChanged());
    document.querySelectorAll('[data-mfw-theme-toggle]').forEach(updateToggle);
  }
  /** Small line icons (no glyph or emoji icons). */
  const ICON = {
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    left: '<path d="M14.5 6l-6 6 6 6"/>', right: '<path d="M9.5 6l6 6-6 6"/>', down: '<path d="M6 9.5l6 6 6-6"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>', pause: '<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', exit: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
    lock: '<rect x="5.5" y="11" width="13" height="9"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  };
  const icon = n => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
  function updateToggle(btn) {
    const t = currentTheme();
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', btn.getAttribute('aria-label'));
    btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon') + `<span>${t === 'dark' ? 'Light' : 'Dark'}</span>`;
  }
  // ---------------------------------------------------------------- lesson navigation
  /** Modules of the course, in the order of a process flow, and the pages in each. Pages are numbered
      module.page (e.g. 4.2); the menu, the pager and the overview page are all built from this list. */
  const MODULES = [
    { id: 'base', title: 'Fundamentals', pages: [
      { slug: 'semiconductor', title: 'Carriers & the pn junction' },
      { slug: 'vacuum', title: 'Vacuum technology' }] },
    { id: 'substrate', title: 'Substrate', pages: [
      { slug: 'segregation', title: 'Dopant segregation' }] },
    { id: 'litho', title: 'Lithography', pages: [
      { slug: 'spincoating', title: 'Spin coating' },
      { slug: 'lithography', title: 'Lithography resolution' }] },
    { id: 'doping', title: 'Doping', pages: [
      { slug: 'diffusion', title: 'Diffusion & junction depth' },
      { slug: 'implant', title: 'Ion implantation' }] },
    { id: 'films', title: 'Thin films', pages: [
      { slug: 'oxidation', title: 'Thermal oxidation' },
      { slug: 'cvd', title: 'CVD growth rate' },
      { slug: 'pvd', title: 'Evaporation & sputtering' },
      { slug: 'stress', title: 'Film stress & wafer bow' }] },
    { id: 'etch', title: 'Etching', pages: [
      { slug: 'etching', title: 'Etching silicon' },
      { slug: 'dryetch', title: 'Dry etching' }] },
    { id: 'char', title: 'Characterization', pages: [
      { slug: 'fourpoint', title: 'Four-point probe' }] },
  ].filter(m => m.pages.length);
  const PAGES = [];
  MODULES.forEach((m, i) => { m.no = i + 1; m.pages.forEach((p, j) => { p.topic = m.title; p.module = m; p.no = `${m.no}.${j + 1}`; PAGES.push(p); }); });
  const escH = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  /** Lesson menu in the header, previous / next links under the widget and the page footer – inserted on every page. */
  function buildNav() {
    const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
    const header = document.querySelector('.site-header');
    if (!header || header.querySelector('.lesson-menu')) return;
    const m = location.pathname.replace(/\\/g, '/').match(/\/widgets\/([^/]+)\/(?:index\.html)?$/);
    const slug = m ? m[1] : null, root = m ? '../../' : '';
    const href = p => `${root}widgets/${p.slug}/index.html`;
    const idx = PAGES.findIndex(p => p.slug === slug);
    const cur = PAGES[idx];
    const menu = el('div', 'lesson-menu');
    const btn = el('button', 'lesson-btn', menu);
    btn.type = 'button'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-haspopup', 'true');
    btn.innerHTML = (cur ? `<span class="lesson-no">${cur.no}</span><span class="lesson-cur">${escH(cur.title)}</span>` : '<span class="lesson-cur">Lessons</span>')
      + `<span class="lesson-chev">${icon('down')}</span>`;
    btn.setAttribute('aria-label', cur ? `Lesson ${cur.no}: ${cur.title}. Switch lesson` : 'Switch lesson');
    const pop = el('div', 'lesson-pop', menu);
    pop.hidden = true;
    pop.innerHTML = MODULES.map(md => `<div class="lesson-group" role="presentation"><span>${md.no}</span>${escH(md.title)}</div>`
      + md.pages.map(p => `<a href="${href(p)}"${p === cur ? ' aria-current="page"' : ''}><span class="lesson-no">${p.no}</span>`
        + `<span class="lesson-txt">${escH(p.title)}</span></a>`).join('')).join('')
      + `<a class="lesson-all" href="${root}index.html">Contents – all lessons</a>`;
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', e => { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); if (!pop.hidden) (pop.querySelector('[aria-current]') || pop.querySelector('a')).focus(); });
    document.addEventListener('click', e => { if (!menu.contains(e.target)) close(); });
    menu.addEventListener('keydown', e => {
      const links = [...pop.querySelectorAll('a')], i = links.indexOf(document.activeElement);
      if (e.key === 'Escape') { close(); btn.focus(); }
      else if (!pop.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); links[(i + (e.key === 'ArrowDown' ? 1 : links.length - 1)) % links.length].focus(); }
    });
    const crumb = header.querySelector('.crumb');
    if (crumb) crumb.replaceWith(menu); else header.insertBefore(menu, header.querySelector('.header-spacer'));
    // previous / next under the widget
    const app = document.getElementById('app');
    if (cur && app) {
      const nav = el('nav', 'lesson-pager');
      nav.setAttribute('aria-label', 'Previous and next lesson');
      const prev = PAGES[idx - 1], next = PAGES[idx + 1];
      const link = (p, dir) => (p ? `<a class="pager-${dir}" href="${href(p)}"><small>${dir === 'prev' ? 'Previous' : 'Next'} · ${p.no} ${escH(p.topic)}</small><span>${escH(p.title)}</span></a>`
        : `<a class="pager-${dir} pager-hub" href="${root}index.html"><small>${dir === 'prev' ? 'Previous' : 'Next'}</small><span>Contents</span></a>`);
      nav.innerHTML = link(prev, 'prev') + link(next, 'next');
      app.insertAdjacentElement('afterend', nav);
    }
    // footer: work-in-progress note and the suggestion link (lesson pages get one, the overview has its own)
    let foot = document.querySelector('.footer');
    if (!foot) {
      foot = el('footer', 'footer', document.querySelector('main') || document.body);
      foot.innerHTML = '<p>Work in progress: lessons are still being added and checked. Every model cites its sources and states its limitations.</p>';
    }
    if (!foot.querySelector('.suggest-link')) {
      const sug = el('a', 'suggest-link', foot);
      sug.href = config.feedbackUrl; sug.target = '_blank'; sug.rel = 'noopener';
      sug.textContent = 'Suggest a topic or report an error';
    }
    // overview page: sort the entries into one section per module, numbered like the menu
    const count = document.querySelector('.contents-count');
    if (count) count.textContent = `${PAGES.length} lessons in ${MODULES.length} modules`;
    const grid = !cur && document.querySelector('.grid');
    if (grid) {
      const tiles = new Map([...grid.querySelectorAll('a.tile')].map(t => [(t.getAttribute('href') || '').replace(/\/index\.html$/, '').split('/').pop(), t]));
      const frag = document.createDocumentFragment();
      MODULES.forEach(md => {
        const sec = el('section', 'module', frag);
        sec.setAttribute('aria-labelledby', 'module-' + md.id);
        sec.innerHTML = `<h3 class="module-title" id="module-${md.id}"><span class="module-no">Module ${md.no}</span>${escH(md.title)}</h3>`;
        const g = el('div', 'grid', sec);
        md.pages.forEach(p => {
          const t = tiles.get(p.slug);
          if (!t) return;
          const no = t.querySelector('.tile-no');
          if (no) no.textContent = p.no;
          g.appendChild(t);
        });
      });
      grid.replaceWith(frag);
    }
  }

  if (isBrowser) {
    applyPalette(currentTheme());
    const wire = () => {
      document.querySelectorAll('[data-mfw-theme-toggle]').forEach(btn => {
        if (btn._mfwWired) return;
        btn._mfwWired = true;
        updateToggle(btn);
        btn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
      });
      buildNav();
      renderMath(document);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  }

  // ---------------------------------------------------------------- KaTeX
  let katexState = 'idle';
  const katexWaiters = [];
  function ensureKaTeX(cb) {
    if (!isBrowser) return;
    if (window.katex) { cb(); return; }
    katexWaiters.push(cb);
    if (katexState !== 'idle') return;
    katexState = 'loading';
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = config.katexBase + 'katex.min.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = config.katexBase + 'katex.min.js'; s.defer = true;
    s.onload = () => { katexState = 'ready'; katexWaiters.splice(0).forEach(f => f()); };
    s.onerror = () => { katexState = 'failed'; katexWaiters.splice(0).forEach(f => f()); };
    document.head.appendChild(s);
  }
  /** Render every element with class "tex" (inline) or "tex-display" (block) whose text is LaTeX. */
  function renderMath(rootEl) {
    if (!isBrowser) return;
    const els = rootEl.querySelectorAll('.tex:not([data-done]), .tex-display:not([data-done])');
    if (!els.length) return;
    ensureKaTeX(() => els.forEach(e => {
      const src = e.getAttribute('data-src') || e.textContent;
      e.setAttribute('data-src', src); e.setAttribute('data-done', '1');
      if (window.katex) {
        const display = e.classList.contains('tex-display');
        try { window.katex.render(src, e, { throwOnError: false, displayMode: display }); if (display) fitDisplay(e); return; } catch (err) { /* fall back */ }
      }
      e.textContent = texToText(src);
    }));
  }
  /** Split a LaTeX string at top-level (brace depth 0) occurrences of a separator. */
  function splitTop(src, sep) {
    const out = []; let depth = 0, start = 0;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '\\' && src.startsWith(sep, i) && depth === 0 && !/[a-zA-Z]/.test(src[i + sep.length] || '')) { out.push(src.slice(start, i)); start = i + sep.length; i += sep.length - 1; continue; }
      if (ch === '\\') { i++; continue; }
      if (ch === '{') depth++; else if (ch === '}') depth--;
    }
    out.push(src.slice(start));
    return out.map(s => s.trim()).filter(Boolean);
  }
  /** A display equation wider than its card: first break it into lines at its top-level \qquad gaps,
      then shrink it (down to 75 %); only what still does not fit keeps the horizontal scroll bar. */
  function fitDisplay(e) {
    const src = e.getAttribute('data-src');
    if (!src || !window.katex || !e.clientWidth) return;
    const render = s => window.katex.render(s, e, { throwOnError: false, displayMode: true });
    e.style.fontSize = '';
    render(src);
    const over = () => e.scrollWidth > e.clientWidth + 1;
    if (!over()) return;
    const parts = splitTop(src, '\\qquad');
    if (parts.length > 1) render(`\\begin{gathered}${parts.join('\\\\[0.35em]')}\\end{gathered}`);
    if (over()) e.style.fontSize = `${Math.max(0.75, e.clientWidth / e.scrollWidth) * 100}%`;
  }
  if (isBrowser) {
    let fitTimer = null;
    const refit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => document.querySelectorAll('.tex-display[data-done]').forEach(fitDisplay), 150); };
    window.addEventListener('resize', refit);
    document.addEventListener('toggle', refit, true);                 // equations inside <details> get a width when opened
    window.addEventListener('load', () => { refit(); if (document.fonts) document.fonts.ready.then(refit); });   // KaTeX fonts change the widths
  }

  const reduceMotion = () => isBrowser && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const words = s => String(s).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

  class Widget {
    constructor(target, cfg) {
      if (!isBrowser) throw new Error('MFW.widget needs a browser; use MFW.renderStill in Node.');
      this.cfg = cfg;
      this.S = { ...STRINGS, ...(cfg.strings || {}) };
      this.root = typeof target === 'string' ? document.querySelector(target) : target;
      if (!this.root) throw new Error('MFW.widget: element not found: ' + target);
      this.root.classList.add('mfw');
      this.aspect = cfg.aspect || 16 / 9;
      this.root.style.setProperty('--mfw-aspect', String(this.aspect));
      this.P = initialValues(cfg);
      this.tweens = new Map();
      this.layerA = {}; this.layerT = new Map();
      for (const [n, vis] of Object.entries(cfg.layers || {})) this.layerA[n] = vis ? 1 : 0;
      const steps = cfg.steps || [];
      this.hasTour = steps.length > 0;
      this._stepKeys = new Set(); this._stepLayers = new Set();
      steps.forEach(s => { Object.keys(s.set || {}).forEach(k => this._stepKeys.add(k));
        (s.show || []).concat(s.hide || []).forEach(n => this._stepLayers.add(n)); });
      this.mode = this.hasTour ? 'tour' : 'explore';
      const sp = parseFloat(store.get('mfw-speed'));
      this.speed = SPEEDS.includes(sp) ? sp : 1;
      this.step = -1; this.playing = false; this.playToken = 0; this.dirty = true; this.t0 = now();
      this._buildDOM();
      this._buildControls();
      this._buildTex();
      this.painter = new Painter(this.ctx, 10, 10);
      this._resize();
      if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this.stage); }
      else window.addEventListener('resize', () => this._resize());
      if ((cfg.tex || []).length && cfg.katex !== false) ensureKaTeX(() => this._renderTexAll());
      if (document.fonts) {
        if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { this.dirty = true; });
        if (document.fonts.ready) document.fonts.ready.then(() => { this.dirty = true; if (this.readoutEl) { this.readoutEl._mfwH = 0; this.readoutEl.style.minHeight = ''; } this._primeReadout(); });
      }
      this._keys();
      this._applyMode();
      this._primeReadout();
      if (this.hasTour && cfg.startStep !== false) this.goStep(cfg.startStep || 0, { instant: true });
      else this._setExplain(resolveText(cfg.freeText || cfg.intro || this.S.free, this.values));
      widgets.add(this);
      this._raf = requestAnimationFrame(t => this._frame(t));
    }

    // ------------------------------------------------------------ public API
    get values() { return withDerived(this.cfg, this.P, (now() - this.t0) / 1000); }
    set(vals) { for (const [k, v] of Object.entries(vals)) { this.tweens.delete(k); this.P[k] = v; } this._syncControls(true); this.dirty = true; return this; }
    /** Animate numeric parameters (non-numeric ones jump). Returns a Promise. Duration is in seconds at speed 1×. */
    animate(vals, duration = 1.5, easing = 'smooth') {
      const dur = reduceMotion() ? 0 : duration * 1000 / this.speed, fn = typeof easing === 'function' ? easing : (ease[easing] || ease.smooth);
      const promises = [];
      for (const [k, v] of Object.entries(vals)) {
        const old = this.tweens.get(k);
        if (old) { old.resolve(); this.tweens.delete(k); }
        if (typeof v !== 'number' || typeof this.P[k] !== 'number' || dur === 0 || this.P[k] === v) { this.P[k] = v; continue; }
        promises.push(new Promise(res => this.tweens.set(k, { from: this.P[k], to: v, t0: now(), dur, fn, resolve: res })));
      }
      this._syncControls(true); this.dirty = true;
      return Promise.all(promises);
    }
    show(name, duration = 0.5) { return this._fadeLayer(name, 1, duration); }
    hide(name, duration = 0.5) { return this._fadeLayer(name, 0, duration); }
    alpha(name) { return this.layerA[name] === undefined ? 1 : this.layerA[name]; }
    /** Set the caption under the stage. fade = true only when the step changes; live value updates replace the text in place. */
    caption(text, fade = false) {
      const c = this.captionEl;
      text = text || this.cfg.title || '';                             // no step caption: the figure's title
      if (this._cap === text) return;
      const first = this._cap === undefined;
      this._cap = text;
      if (this._capT) return;                                         // a cross-fade is running – it will show the latest text
      if (first || !fade || reduceMotion()) { c.innerHTML = richToHTML(text || ''); c.style.opacity = 1; return; }
      c.style.opacity = 0;
      this._capT = setTimeout(() => { this._capT = null; c.innerHTML = richToHTML(this._cap || ''); c.style.opacity = 1; }, 200);
    }
    /** Value that glides towards target over a few frames (for auto-zoom and axis ranges, so the picture does not jump).
        Call it from draw() as w.smooth('key', target, {log: true}). */
    smooth(key, target, o = {}) {
      const s = this._sm || (this._sm = new Map()), t = now();
      const cur = s.get(key);
      if (!cur || this._settle || reduceMotion() || !isFinite(target)) { s.set(key, { v: target, t }); return target; }
      const tau = (o.tau || 0.22) * 1000, a = Math.exp(-Math.min(t - cur.t, 100) / tau);
      const f = o.log ? x => Math.log(x) : x => x, g = o.log ? x => Math.exp(x) : x => x;
      let v = g(f(target) + (f(cur.v) - f(target)) * a);
      const tol = o.log ? 2e-3 : Math.abs(target) * 2e-3 + 1e-12;
      if (Math.abs(f(v) - f(target)) < tol) v = target; else this.dirty = true;
      s.set(key, { v, t });
      return v;
    }
    /** Go to step i of the tour. Only parameters that steps set are changed; everything else stays as the user left it. */
    goStep(i, opt = {}) {
      const steps = this.cfg.steps || [];
      if (i < 0 || i >= steps.length) return Promise.resolve();
      if (this.mode !== 'tour') { this.mode = 'tour'; this._applyMode(); }
      const st = steps[i], target = stepState(this.cfg, i);
      this.step = i; this._markStep(i);
      this._stepLayers.forEach(n => this._fadeLayer(n, target.layers[n] || 0, opt.instant ? 0 : 0.6));
      const vals = {};
      this._stepKeys.forEach(k => { vals[k] = k in target.P ? target.P[k] : this.cfg.params[k].value; });
      const pr = this.animate(vals, opt.instant ? 0 : (st.duration === undefined ? 2.5 : st.duration), st.ease || 'smooth');
      const v = this.values;
      this._capSrc = target.caption; this.caption(resolveText(target.caption, v), !opt.instant);
      this._resetHeights();
      this._textSrc = st.text; this._setExplain(resolveText(st.text, v));
      if (st.enter) st.enter(this);
      return pr;
    }
    next() { this.stop(); return this.goStep(Math.min(this.step + 1, (this.cfg.steps || []).length - 1)); }
    prev() { this.stop(); return this.goStep(Math.max(this.step - 1, 0)); }
    async play() {
      const steps = this.cfg.steps || [];
      if (!steps.length) return;
      const token = ++this.playToken;
      this.playing = true; this._playLabel();
      let i = this.step >= 0 && this.step < steps.length - 1 ? this.step + 1 : 0;
      if (this.step === steps.length - 1 || this.step < 0) { await this.goStep(0); i = 1; if (token !== this.playToken) return; await this._hold(steps[0], token); }
      for (; i < steps.length; i++) {
        if (token !== this.playToken) return;
        await this.goStep(i);
        if (token !== this.playToken) return;
        if (i < steps.length - 1) await this._hold(steps[i], token);
      }
      if (token === this.playToken) this.stop();
    }
    /** Pause long enough to read the step text (≈ 3 words per second at 1×), shown as a progress bar. */
    _hold(st, token) {
      const text = resolveText(st.text, this.values);
      // reading time does not depend on prefers-reduced-motion (that setting only removes animation)
      const sec = (st.hold === undefined ? Math.max(4, 2 + words(text) / 3) : st.hold) / this.speed;
      const bar = this.holdBar;
      bar.style.transition = 'none'; bar.style.width = '0%';
      void bar.offsetWidth;
      bar.style.transition = `width ${sec}s linear`; bar.style.width = '100%';                  // progress bar is information, not decoration
      return new Promise(res => {
        const t = setTimeout(res, sec * 1000);
        this._holdCancel = () => { clearTimeout(t); res(); };
      }).then(() => { if (token === this.playToken) { bar.style.transition = 'none'; bar.style.width = '0%'; } });
    }
    stop() {
      this.playToken++; this.playing = false;
      if (this._holdCancel) { this._holdCancel(); this._holdCancel = null; }
      if (this.holdBar) { this.holdBar.style.transition = 'none'; this.holdBar.style.width = '0%'; }
      this._playLabel();
    }
    setMode(mode) {
      if (mode === this.mode || !this.hasTour) return;
      this.stop();
      this.mode = mode;
      this._applyMode();
      if (mode === 'tour') this.goStep(this.step >= 0 ? this.step : 0);
      else {
        const ex = this.cfg.explore || {};
        (ex.show || []).forEach(n => this._fadeLayer(n, 1, 0.5));
        (ex.hide || []).forEach(n => this._fadeLayer(n, 0, 0.5));
        this.caption('', true); this._capSrc = null; this._textSrc = null;
        this._resetHeights();
        this._setExplain(resolveText(this.cfg.freeText || this.S.free, this.values));
      }
    }
    destroy() { cancelAnimationFrame(this._raf); if (this._ro) this._ro.disconnect(); this.stop(); widgets.delete(this); this.root.innerHTML = ''; this.root.classList.remove('mfw'); }

    // ------------------------------------------------------------ DOM
    _buildDOM() {
      const r = this.root, cfg = this.cfg;
      r.innerHTML = '';
      this.stageWrap = el('div', 'mfw-stagewrap', r);
      this.stage = el('div', 'mfw-stage', this.stageWrap);
      this.canvas = el('canvas', null, this.stage);
      this.canvas.setAttribute('role', 'img');
      this.canvas.setAttribute('aria-label', (typeof cfg.alt === 'string' && cfg.alt) || cfg.title || 'interactive illustration');
      this.ctx = this.canvas.getContext('2d');
      // figure caption "Fig. 3.2 …" below the plate, with the full-screen switch
      const bar = el('div', 'mfw-figbar', this.stageWrap);
      const cap = el('div', 'mfw-caption', bar);
      const path = location.pathname.replace(/\\/g, '/');
      const page = PAGES.find(p => path.includes(`/widgets/${p.slug}/`));
      if (page) el('span', 'mfw-figno', cap, `Fig. ${page.no}`);
      this.captionEl = el('span', 'mfw-captext', cap);
      cap.setAttribute('aria-live', 'polite');
      if (this.hasTour) {
        for (const d of ['prev', 'next']) {
          const b = el('button', 'mfw-nav mfw-fsnav', bar);
          b.type = 'button'; b.innerHTML = d === 'prev' ? icon('left') + this.S.prev : this.S.next + icon('right');
          b.addEventListener('click', () => (d === 'prev' ? this.prev() : this.next()));
        }
      }
      this.fullBtn = el('button', 'mfw-full', bar);
      this.fullBtn.type = 'button';
      this.fullBtn.addEventListener('click', () => this.fullscreen(!this.isFull));
      this._fullLabel();
      this.panel = el('div', 'mfw-panel', r);
      if (cfg.panel === false) this.panel.style.display = 'none';
    }
    _buildControls() {
      const cfg = this.cfg, S = this.S;
      this.controls = {};
      if (this.hasTour) {
        const tabs = el('div', 'mfw-tabs', this.panel);
        tabs.setAttribute('role', 'tablist');
        this.tabBtns = {};
        for (const m of ['tour', 'explore']) {
          const b = el('button', 'mfw-tab', tabs, m === 'tour' ? S.tour : S.explore);
          b.type = 'button'; b.setAttribute('role', 'tab');
          b.addEventListener('click', () => this.setMode(m));
          this.tabBtns[m] = b;
        }
        this.tourBox = el('div', 'mfw-tour', this.panel);
        const stepper = el('div', 'mfw-stepper', this.tourBox);
        this.prevBtn = el('button', 'mfw-nav', stepper); this.prevBtn.type = 'button';
        this.prevBtn.innerHTML = icon('left') + S.prev; this.prevBtn.addEventListener('click', () => this.prev());
        const count = el('div', 'mfw-count', stepper);
        this.countN = el('span', 'mfw-count-n', count); this.countT = el('span', 'mfw-count-t', count);
        this.nextBtn = el('button', 'mfw-nav', stepper); this.nextBtn.type = 'button';
        this.nextBtn.innerHTML = S.next + icon('right'); this.nextBtn.addEventListener('click', () => this.next());
        const row = el('div', 'mfw-transport', this.tourBox);
        this.playBtn = el('button', 'mfw-play', row);
        this.playBtn.type = 'button';
        this.playBtn.addEventListener('click', () => (this.playing ? this.stop() : this.play()));
        this._playLabel();
        const spl = el('label', 'mfw-speed', row);
        el('span', null, spl, S.speed);
        const sel = el('select', null, spl);
        SPEEDS.forEach(s => { const o = el('option', null, sel, s + '×'); o.value = String(s); });
        sel.value = String(this.speed);
        sel.addEventListener('change', () => { this.speed = parseFloat(sel.value); store.set('mfw-speed', sel.value); });
        const track = el('div', 'mfw-holdtrack', this.tourBox);
        this.holdBar = el('div', 'mfw-holdbar', track);
      }
      this.explainEl = el('div', 'mfw-explain', this.panel);
      this.explainEl.setAttribute('aria-live', 'polite');
      if (this.hasTour) {
        this.stepsBox = el('details', 'mfw-stepsbox', this.panel);
        el('summary', null, this.stepsBox, `${S.steps} (${cfg.steps.length})`);
        const list = el('ol', 'mfw-steps', this.stepsBox);
        list.setAttribute('aria-label', S.steps);
        this.chips = cfg.steps.map((st, i) => {
          const li = el('li', null, list);
          const b = el('button', 'mfw-chip', li);
          b.type = 'button'; b.setAttribute('aria-pressed', 'false');
          el('span', 'mfw-chip-n', b, String(i + 1));
          el('span', 'mfw-chip-t', b, st.name || `Step ${i + 1}`);
          b.addEventListener('click', () => { this.stop(); this.goStep(i); });
          return b;
        });
      }
      if (cfg.readout) {
        const chars = el('section', 'mfw-chars', this.panel);
        el('h3', 'mfw-chars-h', chars).innerHTML = `${S.chars}<span>value</span>`;
        this.readoutEl = el('div', 'mfw-readout', chars);
      }
      const params = Object.entries(cfg.params || {}).filter(([, d]) => !d.hidden);
      if (params.length) {
        this.paramBox = el('div', 'mfw-params', this.panel);
        // parameters with d.group go into a collapsible <details> section (opened with d.groupOpen)
        const groups = {};
        const box = d => {
          if (!d.group) return this.paramBox;
          if (!groups[d.group]) {
            const det = el('details', 'mfw-group', this.paramBox);
            el('summary', null, det).innerHTML = richToHTML(d.group);
            if (d.groupOpen) det.open = true;
            groups[d.group] = el('div', 'mfw-params mfw-group-body', det);
          }
          return groups[d.group];
        };
        for (const [name, d] of params) {
          let lab, inp, val = null, tag = null;
          if (typeof d.value === 'boolean') {
            lab = el('label', 'mfw-check', box(d));
            inp = el('input', null, lab); inp.type = 'checkbox'; inp.checked = d.value;
            el('span', null, lab).innerHTML = richToHTML(d.label || name);
            inp.addEventListener('change', () => this._userInput(name, inp.checked));
          } else if (d.options) {
            lab = el('label', 'mfw-param', box(d));
            const head = el('span', 'mfw-param-head', lab);
            el('span', null, head).innerHTML = richToHTML(d.label || name);
            tag = el('span', 'mfw-lock', head); tag.innerHTML = icon('lock') + S.locked;
            inp = el('select', null, lab);
            for (const [v, text] of Object.entries(d.options)) { const o = el('option', null, inp, text); o.value = v; }
            inp.value = d.value;
            inp.addEventListener('change', () => this._userInput(name, inp.value));
          } else {
            lab = el('label', 'mfw-param', box(d));
            const head = el('span', 'mfw-param-head', lab);
            const nameEl = el('span', null, head);
            nameEl.innerHTML = richToHTML(d.label || name);
            val = el('span', 'mfw-val', head);
            tag = el('span', 'mfw-lock', head); tag.innerHTML = icon('lock') + S.locked;
            inp = el('input', null, lab);
            const toIn = x => (d.log ? Math.log10(x) : x);
            Object.assign(inp, d.log
              ? { type: 'range', min: Math.log10(d.min), max: Math.log10(d.max), step: d.step || (Math.log10(d.max) - Math.log10(d.min)) / 300, value: toIn(d.value) }
              : { type: 'range', min: d.min, max: d.max, step: d.step || (d.max - d.min) / 200, value: d.value });
            inp.setAttribute('aria-label', String(d.label || name).replace(/[_^{}]/g, ''));
            inp.addEventListener('input', () => { const x = parseFloat(inp.value); this._userInput(name, d.log ? 10 ** x : x); });
          }
          if (d.help) { lab.title = d.help; }
          this.controls[name] = { inp, val, d, lab, tag };
        }
        if (this.hasTour && [...this._stepKeys].some(k => this.controls[k])) {
          this.lockHint = el('div', 'mfw-lockhint', this.panel);
          this.lockHint.innerHTML = S.lockedHint;
          this.panel.insertBefore(this.lockHint, this.paramBox);
        }
      }
      if (!this.readoutEl) this.readoutEl = el('div', 'mfw-readout', this.panel);
      if (cfg.source) {
        const det = el('details', 'mfw-source', this.panel);
        el('summary', null, det, S.source);
        el('div', null, det).innerHTML = cfg.source;
      }
    }
    _applyMode() {
      const tour = this.mode === 'tour';
      this.root.setAttribute('data-mode', this.mode);
      if (this.tabBtns) for (const [m, b] of Object.entries(this.tabBtns)) b.setAttribute('aria-selected', String(m === this.mode));
      if (this.tourBox) this.tourBox.hidden = !tour;
      if (this.stepsBox) this.stepsBox.hidden = !tour;
      if (this.lockHint) this.lockHint.hidden = !tour;
      for (const [name, c] of Object.entries(this.controls)) {
        const locked = tour && this._stepKeys.has(name);
        c.inp.disabled = locked;
        c.lab.classList.toggle('is-locked', locked);
      }
    }
    _buildTex() {
      this.texEls = (this.cfg.tex || []).map(t => {
        const d = el('div', 'mfw-tex', this.stage);
        const fw = config.frameWidth, fh = fw / this.aspect;
        d.style.left = ((t.at[0] + fw / 2) / fw * 100) + '%';
        d.style.top = ((fh / 2 - t.at[1]) / fh * 100) + '%';
        const al = t.align || 'center';
        d.style.transform = `translate(${al === 'left' ? '0' : al === 'right' ? '-100%' : '-50%'}, -50%)`;
        d.style.fontSize = `calc(var(--u) * ${t.size || 0.4})`;
        d.style.color = col(t.color || 'text');
        return { t, d, last: null };
      });
    }
    _renderTex(item, force) {
      const v = this._v, src = typeof item.t.tex === 'function' ? item.t.tex(v) : item.t.tex, s = fillTemplate(src, v, item.t.digits);
      if (!force && s === item.last) return;
      item.last = s;
      if (window.katex && katexState !== 'failed') {
        try { window.katex.render(s, item.d, { throwOnError: false, displayMode: false }); return; } catch (e) { /* fall through */ }
      }
      item.d.textContent = texToText(s);
    }
    _renderTexAll() { this._texForce = true; this.dirty = true; }
    _themeChanged() {
      this.texEls.forEach(it => { it.d.style.color = col(it.t.color || 'text'); });
      this.dirty = true;
    }
    _setExplain(html) { if (this._explain === html) return; this._explain = html; this.explainEl.innerHTML = richToHTML(html); this._holdHeight(this.explainEl); }
    /** Grow-only min-height: live numbers in a text may change its line count, but must not push the controls around. */
    _holdHeight(e) {
      const h = e.offsetHeight;
      if (h > (e._mfwH || 0)) { e._mfwH = h; e.style.minHeight = h + 'px'; }
    }
    _resetHeights() {
      for (const e of [this.explainEl, this.readoutEl]) if (e) { e._mfwH = 0; e.style.minHeight = ''; }
      this._primeReadout();
    }
    /** The characteristics table sits above the sliders, so its height must not change while one is dragged: reserve
        the tallest height it takes over the slider extremes, every option and a fixed random sample of states. */
    _primeReadout() {
      const e = this.readoutEl, cfg = this.cfg;
      if (!cfg.readout || !e || !e.offsetParent) return;
      const P0 = this.P, defs = Object.entries(cfg.params || {}).filter(([, d]) => !d.hidden);
      const pick = (d, r) => (d.options ? Object.keys(d.options)[Math.floor(r * Object.keys(d.options).length)]
        : typeof d.value === 'boolean' ? r < 0.5 : d.log ? 10 ** (Math.log10(d.min) + r * (Math.log10(d.max) - Math.log10(d.min))) : d.min + r * (d.max - d.min));
      const states = [];
      for (const [k, d] of defs) {
        if (d.options) Object.keys(d.options).forEach(o => states.push({ ...P0, [k]: o }));
        else if (typeof d.value === 'number' && d.min !== undefined) states.push({ ...P0, [k]: d.min }, { ...P0, [k]: d.max });
      }
      let seed = 12345;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < 24; i++) {
        const P = { ...P0 };
        for (const [k, d] of defs) if (d.options || typeof d.value === 'boolean' || (typeof d.value === 'number' && d.min !== undefined)) P[k] = pick(d, rnd());
        states.push(P);
      }
      const keep = e.innerHTML;
      let h = 0;
      for (const P of states) {
        try { e.innerHTML = cfg.readout(withDerived(cfg, P, 0), this); h = Math.max(h, e.offsetHeight); } catch (err) { /* a state the model rejects */ }
      }
      e.innerHTML = keep;
      h = Math.max(h, e.offsetHeight);
      if (h > (e._mfwH || 0)) { e._mfwH = h; e.style.minHeight = h + 'px'; }
    }
    _markStep(i) {
      (this.chips || []).forEach((b, j) => { b.setAttribute('aria-pressed', String(j === i)); b.classList.toggle('is-done', j < i); });
      const steps = this.cfg.steps || [];
      if (!this.countN || !steps[i]) return;
      this.countN.textContent = `Step ${i + 1} / ${steps.length}`;
      this.countT.textContent = steps[i].name || '';
      this.prevBtn.disabled = i <= 0; this.nextBtn.disabled = i >= steps.length - 1;
      this.root.querySelectorAll('.mfw-fsnav').forEach((b, k) => { b.disabled = k === 0 ? i <= 0 : i >= steps.length - 1; });
    }
    _playLabel() {
      if (!this.playBtn) return;
      this.playBtn.innerHTML = icon(this.playing ? 'pause' : 'play') + (this.playing ? this.S.pause : this.S.play);
      this.playBtn.setAttribute('aria-pressed', String(!!this.playing));
    }
    _fullLabel() {
      const t = this.isFull ? this.S.exitFull : this.S.full;
      this.fullBtn.innerHTML = icon(this.isFull ? 'exit' : 'full') + `<span>${t}</span>`;
      this.fullBtn.setAttribute('aria-label', t); this.fullBtn.title = t;
    }
    /** Figure alone on the whole screen (projector, phone in landscape). Uses the Fullscreen API where it exists,
        otherwise (iPhone) a fixed overlay; Escape or the button leaves it. */
    fullscreen(on) {
      if (on === !!this.isFull) return;
      this.isFull = on;
      this.stageWrap.classList.toggle('is-full', on);
      document.body.classList.toggle('mfw-noscroll', on);
      const d = document, fsOk = d.fullscreenEnabled && this.stageWrap.requestFullscreen;
      if (on) {
        if (fsOk) this.stageWrap.requestFullscreen().catch(() => {});
        this._fsEsc = e => { if (e.key === 'Escape') this.fullscreen(false); };
        d.addEventListener('keydown', this._fsEsc);
        this._fsChange = () => { if (!d.fullscreenElement && this.isFull) this.fullscreen(false); };
        d.addEventListener('fullscreenchange', this._fsChange);
      } else {
        if (d.fullscreenElement === this.stageWrap) d.exitFullscreen().catch(() => {});
        d.removeEventListener('keydown', this._fsEsc); d.removeEventListener('fullscreenchange', this._fsChange);
      }
      this._fullLabel();
      this.fullBtn.focus();
    }
    _userInput(name, value) {
      if (this.mode === 'tour' && this._stepKeys.has(name)) return;            // locked (should not happen: input disabled)
      if (this.playing) this.stop();
      this._editing = name;
      if (typeof value === 'number' && this.cfg.glide) this.animate({ [name]: value }, this.cfg.glide);
      else { this.tweens.delete(name); this.P[name] = value; this.dirty = true; this._syncControls(false); }
      this._editing = null;
      if (this.cfg.onInput) this.cfg.onInput(this, name, value);
    }
    _syncControls(force) {
      for (const [name, c] of Object.entries(this.controls || {})) {
        const v = this.P[name];
        if (name === this._editing && !c.d.options && typeof c.d.value !== 'boolean') {   // the user is dragging it: only the value label
          const txt = (c.d.format ? c.d.format(v) : fmt.num(v, c.d.digits === undefined ? 2 : c.d.digits)) + (c.d.unit ? ' ' + c.d.unit : '');
          if (c.val.textContent !== txt) c.val.textContent = txt;
          continue;
        }
        if (name === this._editing) continue;
        if (c.d.options) { if (force || document.activeElement !== c.inp) c.inp.value = v; }
        else if (typeof c.d.value === 'boolean') c.inp.checked = !!v;
        else {
          if (document.activeElement !== c.inp && (force || this.tweens.has(name))) c.inp.value = c.d.log ? Math.log10(v) : v;
          const txt = (c.d.format ? c.d.format(v) : fmt.num(v, c.d.digits === undefined ? 2 : c.d.digits)) + (c.d.unit ? ' ' + c.d.unit : '');
          if (c.val.textContent !== txt) c.val.textContent = txt;
        }
      }
    }
    _fadeLayer(name, target, duration) {
      const dur = reduceMotion() ? 0 : duration * 1000 / this.speed;
      if (dur === 0 || this.alpha(name) === target) { this.layerA[name] = target; this.layerT.delete(name); this.dirty = true; return Promise.resolve(); }
      return new Promise(res => { this.layerT.set(name, { from: this.alpha(name), to: target, t0: now(), dur, res }); this.dirty = true; });
    }
    _keys() {
      this.root.addEventListener('keydown', e => {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'button' && e.key === ' ') return;
        if (!this.hasTour || this.mode !== 'tour') return;
        if (e.key === ' ') { e.preventDefault(); this.playing ? this.stop() : this.play(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      });
    }
    _resize() {
      const r = this.stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      if (r.width < 2) return;
      this.W = r.width; this.H = r.width / this.aspect;
      this.canvas.width = Math.round(this.W * dpr); this.canvas.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.painter.resize(this.W, this.H);
      this.stage.style.setProperty('--u', (this.W / config.frameWidth) + 'px');
      if (this._lastW !== undefined && Math.abs(this._lastW - this.W) > 1) this._resetHeights();
      this._lastW = this.W;
      this.dirty = true;
    }
    /** Finish all running animations and draw synchronously (tests, overlap audit). */
    renderNow() {
      for (const [k, tw] of this.tweens) { this.P[k] = tw.to; tw.resolve(); }
      this.tweens.clear();
      for (const [n, tw] of this.layerT) { this.layerA[n] = tw.to; tw.res(); }
      this.layerT.clear();
      this._settle = true; this.dirty = true;
      try { this._draw(); } finally { this._settle = false; }
      return this._v;
    }
    _frame() {
      const t = now();
      for (const [k, tw] of this.tweens) {
        const u = tw.dur ? Math.min(1, (t - tw.t0) / tw.dur) : 1;
        this.P[k] = tw.from + (tw.to - tw.from) * tw.fn(u);
        if (u >= 1) { this.P[k] = tw.to; this.tweens.delete(k); tw.resolve(); }
        this.dirty = true;
      }
      for (const [n, tw] of this.layerT) {
        const u = Math.min(1, (t - tw.t0) / tw.dur);
        this.layerA[n] = tw.from + (tw.to - tw.from) * ease.smooth(u);
        if (u >= 1) { this.layerA[n] = tw.to; this.layerT.delete(n); tw.res(); }
        this.dirty = true;
      }
      if (this.dirty || this.cfg.loop) this._draw();
      this._raf = requestAnimationFrame(x => this._frame(x));
    }
    _draw() {
      {
        this.dirty = false;
        const v = this.values;
        this._v = v;
        const p = this.painter;
        p.layers = this.layerA;
        try {
          p.clear(this.cfg.background || C.bg);
          this.cfg.draw(p, v, this);
          if (this.errEl) { this.errEl.remove(); this.errEl = null; }
        } catch (e) {
          if (!this.errEl) this.errEl = el('div', 'mfw-error', this.stage);
          this.errEl.textContent = 'Error in draw(): ' + e.message;
          console.error(e);
        }
        this.texEls.forEach(it => {
          const vis = (it.t.layer ? this.alpha(it.t.layer) : 1) * (it.t.when && !it.t.when(v) ? 0 : 1);
          if (vis > 0.01 || this._texForce) this._renderTex(it, this._texForce);
          it.d.style.opacity = vis;
        });
        this._texForce = false;
        this._syncControls(false);
        for (const c of Object.values(this.controls)) if (c.d.when) c.lab.hidden = !c.d.when(v);
        if (typeof this._textSrc === 'function') this._setExplain(this._textSrc(v));
        if (typeof this._capSrc === 'function') this.caption(this._capSrc(v), false);
        if (this.mode === 'explore' && typeof this.cfg.freeText === 'function') this._setExplain(this.cfg.freeText(v));
        if (this.cfg.readout) {
          const html = this.cfg.readout(v, this);
          if (html !== this._lastReadout) { this.readoutEl.innerHTML = html; this._lastReadout = html; this._holdHeight(this.readoutEl); }
        }
        if (this.cfg.alt && typeof this.cfg.alt === 'function') this.canvas.setAttribute('aria-label', this.cfg.alt(v));
      }
    }
  }

  function widget(target, cfg) { return new Widget(target, cfg); }

  return { VERSION, config, C, MAT, DARK, LIGHT, M, K, ease, fmt, mix, rgba, col, texToText, richToHTML, renderMath,
    Painter, Axes, Widget, widget, renderStill, stepState, fillTemplate, setTheme, currentTheme, instances: widgets, PAGES };
}));
