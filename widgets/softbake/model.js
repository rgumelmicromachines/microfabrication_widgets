/* Physics model – soft bake (prebake) of a DNQ/novolak photoresist film after spin coating: how much casting
   solvent is left, how much of the photoactive compound is lost, and how the film shrinks.
   Pure functions, usable in the browser and in Node tests. Units: °C, seconds, weight per cent.

   Solvent. Measured residual PGMEA in a 1.15 µm novolak + 12 wt% DNQ film baked on a vacuum hotplate
   (A. B. Gardiner et al., "Diffusivity measurements in polymers: II. Residual casting solvent measurement by
   liquid scintillation counting", Proc. SPIE 3049 (1997) 850, Fig. 2 and eq. 2). The authors describe their data
   with the desorption of a slab towards a temperature-dependent plateau:
     w(t) = w₀ − M∞(T)·[1 − (8/π²)·Σ (2n+1)⁻²·exp(−D(T)·(2n+1)²·π²·t / 4l²)]
   with w₀ ≈ 28 wt% after spin coating, the film thickness l, and their fitted values
     T (°C)        70           90           110
     D (cm²/s)     8.22e-11     1.32e-10     1.94e-10      (E_d = 5.62 kcal/mol)
     M∞ (wt%)      6.84         12.3         16.3          (linear in T)
   This is an empirical description of process-relevant times (up to about 10 min), not a material law: the solvent
   that can leave in that time is limited, because the diffusivity collapses as the film dries.

   Photoactive compound. First-order thermal decomposition, m′ = exp(−K_T·t), K_T = A_r·exp(−E_a/RT)
   (C. A. Mack, R. T. Carback, "Modeling the effects of prebake on positive resist processing", Proc. Kodak
   Microelectronics Seminar Interface '85 (1985) 155, Table I; C. A. Mack, Inside PROLITH, FINLE 1997, ch. 6):
   Kodak 820 resist, E_a = 30.3 kcal/mol, ln A_r = 35.3 (A_r in 1/min). In a convection oven the substrate needs a
   warm-up time before it reaches the bake temperature: t is replaced by t − t_wup (Inside PROLITH, eq. 6.18). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_SB = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const R = 1.987204e-3;                                  // kcal/(mol·K)
  const W0 = 28;                                          // wt% solvent after spin coating (Gardiner et al. 1997, Fig. 2)
  const L_FILM = 1.15e-4;                                 // cm, film of the measurement (1.15 µm)
  const D90 = 1.32e-10, E_D = 5.62;                       // cm²/s at 90 °C; kcal/mol (Gardiner et al. 1997)
  const MINF = [[70, 6.84], [90, 12.3], [110, 16.3]];     // wt% that leaves the film at each temperature (ibid.)
  const T_FIT = [70, 110];                                // measured range
  const E_PAC = 30.3, LN_A_PAC = 35.3;                    // kcal/mol; ln(1/min) – Kodak 820 (Mack & Carback 1985)

  const kelvin = TC => TC + 273.15;
  /** Effective solvent diffusivity (cm²/s) of the empirical fit. */
  const diffusivity = TC => D90 * Math.exp(-E_D / R * (1 / kelvin(TC) - 1 / kelvin(90)));
  /** Solvent (wt%) that can leave in a process-relevant time: linear through the fitted values, extrapolated with
      the end slopes outside 70–110 °C and kept between 0 and w₀. */
  function desorbable(TC) {
    const [a, b, c] = MINF, seg = TC <= b[0] ? [a, b] : [b, c];
    const v = seg[0][1] + (seg[1][1] - seg[0][1]) * (TC - seg[0][0]) / (seg[1][0] - seg[0][0]);
    return Math.min(W0, Math.max(0, v));
  }
  /** Fraction of the desorbable solvent that has left a slab of thickness l after t seconds. */
  function slabFraction(D, t, l = L_FILM) {
    if (t <= 0) return 0;
    const x = D * Math.PI * Math.PI * t / (4 * l * l);
    if (x < 0.02) return 2 * Math.sqrt(D * t / Math.PI) / l;          // short-time limit of the series (√t law)
    let s = 0;
    for (let n = 0; n < 60; n++) { const k = (2 * n + 1) ** 2; s += Math.exp(-k * x) / k; }
    return 1 - 8 / (Math.PI * Math.PI) * s;
  }
  /** Residual solvent (wt%) after t seconds at the temperature T (isothermal). */
  const solvent = (TC, t) => W0 - desorbable(TC) * slabFraction(diffusivity(TC), t);
  /** Rate constant of the PAC decomposition (1/s) and fraction of PAC left after t seconds. */
  const kPac = TC => Math.exp(LN_A_PAC - E_PAC / (R * kelvin(TC))) / 60;
  const pacLeft = (TC, t) => Math.exp(-kPac(TC) * Math.max(0, t));
  /** Film thickness relative to the as-spun film when the solvent falls from w₀ to w wt% – mass balance with
      additive volumes and equal densities of resin and solvent (an assumption). */
  const thickness = w => (1 - W0 / 100) / (1 - w / 100);

  /** State of the film. o: { mode: 'hotplate' | 'oven', T (°C), t (s), warmup (s, oven only) } */
  function state(o) {
    const tEff = o.mode === 'oven' ? Math.max(0, o.t - o.warmup) : o.t;   // time at the bake temperature
    const w = solvent(o.T, tEff), pac = pacLeft(o.T, tEff);
    return { tEff, w, removed: W0 - w, plateau: W0 - desorbable(o.T), pac, pacLost: 1 - pac, thick: thickness(w),
      tau: L_FILM * L_FILM / diffusivity(o.T), inRange: o.T >= T_FIT[0] && o.T <= T_FIT[1] };
  }
  return { R, W0, L_FILM, MINF, T_FIT, E_PAC, LN_A_PAC, E_D, D90, diffusivity, desorbable, slabFraction, solvent, kPac, pacLeft, thickness, state };
}));
