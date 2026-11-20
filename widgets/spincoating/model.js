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
  /**
   * Timeline of a coating run (process time in s) for the animation. o: { rpm, spinTime, spreadRpm, spreadTime, accel,
   * ebr (bool), ebrRpm, ebrTime, dryRpm, dryTime }. Phases: 3 s static dispense → optional spread → ramp → coating spin
   * → optional edge bead removal (rinse) and spin dry → stop. Ramps use the acceleration accel (rpm/s).
   * Returns the phase times T, the speed profile pts [[t, rpm], …] and a piecewise time-lapse for the display.
   */
  function recipe(o) {
    const ramp = (a, b) => Math.max(0.2, Math.abs(b - a) / o.accel);
    const T = { disp: 3 };
    const hasSpread = o.spreadRpm > 0 && o.spreadTime > 0, sR = hasSpread ? o.spreadRpm : 0;
    T.spread0 = hasSpread ? T.disp + ramp(0, sR) : T.disp;
    T.spread1 = hasSpread ? T.spread0 + o.spreadTime : T.disp;
    T.spin0 = T.spread1 + ramp(sR, o.rpm);
    T.spin1 = T.spin0 + o.spinTime;
    if (o.ebr) {
      T.ebr0 = T.spin1 + ramp(o.rpm, o.ebrRpm);
      T.ebrOn = T.ebr0 + 0.5;                                     // the nozzle is in place
      T.ebrOff = T.ebrOn + o.ebrTime;
      T.dry0 = T.ebrOff + ramp(o.ebrRpm, o.dryRpm);
      T.dry1 = T.dry0 + o.dryTime;
      T.stop = T.dry1 + ramp(o.dryRpm, 0);
    } else {
      T.ebr0 = T.ebrOn = T.ebrOff = T.dry0 = T.dry1 = T.spin1;
      T.stop = T.spin1 + ramp(o.rpm, 0);
    }
    T.end = T.stop + 3.5;                                         // show the finished wafer for a moment
    // end of the free spreading of the puddle and end of the "wet" phase (thinning starts at the coating speed)
    T.wetEnd = hasSpread ? T.spread1 : T.spin0;
    T.spreadEnd = hasSpread ? Math.max(T.spread0 + 0.5, T.spread1 - 1) : T.spin0 + 0.8;
    const pts = [[0, 0], [T.disp, 0]];
    if (hasSpread) pts.push([T.spread0, sR], [T.spread1, sR]);
    pts.push([T.spin0, o.rpm], [T.spin1, o.rpm]);
    if (o.ebr) pts.push([T.ebr0, o.ebrRpm], [T.ebrOff, o.ebrRpm], [T.dry0, o.dryRpm], [T.dry1, o.dryRpm]);
    pts.push([T.stop, 0], [T.end, 0]);
    // time-lapse: process seconds per display second in each part of the run
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const lapse = [[0, T.disp, 1], [T.disp, T.spin0, 2], [T.spin0, T.spin1, clamp(o.spinTime / 7.5, 1, 20)],
      [T.spin1, T.dry0, clamp((T.dry0 - T.spin1) / 2.5, 1, 6)], [T.dry0, T.stop, clamp((T.stop - T.dry0) / 4, 1, 10)], [T.stop, T.end, 1.5]]
      .filter(([a, b]) => b > a + 1e-9);
    let d = 0;
    const seg = lapse.map(([p0, p1, sp]) => { const g = { p0, p1, sp, d0: d }; d += (p1 - p0) / sp; g.d1 = d; return g; });
    const rpmAt = tp => {
      for (let i = 1; i < pts.length; i++) if (tp <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; return b > a ? ya + (yb - ya) * (tp - a) / (b - a) : yb; }
      return 0;
    };
    const procAt = dd => { const g = seg.find(x => dd < x.d1) || seg[seg.length - 1]; return Math.min(g.p1, g.p0 + (dd - g.d0) * g.sp); };
    const dispAt = tp => { const g = seg.find(x => tp < x.p1) || seg[seg.length - 1]; return g.d0 + (Math.min(tp, g.p1) - g.p0) / g.sp; };
    const lapseAt = tp => (seg.find(x => tp < x.p1) || seg[seg.length - 1]).sp;
    const warn = o.ebr && (o.ebrRpm >= o.rpm || o.dryRpm >= o.rpm);
    return { T, pts, seg, display: d, rpmAt, procAt, dispAt, lapseAt, hasSpread, ebr: !!o.ebr, warn };
  }
  return { BAKE, BEAD, thicknessA, thickness, speedFor, state, recipe };
}));
