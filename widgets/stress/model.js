/* Physics model – thin-film stress and wafer bow (Stoney equation, thermal-mismatch stress).
   Usable in the browser and in Node tests. Stress in MPa (tension positive), thicknesses in µm, temperatures in °C.

   Total film stress  σ = σ_int + σ_th,   σ_th = E_f/(1−ν_f) · ∫_{T_dep}^{T} (α_s − α_f) dT'
     (M. Ohring, The Materials Science of Thin Films, Academic Press 1992, eq. 9-17: σ_th = (α_s − α_f)·ΔT·E_f/(1−ν_f)
     with ΔT = T − T_dep; written here as an integral because α_Si depends on temperature)
   Stoney:  1/R = 6·σ·h_f·(1−ν_s) / (E_s·h_s²)   (G. G. Stoney, Proc. R. Soc. Lond. A 82 (1909) 172; biaxial form:
     Ohring eq. 9-13), valid for h_f ≪ h_s and small deflections.
   Bow (sagitta) over a wafer of radius r:  δ = r²/(2R)  (Ohring p. 420). A tensile film makes its side concave.

   Si(100): biaxial modulus E/(1−ν) = 1/(S₁₁ + S₁₂) = C₁₁ + C₁₂ − 2C₁₂²/C₁₁, the same for every in-plane direction
     (W. A. Brantley, J. Appl. Phys. 44 (1973) 534), with C₁₁ = 165.64 GPa, C₁₂ = 63.94 GPa (H. J. McSkimin & Hall data as
     reviewed by A. George, "Elastic constants and moduli of diamond cubic Si", EMIS Datareview, Properties of Crystalline
     Silicon, INSPEC 1999) → 180.2 GPa.
   α_Si(T) = (3.725·(1 − exp(−5.88×10⁻³·(T − 124))) + 5.548×10⁻⁴·T) × 10⁻⁶ /K, T in K, 120–1500 K
     (Y. Okada, Y. Tokumaru, J. Appl. Phys. 56 (1984) 314).
   Film data: see FILMS. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_STRESS = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const C11 = 165.64, C12 = 63.94;                                  // GPa
  const M_SI = C11 + C12 - 2 * C12 * C12 / C11;                     // biaxial modulus of Si(100), GPa
  const T_ROOM = 25;
  /* Wafer thickness by diameter (SEMI M1, polished Si wafers). */
  const WAFER = { 100: 525, 150: 675, 200: 725, 300: 775 };        // µm
  /* E (GPa), ν, α (10⁻⁶/K) and the measured stress used to set the default intrinsic stress.
     Bulk elastic data and α: Kaye & Laby, Tables of Physical and Chemical Constants, 16th ed. (1995), §2.2.2 and §2.3.5
     (thermal SiO₂: fused-quartz values as a proxy; nitride α: bulk ceramic as a proxy). Nitride E and ν: J. J. Vlassak,
     W. D. Nix, J. Mater. Res. 7 (1992) 3242 (LPCVD SiNₓ). Measured stresses: thermal SiO₂ −310 MPa after oxidation at
     1200 °C (R. J. Jaccodine, W. A. Schlegel, J. Appl. Phys. 37 (1966) 2429 – what thermal mismatch alone predicts, so
     σ_int = 0 is used); LPCVD Si₃N₄ at 750 °C ≈ +1 GPa (Ohring, Table 4-3); Si-rich low-stress SiNₓ at 850 °C ≈ +150 MPa
     (K. Sekimoto et al., Jpn. J. Appl. Phys. 20 (1981) L669; Vlassak & Nix: 120–150 MPa); evaporated metals: intrinsic
     stress from Ohring, Table 9-2 (Al −74, Cr +850, Au +260 MPa). */
  const FILMS = {
    sio2: { name: 'thermal SiO₂', E: 73.1, nu: 0.17, a: 0.49, Tdep: 1000, measured: null, sigInt: 0 },
    si3n4: { name: 'LPCVD Si₃N₄', E: 222, nu: 0.28, a: 2.5, Tdep: 750, measured: 1000 },
    lsn: { name: 'low-stress SiNₓ', E: 222, nu: 0.28, a: 2.5, Tdep: 850, measured: 150 },
    al: { name: 'evaporated Al', E: 70.3, nu: 0.345, a: 23.1, Tdep: 25, measured: null, sigInt: -74 },
    cr: { name: 'evaporated Cr', E: 279.1, nu: 0.21, a: 4.9, Tdep: 25, measured: null, sigInt: 850 },
    au: { name: 'evaporated Au', E: 78.0, nu: 0.44, a: 14.2, Tdep: 25, measured: null, sigInt: 260 },
  };

  /** Thermal expansion coefficient of Si (1/K) at T in °C (Okada & Tokumaru 1984). */
  function alphaSi(TC) {
    const T = TC + 273.15;
    return (3.725 * (1 - Math.exp(-5.88e-3 * (T - 124))) + 5.548e-4 * T) * 1e-6;
  }
  /** ∫ α_Si dT from T1 to T2 (°C), Simpson's rule. */
  function intAlphaSi(T1, T2) {
    const n = 200, h = (T2 - T1) / n;
    let s = alphaSi(T1) + alphaSi(T2);
    for (let i = 1; i < n; i++) s += alphaSi(T1 + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  }
  const biax = f => f.E / (1 - f.nu);                                 // GPa
  /** Thermal-mismatch stress (MPa) at temperature T for a film deposited stress-free (thermally) at Tdep. */
  const thermalStress = (f, Tdep, T = T_ROOM) => biax(f) * 1e3 * (intAlphaSi(Tdep, T) - f.a * 1e-6 * (T - Tdep));
  /** Default intrinsic stress (MPa): measured total minus the thermal part, or the tabulated intrinsic value. */
  const defaultIntrinsic = key => { const f = FILMS[key]; return f.measured === null ? f.sigInt : f.measured - thermalStress(f, f.Tdep); };
  /** Stoney: curvature (1/m) for stress σ (MPa), film thickness hf (µm), wafer thickness hs (µm). */
  const curvature = (sigma, hf, hs) => 6 * sigma * 1e6 * hf * 1e-6 / (M_SI * 1e9 * (hs * 1e-6) ** 2);
  /** Inverse Stoney: stress (MPa) from a measured curvature change (1/m). */
  const stressFrom = (kappa, hf, hs) => kappa * M_SI * 1e9 * (hs * 1e-6) ** 2 / (6 * hf * 1e-6) / 1e6;
  /** Bow (µm) of a wafer of diameter D (mm) with curvature κ (1/m): δ = r²κ/2. */
  const bow = (kappa, Dmm) => ((Dmm / 2) * 1e-3) ** 2 * kappa / 2 * 1e6;

  function state(o) {
    const f = FILMS[o.film], hs = WAFER[o.D];
    const sigTh = thermalStress(f, o.Tdep), sig = o.sigI + sigTh;
    const k = curvature(sig, o.hf, hs);
    return { f, hs, sigTh, sig, kappa: k, R: k !== 0 ? 1 / k : Infinity, bow: bow(k, +o.D), F: sig * o.hf,      // N/m (MPa·µm = N/m)
      Mf: biax(f), aMean: o.Tdep !== T_ROOM ? intAlphaSi(o.Tdep, T_ROOM) / (T_ROOM - o.Tdep) : alphaSi(T_ROOM) };
  }

  return { C11, C12, M_SI, T_ROOM, WAFER, FILMS, alphaSi, intAlphaSi, biax, thermalStress, defaultIntrinsic, curvature, stressFrom, bow, state };
}));
