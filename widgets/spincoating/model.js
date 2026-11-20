/* Physics model – photoresist thickness from spin coating (empirical spin curve).
   Usable in the browser and in Node tests.

   t = k · p² / √w      t in Å, k = spinner constant (typically 80–100), p = solids content of the resist in %,
                        w = spin speed in rpm/1000.
   The rule is quoted without units in the course notes it comes from; Å is the only unit for which the quoted
   typical values agree (3000–6000 rpm, 1–2 µm for commercial Si processes): k = 90, p = 20 %, 4000 rpm → 1.8 µm.
   The robust part is the scaling t ∝ 1/√w (spin-speed exponent ≈ 0.5 for low and medium viscosity resists),
   i.e. doubling the speed thins the film by √2; the absolute value needs a spin curve for each resist and spinner.

   Sources: empirical rule, spin-speed range, typical thickness, soft-bake shrinkage (~25 %) and edge bead
   (up to 20–30 × the film) as quoted in microfabrication course notes, e.g. Wake Forest University, NAN 242,
   "Photolithography", slides 10, 13, 15; spin-speed exponent: DTU Nanolab, Litho Tool Package – Spin coating. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_SPIN = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BAKE = 0.75;            // thickness after soft bake: up to ~25 % thinner
  const BEAD = [20, 30];        // edge bead: up to 20–30 × the nominal thickness

  /** Thickness in Å for spin speed rpm, solids p (%), spinner constant k. */
  const thicknessA = (rpm, p, k = 90) => k * p * p / Math.sqrt(rpm / 1000);
  /** Thickness in µm. */
  const thickness = (rpm, p, k = 90) => thicknessA(rpm, p, k) / 1e4;
  /** Spin speed (rpm) that gives thickness tum (µm). */
  const speedFor = (tum, p, k = 90) => 1000 * (k * p * p / (tum * 1e4)) ** 2;

  function state(o) {
    const k = o.k === undefined ? 90 : o.k;
    const tA = thicknessA(o.rpm, o.p, k);
    return { w: o.rpm / 1000, tA, t: tA / 1e4, tBaked: BAKE * tA / 1e4, bead: BEAD.map(f => f * tA / 1e4),
      tLo: thickness(o.rpm, o.p, 80), tHi: thickness(o.rpm, o.p, 100) };
  }
  return { BAKE, BEAD, thicknessA, thickness, speedFor, state };
}));
