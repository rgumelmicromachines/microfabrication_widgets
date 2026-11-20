/* Physics model – dopant segregation (Scheil equation). Pure functions, usable in the browser and in Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_SEG = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /** Equilibrium segregation coefficients k0 = Cs/CL at the melting point of Si (Trumbore 1960; Plummer, Deal & Griffin 2000, ch. 3). */
  const K_SEG = { B: 0.8, P: 0.35, As: 0.3, Sb: 0.023 };
  const NAMES = { B: 'boron', P: 'phosphorus', As: 'arsenic', Sb: 'antimony' };
  /** Melt concentration C_L/C0 after a fraction f has solidified (perfect mixing, no evaporation). */
  const CL = (k, f) => (1 - f) ** (k - 1);
  /** Concentration in the crystal at the interface, Cs/C0 = k (1 - f)^(k - 1). */
  const CS = (k, f) => k * CL(k, f);
  return { K_SEG, NAMES, CL, CS };
}));
