/* Physics model – physical vapour deposition: thickness distribution from a small source, mean free path,
   line-of-sight shadowing. Usable in the browser and in Node tests. Lengths: h, r in cm; λ in cm; p in Pa.

   Flat substrate parallel to a small source at distance h, emission ∝ cosⁿφ (n = 0 isotropic point source,
   n = 1 small planar "Knudsen" surface source, n > 1 more forward-directed sources such as e-beam hearths):
     t(r)/t(0) = (1 + (r/h)²)^(−(n+3)/2)       → n = 0: exponent −3/2,  n = 1: exponent −2
   Mean free path of gas molecules (hard spheres, kinetic theory):  λ = k_B·T / (√2·π·d²·p)
   Fraction of the vapour that reaches the substrate without a gas collision:  exp(−h/λ)
   Shadowing at a step of height s, wafer position r:  angle of incidence θ = atan(r/h), offset s·tan θ.
   Sources: point and small-surface source – M. Ohring, The Materials Science of Thin Films, Academic Press 1992,
   eqs. 3-13 to 3-19 (pp. 87–89) and R. Glang in L. I. Maissel & R. Glang (eds.), Handbook of Thin Film Technology,
   McGraw-Hill 1970, ch. 1, eqs. (52)–(57); cosⁿ emission: Ohring eq. 3-15 (after Pulker 1984) – the flat-substrate
   form with exponent (n+3)/2 follows from it. Mean free path: Glang eq. (38); J. F. O'Hanlon, A User's Guide to
   Vacuum Technology, 3rd ed., Wiley 2003, eq. (2.4) and Table 2.1 (air: λ = 6.6 cm at 0.1 Pa, 22 °C).
   Shadowing: line-of-sight geometry with unit sticking, as in Ohring §3.3.3 (Fig. 3-9). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_PVD = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const K_B = 1.380649e-23;             // J/K (exact)

  /* Hard-sphere molecular diameters from viscosity, 0 °C (Glang, Table 3, after E. H. Kennard, Kinetic Theory of
     Gases, McGraw-Hill 1938). */
  const GAS = { air: { d: 3.74e-10, name: 'air' }, Ar: { d: 3.67e-10, name: 'Ar' } };

  /** Relative thickness at radius r for source–substrate distance h and emission exponent n. */
  const thickness = (r, h, n) => (1 + (r / h) ** 2) ** (-(n + 3) / 2);
  /** Non-uniformity (t(0) − t(R))/t(0) over a wafer of radius R. */
  const nonUniformity = (R, h, n) => 1 - thickness(R, h, n);
  /** Distance h needed for a given edge-to-centre ratio q = t(R)/t(0). */
  const distanceFor = (R, n, q) => R / Math.sqrt(q ** (-2 / (n + 3)) - 1);
  /** Mean free path in cm for pressure p (Pa), temperature T (K), molecular diameter d (m). */
  const meanFreePath = (p, d, T = 293.15) => K_B * T / (Math.SQRT2 * Math.PI * d * d * p) * 100;
  /** Fraction travelling a distance h (cm) without a collision. */
  const unscattered = (h, lam) => Math.exp(-h / lam);
  /** Angle of incidence (deg) at wafer radius r and the shadow offset (same unit as s) behind a step of height s. */
  const incidence = (r, h) => Math.atan(r / h) * 180 / Math.PI;
  const shadow = (s, r, h) => s * r / h;

  return { K_B, GAS, thickness, nonUniformity, distanceFor, meanFreePath, unscattered, incidence, shadow };
}));
