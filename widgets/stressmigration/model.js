/* Physics model – stress migration (stress-induced voiding) of an interconnect line stored without current.
   Pure functions, usable in the browser and in Node tests. Units: °C, eV.

   Creep model of J. W. McPherson and C. F. Dunn (J. Vac. Sci. Technol. B 5 (1987) 1321): a metal line confined by
   its dielectric is under tensile stress below the stress-free temperature T₀, because it wants to shrink more
   than its surroundings. The stress σ ∝ (T₀ − T) drives vacancies to grain boundaries, where voids grow at the rate
     R(T) = C·(T₀ − T)^N·exp(−E_a/kT)             → time to failure  TTF ∝ 1/R = C₀·(T₀ − T)^(−N)·exp(E_a/kT)
   N: creep (stress) exponent, E_a: activation energy of the diffusion that feeds the voids.
   The two factors pull in opposite directions – the stress falls and the diffusion rises with temperature – so the
   rate has a maximum where d ln R/dT = 0:   N/(T₀ − T) = E_a/(k·T²)   (T in kelvin).
   Apparent activation energy at a temperature T:  E_eff = −d ln R/d(1/kT) = E_a − N·k·T²/(T₀ − T); it is zero at the
   maximum and negative above it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_SM = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const K_EV = 8.617333e-5;                               // eV/K (CODATA 2018)
  const kelvin = TC => TC + 273.15;
  /* Fitted parameters of the two studies the model comes from. They describe those structures, not the metals as such.
     cu:   via on a wide Cu damascene lead – E. T. Ogawa et al., Proc. IEEE Int. Reliability Physics Symp. 2002, p. 312:
           N = 3.2, Q = 0.74 eV, T₀ ≈ 270 °C, maximum rate at ≈ 190 °C.
     alsi: 3 µm wide Al–Si(1 %) lines – McPherson & Dunn 1987, values as quoted by Ogawa et al. 2002:
           N = 2.33, Q = 0.58 eV, T₀ = 232 °C. */
  const PRESETS = {
    cu: { name: 'Cu damascene, via on a wide lead', short: 'copper', T0: 270, N: 3.2, Ea: 0.74, mat: 'gold' },
    alsi: { name: 'Al–Si(1 %) lines, 3 µm wide', short: 'Al–Si', T0: 232, N: 2.33, Ea: 0.58, mat: 'metal' },
  };

  /** Voiding rate in arbitrary units (C = 1, temperatures in kelvin inside); 0 at and above T₀. */
  const rate = (TC, T0, N, Ea) => (TC >= T0 ? 0 : (T0 - TC) ** N * Math.exp(-Ea / (K_EV * kelvin(TC))));
  /** Stress factor (T₀ − T)^N and diffusion factor exp(−E_a/kT) separately. */
  const stressTerm = (TC, T0, N) => (TC >= T0 ? 0 : (T0 - TC) ** N);
  const diffusionTerm = (TC, Ea) => Math.exp(-Ea / (K_EV * kelvin(TC)));
  /** Temperature (°C) of the maximum rate: root of N·k·T² = E_a·(T₀ − T) in kelvin (the positive root of a quadratic). */
  function peak(T0, N, Ea) {
    const a = N * K_EV, T0K = kelvin(T0);
    return (-Ea + Math.sqrt(Ea * Ea + 4 * a * Ea * T0K)) / (2 * a) - 273.15;
  }
  /** Apparent activation energy (eV) at T. */
  const eaEff = (TC, T0, N, Ea) => Ea - N * K_EV * kelvin(TC) ** 2 / (T0 - TC);
  /** Ratio of the times to failure at two temperatures: TTF(T_a)/TTF(T_b) = R(T_b)/R(T_a). */
  const lifeRatio = (Ta, Tb, T0, N, Ea) => rate(Tb, T0, N, Ea) / rate(Ta, T0, N, Ea);

  /** Everything the page shows. o: { T0, N, Ea, Tuse, Ttest } */
  function evaluate(o) {
    const Tp = peak(o.T0, o.N, o.Ea), Rp = rate(Tp, o.T0, o.N, o.Ea);
    const rel = T => rate(T, o.T0, o.N, o.Ea) / Rp;
    return { Tp, Rp, relUse: rel(o.Tuse), relTest: rel(o.Ttest), AF: lifeRatio(o.Tuse, o.Ttest, o.T0, o.N, o.Ea),
      eUse: eaEff(o.Tuse, o.T0, o.N, o.Ea), eTest: eaEff(o.Ttest, o.T0, o.N, o.Ea), rel };
  }
  return { K_EV, PRESETS, rate, stressTerm, diffusionTerm, peak, eaEff, lifeRatio, evaluate };
}));
