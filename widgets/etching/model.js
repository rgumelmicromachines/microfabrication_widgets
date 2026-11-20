/* Physics model – etching a window into (100) silicon: anisotropic wet (KOH, TMAH), isotropic wet, Bosch DRIE.
   Geometric etch-front model, usable in the browser and in Node tests. Units: µm, minutes, °C. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_ETCH = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const kB = 8.617333e-5;
  const ANGLE = Math.atan(Math.SQRT2);                         // 54.7356°, angle between {100} and {111}
  const WAFER = 525;                                           // µm, standard 100 mm (4-inch) wafer (SEMI M1: 525 ± 25 µm)

  /* Rates at the reference temperature Tref (µm/min for Si, nm/min for masks).
     KOH 30 wt %, 80 °C: Si(100) 1.1 µm/min, thermal SiO2 7.7 nm/min, LPCVD Si3N4 not measurable
       (K. R. Williams, K. Gupta, M. Wasilik, J. MEMS 12 (2003) 761, Tables II–IV); Ea Si(100) 0.59 eV, SiO2 0.84 eV
       (H. Seidel et al., J. Electrochem. Soc. 137 (1990) 3612, as quoted by Williams & Muller, J. MEMS 5 (1996) 256).
       (100):(111) ≈ 100:1 at 20 °C falling to 30:1 at 100 °C (Seidel) → ~40 used at 80 °C.
     TMAH 25 wt %, 80 °C: Si(100) ≈ 0.55 µm/min, Ea ≈ 0.6 eV (0.5–0.7), (100):(111) 10–35 → 20,
       SiO2 ~4 orders of magnitude slower than Si, Ea ≈ 0.9 eV (O. Tabata, Sensors and Materials 13 (2001) 271).
     Isotropic wet (126 HNO3 : 60 H2O : 5 NH4F, room temperature): Si 0.15 µm/min, thermal SiO2 8.7 nm/min,
       photoresist usable (Williams et al. 2003). HNA mixtures with more HF can be orders of magnitude faster.
     Bosch DRIE (STS ASE): Si 1.5–2.4 µm/min, resist ≈ 33 nm/min, thermal SiO2 ≈ 24 nm/min (Williams et al. 2003);
       modern tools are faster – the rate is a slider, mask rates scale with it (constant selectivity). */
  const ETCH = {
    koh: { name: 'KOH 30 wt %', kind: 'aniso', Tref: 80, R100: 1.1, Ea: 0.59, ratio111: 40,
      mask: { si3n4: { r: 0, Ea: 0 }, sio2: { r: 7.7, Ea: 0.84 }, resist: null } },
    tmah: { name: 'TMAH 25 wt %', kind: 'aniso', Tref: 80, R100: 0.55, Ea: 0.6, ratio111: 20,
      mask: { si3n4: { r: 0, Ea: 0 }, sio2: { r: 0.06, Ea: 0.9 }, resist: null } },
    iso: { name: 'Isotropic wet (HNA type)', kind: 'iso', Tref: 25, R100: 0.15, Ea: 0,
      mask: { si3n4: undefined, sio2: { r: 8.7, Ea: 0 }, resist: { r: 0, Ea: 0 } } },
    drie: { name: 'Bosch DRIE', kind: 'drie', Tref: 20, R100: 2.0, Ea: 0,
      mask: { si3n4: undefined, sio2: { r: 24, Ea: 0, scale: true }, resist: { r: 33, Ea: 0, scale: true } } },
  };
  const arr = (r, Ea, T, Tref) => r * Math.exp(-Ea / kB * (1 / (T + 273.15) - 1 / (Tref + 273.15)));

  /** Si etch rate (µm/min). For DRIE the rate is given directly (rate argument). */
  function siRate(e, T, rate) { const E = ETCH[e]; return E.kind === 'drie' ? rate : E.kind === 'iso' ? E.R100 : arr(E.R100, E.Ea, T, E.Tref); }
  /** Mask etch rate (nm/min): null = mask is destroyed by the etchant, undefined = no reliable data. */
  function maskRate(e, m, T, rate) {
    const E = ETCH[e], d = E.mask[m];
    if (d === null || d === undefined) return d;
    if (d.scale) return d.r * rate / E.R100;
    return E.kind === 'aniso' ? arr(d.r, d.Ea, T, E.Tref) : d.r;
  }

  /**
   * Etch state after t minutes through a mask opening of width W (µm).
   * Returns depth, undercut per side, bottom width, the sidewall polygon (x, depth) for one side, and flags.
   */
  function etchState(o) {
    const E = ETCH[o.etch], R = siRate(o.etch, o.T, o.rate);
    const mr = maskRate(o.etch, o.mask, o.T, o.rate);
    const tFail = mr === null ? 0 : mr === undefined ? Infinity : mr > 0 ? o.tm / mr : Infinity;   // tm in nm
    const t = Math.min(o.t, tFail);                       // geometry frozen when the mask is gone
    const half = o.W / 2;
    const s = { R, mr, tFail, tEff: t, kind: E.kind, maskLeft: mr > 0 ? Math.max(0, o.tm - mr * o.t) : (mr === null ? 0 : o.tm) };
    if (E.kind === 'aniso') {
      const R111 = R / E.ratio111;
      const u = R111 * t / Math.sin(ANGLE);               // horizontal recession of the {111} sidewall at the mask edge
      const top = half + u;                              // half-width of the groove at the surface
      const dmax = top * Math.tan(ANGLE);                // V-groove closes here (self-termination)
      const depth = Math.min(R * t, dmax, WAFER);
      const bottom = Math.max(0, top - depth / Math.tan(ANGLE));
      // the walls close when R·t = (W/2 + R111·t/sinθ)·tanθ  →  t* = (W/2)·tanθ / (R − R111·tanθ/sinθ)
      const tClose = half * Math.tan(ANGLE) / (R - R111 * Math.tan(ANGLE) / Math.sin(ANGLE));
      Object.assign(s, { depth, undercut: u, top, bottom, dmax, closed: R * t >= dmax && dmax < WAFER, tClose, dClose: R * tClose, angle: ANGLE * 180 / Math.PI,
        through: R * t >= WAFER && dmax >= WAFER, tThrough: dmax >= WAFER ? WAFER / R : Infinity });
      s.profile = [[-top, 0], [-bottom, -depth], [bottom, -depth], [top, 0]];
    } else if (E.kind === 'iso') {
      const r = Math.min(R * t, WAFER);                   // every point of the opening etches equally in all directions
      Object.assign(s, { depth: r, undercut: r, top: half + r, bottom: o.W, closed: false, through: R * t >= WAFER, tThrough: WAFER / R });
      const pts = [[-half - r, 0]];
      for (let i = 0; i <= 18; i++) { const a = Math.PI + Math.PI / 2 * i / 18; pts.push([-half + r * Math.cos(a), r * Math.sin(a)]); }
      for (let i = 0; i <= 18; i++) { const a = -Math.PI / 2 + Math.PI / 2 * i / 18; pts.push([half + r * Math.cos(a), r * Math.sin(a)]); }
      s.profile = pts;
    } else {
      const depth = Math.min(R * t, WAFER);
      Object.assign(s, { depth, undercut: 0, top: half, bottom: o.W, closed: false, aspect: depth / o.W, through: R * t >= WAFER, tThrough: WAFER / R });
      s.profile = [[-half, 0], [-half, -depth], [half, -depth], [half, 0]];
    }
    return s;
  }
  return { ETCH, ANGLE, WAFER, siRate, maskRate, etchState };
}));
