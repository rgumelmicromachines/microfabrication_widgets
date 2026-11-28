/* Physics model – reactive ion etching of a film through a resist window: anisotropy, bias, overetch, selectivity
   and laser-interferometric end-point detection. Usable in the browser (needs ../oxidation/model.js loaded first)
   and in Node tests. Units: nm and minutes.

   Etch front: a directional (ion-driven) vertical rate R_v and an isotropic (radical-driven) lateral rate R_l ≤ R_v.
   The ions travel in straight lines and only reach the open area, so the floor moves down at R_v. A point of the
   sidewall at depth y is uncovered at the time y/R_v and is etched sideways by the radicals from then on, for the
   time t − y/R_v. The wall is the envelope of circles of radius R_l·(t − y₁/R_v) centred on the mask-edge line at
   every depth y₁ ≤ R_v·t (Huygens construction). With a = R_l/R_v and r = R_l·t the half-width of the opening is
     W/2 + √(r² − y²)                      for y ≤ a·r        (quarter circle below the mask edge)
     W/2 + (R_v·t − y)·a/√(1 − a²)         for a·r < y ≤ R_v·t (straight, tapered wall)
   cut off by the film/substrate interface: a = 0 gives a vertical wall, a = 1 the isotropic quarter circle.
   → floor depth R_v·t, undercut U = R_l·t at the top of the film, bias B = d_f − d_m = 2U, anisotropy A = 1 − R_l/R_v.
   Complete isotropic etching (R_l = R_v) gives B = 2·h_f at the end point, complete anisotropic etching B = 0.
   Definitions: J. D. Plummer, M. D. Deal, P. B. Griffin, Silicon VLSI Technology (2000), ch. 10.

   End point: normal-incidence reflectance of a He–Ne laser (632.8 nm) from the remaining SiO₂ on Si (thin-film
   interference, optical constants as on the oxidation page: Malitson 1965, Green 2008). One full fringe per
   Δd = λ/(2n) of removed oxide. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../oxidation/model.js'));
  else root.MFW_DRY = factory(root.MFW_OX);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (OX) {
  'use strict';
  const HENE = 632.8;                                    // nm, He–Ne laser line

  /** Etch state. o: { hf (film nm), Rv, Rl (nm/min), W (opening, nm), t (min), Ssi (film:Si), Sr (film:resist), hr (resist nm) } */
  function state(o) {
    const Rl = Math.min(o.Rl, o.Rv);
    const r = Rl * o.t, dDir = (o.Rv - Rl) * o.t;                  // isotropic radius and directional sweep
    const tc = o.hf / o.Rv;                                        // time to clear the film in the opening (end point)
    const over = Math.max(0, o.t - tc);
    const dRem = Math.max(0, o.hf - o.Rv * o.t);                   // film left at the bottom of the opening
    const recess = over * o.Rv / o.Ssi;                            // substrate etched during the overetch
    const resist = o.hr - o.Rv * o.t / o.Sr;                       // resist left (negative: mask gone)
    // half-width of the etched opening in the film at depth y (0 = top of the film); null below the etch front
    const edge = y => {
      const D = o.Rv * o.t, a = Rl / o.Rv;
      if (y < 0 || y > o.hf || y > D + 1e-9) return null;
      if (y <= a * r) return o.W / 2 + Math.sqrt(Math.max(0, r * r - y * y));
      return o.W / 2 + Math.max(0, D - y) * a / Math.sqrt(1 - a * a);        // a < 1 here (for a = 1: a·r = D)
    };
    const U = r, B = 2 * r;
    return {
      Rl, r, dDir, tc, over, overPct: tc > 0 ? 100 * over / tc : 0, dRem, recess, resist, maskGone: resist <= 0,
      depth: Math.min(o.hf, o.Rv * o.t), U, B, cd: o.W + B, A: 1 - Rl / o.Rv, edge,
      floorHalf: edge(Math.min(o.hf, o.Rv * o.t)),                  // half-width of the floor of the etched film
      signal: reflectance(dRem), period: HENE / (2 * OX.nSiO2(HENE)), periodT: HENE / (2 * OX.nSiO2(HENE) * o.Rv),
      fringes: 2 * OX.nSiO2(HENE) * o.hf / HENE,
    };
  }
  /** Reflectance of the He–Ne beam with d nm of SiO₂ left on Si. */
  const reflectance = d => OX.reflectance(d, HENE);
  return { HENE, state, reflectance };
}));
