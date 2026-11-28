/* Physics model – four-point probe and van der Pauw: sheet resistance, geometric corrections, resistivity vs doping.
   Usable in the browser and in Node tests. Lengths in mm unless noted, ρ in Ω·cm, R_s in Ω/□, N in cm⁻³.

   Collinear probe, equal spacing s, current I through the outer probes, voltage V across the inner ones.
     infinitely thin, infinite sheet:  R_s = (π/ln 2)·V/I = 4.532·V/I      (F. M. Smits, Bell Syst. Tech. J. 37 (1958) 711)
     semi-infinite bulk:               ρ = 2π·s·V/I                          (A. Uhlir, Bell Syst. Tech. J. 34 (1955) 105, eq. 9)
   Finite circular slice of diameter d, probe centred:  R_s = C·V/I,
     C = π / [ln 2 + ln(((d/s)² + 3)/((d/s)² − 3))]                       (Smits 1958, Sect. IV; reproduces his Table I)
   Thickness w (non-conducting bottom):  ρ = (V/I)·w·(π/ln 2)·F(w/s),
     F = 2 ln 2·(s/w)/G,  G = 1 + 4(s/w)·Σₙ [1/√((s/w)² + (2n)²) − 1/√((2s/w)² + (2n)²)]   (images; Uhlir 1955
     eqs. 12–13, reproduces Smits Table III); finite thick slice: first-order product C·F (Smits 1958).
   Van der Pauw: exp(−π R_A/R_s) + exp(−π R_B/R_s) = 1  (L. J. van der Pauw, Philips Res. Rep. 13 (1958) 1, eq. 1).
   Resistivity vs doping of Si at 300 K: W. R. Thurber, R. L. Mattis, Y. M. Liu, J. J. Filliben, NBS Special
     Publication 400-64 (1981) – phosphorus eq. (1) with Table 9, boron eq. (4) with Table 12 (300 K columns); the same
     equations (at 23 °C) underlie ASTM F723. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_4PP = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const Q = 1.602176634e-19;
  const K_INF = Math.PI / Math.LN2;                  // 4.5324

  /** Smits' correction factor for a centred probe on a thin circular slice (d/s > √3). */
  const cCircle = ds => Math.PI / (Math.LN2 + Math.log((ds * ds + 3) / (ds * ds - 3)));
  /** Thickness factor F(w/s) for an infinite slice with a non-conducting bottom (F → 1 for w ≪ s). */
  function fThick(ws) {
    if (ws < 0.05) return 1;
    const a = 1 / ws;                                   // s/w
    let sum = 0;
    for (let n = 1; n <= 4000; n++) sum += 1 / Math.sqrt(a * a + 4 * n * n) - 1 / Math.sqrt(4 * a * a + 4 * n * n);
    // tail of the series (terms ~ 3a²/(16 n³)): integral estimate beyond n = 4000
    sum += 3 * a * a / (32 * 4000 * 4000);
    return 2 * Math.LN2 * a / (1 + 4 * a * sum);
  }

  /** Resistivity of Si at 300 K (Ω·cm) for boron or phosphorus density N (Thurber et al. 1981). */
  function rho(dop, N) {
    let qrhoN;
    if (dop === 'P') {
      const x = Math.log10(N / 1e16);
      const A = [-3.0652, 2.1853, -0.61080, 0.056189], B = [-0.67642, 0.19542, -0.018100];
      qrhoN = 10 ** ((A[0] + A[1] * x + A[2] * x * x + A[3] * x ** 3) / (1 + B[0] * x + B[1] * x * x + B[2] * x ** 3));
    } else {
      qrhoN = 0.00215 + (0.02053 - 0.00215) / (1 + (N / 4.09e18) ** -0.727);
    }
    return qrhoN / (Q * N);
  }
  /** Inverse: dopant density for a measured resistivity (bisection in log N). */
  function dopingFor(dop, r) {
    let lo = 10, hi = 21;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (rho(dop, 10 ** m) > r) lo = m; else hi = m; }
    return 10 ** ((lo + hi) / 2);
  }
  /** Van der Pauw: sheet resistance from the two four-terminal resistances (Newton on the vdP equation). */
  function vdpRs(RA, RB) {
    let Rs = Math.PI * (RA + RB) / (2 * Math.LN2);
    for (let i = 0; i < 60; i++) {
      const ea = Math.exp(-Math.PI * RA / Rs), eb = Math.exp(-Math.PI * RB / Rs);
      const f = ea + eb - 1, df = ea * Math.PI * RA / (Rs * Rs) + eb * Math.PI * RB / (Rs * Rs);
      const step = f / df; Rs -= step;
      if (Math.abs(step) < 1e-12 * Rs) break;
    }
    return Rs;
  }
  /** The two resistances a sample of sheet resistance Rs shows for a given ratio RA/RB = r (solves the vdP equation). */
  function vdpPair(Rs, r) {
    let lo = 0, hi = Rs;                                  // RB in (0, Rs·ln2/π] for r ≥ 1
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; const g = Math.exp(-Math.PI * r * m / Rs) + Math.exp(-Math.PI * m / Rs) - 1; if (g > 0) lo = m; else hi = m; }
    const RB = (lo + hi) / 2;
    return { RA: r * RB, RB };
  }
  /** Recommended current for a resistivity (ASTM F84-68T, as reproduced in NBS Technical Note 555 (1970), Table 2). */
  const CURRENTS = [[0.012, 0.1], [0.6, 0.01], [60, 1e-3], [1200, 1e-4], [Infinity, 1e-5]];
  const recCurrent = r => CURRENTS.find(([lim]) => r < lim)[1];

  function measure(o) {
    // o: { dop, N, w (µm), d (mm), s (mm), I (A) }
    const r = rho(o.dop, o.N), Rs = r / (o.w * 1e-4);
    const ds = o.d / o.s, ws = o.w * 1e-3 / o.s;
    const C = ds > 3 ? cCircle(ds) : NaN;     // the array is 3s long: it only fits on the sample for d > 3s
    const F = fThick(ws);
    const V = o.I * Rs / (C * F);                        // R_s = (V/I)·C·F (Smits 1958)
    return { rho: r, Rs, C, F, ds, ws, V, naive: K_INF * V / o.I, rec: recCurrent(r) };
  }
  return { Q, K_INF, cCircle, fThick, rho, dopingFor, vdpRs, vdpPair, recCurrent, CURRENTS, measure };
}));
