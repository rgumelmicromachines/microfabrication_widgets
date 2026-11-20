/* Physics model – two-step dopant diffusion in silicon (predeposition + drive-in).
   Pure functions, usable in the browser and in Node tests. Units: x in µm, t in minutes, T in °C, C in cm⁻³. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_DIFF = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const kB = 8.617333e-5, q = 1.602177e-19;

  function erfc(x) {                                   // Numerical Recipes erfcc, |rel. error| < 1.2e-7
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function erfcinv(y) { let lo = -7, hi = 7; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (erfc(m) > y) lo = m; else hi = m; } return (lo + hi) / 2; }

  /* Intrinsic diffusivities (n = p = n_i): sum of the charge-state components,
     Plummer, Deal & Griffin, Silicon VLSI Technology (2000), ch. 7, Table 7-5 (values as reproduced in the
     authors' own course handouts). [D0 cm²/s, Ea eV]. Fair's older set gives D_B within 6 % of this at 1100 °C. */
  const DIFF = {
    B: [[0.05, 3.5], [0.95, 3.5]],                          // D0, D+
    P: [[3.85, 3.66], [4.44, 4.00], [44.2, 4.37]],          // D0, D-, D=
    As: [[0.011, 3.44], [31.0, 4.15]],                      // D0, D-
    Sb: [[0.214, 3.65], [15.0, 4.08]],                      // D0, D-
  };
  /** Intrinsic diffusivity in cm²/s at T (°C). */
  const D = (dop, TC) => DIFF[dop].reduce((s, [D0, Ea]) => s + D0 * Math.exp(-Ea / (kB * (TC + 273.15))), 0);

  /* Maximum solid solubility (cm⁻³) vs temperature, digitised (±15 %) from the solubility figure in Plummer, Deal &
     Griffin ch. 7 (after Trumbore 1960 and later data); log-interpolated between the points. Total, not electrically
     active, concentration: for P the active limit is only a few 10²⁰ cm⁻³ (clustering). Sources differ by up to ~1.6×. */
  const SOL = {
    B: [[900, 1.2e20], [1000, 2.0e20], [1100, 2.7e20], [1200, 2.7e20]],
    P: [[900, 6.8e20], [1000, 1.2e21], [1100, 1.35e21], [1200, 1.45e21]],
  };
  function solubility(dop, TC) {
    const t = SOL[dop];
    if (TC <= t[0][0]) return t[0][1];
    for (let i = 1; i < t.length; i++) if (TC <= t[i][0]) {
      const u = (TC - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return 10 ** (Math.log10(t[i - 1][1]) + u * (Math.log10(t[i][1]) - Math.log10(t[i - 1][1])));
    }
    return t[t.length - 1][1];
  }
  /** Intrinsic carrier concentration of Si at high temperature (cm⁻³), n_i = 3.87e16 T^1.5 exp(−0.605 eV/kT) (Morin & Maita 1954). */
  const ni = TC => { const T = TC + 273.15; return 3.87e16 * T ** 1.5 * Math.exp(-0.605 / (kB * T)); };

  /** Predeposition (constant surface concentration Cs): erfc profile. Dt in µm². */
  const predep = (x, Cs, Dt) => Cs * erfc(x / (2 * Math.sqrt(Dt)));
  /** Dose of the erfc profile (cm⁻²): Q = 2 Cs √(Dt/π), Dt converted to cm². */
  const predepDose = (Cs, Dt) => 2 * Cs * Math.sqrt(Dt * 1e-8 / Math.PI);
  /** Gaussian (limited-source) profile with dose Q (cm⁻²), Dt in µm²; returns cm⁻³. */
  const gaussian = (x, Q, Dt) => Q / Math.sqrt(Math.PI * Dt * 1e-8) * Math.exp(-x * x / (4 * Dt));

  /* Exact drive-in of an erfc predeposit with a reflecting (zero-flux) surface and no further supply:
     C2(x) = ∫0^∞ C1(ξ) [G(x−ξ) + G(x+ξ)] dξ,   G(u) = exp(−u²/4Dt2) / √(4π Dt2)   (method of images). */
  function simpson(f, a, b, n) {
    if (!(b > a)) return 0;
    if (n % 2) n++;
    const h = (b - a) / n;
    let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
    return s * h / 3;
  }
  function driveIn(x, Cs, Dt1, Dt2) {
    if (Dt2 <= 0) return predep(x, Cs, Dt1);
    // Integrate only where both factors matter: the kernel (±w around x) AND the predeposit (ξ < L1, erfc(6) ≈ 2e-17).
    // The interval is then never wider than the narrower of the two functions allows, so 200 Simpson steps resolve both.
    const w = 9 * Math.sqrt(2 * Dt2), L1 = 12 * Math.sqrt(Dt1), norm = 1 / Math.sqrt(4 * Math.PI * Dt2);
    const C1 = xi => predep(xi, Cs, Dt1);
    const direct = simpson(xi => C1(xi) * Math.exp(-((x - xi) ** 2) / (4 * Dt2)), Math.max(0, x - w), Math.min(x + w, L1), 200);
    const image = simpson(xi => C1(xi) * Math.exp(-((x + xi) ** 2) / (4 * Dt2)), 0, Math.min(Math.max(0, w - x), L1), 200);
    return norm * (direct + image);
  }
  /** Depth where a monotonically decreasing profile f(x) crosses level N (bisection). */
  function crossing(f, N, xmax) {
    if (f(0) <= N) return 0;
    let lo = 0, hi = xmax;
    while (f(hi) > N && hi < 1e3) hi *= 2;
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) > N) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  /* Low-field mobility vs total ionised impurity concentration at 300 K, Caughey–Thomas form with the
     parameters of Arora, Hauser & Roulston, IEEE TED 29 (1982) 292 at T = 300 K. */
  const MOB = { n: { min: 88.0, max: 88.0 + 1252, Nref: 1.26e17, a: 0.88 }, p: { min: 54.3, max: 54.3 + 407, Nref: 2.35e17, a: 0.88 } };
  const mobility = (carrier, N) => { const m = MOB[carrier]; return m.min + (m.max - m.min) / (1 + (N / m.Nref) ** m.a); };
  /** Sheet resistance (Ω/□) of the diffused layer between the surface and the junction. */
  function sheetResistance(profile, NB, xj, carrier) {
    if (!(xj > 0)) return Infinity;
    const G = simpson(x => { const C = profile(x); return Math.max(C - NB, 0) * mobility(carrier, C + NB); }, 0, xj, 400) * 1e-4; // µm → cm
    return 1 / (q * G);
  }

  return { D, DIFF, SOL, solubility, ni, predep, predepDose, gaussian, driveIn, crossing, erfcinv, mobility, sheetResistance, MOB };
}));
