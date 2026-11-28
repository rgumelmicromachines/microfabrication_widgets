/* Physics model – electromigration lifetime of an interconnect line: Black's equation, extrapolation from an
   accelerated test to use conditions, lognormal failure statistics and the Blech (short-length) effect.
   Pure functions, usable in the browser and in Node tests. Units: j in MA/cm², T in °C, times in hours, L in µm.

   Black's equation (J. R. Black, IEEE Trans. Electron Devices ED-16 (1969) 338, eq. (1)):
     1/MTF = A·j²·exp(−E_a/kT)   →   t50 = A′·j^(−n)·exp(E_a/kT)
   with the median time to failure t50. Black found n = 2 for aluminium; in general n ≈ 2 when the failure time is
   dominated by void nucleation and n ≈ 1 when it is dominated by void growth (J. R. Lloyd, Microelectron. Reliab.
   47 (2007) 1468; J. Lienig, S. Rothe, M. Thiele, Fundamentals of Electromigration-Aware Integrated Circuit Design,
   2nd ed., Springer 2025, §2.2.1).
   The prefactor A′ depends on the metal, its microstructure and the line geometry, so it is never calculated: a
   measured t50 of an accelerated test is scaled to the use conditions with the acceleration factor
     AF = t50(use)/t50(test) = (j_test/j_use)^n · exp[(E_a/k)·(1/T_use − 1/T_test)].
   Failure times of nominally identical lines are lognormally distributed: F(t) = Φ[ln(t/t50)/σ], so the time at
   which a fraction F has failed is t_F = t50·exp(σ·Φ⁻¹(F)).
   Blech effect (I. A. Blech, J. Appl. Phys. 47 (1976) 1203): the atoms pile up at the anode end and the resulting
   stress gradient drives them back. Below a threshold product (j·L)_c the back flow balances the electron wind and
   the line does not fail by electromigration. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_EM = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const K_EV = 8.617333e-5;                               // eV/K (CODATA 2018)
  const HOURS_PER_YEAR = 8766;                            // 365.25 d

  /* Metallisations. E_a and n as measured in the cited works – they describe those films, not a material constant:
     the activation energy follows the fastest diffusion path (grain boundaries, the surface or interface, the bulk).
     jLc: Blech threshold product in A/cm. */
  const METALS = {
    alFine: { name: 'Al, fine-grained (1.2 µm grains)', short: 'fine-grained Al', Ea: 0.48, n: 2, jLc: 1260, mat: 'metal' },   // Black 1969, p. 341, eq. (5)
    alLarge: { name: 'Al, large-grained (8 µm grains)', short: 'large-grained Al', Ea: 0.84, n: 2, jLc: 1260, mat: 'metal' },  // Black 1969, p. 341, eq. (7)
    alGlass: { name: 'Al, large-grained, SiO₂-covered', short: 'glass-covered Al', Ea: 1.2, n: 2, jLc: 1260, mat: 'metal' },   // Black 1969, p. 342, eq. (9)
    // Cu damascene line with a dielectric (SiN/SiCN) cap: transport along the Cu/cap interface, E_a ≈ 0.9 eV
    // (0.85–1.1 eV: C.-K. Hu et al., Proc. IRPS 2004, p. 222), n = 1.1–1.3 (Filippi et al., Proc. IRPS 2009, p. 444,
    // quoted by Lienig et al. 2025, §2.2.1)
    cu: { name: 'Cu damascene, dielectric cap', short: 'Cu', Ea: 0.9, n: 1.2, jLc: 3700, mat: 'gold' },
  };
  /* Blech products: Al 1260 A/cm at 350 °C (Blech 1976, as quoted in the review literature);
     Cu/oxide dual damascene 3700 A/cm, 340–400 °C (K.-D. Lee et al., Appl. Phys. Lett. 79 (2001) 3236).
     Published values for Cu range from about 2000 to 10 000 A/cm depending on the dielectric and the cap. */

  const kelvin = TC => TC + 273.15;
  /** Acceleration factor between a test (jT, TT) and use conditions (jU, TU): t50(use)/t50(test). */
  const accel = (Ea, n, jT, TT, jU, TU) => (jT / jU) ** n * Math.exp(Ea / K_EV * (1 / kelvin(TU) - 1 / kelvin(TT)));
  /** Median life (h) at (j, T), scaled from a measured t50 (h) at (jT, TT). */
  const t50At = (Ea, n, t50T, jT, TT, j, T) => t50T * accel(Ea, n, jT, TT, j, T);

  /** Error function (Numerical Recipes erfc approximation, |error| < 1.2e-7). */
  function erf(x) {
    const t = 1 / (1 + 0.5 * Math.abs(x));
    const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? y : -y;
  }
  /** Standard normal CDF and its inverse (P. J. Acklam's rational approximation, |relative error| < 1.2e-9). */
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  function PhiInv(p) {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) return -PhiInv(1 - p);
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  /** Lognormal: fraction failed at time t, and time at which the fraction F has failed. */
  const failed = (t, t50, sigma) => (t <= 0 ? 0 : Phi(Math.log(t / t50) / sigma));
  const timeAt = (F, t50, sigma) => t50 * Math.exp(sigma * PhiInv(F));

  /** Blech product j·L in A/cm for j in MA/cm² and L in µm. */
  const jL = (j, L) => j * 1e6 * L * 1e-4;
  /** Longest "immortal" line (µm) at current density j (MA/cm²). */
  const blechLength = (jLc, j) => jLc / (j * 1e6) * 1e4;

  /** Everything the page shows. o: { metal, jT, TT, t50T, jU, TU, sigma, L, F (fraction, e.g. 0.001), life (years) } */
  function evaluate(o) {
    const m = METALS[o.metal];
    const AF = accel(m.Ea, m.n, o.jT, o.TT, o.jU, o.TU);
    const t50U = o.t50T * AF, tFU = timeAt(o.F, t50U, o.sigma);
    const target = o.life * HOURS_PER_YEAR;
    // current density at which the F-quantile just reaches the target life at T_use: t_F ∝ j^(−n)
    const jMax = o.jU * (tFU / target) ** (1 / m.n);
    return { m, Ea: m.Ea, n: m.n, AF, AFj: (o.jT / o.jU) ** m.n, AFT: AF / (o.jT / o.jU) ** m.n, t50U, tFU, target, jMax,
      jLT: jL(o.jT, o.L), jLU: jL(o.jU, o.L), immortalT: jL(o.jT, o.L) < m.jLc, immortalU: jL(o.jU, o.L) < m.jLc,
      LcU: blechLength(m.jLc, o.jU), LcT: blechLength(m.jLc, o.jT), ok: tFU >= target };
  }
  return { K_EV, HOURS_PER_YEAR, METALS, accel, t50At, Phi, PhiInv, failed, timeAt, jL, blechLength, evaluate };
}));
