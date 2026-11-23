/* Physics model – high-vacuum pump-down of a chamber through a pipe: conductance, effective pumping speed,
   flow regimes, outgassing, mean free path and monolayer time. Air (or air-like gas) at room temperature.
   Usable in the browser and in Node tests. Pressures in Pa, volumes in L, speeds in L/s, lengths in cm, time in s.

   Mean free path of air: λ·p = 6.6×10⁻³ Pa·m at 22 °C (J. F. O'Hanlon, A User's Guide to Vacuum Technology, 3rd ed.,
     Wiley 2003, eq. 2.5 and Table 2.1). Knudsen number Kn = λ/d: viscous Kn < 0.01, transition 0.01–1, molecular
     Kn > 1 (O'Hanlon §3.1; Leybold and Pfeiffer put the molecular boundary at Kn > 0.5).
   Monolayer time (sticking 1, air 22 °C): 2.5 s at 10⁻⁴ Pa, ∝ 1/p (O'Hanlon eq. 2.10 and p. 14).
   Conductance of a round pipe, air 20 °C (W. Umrath, Fundamentals of Vacuum Technology, Leybold 2016, eqs. 1.26–1.28,
     Knudsen's formula, d in cm, l in cm, p̄ in mbar):  C = 135·d⁴p̄/l + 12.1·(d³/l)·(1 + 192·d·p̄)/(1 + 237·d·p̄) L/s;
     molecular limit 12.1·d³/l (O'Hanlon eq. 3.23); entrance effect of a short pipe approximated by Dushman's series
     combination with the aperture conductance 11.6·A (O'Hanlon eqs. 3.21, 3.24), i.e. l → l + 4d/3 in the molecular term.
   Effective speed 1/S_eff = 1/S + 1/C (Leybold eq. 1.24). Pump-down V·dp/dt = −S_eff·p + Q(t) (Leybold eqs. 2.32, 2.38).
   Outgassing q(t) = q₁ₕ·(1 h/t) for metals (Pfeiffer Vacuum Know-how, formula 1-32): unbaked stainless steel
     q₁ₕ = 9×10⁻⁸ mbar·L/(s·cm²), unbaked aluminium 6×10⁻⁹ (Leybold Table X); stainless steel baked at 150 °C for 24 h:
     constant ≈ 3×10⁻¹² (hydrogen; P. Chiggiato, CAS 2017, arXiv:2006.07124, Table 3). Published values scatter by more
     than an order of magnitude – they are indicative only.
   Pressure ranges: ISO 3529-1:2019 (low ≥ 100 Pa, medium 0.1–100 Pa, high 10⁻⁶–0.1 Pa, ultra-high 10⁻⁹–10⁻⁶ Pa,
     extreme-high < 10⁻⁹ Pa). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_VAC = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LP = 6.6e-3;                                  // λ·p, Pa·m (air, 22 °C)
  const MAT = {
    ss: { name: 'stainless steel, unbaked', q1h: 9e-8, alpha: 1 },        // mbar·L/(s·cm²) at 1 h
    al: { name: 'aluminium, unbaked', q1h: 6e-9, alpha: 1 },
    baked: { name: 'stainless steel, baked 150 °C', q1h: 3e-12, alpha: 0 },
  };
  const RANGES = [[100, Infinity, 'low (rough) vacuum'], [0.1, 100, 'medium vacuum'], [1e-6, 0.1, 'high vacuum'], [1e-9, 1e-6, 'ultra-high vacuum'], [0, 1e-9, 'extreme-high vacuum']];
  const T_ROUGH = 300;                                // s of pumping before the high-vacuum stage starts (assumption)
  const P0 = 1;                                       // Pa, start of the high-vacuum stage

  const lambda = p => LP / p * 100;                   // cm
  const knudsen = (p, d) => lambda(p) / d;
  const regime = Kn => (Kn < 0.01 ? 'viscous' : Kn > 1 ? 'molecular' : 'transition');
  const rangeName = p => RANGES.find(([lo, hi]) => p >= lo && p < hi)[2];
  const monolayer = p => 2.5e-4 / p;                  // s
  /** Pipe conductance (L/s) at mean pressure p (Pa); Knudsen formula with an entrance correction for the molecular part. */
  function conductance(d, l, p) {
    const pm = p / 100;                               // mbar
    return 135 * d ** 4 * pm / l + 12.1 * d ** 3 / (l + 4 * d / 3) * (1 + 192 * d * pm) / (1 + 237 * d * pm);
  }
  const molecularConductance = (d, l) => 12.1 * d ** 3 / (l + 4 * d / 3);
  const sEff = (S, C) => S * C / (S + C);
  /** Wall area (cm²) of a cube-shaped chamber of volume V (L). */
  const area = V => 6 * (V * 1000) ** (2 / 3);
  /** Gas load (Pa·L/s) at time t (s) from the start of the high-vacuum stage. */
  function gasLoad(mat, V, t) {
    const m = MAT[mat], tt = t + T_ROUGH;
    return m.q1h * (m.alpha ? (3600 / tt) ** m.alpha : 1) * area(V) * 100;   // mbar·L/s → Pa·L/s
  }
  /** Pump-down from P0: returns samples [{t, p, Seff, Q}] on a log time grid up to tmax. */
  function pumpDown(o, tmax = 3.6e5) {
    const out = [];
    let p = P0, t = 0;
    const N = 500, t1 = 0.01;
    for (let i = 0; i <= N; i++) {
      const tn = i === 0 ? 0 : t1 * (tmax / t1) ** ((i - 1) / (N - 1));
      const dt = tn - t;
      if (dt > 0) {
        // exact solution over the step with S_eff and Q taken at the start of the step
        const C = conductance(o.d, o.l, p), S = sEff(o.S, C), Q = gasLoad(o.mat, o.V, t), pInf = Q / S;
        p = pInf + (p - pInf) * Math.exp(-S * dt / o.V);
        t = tn;
      }
      const C = conductance(o.d, o.l, p), S = sEff(o.S, C);
      out.push({ t, p, Seff: S, C, Q: gasLoad(o.mat, o.V, t) });
    }
    return out;
  }
  /** Interpolated pressure at time t from the samples (log–log). */
  function pAt(curve, t) {
    if (t <= curve[1].t) return curve[0].p + (curve[1].p - curve[0].p) * t / curve[1].t;
    let i = 1; while (i < curve.length - 1 && curve[i + 1].t < t) i++;
    const a = curve[i], b = curve[i + 1] || a;
    if (b === a) return a.p;
    const u = Math.log(t / a.t) / Math.log(b.t / a.t);
    return Math.exp(Math.log(a.p) + u * Math.log(b.p / a.p));
  }
  /** First time the curve reaches p ≤ target (s), or Infinity. */
  function timeTo(curve, target) {
    for (let i = 1; i < curve.length; i++) if (curve[i].p <= target) {
      const a = curve[i - 1], b = curve[i];
      if (a.t === 0) return b.t;
      const u = Math.log(target / a.p) / Math.log(b.p / a.p);
      return Math.exp(Math.log(a.t) + u * Math.log(b.t / a.t));
    }
    return Infinity;
  }
  return { LP, MAT, RANGES, T_ROUGH, P0, lambda, knudsen, regime, rangeName, monolayer, conductance, molecularConductance, sEff, area, gasLoad, pumpDown, pAt, timeTo };
}));
