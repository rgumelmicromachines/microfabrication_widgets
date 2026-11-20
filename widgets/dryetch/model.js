/* Physics model – reactive ion etching of a film through a resist window: anisotropy, bias, overetch, selectivity
   and laser-interferometric end-point detection. Usable in the browser (needs ../oxidation/model.js loaded first)
   and in Node tests. Units: nm and minutes.

   Etch front: a directional (ion-driven) vertical rate R_v and an isotropic (radical-driven) lateral rate R_l ≤ R_v.
   The etched region of the film after time t is the opening (width W) swept down by (R_v − R_l)·t and grown in all
   directions by R_l·t (Minkowski sum of a rectangle and a disc), cut off by the film/substrate interface.
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
      if (y < 0 || y > o.hf) return null;
      if (y <= dDir) return o.W / 2 + r;
      const dy = y - dDir;
      return dy <= r ? o.W / 2 + Math.sqrt(r * r - dy * dy) : null;
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
