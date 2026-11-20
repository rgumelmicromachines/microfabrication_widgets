/* Physics model – CVD / epitaxial growth rate in the Grove model (two fluxes in series).
   Usable in the browser and in Node tests. Units: T in °C, h_G and k_s in cm/s, concentrations in cm⁻³,
   growth rate in µm/min (the unit of Grove's figure).

   F₁ = h_G (C_G − C_S)      transport of the precursor through the stagnant boundary layer, h_G = D_G/δ
   F₂ = k_S C_S              first-order surface reaction, k_S = k₀ exp(−E_a/kT)
   steady state F₁ = F₂  →   C_S = C_G / (1 + k_S/h_G),   V = F/N₁ = k_S h_G/(k_S + h_G) · C_T Y / N₁

   Source: A. S. Grove, Physics and Technology of Semiconductor Devices, Wiley 1967, ch. 1 (SiCl₄ epitaxy,
   k_S = 1×10⁷ cm/s · exp(−1.9 eV/kT), growth-rate figure for h_G = 1, 5, 10 cm/s and ∞ at Y = 0.005).
   C_T, the number density of gas molecules, is the ideal-gas value p/kT at the substrate temperature and 1 atm;
   with it the model reproduces Grove's figure (see tests/verify.js). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_CVD = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const K_EV = 8.617333262e-5;          // Boltzmann constant, eV/K (CODATA 2018)
  const K_SI = 1.380649e-23;            // Boltzmann constant, J/K (exact)
  const P_ATM = 101325;                 // Pa
  const KS0 = 1e7;                      // cm/s   (Grove 1967)
  const EA = 1.9;                       // eV     (Grove 1967)
  const N1 = 5e22;                      // Si atoms per cm³ in the film (atomic density of Si)
  const UM_PER_MIN = 1e4 * 60;          // cm/s → µm/min

  const kelvin = TC => TC + 273.15;
  /** Surface reaction rate constant (cm/s). */
  const ks = TC => KS0 * Math.exp(-EA / (K_EV * kelvin(TC)));
  /** Total gas number density at pressure p (Pa), ideal gas at the substrate temperature (cm⁻³). */
  const CT = (TC, p = P_ATM) => p / (K_SI * kelvin(TC)) * 1e-6;
  /** Temperature (°C) at which k_S = h_G – the boundary between the two regimes. */
  const Tstar = hG => EA / (K_EV * Math.log(KS0 / hG)) - 273.15;

  /** Growth state. o: { T (°C), hG (cm/s, Infinity allowed), Y (mole fraction) }. */
  function growth(o) {
    const k = ks(o.T), CG = CT(o.T) * o.Y;
    const hk = isFinite(o.hG) ? k * o.hG / (k + o.hG) : k;           // series combination of the two "conductances"
    const CS = isFinite(o.hG) ? CG / (1 + k / o.hG) : CG;
    const F = hk * CG;                                                // flux of precursor molecules, cm⁻² s⁻¹
    return {
      ks: k, CT: CT(o.T), CG, CS, F,
      V: F / N1 * UM_PER_MIN,                                         // µm/min
      Vreact: k * CG / N1 * UM_PER_MIN,                               // reaction limit (h_G → ∞)
      Vtrans: isFinite(o.hG) ? o.hG * CG / N1 * UM_PER_MIN : Infinity, // transport limit (k_S → ∞)
      ratio: isFinite(o.hG) ? k / o.hG : 0,                           // k_S / h_G
      Tstar: isFinite(o.hG) ? Tstar(o.hG) : Infinity,
    };
  }
  /** Growth rate only (µm/min). */
  const rate = (T, hG, Y) => growth({ T, hG, Y }).V;

  return { K_EV, KS0, EA, N1, P_ATM, UM_PER_MIN, ks, CT, Tstar, growth, rate };
}));
