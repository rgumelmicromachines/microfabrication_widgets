/* Physics model – ion implantation: Gaussian as-implanted profile, junction depth, masking, beam time.
   Usable in the browser and in Node tests. Depths in nm, concentrations in cm⁻³, dose in cm⁻².

   N(x) = Q/(√(2π)·ΔRp) · exp(−(x − Rp)²/(2ΔRp²)),   peak N_p = Q/(√(2π)·ΔRp) ≈ 0.4·Q/ΔRp
   junction(s) where N(x) = N_B:  x_j = Rp ± ΔRp·√(2·ln(N_p/N_B))
   mask of thickness d: dose that passes = Q·½·erfc((d − Rp,m)/(√2·ΔRp,m)); concentration that reaches the
   mask/Si interface N_m(d) = Q/(√(2π)ΔRp,m)·exp(−(d − Rp,m)²/2ΔRp,m²); the mask is sufficient when N_m(d) ≤ N_B,
   i.e. d ≥ Rp,m + ΔRp,m·√(2·ln(N_p,m/N_B)). (If d < Rp,m the peak itself lands in the Si.)
   Source of the equations: J. D. Plummer, M. D. Deal, P. B. Griffin, Silicon VLSI Technology, Prentice Hall 2000,
   ch. 8 (eqs. for the Gaussian profile, peak concentration and masking).
   Range data (Rp, ΔRp): see RANGE below. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_IMPL = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const Q_E = 1.602176634e-19;          // elementary charge, C (exact, SI 2019)
  const SQ2PI = Math.sqrt(2 * Math.PI);

  /* Projected range Rp and straggle ΔRp in nm vs energy in keV, amorphous targets, all from SRIM-2013
     (J. F. Ziegler, M. D. Ziegler, J. P. Biersack, Nucl. Instrum. Methods B 268 (2010) 1818).
     Si: SRIM-2013 tables as published in S. M. Ben Saleh, H. M. Albangahzi, S. M. Alarabi, Academy J. Basic Appl. Sci.
       7(2) (2025) 1, Tables 2 (B), 3 (As), 5 (P); B and As identical to raw SRIM-2013 output; B 30 keV and As 30 keV
       from the raw output.
     SiO₂ and photoresist (AZ-111): read from the SRIM-2013 range graphs of Coherent Corp., "Ion Implantation –
       Projected Range Statistics" (datasheet, 2022), pp. 3 and 5 (read-off accuracy ≈ ±2 nm in Rp, ±0.5 nm in ΔRp;
       10 keV points ±10 %). */
  const T = (E, Rp, dRp) => ({ Rp: E.map((e, i) => [e, Rp[i]]), dRp: E.map((e, i) => [e, dRp[i]]) });
  const E8 = [10, 20, 30, 50, 80, 100, 150, 200], E7 = [10, 20, 50, 80, 100, 150, 200], E7b = [20, 30, 50, 80, 100, 150, 200];
  const RANGE = {
    B: {
      Si: T(E8, [40.0, 77.1, 112.2, 174.6, 261.8, 318.0, 451.9, 574.9], [23.1, 37.9, 49.0, 64.2, 80.2, 88.6, 105.0, 116.9]),
      sio2: T(E8, [39, 78, 116, 188, 286, 349, 497, 630], [21, 34, 45, 62.5, 79, 88, 106, 118]),
      resist: T(E8, [70, 136, 201, 316, 470, 569, 802, 1019], [23, 39, 49.5, 66, 82, 90, 106, 117.5]),
    },
    P: {
      Si: T(E7, [16.9, 30.0, 69.0, 108.4, 134.2, 197.9, 261.2], [8.3, 13.6, 27.7, 39.9, 47.0, 62.6, 76.1]),
      sio2: T(E8, [16.5, 25, 40, 67, 107, 133, 201, 269], [5.7, 11.0, 15.6, 23.7, 34, 41, 56, 70]),
      resist: T(E8, [29, 53, 76, 123, 193, 241, 359, 473], [9.6, 14, 19.5, 28.5, 41, 49, 65, 78.5]),
    },
    As: {
      Si: T(E8, [12.4, 19.6, 26.2, 38.8, 57.1, 69.2, 99.7, 130.3], [4.7, 6.9, 8.9, 12.4, 17.4, 20.6, 28.2, 35.5]),
      sio2: T(E7b, [17.5, 23, 37.6, 53, 65, 95, 125], [5.6, 6.9, 10.0, 14.2, 16.8, 23.4, 29.5]),   // 10 keV not readable: extrapolated
      resist: T(E8, [23, 39, 51.5, 73, 110, 131, 188, 246], [5.5, 8.3, 10.2, 14.2, 20, 23.5, 32, 40]),
    },
  };

  /** erfc with |error| < 1.2e-7 (Numerical Recipes, Chebyshev fit). */
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  /** Log–log interpolation of a table [[E, value], …]; outside the table: log–log extrapolation from the two end
      points (used only for As in SiO₂ below 20 keV). */
  function interp(tab, E) {
    let i = 1;
    if (E >= tab[tab.length - 1][0]) i = tab.length - 1;
    else if (E > tab[0][0]) while (tab[i][0] < E) i++;
    const [e0, v0] = tab[i - 1], [e1, v1] = tab[i];
    const u = Math.log(E / e0) / Math.log(e1 / e0);
    return Math.exp(Math.log(v0) + u * Math.log(v1 / v0));
  }
  /** { Rp, dRp } in nm for an ion in a target at energy E (keV). */
  function range(ion, target, E) {
    const t = RANGE[ion] && RANGE[ion][target];
    if (!t) return null;
    return { Rp: interp(t.Rp, E), dRp: interp(t.dRp, E) };
  }
  /** Gaussian concentration (cm⁻³) at depth x (nm). */
  const gauss = (x, Q, Rp, dRp) => Q / (SQ2PI * dRp * 1e-7) * Math.exp(-((x - Rp) ** 2) / (2 * dRp * dRp));
  const peak = (Q, dRp) => Q / (SQ2PI * dRp * 1e-7);
  /** Depths (nm) where the Gaussian equals NB: [shallow, deep]; shallow is null when the profile at the surface is
      already above NB (no buried junction), both null when the peak is below NB. */
  function junctions(Q, Rp, dRp, NB) {
    const Np = peak(Q, dRp);
    if (Np <= NB) return [null, null];
    const w = dRp * Math.sqrt(2 * Math.log(Np / NB));
    return [Rp - w > 0 ? Rp - w : null, Rp + w];
  }
  /** Mask: fraction of the dose that passes a layer of thickness d (nm), concentration reaching the interface,
      and the thickness needed so that it stays below NB. */
  function mask(Q, rm, d, NB) {
    const pass = 0.5 * erfc((d - rm.Rp) / (Math.SQRT2 * rm.dRp));
    const atInterface = gauss(d, Q, rm.Rp, rm.dRp);
    const Np = peak(Q, rm.dRp);
    // peak already below NB: nothing can exceed NB in the Si, no mask is needed
    const need = Np > NB ? rm.Rp + rm.dRp * Math.sqrt(2 * Math.log(Np / NB)) : 0;
    // highest concentration that reaches the Si: at the interface when the peak lies inside the mask, otherwise the
    // peak itself (the ions overshoot the mask)
    const inSi = d >= rm.Rp ? atInterface : Np;
    return { pass, atInterface, inSi, need, ok: inSi <= NB };
  }
  /** Implant time (s) for dose Q (cm⁻²) on area A (cm²) with beam current I (A) of ions of charge state n. */
  const beamTime = (Q, A, I, n = 1) => Q * n * Q_E * A / I;

  return { Q_E, RANGE, erfc, interp, range, gauss, peak, junctions, mask, beamTime };
}));
