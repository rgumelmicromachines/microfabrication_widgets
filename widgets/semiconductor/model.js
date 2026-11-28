/* Physics model – carriers in silicon and the abrupt pn junction (depletion approximation).
   Usable in the browser and in Node tests. Concentrations in cm⁻³, lengths in µm, energies in eV, T in K.

   Intrinsic density: n_i = 5.29×10¹⁹·(T/300)^2.54·exp(−6726/T) cm⁻³ – fit of K. Misiakos, D. Tsamakis,
     J. Appl. Phys. 74 (1993) 3293 (measured 78–340 K, 9.7×10⁹ cm⁻³ at 300 K; above 340 K an extrapolation, within
     ~3 % of R. Couderc et al., J. Appl. Phys. 115 (2014) 093705 up to 700 K). Accepted 300 K value 9.65×10⁹ cm⁻³
     (P. P. Altermatt et al., J. Appl. Phys. 93 (2003) 1598).
   Band gap: E_g(T) = 1.1692 − 4.9×10⁻⁴·T²/(T + 655) eV (Varshni form; K. Alex, F. Finkbeiner, J. Weber,
     J. Appl. Phys. 79 (1996) 6943) – used only to draw the band diagram.
   Permittivity: ε_r = 11.7 (W. C. Dunlap, R. L. Watters, Phys. Rev. 92 (1953) 1396).
   Full ionisation, Boltzmann statistics (non-degenerate, N ≲ 10¹⁸ cm⁻³), E_i drawn at mid-gap.
     n = (N_D − N_A)/2 + √(((N_D − N_A)/2)² + n_i²),  p = n_i²/n,  E_F − E_i = kT·ln(n/n_i)
   Abrupt junction, depletion approximation (S. M. Sze, K. K. Ng, Physics of Semiconductor Devices, 3rd ed., Wiley
   2007, ch. 2; R. F. Pierret, Semiconductor Device Fundamentals, Addison-Wesley 1996, ch. 5):
     V_bi = (kT/q)·ln(N_A N_D/n_i²),  W = √(2 ε_s (V_bi − V)(N_A + N_D)/(q N_A N_D))
     x_n = W·N_A/(N_A + N_D),  x_p = W·N_D/(N_A + N_D),  E_max = 2(V_bi − V)/W,  C_j = ε_s/W
   Avalanche breakdown of a one-sided abrupt junction (lightly doped side N_B), two approximations that differ by
   ~15 %: V_B ≈ 60·(E_g/1.1)^1.5·(N_B/10¹⁶)^(−3/4) V (universal fit to S. M. Sze, G. Gibbons, Appl. Phys. Lett.
   8 (1966) 111, as given by Sze & Ng) and V_B ≈ 5.34×10¹³·N_B^(−3/4) V (B. J. Baliga, Fundamentals of Power
   Semiconductor Devices, Springer 2008, ch. 3). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_SEMI = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const Q = 1.602176634e-19;            // C (exact)
  const K_EV = 8.617333262e-5;          // eV/K (CODATA 2018)
  const EPS0 = 8.8541878128e-14;        // F/cm (CODATA 2018)
  const EPS_R = 11.7;
  const EPS_S = EPS_R * EPS0;           // F/cm

  const kT = T => K_EV * T;
  const ni = T => 5.29e19 * (T / 300) ** 2.54 * Math.exp(-6726 / T);
  const Eg = T => 1.1692 - 4.9e-4 * T * T / (T + 655);

  /** Electron and hole densities for net doping N_D − N_A (full ionisation); E_F − E_i in eV. */
  function carriers(ND, NA, T) {
    const n_i = ni(T), h = (ND - NA) / 2;
    const n = h >= 0 ? h + Math.sqrt(h * h + n_i * n_i) : n_i * n_i / (-h + Math.sqrt(h * h + n_i * n_i));   // no cancellation
    return { n, p: n_i * n_i / n, ni: n_i, EFi: kT(T) * Math.log(n / n_i) };
  }
  /** Abrupt pn junction: N_A on the p side, N_D on the n side, applied voltage V (forward positive). */
  function junction(NA, ND, V, T) {
    // V_bi = (kT/q)·ln(n_n·p_p/n_i²): equal to (kT/q)·ln(N_A·N_D/n_i²) while N ≫ n_i, and it goes to zero (never
    // negative) when n_i reaches the doping
    const n_i = ni(T), Vbi = carriers(ND, 0, T).EFi - carriers(0, NA, T).EFi;
    const Vj = Math.max(Vbi - V, 1e-4);                                              // depletion approximation needs V < V_bi
    const Wcm = Math.sqrt(2 * EPS_S * Vj * (NA + ND) / (Q * NA * ND));
    const xn = Wcm * NA / (NA + ND), xp = Wcm * ND / (NA + ND);
    const NB = Math.min(NA, ND), g = Eg(300);
    return { ni: n_i, Vbi, Vj, W: Wcm * 1e4, xn: xn * 1e4, xp: xp * 1e4, Emax: 2 * Vj / Wcm,                 // V/cm
      Cj: EPS_S / Wcm, valid: V < Vbi - 4 * kT(T),                                                             // F/cm²
      VB: [5.34e13 * NB ** -0.75, 60 * (g / 1.1) ** 1.5 * (NB / 1e16) ** -0.75] };                             // V, [Baliga, Sze]
  }
  return { Q, K_EV, EPS0, EPS_R, EPS_S, kT, ni, Eg, carriers, junction };
}));
