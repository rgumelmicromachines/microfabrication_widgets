/* Physics regression checks for the MFW widgets.  Run:  node tests/verify.js
   Every check compares a model against an independent value (closed-form result, textbook number,
   published chart) with a stated tolerance. Exit code 1 if any check fails. */
'use strict';
const path = require('path');
const W = n => require(path.join(__dirname, '..', 'widgets', n, 'model.js'));
const SEG = W('segregation'), OX = W('oxidation'), DF = W('diffusion'), LI = W('lithography'), ET = W('etching');

let fails = 0, n = 0;
function check(name, got, want, relTol, absTol = 0) {
  n++;
  const ok = Math.abs(got - want) <= Math.max(relTol * Math.abs(want), absTol);
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}: got ${fmtN(got)}, expected ${fmtN(want)} (±${relTol ? (relTol * 100).toFixed(0) + ' %' : absTol})`);
}
const fmtN = v => (typeof v === 'number' ? (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(3) : v.toPrecision(4)) : String(v));
function section(s) { console.log(`\n== ${s}`); }

// ------------------------------------------------------------------ segregation
section('Segregation (Scheil equation)');
check('tail/seed ratio, P, f = 0.9', SEG.CL(0.35, 0.9), 0.1 ** -0.65, 1e-12);
check('dopant left in melt, P, f = 0.9  [(1−f)^k]', (1 - 0.9) * SEG.CL(0.35, 0.9), 0.4467, 1e-3);
// mass balance: ∫0^f Cs df' + (1−f) CL = 1 (C0 = 1)
{ let s = 0; const N = 20000, f = 0.9, k = 0.023; for (let i = 0; i < N; i++) s += SEG.CS(k, (i + 0.5) / N * f) * f / N; check('mass balance Sb, f = 0.9', s + (1 - f) * SEG.CL(k, f), 1, 1e-4); }
check('task: P within +20 % up to f', 1 - 1.2 ** (1 / (0.35 - 1)), 0.2446, 2e-3);
check('task: B within +20 % up to f', 1 - 1.2 ** (1 / (0.8 - 1)), 0.598, 2e-3);
check('task: B at f = 0.9 from 1e15', 1e15 * SEG.CL(0.8, 0.9), 1.585e15, 2e-3);

// ------------------------------------------------------------------ oxidation
section('Oxidation (Deal–Grove) vs EPFL CMI furnace charts (Si(100); read by eye, ±15 %)');
const ox = (amb, T, ori, t, x0 = 0) => { const r = OX.rates(amb, T, ori); return OX.thickness(r, t, OX.tauOf(r, OX.startThickness(amb, x0))) * 1000; };
check('dry 1000 °C 1 h (nm)', ox('dry', 1000, '100', 1), 54, 0.15);
check('dry 1000 °C 3 h (nm)', ox('dry', 1000, '100', 3), 110, 0.15);
check('dry 1050 °C 1 h (nm)', ox('dry', 1050, '100', 1), 90, 0.15);
check('wet 1000 °C 1 h (nm)', ox('wet', 1000, '100', 1), 385, 0.15);
check('wet 900 °C 1 h (nm)', ox('wet', 900, '100', 1), 150, 0.15);
check('wet 1000 °C 4 h (nm)', ox('wet', 1000, '100', 4), 930, 0.15);
console.log('note  dry 900 °C 1 h: model', ox('dry', 900, '100', 1).toFixed(0), 'nm vs chart ≈ 20 nm – known overestimate of the 25 nm convention (documented on the page)');
section('Oxidation – internal consistency and page answers');
{ const r = OX.rates('wet', 1100, '100'); const t = OX.timeTo(r, 0.5, 0); check('timeTo inverts thickness', OX.thickness(r, t, 0), 0.5, 1e-9);
  check('page task 1: wet 1100 °C 500 nm (min)', t * 60, 38.7, 0.01);
  check('page task 1: B (µm²/h)', r.B, 0.529, 0.005); check('page task 1: B/A (µm/h)', r.BA, 2.90, 0.005); check('page task 1: A (µm)', r.A, 0.182, 0.01); }
{ const r = OX.rates('dry', 1000, '100'); const tau0 = OX.tauOf(r, 0.025), tau1 = OX.tauOf(r, 0.1);
  check('page task 2: τ(25 nm) (h)', tau0, 0.62, 0.01); check('page task 2: bare → 100 nm (h)', OX.timeTo(r, 0.1, tau0), 2.58, 0.01);
  check('page task 2: τ(100 nm) (h)', tau1, 3.20, 0.01); check('page task 2: 100 → 200 nm (h)', OX.timeTo(r, 0.2, tau1), 5.13, 0.01); }
check('(111)/(100) linear-rate ratio', OX.rates('dry', 1000, '111').BA / OX.rates('dry', 1000, '100').BA, 1.68, 1e-9);
check('wet/dry B ratio at 1000 °C (tour says ~30)', OX.rates('wet', 1000, '100').B / OX.rates('dry', 1000, '100').B, 30, 0.05);
check('n(SiO2) at 550 nm (Malitson)', OX.nSiO2(550), 1.4599, 2e-4);
check('n(SiO2) at 400 nm (Malitson)', OX.nSiO2(400), 1.4701, 2e-4);
check('bare Si reflectance at 600 nm, ((n−1)²+k²)/((n+1)²+k²)', OX.reflectance(0, 600), ((3.94 - 1) ** 2 + 0.0199 ** 2) / ((3.94 + 1) ** 2 + 0.0199 ** 2), 1e-6);
// quarter-wave: reflectance minimum near d = λ/(4n) for λ = 600 nm
{ let best = 0, bv = 9; for (let d = 50; d < 150; d += 0.5) { const R = OX.reflectance(d, 600); if (R < bv) { bv = R; best = d; } } check('first reflectance minimum at 600 nm = λ/4n (nm)', best, 600 / (4 * OX.nSiO2(600)), 0.02); }
section('Oxide colour vs Pliskin–Conrad chart (hue family check)');
const hue = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return -1; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
const CHART = [[120, 'royal blue', 200, 240], [150, 'light blue', 195, 230], [200, 'light gold / yellow', 40, 75], [225, 'gold', 30, 55],
  [275, 'red-violet', 250, 300], [300, 'blue / violet-blue', 205, 245], [350, 'green / yellow-green', 140, 175], [390, 'yellow', 50, 75],
  [440, 'violet-red', 290, 330], [490, 'blue', 200, 235], [520, 'green', 150, 180]];
for (const [d, name, lo, hi] of CHART) { n++; const h = hue(OX.oxideRGB(d)); const ok = h >= lo && h <= hi; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${d} nm “${name}”: hue ${h.toFixed(0)}° (accepted ${lo}–${hi}°)`); }

// ------------------------------------------------------------------ diffusion
section('Diffusion');
check('D_B(1100 °C), Plummer (cm²/s)', DF.D('B', 1100), 1.43e-13, 0.02);
check('D_P(1100 °C), Plummer (cm²/s)', DF.D('P', 1100), 1.55e-13, 0.03);
check('D_As(1100 °C), Plummer (cm²/s)', DF.D('As', 1100), 2.1e-14, 0.05);
check('D_B vs Fair set at 1100 °C (should agree within 10 %)', DF.D('B', 1100), 0.037 * Math.exp(-3.46 / (8.617333e-5 * 1373.15)) + 0.72 * Math.exp(-3.46 / (8.617333e-5 * 1373.15)), 0.10);
check('n_i(300 K) order of magnitude', DF.ni(26.85), 1.0e10, 0.5);
check('n_i(1000 °C) (cm⁻³)', DF.ni(1000), 7.1e18, 0.05);
{ const Cs = 2e20, Dt = 0.01; let s = 0; const N = 40000, L = 2; for (let i = 0; i < N; i++) s += DF.predep((i + 0.5) / N * L, Cs, Dt) * L / N * 1e-4;
  check('erfc dose integral = 2Cs√(Dt/π)', s, DF.predepDose(Cs, Dt), 1e-4); }
{ const Cs = 2e20, Dt1 = 0.005, Dt2 = 0.2; let s = 0; const N = 4000, L = 4; for (let i = 0; i < N; i++) s += DF.driveIn((i + 0.5) / N * L, Cs, Dt1, Dt2) * L / N * 1e-4;
  check('drive-in conserves the dose', s, DF.predepDose(Cs, Dt1), 2e-3);
  const Q = DF.predepDose(Cs, Dt1);
  check('drive-in → Gaussian when Dt2 ≫ Dt1 (surface)', DF.driveIn(0, Cs, Dt1, Dt2), DF.gaussian(0, Q, Dt2), 0.03);
  check('drive-in → Gaussian when Dt2 ≫ Dt1 (x = 0.6 µm)', DF.driveIn(0.6, Cs, Dt1, Dt2), DF.gaussian(0.6, Q, Dt2), 0.05); }
for (const [ratioName, Dt1, Dt2] of [['~2e3', 1e-4, 0.23], ['~1e5', 1e-5, 1.1]]) {          // review E1: thin predeposit, long drive-in
  const Cs = 1e20, L = 10 * Math.sqrt(Dt2) + 0.5, N = 6000; let s = 0;
  for (let i = 0; i < N; i++) s += DF.driveIn((i + 0.5) / N * L, Cs, Dt1, Dt2) * L / N * 1e-4;
  check(`drive-in conserves the dose at D2t2/D1t1 ${ratioName}`, s, DF.predepDose(Cs, Dt1), 2e-3);
  check(`drive-in surface = Gaussian at D2t2/D1t1 ${ratioName}`, DF.driveIn(0, Cs, Dt1, Dt2), DF.gaussian(0, DF.predepDose(Cs, Dt1), Dt2), 5e-3);
}
{ const Cs = 1e20, Dt = 0.04, NB = 1e16; check('erfc junction depth formula', DF.crossing(x => DF.predep(x, Cs, Dt), NB, 5), 2 * Math.sqrt(Dt) * DF.erfcinv(NB / Cs), 1e-4); }
check('Arora μn(1e17) ≈ 777 (agent recomputation)', DF.mobility('n', 1e17), 777, 0.01);
check('Arora μp(1e19) ≈ 69', DF.mobility('p', 1e19), 69, 0.02);
// uniform-slab check of the sheet-resistance integral: Rs = 1/(q μ N x)
check('Rs of a uniform 1 µm, 1e18 p-layer', DF.sheetResistance(() => 1e18 + 1e15, 1e15, 1, 'p'), 1 / (1.602177e-19 * DF.mobility('p', 1e18 + 2e15) * 1e18 * 1e-4), 1e-3);
// page answers
const diffCase = (dop, NB, T1, t1, T2, t2) => {
  const D1 = DF.D(dop, T1), D2 = DF.D(dop, T2), Dt1 = D1 * t1 * 60 * 1e8, Dt2 = D2 * t2 * 60 * 1e8, Cs = DF.solubility(dop, T1);
  const prof = x => DF.driveIn(x, Cs, Dt1, Dt2), xj = DF.crossing(prof, NB, 10);
  return { D1, D2, Dt1, Dt2, Cs, Q: DF.predepDose(Cs, Dt1), xj, xjPre: 2 * Math.sqrt(Dt1) * DF.erfcinv(NB / Cs), Rs: DF.sheetResistance(prof, NB, xj, dop === 'B' ? 'p' : 'n'),
    xjGauss: Math.sqrt(4 * Dt2 * Math.log(DF.predepDose(Cs, Dt1) / (NB * Math.sqrt(Math.PI * Dt2 * 1e-8)))) };
};
const tour = diffCase('B', 1e15, 950, 30, 1100, 60);
console.log('info  tour case B 950 °C/30 min + 1100 °C/60 min into 1e15:', JSON.stringify(Object.fromEntries(Object.entries(tour).map(([k, v]) => [k, +v.toPrecision(3)]))));
const pre = diffCase('B', 1e15, 950, 30, 1100, 0);
console.log('info  predep only:', JSON.stringify(Object.fromEntries(Object.entries(pre).map(([k, v]) => [k, +v.toPrecision(3)]))));
check('predep xj numeric = erfc formula', pre.xj, pre.xjPre, 1e-4);
check('tour: Gaussian xj ≈ exact xj (D2t2/D1t1 large)', tour.xjGauss, tour.xj, 0.03);

// ------------------------------------------------------------------ lithography
section('Lithography');
const img = o => { const p = 2 * o.hp, xs = []; for (let i = 0; i <= 360; i++) xs.push(-p + 2 * p * i / 360); const I = LI.aerialImage({ ...o, xs }); return { xs, I, max: Math.max(...I), min: Math.min(...I) }; };
{ const a = img({ mode: 'projection', lambda: 0.365, NA: 0.5, sigma: 0.5, defocus: 0, hp: 0.22 }); check('below cut-off: flat image I = c0² = 0.25 (max)', a.max, 0.25, 1e-9); check('below cut-off: flat image (min)', a.min, 0.25, 1e-9); }
{ const a = img({ mode: 'projection', lambda: 0.365, NA: 0.9, sigma: 0, defocus: 0, hp: 0.5 });
  // coherent, orders −1, 0, +1 pass (and ±2 = 0, ±3 needs NA ≥ 3λ/p = 1.095): I(0) = (0.5 + 2/π)²
  check('coherent 3-beam image at x = 0: (1/2 + 2/π)²', a.I[180], (0.5 + 2 / Math.PI) ** 2, 1e-9); check('coherent 3-beam image at line centre: (1/2 − 2/π)²', a.I[90], (0.5 - 2 / Math.PI) ** 2, 1e-9); }
{ const a = img({ mode: 'proximity', lambda: 0.365, gap: 0, resist: 0, collimation: 0, hp: 5 }); check('contact, z = 0: space intensity ≈ 1 (Gibbs ripple)', a.I[180], 1, 0.1); check('contact, z = 0: line intensity ≈ 0', a.min, 0, 0, 0.02); }
{ const o = { mode: 'projection', lambda: 0.193, NA: 0.85, sigma: 0.5, hp: 0.12 }; const d = z => { const a = img({ ...o, defocus: z }); return (a.max - a.min) / (a.max + a.min); };
  console.log('info  ArF NA0.85 hp120 contrast vs defocus:', [0, 0.05, 0.1, 0.13, 0.15, 0.2].map(z => `${z}: ${d(z).toFixed(2)}`).join(', '));
  check('defocus symmetry (scalar, no aberrations)', d(0.1), d(-0.1), 1e-9); }
{ const a = img({ mode: 'projection', lambda: 0.365, NA: 0.5, sigma: 0.5, defocus: 0, hp: 0.5 }); const cd = LI.clearedWidth(a.xs, a.I, 0.4); console.log('info  i-line NA0.5 hp0.5 cleared width at thr 0.4:', cd.toFixed(3), 'µm'); }
// tour-step claims (review E2, E3)
{ const a = img({ mode: 'projection', lambda: 0.193, NA: 0.85, sigma: 0.5, defocus: 0.2, hp: 0.12 }); n++; const cd = LI.clearedWidth(a.xs, a.I, 0.4); const ok = cd === 0; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  tour “Depth of focus”: nothing prints at 0.2 µm defocus, dose 2.5 (cleared width ${cd})`); }
{ const a = img({ mode: 'proximity', lambda: 0.365, gap: 20, resist: 1.4, collimation: 2, hp: 2 }); n++; const c = (a.max - a.min) / (a.max + a.min); const ok = c < 0.2; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  tour “Too large a gap”: contrast < 0.2 at s = 20 µm (got ${c.toFixed(2)})`); }
check('page task: proximity contact b_min (µm)', LI.proximityLimit(0.365, 0, 1.4), 0.76, 0.01);
check('page task: proximity 10 µm b_min (µm)', LI.proximityLimit(0.365, 10, 1.4), 2.96, 0.01);
check('page task: i-line NA0.5 σ0.5 min pitch (µm)', LI.minPitch(0.365, 0.5, 0.5), 0.487, 0.005);
check('DTU worked example: i-line, d = 2 µm, s = 0 → 0.91 µm', LI.proximityLimit(0.365, 0, 2), 0.91, 0.01);

// ------------------------------------------------------------------ etching
section('Etching');
check('{100}/{111} angle (deg)', ET.ANGLE * 180 / Math.PI, 54.7356, 1e-5);
{ const s0 = ET.etchState({ etch: 'koh', mask: 'si3n4', tm: 100, W: 100, t: 1, T: 80, rate: 2 });
  const s = ET.etchState({ etch: 'koh', mask: 'si3n4', tm: 100, W: 100, t: s0.tClose * 1.0001, T: 80, rate: 2 });
  check('V-groove depth = W′/√2 (W′ includes undercut)', s.depth, (100 / 2 + s.undercut) * Math.SQRT2, 1e-6);
  check('V-groove at closing ≈ W/√2 = 70.7 µm for W = 100 (+ {111} undercut with R100:R111 = 40)', s.depth, 70.7, 0.06);
  check('closing time consistent: R·t* = depth', s0.dClose, ET.etchState({ etch: 'koh', mask: 'si3n4', tm: 100, W: 100, t: s0.tClose, T: 80, rate: 2 }).depth, 1e-6);
  const late = ET.etchState({ etch: 'koh', mask: 'si3n4', tm: 100, W: 100, t: 480, T: 80, rate: 2 });
  console.log('info  after self-termination the {111} walls keep receding: depth at 8 h', late.depth.toFixed(1), 'µm'); }
{ const s = ET.etchState({ etch: 'koh', mask: 'si3n4', tm: 100, W: 100, t: 20, T: 80, rate: 2 }); check('bottom width = W′ − √2 d', 2 * s.bottom, 2 * s.top - Math.SQRT2 * s.depth, 1e-9); check('KOH 80 °C depth after 20 min (µm)', s.depth, 22, 1e-9); }
check('KOH rate 60 °C / 80 °C (Ea 0.59 eV)', ET.siRate('koh', 60, 0) / ET.siRate('koh', 80, 0), Math.exp(-0.59 / 8.617333e-5 * (1 / 333.15 - 1 / 353.15)), 1e-9);
console.log('info  tour: KOH 80→60 °C slow-down', (ET.siRate('koh', 80, 0) / ET.siRate('koh', 60, 0)).toFixed(2), '×');
{ const s = ET.etchState({ etch: 'koh', mask: 'sio2', tm: 500, W: 100, t: 90, T: 80, rate: 2 }); check('SiO2 500 nm in KOH lasts 500/7.7 min', s.tFail, 500 / 7.7, 1e-9); }
{ const s = ET.etchState({ etch: 'iso', mask: 'sio2', tm: 500, W: 100, t: 60, T: 25, rate: 2 }); check('isotropic: undercut = depth', s.undercut, s.depth, 1e-12); }
{ const s = ET.etchState({ etch: 'iso', mask: 'sio2', tm: 1000, W: 100, t: 60, T: 25, rate: 2 }); n++; const ok = s.tFail > 60; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  tour “Isotropic etching”: 1 µm SiO2 mask survives 60 min (lasts ${s.tFail.toFixed(0)} min)`); }
{ const s = ET.etchState({ etch: 'koh', mask: 'sio2', tm: 500, W: 100, t: 90, T: 80, rate: 2 }); n++; const ok = s.tFail < 90; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  tour “Mask selectivity”: 500 nm SiO2 fails before 90 min`); }
{ const s = ET.etchState({ etch: 'drie', mask: 'si3n4', tm: 2000, W: 50, t: 480, T: 20, rate: 15 });
  check('DRIE stops at the wafer back side (525 µm)', s.depth, 525, 1e-12); n++; const ok = s.through && Math.abs(s.tThrough - 35) < 1e-9; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  DRIE 15 µm/min etches through 525 µm after 35 min`); }
{ const s = ET.etchState({ etch: 'koh', mask: 'si3n4', tm: 100, W: 1000, t: 480, T: 95, rate: 2 });
  n++; const ok = s.through && s.depth === 525 && !s.closed && 2 * s.bottom > 0; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  KOH 95 °C, 1 mm window, 8 h: etched through, opening at the back ${(2 * s.bottom).toFixed(0)} µm`); }
{ const s = ET.etchState({ etch: 'koh', mask: 'si3n4', tm: 100, W: 100, t: 480, T: 95, rate: 2 });
  n++; const ok = !s.through && s.depth < 525; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  KOH 100 µm window self-terminates, never through`); }
check('page task: 360 µm at 1.1 µm/min (h)', 360 / ET.siRate('koh', 80, 0) / 60, 5.45, 0.01);
check('page task: oxide for 5.45 h (µm)', 360 / ET.siRate('koh', 80, 0) * 7.7 / 1000, 2.52, 0.01);

// ------------------------------------------------------------------ CVD (Grove model)
const CV = W('cvd');
section('CVD growth rate (Grove model) vs Grove 1967 figure (read by eye, ±8 %) and an illustrative parameter set (E_a 1.9 eV, h_G 2 cm/s, Y 1 %)');
{ const T = x => 1000 / x - 273.15, Y = 0.005;
  check('Grove 1967 fig.: h_G = 1 cm/s at 10³/T = 0.625 (µm/min)', CV.rate(T(0.625), 1, Y), 0.25, 0.08);
  check('Grove 1967 fig.: h_G = 5 cm/s at 0.625', CV.rate(T(0.625), 5, Y), 0.95, 0.08);
  check('Grove 1967 fig.: h_G = 10 cm/s at 0.625', CV.rate(T(0.625), 10, Y), 1.43, 0.08);
  check('Grove 1967 fig.: h_G = 1 cm/s at 0.70', CV.rate(T(0.70), 1, Y), 0.20, 0.08);
  check('Grove 1967 fig.: h_G → ∞ at 0.70', CV.rate(T(0.70), Infinity, Y), 0.61, 0.08);
  check('Grove 1967 fig.: h_G = 1 cm/s at 0.765', CV.rate(T(0.765), 1, Y), 0.11, 0.1); }
{ const a = CV.growth({ T: 1250, hG: 2, Y: 0.01 }), b = CV.growth({ T: 850, hG: 2, Y: 0.01 });
  check('illustrative set: combined rate at 1250 °C (µm/min)', a.V, 0.83, 0.05);
  check('illustrative set: transport limit at 1250 °C', a.Vtrans, 1.16, 0.05);
  check('illustrative set: reaction limit at 1250 °C', a.Vreact, 3.0, 0.05);
  check('illustrative set: rate at 850 °C', b.V, 0.023, 0.08);
  check('illustrative set: transport limit at 850 °C', b.Vtrans, 1.57, 0.05);
  check('illustrative set: limits cross near 1150 °C', CV.Tstar(2), 1150, 0.01); }
{ const g = CV.growth({ T: 1100, hG: 5, Y: 0.005 });
  check('steady state F₁ = F₂: h_G(C_G − C_S) = k_S·C_S', 5 * (g.CG - g.CS), g.ks * g.CS, 1e-12);
  check('series law 1/V = (1/k_S + 1/h_G)·N₁/(C_G) (µm/min)', g.V, 1 / (1 / g.ks + 1 / 5) * g.CG / CV.N1 * CV.UM_PER_MIN, 1e-12);
  const s = CV.growth({ T: CV.Tstar(5), hG: 5, Y: 0.005 });
  check('at T* the rate is half of either limit', s.V, s.Vreact / 2, 1e-9);
  check('page task 1: T* for h_G = 5 cm/s (°C)', CV.Tstar(5), 1247, 1e-3);
  check('page task 2: rate at 1100 °C, h_G 5, Y 0.5 % (µm/min)', g.V, 0.28, 0.01);
  check('page task 2: k_S at 1100 °C (cm/s)', g.ks, 1.06, 0.01);
  check('page task 2: 10 µm takes (min)', 10 / g.V, 36, 0.02);
  const d = Math.log(CV.rate(901, Infinity, 0.005) / CV.rate(899, Infinity, 0.005)) / 2;
  check('page task 3: d ln V/dT at 900 °C, reaction limit (1/K)', d, 0.0152, 0.01);
  check('page task 4: gain when h_G grows √2× at 1320 °C, h_G 2', CV.rate(1320, 2 * Math.SQRT2, 0.01) / CV.rate(1320, 2, 0.01), 1.32, 0.01);
  check('tour: Y doubles → rate doubles', CV.rate(1250, 10, 0.01) / CV.rate(1250, 10, 0.005), 2, 1e-12);
  check('tour step 3: k_S/h_G at 1320 °C, h_G 2', CV.growth({ T: 1320, hG: 2, Y: 0.01 }).ratio, 4.88, 0.01); }

// ------------------------------------------------------------------ spin coating
const SP = W('spincoating');
section('Spin coating (empirical spin curve t = k·p²/√w, t in Å)');
check('typical values: k 90, 20 %, 4000 rpm → 1.8 µm (within the quoted 1–2 µm)', SP.thickness(4000, 20, 90), 1.8, 1e-12);
check('20 % at 3000 rpm (µm)', SP.thickness(3000, 20, 90), 2.078, 1e-3);
check('20 % at 6000 rpm (µm)', SP.thickness(6000, 20, 90), 1.470, 1e-3);
check('double speed → 1/√2', SP.thickness(8000, 20) / SP.thickness(4000, 20), Math.SQRT1_2, 1e-12);
check('30 % vs 20 % solids → 2.25×', SP.thickness(4000, 30) / SP.thickness(4000, 20), 2.25, 1e-12);
check('speedFor inverts thickness', SP.thickness(SP.speedFor(1.5, 20, 90), 20, 90), 1.5, 1e-12);
check('page task 1: 2.5 µm with 25 %, k 90 (rpm)', SP.speedFor(2.5, 25, 90), 5063, 1e-3);
check('page task 2: 1.2 µm with 20 % needs (rpm)', SP.speedFor(1.2, 20, 90), 9000, 1e-9);
check('page task 2: solids for 1.2 µm at 4000 rpm (%)', 20 * Math.sqrt(1.2 / 1.8), 16.33, 1e-3);
check('page task 3: edge bead ≈ film thickness (µm)', SP.state({ rpm: 4000, p: 20, k: 90 }).bead, 1.8, 1e-12);
{ const bmin = (s, d) => LI.proximityLimit(0.365, s, d);           // same formula as the lithography lesson
  check('page task 3: b_min hard contact, i-line, 1.8 µm resist (µm)', bmin(0, 1.8), 0.86, 0.005);
  check('page task 3: b_min on a 1.8 µm edge bead (µm)', bmin(1.8, 1.8), 1.49, 0.005); }
check('tour: soft bake 1.8 µm → 1.35 µm', SP.state({ rpm: 4000, p: 20, k: 90 }).tBaked, 1.35, 1e-12);
{ // the animated recipe: phase times, ramps, speed profile, time-lapse mapping, warnings
  const D = { rpm: 4000, spinTime: 60, spreadRpm: 500, spreadTime: 8, accel: 2000, ebr: true, ebrRpm: 1000, ebrTime: 5, dryRpm: 2000, dryTime: 15 };
  const R = SP.recipe(D), T = R.T;
  check('recipe: coating spin lasts spinTime', T.spin1 - T.spin0, 60, 1e-12);
  check('recipe: ramp 500 → 4000 rpm at 2000 rpm/s takes 1.75 s', T.spin0 - T.spread1, 1.75, 1e-12);
  check('recipe: speed in the middle of the spin', R.rpmAt((T.spin0 + T.spin1) / 2), 4000, 1e-12);
  check('recipe: speed during the rinse', R.rpmAt((T.ebrOn + T.ebrOff) / 2), 1000, 1e-12);
  check('recipe: speed during the spin dry', R.rpmAt((T.dry0 + T.dry1) / 2), 2000, 1e-12);
  check('recipe: spin dry lasts dryTime', T.dry1 - T.dry0, 15, 1e-12);
  let e = 0; for (let i = 0; i <= 400; i++) { const tp = T.end * i / 400; e = Math.max(e, Math.abs(R.procAt(R.dispAt(tp)) - tp)); }
  check('recipe: display ↔ process time mapping is consistent (max error, s)', e, 0, 0, 1e-9);
  check('recipe: the 60 s spin is shown 8× faster', R.lapseAt((T.spin0 + T.spin1) / 2), 8, 1e-12);
  const N = SP.recipe({ ...D, spreadRpm: 0, ebr: false });
  check('recipe without spread: spin-up starts right after dispensing', N.T.spin0 - N.T.disp, 2, 1e-12);
  check('recipe without EBR: no rinse phase', N.T.dry1 - N.T.spin1, 0, 0, 1e-12);
  n++; const okW = !R.warn && SP.recipe({ ...D, rpm: 1500 }).warn; if (!okW) fails++;
  console.log(`${okW ? 'ok  ' : 'FAIL'}  recipe: warning only when the spin-dry or rinse speed is not below the coating speed`); }

// ------------------------------------------------------------------ dry etching
const DE = W('dryetch');
section('Dry etching (geometric etch front, laser-interferometric end point)');
{ const o = { hf: 1000, Rv: 100, Rl: 15, W: 2000, t: 12, Ssi: 15, Sr: 4, hr: 1500 };
  const s = DE.state(o);
  check('end point t_c = h_f/R_v (min)', s.tc, 10, 1e-12);
  check('undercut U = R_l·t (nm)', s.U, 180, 1e-12);
  check('bias B = d_f − d_m = 2U (nm)', s.cd - o.W, 2 * s.U, 1e-12);
  check('anisotropy A = 1 − R_l/R_v', s.A, 0.85, 1e-12);
  check('Si recess = R_v/S · overetch time (nm)', s.recess, 100 / 15 * 2, 1e-12);
  check('resist left = h_r − R_v t/S_r (nm)', s.resist, 1500 - 1200 / 4, 1e-12);
  const iso = DE.state({ ...o, Rl: 100, t: 10 });
  check('complete isotropic etch at the end point: B = 2h_f (nm)', iso.B, 2000, 1e-12);
  check('complete isotropic etch: A = 0', iso.A, 0, 0, 1e-12);
  const an = DE.state({ ...o, Rl: 0, t: 10 });
  check('complete anisotropic etch: B = 0', an.B, 0, 0, 1e-12);
  check('anisotropic etch: vertical wall (edge at top = edge at bottom)', an.edge(0), an.edge(999), 1e-12);
  check('isotropic etch: rounded wall – at the film bottom the edge is back at the mask edge', iso.edge(1000), o.W / 2, 1e-9);
  // partly anisotropic: a wall point at depth y is etched sideways only for t − y/R_v (Huygens envelope)
  { const pa = DE.state({ ...o, Rv: 100, Rl: 30, t: 10 }), a = 0.3;
    check('tapered wall: undercut at 600 nm depth = (D − y)·a/√(1 − a²) (nm)', pa.edge(600) - o.W / 2, 400 * a / Math.sqrt(1 - a * a), 1e-12);
    check('tapered wall: continuous where the circle meets the taper (y = a·r)', pa.edge(90 - 1e-7), pa.edge(90 + 1e-7), 1e-6);
    check('tapered wall: full undercut R_l·t only at the top (nm)', pa.edge(0) - o.W / 2, 300, 1e-12);
    check('tapered wall: reaches the mask edge at the floor', pa.edge(1000), o.W / 2, 1e-9); }
  check('bare Si reflectance at 632.8 nm (Green 2008: n = 3.88, k = 0.016)', DE.reflectance(0), ((3.877 - 1) ** 2 + 0.0163 ** 2) / ((3.877 + 1) ** 2 + 0.0163 ** 2), 1e-3);
  check('one fringe per λ/2n: R(d + λ/2n) = R(d)', DE.reflectance(400 + s.period), DE.reflectance(400), 1e-9);
  check('fringe period for SiO₂ at 632.8 nm (nm)', s.period, 217.2, 1e-3);
  check('page task 1: bias (nm)', DE.state({ hf: 500, Rv: 50, Rl: 5, W: 1000, t: 12, Ssi: 20, Sr: 3, hr: 1000 }).B, 120, 1e-12);
  check('page task 1: Si recess (nm)', DE.state({ hf: 500, Rv: 50, Rl: 5, W: 1000, t: 12, Ssi: 20, Sr: 3, hr: 1000 }).recess, 5, 1e-12);
  check('page task 2: fringes in 800 nm', DE.state({ ...o, hf: 800 }).fringes, 3.68, 0.01); }

// ------------------------------------------------------------------ ion implantation
section('Ion implantation (Gaussian, SRIM-2013 ranges)');
{ const IM = W('implant');
  check('erfc(1)', IM.erfc(1), 0.1572992070, 1e-6); check('erfc(0.5)', IM.erfc(0.5), 0.4795001222, 1e-6);
  // dose transmitted through Rp + m·ΔRp of mask: ½ erfc(m/√2)
  [[2, 2.275e-2], [3, 1.350e-3], [4, 3.167e-5], [5, 2.867e-7]].forEach(([m, T]) => check(`transmitted fraction at Rp + ${m}ΔRp`, IM.mask(1, { Rp: 100, dRp: 10 }, 100 + 10 * m, 1).pass, T, 2e-3));
  // area under the Gaussian = dose (deep implant, no truncation at the surface)
  { let s = 0; const dx = 0.05; for (let x = 0; x < 2000; x += dx) s += IM.gauss(x + dx / 2, 1e15, 500, 60) * dx * 1e-7; check('∫N dx = Q', s, 1e15, 1e-6); }
  check('peak = 0.3989 Q/ΔRp', IM.peak(1e15, 50) * 50e-7 / 1e15, 0.398942, 1e-5);
  // table points are reproduced, interpolation agrees with an independent graph read-off (P 30 keV in Si ≈ 43 / 18.6 nm)
  check('B 100 keV in Si: Rp (nm)', IM.range('B', 'Si', 100).Rp, 318.0, 1e-9); check('B 100 keV in Si: ΔRp (nm)', IM.range('B', 'Si', 100).dRp, 88.6, 1e-9);
  check('As 100 keV in Si: Rp (nm)', IM.range('As', 'Si', 100).Rp, 69.2, 1e-9);
  check('P 30 keV in Si, interpolated Rp vs graph (nm)', IM.range('P', 'Si', 30).Rp, 43, 0.04); check('P 30 keV in Si, interpolated ΔRp vs graph (nm)', IM.range('P', 'Si', 30).dRp, 18.6, 0.04);
  // resist ≈ 1.8 × Si, SiO2 ≈ Si (100 keV) – the rules of thumb quoted on the page
  check('Rp resist / Rp Si, B 100 keV', IM.range('B', 'resist', 100).Rp / IM.range('B', 'Si', 100).Rp, 1.79, 0.01);
  check('Rp SiO2 / Rp Si, P 100 keV', IM.range('P', 'sio2', 100).Rp / IM.range('P', 'Si', 100).Rp, 0.99, 0.01);
  // page exercises
  { const r = IM.range('B', 'Si', 50); check('page task 1: peak (cm⁻³)', IM.peak(1e15, r.dRp), 6.21e19, 0.003); check('page task 1: x_j (nm)', IM.junctions(1e15, r.Rp, r.dRp, 1e16)[1], 443, 0.002); }
  { const rm = IM.range('P', 'resist', 100); check('page task 2: resist needed (nm)', IM.mask(1e15, rm, 500, 1e16).need, 449, 0.002); check('page task 2: rule Rp + 5ΔRp (nm)', rm.Rp + 5 * rm.dRp, 486, 1e-9); }
  { const m = IM.mask(3.39e12, IM.range('B', 'resist', 130), 143, 1e14); n++; const ok = !m.ok && m.inSi > 1e17; if (!ok) fails++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  too-thin mask (ions overshoot it) is reported as insufficient: inSi ${m.inSi.toExponential(2)}, ok = ${m.ok}`); }
  check('page task 3: beam time (s)', IM.beamTime(5e15, Math.PI * 100, 0.01), 25.2, 0.002);
  { const r = IM.range('B', 'Si', 100); const j = IM.junctions(1e13, r.Rp, r.dRp, 1e17); check('buried layer: shallow junction (nm)', j[0], 164.3, 0.002); check('buried layer: deep junction (nm)', j[1], 471.7, 0.002); }
}

// ------------------------------------------------------------------ PVD
section('PVD (cosine law, mean free path, shadowing)');
{ const PV = W('pvd');
  check('point source, r = h: [1+1]^(−3/2)', PV.thickness(10, 10, 0), 2 ** -1.5, 1e-12);
  check('cosine source, r = h: [1+1]^(−2)', PV.thickness(10, 10, 1), 0.25, 1e-12);
  check('distanceFor inverts thickness', PV.thickness(7.5, PV.distanceFor(7.5, 1, 0.95), 1), 0.95, 1e-12);
  // a cosine source deposits ∝ cos φ cos θ /(π L²); numerical integral over a disc of radius R vs the closed form R²/(R²+h²)
  { const R = 5, h = 20; let num = 0; const N = 4000; for (let i = 0; i < N; i++) { const r = (i + 0.5) / N * R, L2 = r * r + h * h; num += (h * h / L2) / (Math.PI * L2) * 2 * Math.PI * r * R / N; }
    check('cosine source: fraction collected = R²/(R²+h²)', num, R * R / (R * R + h * h), 1e-4); }
  check('λ(air, 0.1 Pa, 22 °C) vs O’Hanlon Table 2.1 (6.6 cm)', PV.meanFreePath(0.1, PV.GAS.air.d, 295.15), 6.6, 0.02);
  check('page task 1: distance for ±5 %, 150 mm (cm)', PV.distanceFor(7.5, 1, 0.95), 46.5, 0.002);
  check('page task 2: collision-free over 40 cm at 1e-3 Pa', PV.unscattered(40, PV.meanFreePath(1e-3, PV.GAS.air.d, 295.15)), 0.94, 0.005);
  check('page task 2: λ(Ar, 0.5 Pa) (cm)', PV.meanFreePath(0.5, PV.GAS.Ar.d, 295.15), 1.36, 0.01);
  check('page task 3: angle (deg)', PV.incidence(10, 50), 11.31, 0.001); check('page task 3: shadow (µm)', PV.shadow(1.5, 10, 50), 0.3, 1e-12);
}

// ------------------------------------------------------------------ lift-off
section('Lift-off (line-of-sight deposition into a resist opening)');
{ const LO = W('liftoff'), d2r = Math.PI / 180;
  const truth = (name, ok) => { n++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`); };
  const g0 = { h: 1.5, w: 4, gamma: 12, t: 0.3, psi: 2, th0: 0 };
  check('open flat surface collects the full thickness', LO.flux(-90, 90, 0, 7, 20), 1, 1e-12);
  // the closed form against a brute-force integral over the arrival directions (cosine law of incidence)
  { const a = -35, b = 50, phin = 60, th0 = 10, psi = 55; let num = 0, den = 0; const N = 200000;
    for (let i = 0; i < N; i++) { const phi = th0 - psi + (i + 0.5) / N * 2 * psi; den += Math.cos(phi * d2r); if (phi > a && phi < b) num += Math.max(0, Math.cos((phi - phin) * d2r)); }
    check('flux formula vs numerical integration (tilted surface, partly hidden)', LO.flux(a, b, phin, th0, psi), num / den, 1e-4); }
  check('whole half-space, vertical wall: top of the sidewall gets t/2', LO.onWall(-1, 1e-9, { ...g0, gamma: 0, psi: 90 }), 0.5, 1e-6);
  check('whole half-space: middle of the opening gets (w/2)/√((w/2)² + h²)', LO.onSubstrate(2, { ...g0, gamma: 0, psi: 90 }), 2 / Math.hypot(2, 1.5), 1e-12);
  check('parallel beam along the normal on a 10° positive slope: t·sin 10°', LO.onWall(-1, 0.5, { ...g0, gamma: -10, psi: 0.01 }), Math.sin(10 * d2r), 1e-3);
  check('parallel beam at θ₀ on a vertical wall: tan θ₀', LO.onWall(-1, 0.5, { ...g0, gamma: 0, psi: 0.01, th0: 15 }), Math.tan(15 * d2r), 1e-3);
  { const s = LO.state({ ...g0, th0: 10 }); check('shift of the line = −h·tan θ₀ (µm)', s.centre, -1.5 * Math.tan(10 * d2r), 2e-3); check('line keeps the width of the top opening (µm)', s.cd, 4, 1e-3); }
  truth('bare sidewalls exactly from γ = ψ + |θ₀|', LO.state({ ...g0, gamma: 12, psi: 2, th0: 10 }).nCoated === 0 && LO.state({ ...g0, gamma: 11, psi: 2, th0: 10 }).nCoated === 1 && LO.state({ ...g0, gamma: 1, psi: 2, th0: 0 }).nCoated === 2);
  truth('the exact condition agrees with the sampled sidewall profile', [-15, -3, 0, 2, 5, 12, 25].every(gm => [0, 6, 14].every(th => [1, 8, 40, 90].every(ps => { const g = { ...g0, gamma: gm, psi: ps, th0: th }; return [-1, 1].every(sd => { let mx = 0; for (let i = 1; i < 60; i++) mx = Math.max(mx, LO.onWall(sd, i / 60, g)); return (mx < 1e-9) === LO.wallBare(sd, g); }); }))));
  truth('whole half-space: sidewalls coated under any undercut', LO.state({ ...g0, gamma: 30, psi: 90 }).nCoated === 2);
  truth('symmetric at normal incidence', Math.abs(LO.state(g0).centre) < 1e-9);
  check('page task 1: arrival angle at the edge (deg)', Math.atan(5 / 40) / d2r, 7.1, 0.005); check('page task 1: shift (µm)', -LO.state({ ...g0, h: 2, gamma: 9, psi: 1.4, th0: Math.atan(5 / 40) / d2r }).shift, 0.25, 1e-9);
  check('page task 1: undercut for γ = 8.6° (µm)', LO.undercut(2, 8.6), 0.30, 0.01);
  check('page task 2: sidewall film (nm)', 300 * Math.sin(10 * d2r), 52, 0.005);
  truth('tour “Undercut”: solution clean, start coated', LO.state({ ...g0, gamma: 5 }).nCoated === 0 && LO.state({ ...g0, gamma: -8 }).nCoated === 2);
  truth('tour “Away from the wafer centre”: one wall coated at 12°', LO.state({ ...g0, gamma: 5, th0: 12 }).nCoated === 1 && !LO.state({ ...g0, gamma: 5, th0: 12 }).walls[0].bare);
  truth('tour “Thick films”: buried at h = 1.5, free at h = 3', LO.state({ ...g0, t: 1.6 }).buried && !LO.state({ ...g0, t: 1.6, h: 3 }).buried);
}

// ------------------------------------------------------------------ film stress
section('Film stress (Stoney, thermal mismatch)');
{ const ST = W('stress');
  check('Si(100) biaxial modulus from C11, C12 (GPa)', ST.M_SI, 180.2, 0.002);
  check('… equals 1/(S11 + S12) with Hall compliances 7.691, −2.142 (GPa)', 1 / (7.691e-3 - 2.142e-3), ST.M_SI, 0.002);
  check('α_Si at 300 K (Okada & Tokumaru: 2.57 ppm/K)', ST.alphaSi(26.85) * 1e6, 2.57, 0.005);
  check('∫α dT of a constant equals α·ΔT', ST.thermalStress({ E: 100, nu: 0, a: 2.6 }, 25, 25), 0, 0, 1e-9);
  check('thermal SiO2 after 1200 °C vs measured −310 MPa (Jaccodine & Schlegel; bulk data, ±25 %)', ST.thermalStress(ST.FILMS.sio2, 1200), -310, 0.25);
  check('Si3N4 default: measured total +1 GPa reproduced', ST.state({ film: 'si3n4', D: '100', Tdep: 750, sigI: ST.defaultIntrinsic('si3n4'), hf: 0.1 }).sig, 1000, 1e-9);
  check('stressFrom inverts curvature', ST.stressFrom(ST.curvature(500, 0.3, 725), 0.3, 725), 500, 1e-12);
  check('bow of a 100 mm wafer for R = 41.4 m (µm)', ST.bow(1 / 41.39, 100), 30.2, 0.002);
  check('page task 1: R (m)', 1 / ST.curvature(1000, 0.2, 525), 41.4, 0.002); check('page task 1: bow (µm)', ST.bow(ST.curvature(1000, 0.2, 525), 100), 30.2, 0.002);
  check('page task 2: stress from R = −40 m (MPa)', ST.stressFrom(-1 / 40, 0.5, 675), -684, 0.002);
  check('page task 3: Al from 400 °C (MPa)', ST.thermalStress(ST.FILMS.al, 400), 790, 0.002);
  check('page task 3: mean α_Si 25–400 °C (ppm/K)', ST.intAlphaSi(400, 25) / (25 - 400) * 1e6, 3.45, 0.002);
  check('tour: α_Si at 1000 °C ≈ 4.4 ppm/K', ST.alphaSi(1000) * 1e6, 4.43, 0.005);
}

// ------------------------------------------------------------------ semiconductor basics
section('Carriers and the pn junction');
{ const SC = W('semiconductor');
  check('n_i(300 K) vs Misiakos & Tsamakis 9.7e9', SC.ni(300), 9.7e9, 0.005);
  check('n_i(300 K) vs Altermatt 9.65e9 (accepted value)', SC.ni(300), 9.65e9, 0.01);
  check('E_g(300 K) (Alex et al.: 1.1230 eV)', SC.Eg(300), 1.1230, 1e-4);
  check('n·p = n_i² (N_D = 1e16)', SC.carriers(1e16, 0, 300).n * SC.carriers(1e16, 0, 300).p, SC.ni(300) ** 2, 1e-9);
  check('compensated: n = N_D − N_A (1e16 − 4e15)', SC.carriers(1e16, 4e15, 300).n, 6e15, 1e-6);
  check('intrinsic: n = n_i (N = 0)', SC.carriers(0, 0, 300).n, SC.ni(300), 1e-12);
  { const j = SC.junction(1e17, 1e16, 0, 300);
    check('charge balance N_A·x_p = N_D·x_n', 1e17 * j.xp, 1e16 * j.xn, 1e-12);
    check('E_max = q N_D x_n / ε_s = 2 V_bi / W', SC.Q * 1e16 * j.xn * 1e-4 / SC.EPS_S, j.Emax, 1e-9);
    check('page task 1: V_bi (V)', j.Vbi, 0.775, 0.002); check('page task 1: W (µm)', j.W, 0.332, 0.003);
    check('page task 1: x_n (µm)', j.xn, 0.302, 0.003); check('page task 1: E_max (kV/cm)', j.Emax / 1e3, 46.7, 0.003); }
  { const j = SC.junction(1e19, 1e15, -5, 300);
    check('page task 2: V_bi (V)', j.Vbi, 0.835, 0.002); check('page task 2: W (µm)', j.W, 2.75, 0.003);
    check('page task 2: C for 100 µm × 100 µm (pF)', j.Cj * 1e-4 * 1e12, 0.377, 0.005); }
  check('page task 3: n_i(400 K)', SC.ni(400), 5.47e12, 0.005);
  check('page task 3: V_bi at 400 K (V)', SC.junction(1e17, 1e16, 0, 400).Vbi, 0.597, 0.002);
  // breakdown approximations agree with each other within ~15 % and give ~60 V at 1e16
  { const b = SC.junction(1e18, 1e16, 0, 300).VB; check('breakdown 1e16: Baliga (V)', b[0], 53.4, 0.005); check('breakdown 1e16: Sze–Gibbons fit (V)', b[1], 61.9, 0.005); }
}

// ------------------------------------------------------------------ four-point probe
section('Four-point probe and van der Pauw');
{ const FP = W('fourpoint');
  check('π/ln 2', FP.K_INF, 4.532360, 1e-6);
  // Smits 1958, Table I (circular slice) – printed values, ±0.0005 (the printed table rounds)
  [[3, 2.2662], [4, 2.9289], [5, 3.3625], [7.5, 3.9273], [10, 4.1716], [20, 4.4364], [40, 4.5076]].forEach(([d, c]) => check(`C(d/s = ${d}) vs Smits Table I`, FP.cCircle(d), c, 0, 6e-4));
  // Smits 1958, Table III (thickness, non-conducting bottom)
  [[0.4, 0.9995], [0.5, 0.9974], [0.7143, 0.9798], [1.0, 0.9214], [1.4286, 0.7938], [2.0, 0.6336]].forEach(([ws, f]) => check(`F(w/s = ${ws}) vs Smits Table III`, FP.fThick(ws), f, 0, 2e-4));
  check('thick limit: (π/ln2)·w·F → 2πs', FP.K_INF * 20 * FP.fThick(20), 2 * Math.PI, 0.01);
  // Thurber et al. 1981, 300 K fits (values recomputed from the published coefficients)
  [['P', 1e14, 44.2], ['P', 1e16, 0.537], ['P', 1e18, 0.02356], ['B', 1e14, 134.7], ['B', 1e16, 1.485], ['B', 1e18, 0.04374]].forEach(([d, N, r]) => check(`ρ(${d}, ${N.toExponential(0)}) vs Thurber (Ω·cm)`, FP.rho(d, N), r, 0.003));
  check('dopingFor inverts rho', FP.dopingFor('P', FP.rho('P', 3e17)), 3e17, 1e-6);
  { const pr = FP.vdpPair(100, 3); check('vdP: pair satisfies the equation', Math.exp(-Math.PI * pr.RA / 100) + Math.exp(-Math.PI * pr.RB / 100), 1, 1e-9); check('vdP: Rs recovered', FP.vdpRs(pr.RA, pr.RB), 100, 1e-9); }
  check('vdP f-factor at ratio 10 (exact 0.6993)', FP.vdpRs(10, 1) / (Math.PI * 5.5 / Math.LN2), 0.6993, 1e-3);
  check('page task 1: R_s (Ω/□)', FP.K_INF * 20, 90.6, 0.002);
  check('page task 2: C(8) and R_s (Ω/□)', FP.cCircle(8) * 20, 79.8, 0.002);
  check('page task 3: N for 1.485 Ω·cm boron', FP.dopingFor('B', 1.485), 1e16, 0.002);
  check('page task 4: symmetric vdP (Ω/□)', FP.vdpRs(10, 10), 45.32, 0.001);
  check('ASTM current for 1.5 Ω·cm (A)', FP.recCurrent(1.5), 1e-3, 1e-12);
}

// ------------------------------------------------------------------ vacuum
section('Vacuum: conductance, pump-down, outgassing');
{ const VA = W('vacuum');
  check('λ at 0.1 Pa (O’Hanlon: 6.6 cm)', VA.lambda(0.1), 6.6, 1e-9);
  check('monolayer time at 1e-4 Pa (O’Hanlon ≈ 2.5 s)', VA.monolayer(1e-4), 2.5, 1e-9);
  // Knudsen formula → molecular limit 12.1 d³/l at low pressure (long pipe, entrance term negligible)
  check('Knudsen formula → 12.1 d³/l (molecular, l = 1000 d)', VA.conductance(1, 1000, 1e-6), 12.1 / (1000 + 4 / 3), 1e-4);
  // … and the viscous term dominates at high pressure: 135 d⁴ p̄/l (mbar)
  check('Knudsen formula, viscous limit 135 d⁴ p̄/l at 10 mbar', VA.conductance(5, 100, 1000), 135 * 625 * 10 / 100, 0.01);
  check('S_eff = S·C/(S + C)', VA.sEff(500, 14), 13.62, 0.001);
  // pump-down without gas load is exponential: compare the integrator with p0·exp(−S t/V)
  { const o = { V: 50, S: 100, d: 30, l: 5, mat: 'baked' }; const c = VA.pumpDown(o, 10); const Seff = VA.sEff(100, VA.conductance(30, 5, 1e-3));
    check('integrator: exponential decay while the volume dominates (p after 2 s)', VA.pAt(c, 2), Math.exp(-Seff * 2 / 50), 0.05); }
  check('regime: Kn < 0.01 viscous', VA.regime(0.005) === 'viscous' ? 1 : 0, 1, 0); check('regime: Kn > 1 molecular', VA.regime(2) === 'molecular' ? 1 : 0, 1, 0);
  check('ISO 3529-1: 1e-4 Pa is high vacuum', VA.rangeName(1e-4) === 'high vacuum' ? 1 : 0, 1, 0);
  check('page task 1: C (L/s)', VA.molecularConductance(4, 50), 14.0, 0.002); check('page task 1: S_eff (L/s)', VA.sEff(500, VA.molecularConductance(4, 50)), 13.6, 0.003);
  check('page task 2: t = τ ln 1000 (s)', 0.5 * Math.log(1000), 3.45, 0.002);
  check('page task 3: Q from 9e-8 mbar·L/(s·cm²) on 1 m² (Pa·L/s)', 9e-8 * 1e4 * 100, 0.09, 1e-9);
}

section('Edge cases found in the audit');
{
  const SC = W('semiconductor'), IM = W('implant'), FP = W('fourpoint');
  const j = SC.junction(1e14, 1e14, 0, 500);
  n++; { const ok = j.Vbi > 0 && j.Vbi < 0.05; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  V_bi stays positive when n_i exceeds the doping (1e14, 500 K): ${j.Vbi.toFixed(4)} V`); }
  check('V_bi unchanged for N ≫ n_i (1e17/1e16, 300 K) (V)', SC.junction(1e17, 1e16, 0, 300).Vbi, SC.kT(300) * Math.log(1e33 / SC.ni(300) ** 2), 1e-9);
  check('implant: no mask needed when the peak is below N_B (nm)', IM.mask(1e11, IM.range('B', 'resist', 200), 50, 1e18).need, 0, 0, 1e-12);
  n++; { const ok = Number.isNaN(FP.measure({ dop: 'B', N: 1e16, w: 1, d: 3, s: 1.59, I: 1e-3 }).C); if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  four-point: no correction factor when the probe does not fit (d < 3s)`); }
}

section('Thin-film interference (Airy formula, colour, reflectometry)');
{
  const TF = W('interference');
  check('normal incidence equals the oxidation-page formula (300 nm SiO₂, 550 nm)', TF.reflectance('sio2', 300, 550, 0), OX.reflectance(300, 550), 1e-12);
  check('s and p agree at normal incidence', TF.stack('sio2', 300, 550, 0).Rs, TF.stack('sio2', 300, 550, 0).Rp, 1e-12);
  check('no film: bare Si, R = |(N − 1)/(N + 1)|² at 550 nm (Green 2008: 4.077 + 0.028i)', TF.reflectance('sio2', 0, 550), ((4.077 - 1) ** 2 + 0.028 ** 2) / ((4.077 + 1) ** 2 + 0.028 ** 2), 1e-9);
  check('half-wave film is absent: R = R(bare Si)', TF.reflectance('sio2', 550 / (2 * OX.nSiO2(550)), 550), TF.reflectance('sio2', 0, 550), 1e-9);
  check('n(Si₃N₄) at 632.8 nm (Philipp 1973: 2.01)', TF.nSi3N4(632.8), 2.01, 0.002);
  // quarter-wave film on a (nearly) real substrate: R = ((n₀n₂ − n₁²)/(n₀n₂ + n₁²))²
  { const n1 = TF.nSi3N4(600), n2 = OX.nkSi(600)[0]; check('quarter-wave nitride at 600 nm vs closed form (k of Si neglected)', TF.reflectance('si3n4', TF.quarterWave('si3n4', 600), 600), ((n2 - n1 * n1) / (n2 + n1 * n1)) ** 2, 0, 2e-4); }
  // Brewster angle of bare Si at 650 nm: tan θ_B = n → R_p almost zero (k is small)
  { const thB = Math.atan(OX.nkSi(650)[0]) * 180 / Math.PI; n++; const rp = TF.stack('sio2', 0, 650, thB).Rp; const ok = rp < 1e-4; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  bare Si at the Brewster angle ${thB.toFixed(1)}°: R_p = ${rp.toExponential(1)} < 1e-4`); }
  check('energy: R_s ≥ R_p at oblique incidence (bare Si, 60°)', Math.sign(TF.stack('sio2', 0, 550, 60).Rs - TF.stack('sio2', 0, 550, 60).Rp), 1, 0);
  { const e = TF.extrema('sio2', 1000).min; check('reflectometry: two neighbouring minima return the thickness (nm)', TF.thicknessFromPair('sio2', e[0].lambda, e[1].lambda), 1000, 1e-9);
    check('minima of the 1000 nm oxide (nm)', e[0].lambda, 647.4, 2e-4); check('… second', e[1].lambda, 531.2, 2e-4);
    // the analytic minimum is a minimum of the computed spectrum (the dispersion of Si shifts it by < 2 nm)
    let lm = 0, rm = 1; for (let l = 600; l <= 690; l += 0.1) { const r = TF.reflectance('sio2', 1000, l); if (r < rm) { rm = r; lm = l; } }
    check('numerical minimum of R(λ) vs interference condition (nm)', lm, e[0].lambda, 0, 2); }
  check('page task 1: λ/4n at 550 nm, SiO₂ (nm)', TF.quarterWave('sio2', 550), 94.2, 1e-3);
  check('page task 2: constant-index estimate (nm)', 647 * 531 / (2 * 1.46 * 116), 1014, 1e-3);
  check('page task 3: cos θ₁ at 60° in SiO₂', TF.stack('sio2', 300, 550, 60).cos1, 0.805, 1e-3);
  check('page task 3: minimum moves 583 → 472 nm', TF.extrema('sio2', 300, 60).min[0].lambda, 472, 2e-3);
  check('page task 4: quarter-wave nitride for 600 nm (nm)', TF.quarterWave('si3n4', 600), 74.4, 1e-3);
  check('page task 4: quarter-wave oxide still reflects 9 %', TF.reflectance('sio2', TF.quarterWave('sio2', 600), 600), 0.09, 0.02);
  // Pliskin & Conrad colour chart: ~100 nm oxide is violet/blue (blue channel dominant), ~200 nm light gold (blue lowest)
  { const a = TF.rgb('sio2', 100), b = TF.rgb('sio2', 200); n++; const ok = a[2] > a[0] && a[2] > a[1] && b[2] < b[0] && b[2] < b[1]; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  colour chart: 100 nm bluish (${a}), 200 nm yellowish (${b})`); }
}

section('Electromigration (Black, lognormal, Blech)');
{
  const EM = W('electromigration');
  check('n = 2: twice the current density, a quarter of the life', EM.accel(0.84, 2, 2, 250, 1, 250), 4, 1e-12);
  check('temperature term 250 → 125 °C, 0.84 eV (hand: exp(9748·(1/398.15 − 1/523.15)))', EM.accel(0.84, 2, 1, 250, 1, 125), Math.exp(0.84 / 8.617333e-5 * (1 / 398.15 - 1 / 523.15)), 1e-12);
  check('page task 1: acceleration factor', EM.accel(0.84, 2, 2, 250, 0.2, 125), 3.47e4, 2e-3);
  check('Φ⁻¹(0.001) = −3.0902', EM.PhiInv(0.001), -3.0902, 1e-4);
  check('Φ(Φ⁻¹(0.3)) = 0.3', EM.Phi(EM.PhiInv(0.3)), 0.3, 1e-6);
  check('lognormal: half failed at t50', EM.failed(100, 100, 0.5), 0.5, 1e-7);
  check('lognormal: Φ(1) = 0.8413 failed at t50·e^σ', EM.failed(100 * Math.exp(0.5), 100, 0.5), 0.8413, 1e-4);
  const e = EM.evaluate({ metal: 'alLarge', jT: 2, TT: 250, t50T: 100, jU: 0.2, TU: 125, sigma: 0.5, L: 100, F: 0.001, life: 10 });
  check('page task 1: median life in use (years)', e.t50U / EM.HOURS_PER_YEAR, 396, 2e-3);
  check('page task 2: 0.1 % life (years)', e.tFU / EM.HOURS_PER_YEAR, 84.5, 2e-3);
  check('page task 2: j_max for 10 years (MA/cm²)', e.jMax, 0.58, 5e-3);
  check('j_max really gives the target life', EM.timeAt(0.001, EM.t50At(0.84, 2, 100, 2, 250, e.jMax, 125), 0.5), 10 * EM.HOURS_PER_YEAR, 1e-9);
  const f = EM.evaluate({ metal: 'alFine', jT: 2, TT: 250, t50T: 100, jU: 0.2, TU: 125, sigma: 0.5, L: 100, F: 0.001, life: 10 });
  check('page task 3: fine-grained Al, temperature factor', f.AFT, 28.3, 2e-3);
  check('page task 3: 0.1 % life (years)', f.tFU / EM.HOURS_PER_YEAR, 6.9, 5e-3);
  check('page task 4: Blech length Cu at 1 MA/cm² (µm)', EM.blechLength(3700, 1), 37, 1e-12);
  check('page task 4: Blech length Al at 0.2 MA/cm² (µm)', EM.blechLength(1260, 0.2), 63, 1e-12);
  check('j·L of 0.2 MA/cm² × 100 µm (A/cm)', EM.jL(0.2, 100), 2000, 1e-12);
}

section('Soft bake (residual solvent, PAC decomposition)');
{
  const SB = W('softbake');
  check('D(70 °C) from E_d = 5.62 kcal/mol vs fitted 8.22e-11 cm²/s', SB.diffusivity(70), 8.22e-11, 0.03);
  check('D(110 °C) vs fitted 1.94e-10 cm²/s', SB.diffusivity(110), 1.94e-10, 0.03);
  check('desorbable solvent at 90 °C (wt%)', SB.desorbable(90), 12.3, 1e-12);
  check('slab desorption: series and √t limit agree where they meet', SB.slabFraction(1e-10, 1.3), SB.slabFraction(1e-10, 1.35), 0.03);
  check('slab desorption: complete for t ≫ l²/D', SB.slabFraction(1.32e-10, 5000), 1, 1e-9);
  // the law against the measured points of Gardiner et al. 1997, Fig. 2 (read from the figure, ±0.5 wt%)
  for (const [T, mn, w] of [[90, 1, 18.2], [90, 2.5, 16.3], [90, 7, 15.6], [110, 1, 13.2], [110, 2.5, 11.7], [70, 1, 22], [70, 6, 20]]) check(`solvent after ${mn} min at ${T} °C vs measurement (wt%)`, SB.solvent(T, mn * 60), w, 0, T === 70 ? 1.5 : 0.8);
  check('PAC lost in a 30 min oven bake at 100 °C (Inside PROLITH: 11 %)', 1 - SB.pacLeft(100, 1800), 0.11, 0.02);
  check('page task 1: solvent after 60 s at 100 °C (wt%)', SB.solvent(100, 60), 15.6, 5e-3);
  check('page task 1: relative thickness', SB.thickness(15.6), 0.853, 1e-3);
  check('page task 2: K_T at 100 °C (1/min)', SB.kPac(100) * 60, 3.8e-3, 0.02);
  check('page task 2: 1 min at 100 °C (%)', 100 * (1 - SB.pacLeft(100, 60)), 0.38, 0.02);
  check('page task 3: rate ratio 110/100 °C', SB.kPac(110) / SB.kPac(100), 2.9, 0.01);
  check('page task 4: plateau at 70 °C (wt%)', SB.state({ mode: 'hotplate', T: 70, t: 600 }).plateau, 21.2, 2e-3);
  check('oven: nothing happens during the warm-up', SB.state({ mode: 'oven', T: 90, t: 200, warmup: 300 }).w, SB.W0, 1e-12);
  check('as-spun film: relative thickness 1', SB.thickness(SB.W0), 1, 1e-12);
}

section('Stress migration (McPherson–Dunn creep model)');
{
  const SM = W('stressmigration'), cu = SM.PRESETS.cu, al = SM.PRESETS.alsi;
  check('Cu: maximum rate at ≈ 190 °C (Ogawa et al. 2002)', SM.peak(cu.T0, cu.N, cu.Ea), 190, 0, 1);
  check('McPherson 2019, example: Q = n·k·T²/(T0 − T) = 0.74 eV for 3.2, 190 °C, 270 °C', 3.2 * SM.K_EV * 463.15 ** 2 / 80, 0.74, 5e-3);
  check('E_eff is zero at the maximum', SM.eaEff(SM.peak(cu.T0, cu.N, cu.Ea), cu.T0, cu.N, cu.Ea), 0, 0, 1e-9);
  { const Tp = SM.peak(cu.T0, cu.N, cu.Ea); n++; const ok = SM.rate(Tp, 270, 3.2, 0.74) > SM.rate(Tp - 2, 270, 3.2, 0.74) && SM.rate(Tp, 270, 3.2, 0.74) > SM.rate(Tp + 2, 270, 3.2, 0.74); if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  the analytic maximum is a maximum of R(T)`); }
  // McPherson 2019, ch. 12 problem: n = 3, Q = 0.75 eV, T0 = 270 °C → apparent activation energy 0.37 eV between 190 and 105 °C
  check('apparent E_a between 190 and 105 °C (textbook problem: 0.37 eV)', Math.log(SM.rate(190, 270, 3, 0.75) / SM.rate(105, 270, 3, 0.75)) * SM.K_EV / (1 / 378.15 - 1 / 463.15), 0.37, 0.02);
  check('no voiding at or above T0', SM.rate(270, 270, 3.2, 0.74), 0, 0, 0);
  check('page: Al–Si maximum (°C)', SM.peak(al.T0, al.N, al.Ea), 165, 0, 1);
  check('page task 2: AF of a 190 °C bake against 105 °C', SM.lifeRatio(105, 190, 270, 3.2, 0.74), 6.4, 0.01);
  check('page task 3: AF of a 250 °C bake', SM.lifeRatio(105, 250, 270, 3.2, 0.74), 0.63, 0.01);
  check('page task 4: E_eff of Al–Si at 105 °C (eV)', SM.eaEff(105, al.T0, al.N, al.Ea), 0.35, 0.02);
}

section('Development (Dill exposure, Mack rate, front propagation)');
{
  const DV = W('development'), S = DV.MACK.pb70, S2 = DV.MACK.pb100;
  const truth = (name, ok) => { n++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`); };
  check('surface: m = exp(−C·E), 100 mJ/cm²', DV.mSurface(100), Math.exp(-2.39), 1e-12);
  check('page task 1: dose for m = 0.5 (mJ/cm²)', Math.log(2) / DV.DILL.C, 29.0, 2e-3);
  // the reduced equation in depth against stepping Dill's two equations through the exposure
  { const a = DV.pacProfile(60, 1.2, 40), b = DV.pacBrute(60, 1.2, 400, 8000); check('m at the substrate: reduced equation vs brute force', a[40], b[400], 2e-3); }
  { const a = DV.pacProfile(200, 3, 80), b = DV.pacBrute(200, 3, 400, 8000); check('same for 3 µm, 200 mJ/cm²', a[80], b[400], 3e-3); }
  // weak exposure: Beer–Lambert with the unbleached absorption A + B → 1 − m(d) ≈ C·E·exp(−(A+B)·d)
  check('weak-exposure limit (E = 0.01)', 1 - DV.pacProfile(0.01, 1.2, 80)[80], DV.DILL.C * 0.01 * Math.exp(-(DV.DILL.A + DV.DILL.B) * 1.2), 2e-3);
  check('page task 2: unbleached transmission of 1.2 µm', Math.exp(-(DV.DILL.A + DV.DILL.B) * 1.2), 0.23, 0.01);
  check('page task 2: bleached transmission', Math.exp(-DV.DILL.B * 1.2), 0.77, 0.01);
  truth('no exposure leaves m = 1 at every depth', DV.pacProfile(0, 1.2, 40).every(m => m === 1));
  // Mack rate: limits, and the inflection point at m_TH (the meaning of the parameter)
  check('r(m = 1) = r_min', DV.rate(1, S), S.rmin, 1e-12);
  check('r(m = 0) = r_max + r_min', DV.rate(0, S), S.rmax + S.rmin, 1e-12);
  { const h = 1e-3, d2 = m => (DV.rate(m + h, S) - 2 * DV.rate(m, S) + DV.rate(m - h, S)); truth('inflection of r(m) at m_TH = 0.61', d2(0.61 - 0.02) * d2(0.61 + 0.02) < 0 && Math.abs(d2(0.61)) < Math.abs(d2(0.55)) / 5); }
  check('Mack 1987: r_max/r_min, prebake 70 °C', S.rmax / S.rmin, 367, 2e-3);
  check('Mack 1987: r_max/r_min, prebake 100 °C', S2.rmax / S2.rmin, 10.5, 1e-9);
  check('page task 3: a (70 °C set)', 7 / 5 * 0.39 ** 6, 0.0049, 0.01);
  check('page task 3: r(0.3) (nm/s)', 1000 * DV.rate(0.3, S), 53, 0.01);
  check('page task 3: r(0.61) (nm/s)', 1000 * DV.rate(0.61, S), 23, 0.01);
  check('page task 3: r(0.8) (nm/s)', 1000 * DV.rate(0.8, S), 0.86, 0.01);
  // development of a large open area
  check('unexposed film: depth = r_min·t (dark erosion, 60 s, nm)', 1000 * DV.depth(0, 1.2, 60, S), 9, 1e-6);
  check('page task 4: dark erosion, 100 °C set (nm)', 1000 * DV.depth(0, 1.2, 60, S2), 120, 1e-6);
  check('saturated exposure: clear time → d/(r_max + r_min) (s)', DV.clearTime(1e4, 1.2, S), 1.2 / (S.rmax + S.rmin), 1e-3);
  { const Dc = DV.doseToClear(1.2, 60, S); check('dose to clear inverts the clear time (s)', DV.clearTime(Dc, 1.2, S), 60, 1e-4);
    const c = DV.contrast(1.2, 60, S); check('γ = 1/log10(D_c/D_0)', 1 / Math.log10(c.Dc / c.D0), c.gamma, 1e-9);
    check('page task 5 and tour: D_c, 1.2 µm, 60 s (mJ/cm²)', c.Dc, 44, 0.02); check('page task 5: D_0', c.D0, 14, 0.03); check('page task 5: γ', c.gamma, 2.1, 0.03);
    check('page task 5: D_c for 2 µm', DV.doseToClear(2, 60, S), 85, 0.01);
    check('tour “Time against dose”: D_c at 120 s is a seventh lower', 1 - DV.doseToClear(1.2, 120, S) / c.Dc, 1 / 7, 0.05);
    check('tour “Too little dose”: 25 mJ/cm², 60 s develops about half (µm)', DV.depth(25, 1.2, 60, S), 0.6, 0.1);
    truth('more time never raises the dose to clear', DV.doseToClear(1.2, 120, S) < c.Dc && DV.doseToClear(1.2, 30, S) > c.Dc); }
  // front propagation on the grid
  { const flat = new Array(21).fill(1);
    const R = DV.develop2D({ I: flat, E: 0, d: 1.2, S, X: 2, nz: 32 }); check('uniform resist: front arrives at d after d/r_min (s)', R.T[32 * 21 + 10], 1.2 / S.rmin, 1e-9);
    const R2 = DV.develop2D({ I: flat, E: 60, d: 1.2, S, X: 2, nz: 32 }); check('uniform exposure: grid solver vs ∫dz/r (s)', R2.T[32 * 21 + 10], DV.clearTime(60, 1.2, S), 0.03);
    check('profile() of a uniform film = depth() (µm)', DV.profile(R2, 15)[5], DV.depth(60, 1.2, 15, S), 0.03);
    truth('nothing cleared → foot edge 0; everything cleared → X', DV.footEdge(R, 60) === 0 && DV.footEdge(R2, 60) === 2);
    // a sharp, fully exposed half next to an unexposed half: the edge creeps sideways at r_min
    const step = flat.map((x, i) => (i <= 10 ? 1e3 : 0)), R3 = DV.develop2D({ I: step, E: 1, d: 0.6, S, X: 2, nz: 32 });
    const t0 = 0.6 / (S.rmax + S.rmin), tt = 600; check('sharp edge: lateral creep r_min·(t − t_clear) (µm)', DV.footEdge(R3, tt) - 1.0, S.rmin * (tt - t0), 0.15, 0.02); }
  // tour claims with the real image of a 2 µm line in contact
  { const xs = []; for (let i = 0; i < 41; i++) xs.push(2 * i / 40);
    const I = LI.aerialImage({ mode: 'proximity', lambda: 0.365, hp: 2, xs, gap: 0, resist: 1.2, collimation: 2 });
    const cd = (E, t) => 2 * (2 - DV.footEdge(DV.develop2D({ I, E, d: 1.2, S, X: 2, nz: 32 }), t));
    check('tour “Dose to size”: 150 mJ/cm² prints 2 µm (µm)', cd(150, 60), 2, 0.02);
    check('tour “Too long in the developer”: 180 s narrows the line by ≈ 0.1 µm', cd(150, 60) - cd(150, 180), 0.1, 0.25);
    truth('the line narrows with dose', cd(100, 60) > cd(200, 60) && cd(200, 60) > cd(400, 60)); }
  check('page task 6: Al lost in 65 s at 10 nm/min (nm)', DV.alLoss('mif', 65)[0], 11, 0.02);
  check('page task 6: Al lost in 65 s at 70 nm/min (nm)', DV.alLoss('mif', 65)[1], 76, 0.01);
  check('AZ Developer: no attack on Al', DV.alLoss('azdev', 600)[1], 0, 0, 0);
  truth('a saturating dose gives m = 0 at every depth, not NaN', DV.pacProfile(1e5, 1.2, 40).every(m => m === 0));
  truth('no dose clears the film in zero time, or faster than d/r_max: dose to clear is infinite', DV.doseToClear(1.2, 0, S) === Infinity && DV.doseToClear(1.2, 30, S2) === Infinity && isNaN(DV.contrast(1.2, 0, S).gamma));
}

section('Alignment and overlay (linear model, two marks, thermal run-out)');
{
  const AL = W('alignment');
  const truth = (name, ok) => { n++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`); };
  const o = { Tx: 0.6, Ty: -0.4, th: 25, M: 12.9 };
  // the linear model against an exact rigid rotation and scaling of the point (30 mm, 40 mm)
  { const th = 25e-6, Mm = 12.9e-6, x = 30e3, y = 40e3, X = (1 + Mm) * (x * Math.cos(th) - y * Math.sin(th)) + 0.6, Y = (1 + Mm) * (x * Math.sin(th) + y * Math.cos(th)) - 0.4, d = AL.overlay(30, 40, o);
    check('Δx vs exact rotation + scaling (µm)', d.dx, X - x, 0, 1e-4); check('Δy vs exact rotation + scaling (µm)', d.dy, Y - y, 0, 1e-4); }
  check('pure rotation: 40 µrad at 50 mm (µm)', AL.overlay(50, 0, { Tx: 0, Ty: 0, th: 40, M: 0 }).dy, 2, 1e-12);
  check('pure rotation: no error at the centre', Math.hypot(AL.overlay(0, 0, { Tx: 0, Ty: 0, th: 40, M: 0 }).dx, AL.overlay(0, 0, { Tx: 0, Ty: 0, th: 40, M: 0 }).dy), 0, 0, 1e-15);
  // largest error on the wafer: closed form against a scan of the rim
  { let mx = 0; for (let i = 0; i < 3600; i++) { const a = i * Math.PI / 1800, d = AL.overlay(50 * Math.cos(a), 50 * Math.sin(a), o); mx = Math.max(mx, Math.hypot(d.dx, d.dy)); }
    check('|Δ|max = |T| + R·√(θ² + M²) vs scan of the wafer edge (µm)', AL.maxError(o), mx, 1e-5); }
  // two marks: residuals → parameters → residuals
  { const m = AL.marks(o, 60), back = AL.fromMarks(m.left, m.right, 60);
    check('fromMarks recovers T_x', back.Tx, o.Tx, 1e-12); check('fromMarks recovers T_y', back.Ty, o.Ty, 1e-12); check('fromMarks recovers θ', back.th, o.th, 1e-12); check('fromMarks recovers M', back.M, o.M, 1e-12);
    const q = AL.fromMarks({ dx: 0.1, dy: -0.4 }, { dx: 0.5, dy: 0.3 }, 70);
    check('page task 2: T_x (µm)', q.Tx, 0.3, 1e-9); check('page task 2: T_y (µm)', q.Ty, -0.05, 1e-9); check('page task 2: θ (µrad)', q.th, 10, 1e-9); check('page task 2: M (ppm)', q.M, 5.7, 0.01); }
  check('page task 1: 30 µrad in degrees', 30e-6 * 180 / Math.PI, 0.0017, 0.02);
  check('page task 1: 30 µrad at the edge (µm)', AL.maxError({ Tx: 0, Ty: 0, th: 30, M: 0 }), 1.5, 1e-12);
  // thermal run-out (the table on the page: µm over 100 mm per kelvin)
  check('soda-lime vs Si: run-out over 100 mm per K (µm)', AL.runout('soda', 1) * 100 * 1e-3, 0.64, 0.01);
  check('borosilicate vs Si (µm)', AL.runout('boro', 1) * 100 * 1e-3, 0.065, 1e-9);
  check('fused silica vs Si (µm)', AL.runout('fs', 1) * 100 * 1e-3, -0.21, 0.02);
  check('page task 3: soda-lime, 2 K (ppm)', AL.runout('soda', 2), 12.8, 2e-3);
  check('page task 3: at 45 mm (µm)', AL.runout('soda', 2) * 45e-3, 0.58, 0.01);
  check('page task 3: fused silica, 2 K (ppm)', AL.runout('fs', 2), -4.1, 0.01);
  check('page task 3: fused silica at 45 mm (µm)', Math.abs(AL.runout('fs', 2)) * 45e-3, 0.19, 0.03);
  check('tour “Run-out”: soda-lime, 3 K, at the edge (µm)', AL.maxError({ Tx: 0, Ty: 0, th: 0, M: AL.runout('soda', 3) }), 0.96, 0.01);
  truth('tour “Run-out”: only borosilicate brings the error below 0.2 µm at 3 K', AL.maxError({ Tx: 0, Ty: 0, th: 0, M: AL.runout('boro', 3) }) < 0.2 && AL.maxError({ Tx: 0, Ty: 0, th: 0, M: AL.runout('fs', 3) }) > 0.2);
  // reading error and mark separation
  check('page task 4: ±0.5 µm at marks 60 mm apart (µrad)', AL.rotationFromReading(0.5, 60), 17, 0.02);
  check('page task 4: that rotation at the edge (µm)', AL.rotationFromReading(0.5, 60) * 0.05, 0.83, 0.01);
  check('page task 4: marks 20 mm apart (µrad)', AL.rotationFromReading(0.5, 20), 50, 1e-12);
  { const m = AL.marks({ Tx: 0, Ty: 0, th: 100, M: 0 }, 10); check('tour “Marks too close”: 100 µrad reads +0.5 µm at marks 10 mm apart', m.right.dy, 0.5, 1e-12);
    truth('tour “Marks too close”: windows at the edge are lost with e = 3 µm', AL.map({ Tx: 0, Ty: 0, th: 100, M: 0 }, 3).yield < 1); }
  // vernier
  check('vernier: +0.8 µm reads +1.0 (0.5 µm steps)', AL.vernier(0.8).reading, 1.0, 1e-12);
  check('vernier: −0.2 µm reads 0', AL.vernier(-0.2).reading, 0, 0, 1e-12);
  truth('vernier: 3.2 µm is off a ±2.5 µm scale', !AL.vernier(3.2).inRange);
  { // geometry: with the offset n·r the n-th bars of a 4.0 and a 3.5 µm scale coincide
    const nB = 3, off = nB * 0.5; check('vernier geometry: bar 3 of both scales coincides at +1.5 µm', nB * 3.5 + off, nB * 4.0, 1e-12); }
  // enclosure
  { const mp = AL.map({ Tx: 0.6, Ty: 0.4, th: 25, M: AL.runout('soda', 2) }, 2); truth('tour “Enclosure”: 2 µm covers every die, 0.5 µm does not', mp.yield === 1 && mp.need <= 2 && mp.need > 1.6 && AL.map({ Tx: 0.6, Ty: 0.4, th: 25, M: AL.runout('soda', 2) }, 0.5).yield < 1); }
  check('number of die sites (10 mm grid, r ≤ 45 mm)', AL.sites().length, 69, 0, 0);
  check('root sum of squares: 0.5, 0.5, 0.65 (µm)', AL.rss([0.5, 0.5, 0.65]), 0.96, 0.005);
  check('page task 5: plus 1.0 µm systematic (µm)', AL.rss([0.5, 0.5, 0.65]) + 1, 2.0, 0.03);
}

section('Process game (data-sheet values, chained lesson models, scoring)');
{
  const G = W('processgame'), SP = W('spincoating'), DVm = W('development'), ALm = W('alignment');
  const truth = (name, ok) => { n++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`); };
  const good = { resist: 'az1512', rpm: 3500, sbT: 100, sbt: 60, ax: 0, ay: 0, ath: 0, mode: 'contact', gap: 20, dose: 127.5, dev: 'azdev', tdev: 60, hbT: 110, hbt: 60, etT: 't40', tet: 75 };
  const wf = { ox: 0, oy: 0, oth: 0 }, run = (ch, w = wf) => G.run({ ...good, ...ch }, w);
  // digitised spin curve
  check('spin curve returns the digitised point (AZ 1512 HS, 3000 rpm, µm)', G.thickness('az1512', 3000), 1.52, 1e-12);
  check('spin curve returns the digitised point (AZ 1518, 4000 rpm, µm)', G.thickness('az1518', 4000), 1.84, 1e-12);
  truth('thickness falls with speed and rises along the series', G.thickness('az1512', 2500) > G.thickness('az1512', 3500) && G.thickness('az1505', 3000) < G.thickness('az1512', 3000) && G.thickness('az1518', 3000) < G.thickness('az1529', 3000));
  check('digitised curve follows the ω^(−1/2) law of the spin-coating lesson (1000 → 4000 rpm, AZ 1512 HS)', G.thickness('az1512', 1000) / G.thickness('az1512', 4000), SP.thickness(1000, 20) / SP.thickness(4000, 20), 0.02);
  truth('only AZ 1512 HS reaches the 1.3–1.6 µm of the work order between 1000 and 4000 rpm', ['az1505', 'az1518', 'az1529'].every(k => [1000, 2000, 3000, 4000].every(r => { const t = G.thickness(k, r); return t < 1.3 || t > 1.6; })) && G.thickness('az1512', 3500) > 1.3 && G.thickness('az1512', 3500) < 1.6);
  // page tasks
  check('page task 1: target resistance (Ω)', G.R_TARGET, 795, 1e-9);
  check('page task 1: sheet resistance (mΩ/□)', 1000 * G.RHO_AL / 500e-9, 53, 1e-9);
  check('page task 2: exposure time for 128 mJ/cm² (s)', run({ dose: 128 }).L.tExp, 15, 0.005);
  check('page task 3: 80 Å/s in nm/min', G.etchRate('t40'), 480, 1e-12);
  check('page task 3: time to clear the centre (s)', run({}).tc0, 62.5, 1e-12);
  check('page task 3 and work order: film at the edge (nm)', G.filmAt(50), 473, 0.002);
  check('page task 4: mean width when just cleared (µm)', G.lineSection(5, 500, 500).wEff, 5 - 2 * Math.PI / 4 * 0.5, 2e-3);
  check('page task 4: after 20 % more etch (µm)', G.lineSection(5, 500, 600).wEff, 3.96, 0.005);
  truth('before the film clears the lines are still connected', !G.lineSection(5, 500, 499).cleared);
  check('page task 5: run-out at 45 mm (µm)', ALm.runout('soda', 1.5) * 45e-3, 0.43, 0.01);
  check('page task 6: four-point probe V/I (mΩ)', 1000 * run({}).VI, 11.7, 0.005);
  // a careful run is on target
  { const r = run({}); check('careful run: mean resistance (Ω)', r.Rmean, G.R_TARGET, 0.02); check('careful run: all 69 dies pass', r.count.pass, 69, 0, 0);
    check('resist model = Development lesson (resist line width, µm)', r.L.cd, 2 * (5 - DVm.footEdge(DVm.develop2D({ I: r.L.I, E: r.L.E, d: r.L.d, S: DVm.MACK.pb70, X: 5, nz: 32, pac: r.L.pac }), 60)), 1e-12);
    const sc = G.score(r, G.grade({ qThick: 1.4, qSbMin: 90, qSbMax: 110, qSensMin: 310, qSensMax: 450, qDev: 60, qHbMin: 100, qHbMax: 110, qRate: 80 }, good), 0, 0);
    check('careful run with every document value right scores 100', sc.total, 100, 0, 0);
    check('one rework and one new wafer cost 15 points', G.score(r, [{ ok: true }], 1, 1).eco, 0, 0, 0); }
  // mistakes carry forward
  truth('underexposure → spaces not open → every die shorted', run({ dose: 34 }).count.short === 69);
  truth('etch stopped early → shorts at the centre first', (() => { const r = run({ tet: 60 }); return r.centre.cls === 'short' && r.count.pass > 0 && r.count.short > 0; })());
  truth('long overetch → resistance too high', run({ tet: 110 }).count.high === 69);
  truth('underexposed but open → lines too wide → resistance too low', run({ dose: 59.5 }).count.low === 69);
  truth('underbaked film sticks to the mask → opens', (() => { const r = run({ sbT: 80, sbt: 30 }); return r.L.stick && r.count.open === 69; })());
  truth('the data-sheet bake (100 °C, 60 s) does not stick', !run({}).L.stick);
  truth('hot, long soft bake: PAC lost, resist no longer opens', (() => { const r = run({ sbT: 140, sbt: 300 }); return r.L.pac < 0.5 && r.L.notOpen; })());
  truth('hard bake at 150 °C or more → no contact on any die; 145 °C still strips', run({ hbT: 150 }).count.nocontact === 69 && run({ hbT: 145 }).count.nocontact === 0);
  truth('skipped hard bake changes nothing (stated on the page)', run({ hbt: 0 }).Rmean === run({}).Rmean);
  truth('unaligned mask (3 µm off) → pads miss the windows', run({}, { ox: 3, oy: 0, oth: 0 }).count.nocontact === 69);
  truth('rotation of 100 µrad → only the dies near the edge lose contact', (() => { const r = run({}, { ox: 0, oy: 0, oth: 100 }); return r.count.nocontact > 0 && r.count.pass > 0 && r.centre.cls === 'pass'; })());
  truth('TMAH developer attacks the aluminium, AZ Developer does not', run({ dev: 'mif', tdev: 90 }).L.alLoss > 5 && run({}).L.alLoss === 0);
  truth('developer attack narrows the line slightly', run({ dev: 'naoh' }).Rmean > run({}).Rmean);
  // grading
  { const g = G.grade({ qThick: 1.9, qSbMin: 90 }, good); truth('grading: wrong thickness and empty answers are wrong, a right one is right', !g.find(x => x.id === 'qThick').ok && g.find(x => x.id === 'qSbMin').ok && !g.find(x => x.id === 'qDev').ok && g.length === 9); }
  { const g = run({}).reso, w = k => g.find(x => x.hp === k);
    truth('inspection, good recipe: the 5 µm and 2 µm groups print within 20 %', [5, 2].every(k => !w(k).notOpen && !w(k).gone && Math.abs(w(k).cd - k) <= 0.2 * k));
    truth('inspection, far too little dose: every group stays closed', run({ dose: 20 }).reso.every(x => x.notOpen));
    truth('inspection, more dose: the fine lines get thinner', run({ dose: 300 }).reso.find(x => x.hp === 1.5).cd < w(1.5).cd);
    check('inspection: the 5 µm group equals the resistor line (µm)', w(5).cd, run({}).L.cd, 0.02); }
  check('grading: etch-rate question follows the chosen temperature (Å/s)', G.questions({ ...good, etT: 't25' }).find(q => q.id === 'qRate').want, 30, 0, 0);
  { const w = G.newWafer(0, 1, 0.5); truth('new wafer: misalignment within ±3 µm and ±120 µrad', w.ox === -3 && w.oy === 3 && w.oth === 0); }
}

section('Progress: points and achievements (engine, kept in the browser)');
{
  const MFWn = require(path.join(__dirname, '..', 'assets', 'mfw.js')), P = MFWn.progress, PT = P.POINTS;
  const truth = (name, ok) => { n++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`); };
  const st = P.empty();
  check('an empty record has no points', P.total(st), 0, 0, 0);
  truth('and no achievements', P.earned(st).length === 0);
  P.record(st, { type: 'need', slug: 'dryetch', n: 2 });
  check('a wrong prediction still counts a little', P.record(st, { type: 'step', slug: 'dryetch', i: 1, kind: 'wrong' }), PT.wrong, 0, 0);
  check('answering it right later adds only the difference', P.record(st, { type: 'step', slug: 'dryetch', i: 1, kind: 'right' }), PT.right - PT.wrong, 0, 0);
  check('a worse repeat takes nothing away', P.record(st, { type: 'step', slug: 'dryetch', i: 1, kind: 'wrong' }), 0, 0, 0);
  truth('one step of two: tour not finished', !P.lessonDone(st, 'dryetch'));
  check('the last task gives its points plus the tour bonus', P.record(st, { type: 'step', slug: 'dryetch', i: 2, kind: 'solved' }), PT.solved + PT.tour, 0, 0);
  check('lesson total', P.lessonPoints(st, 'dryetch'), PT.right + PT.solved + PT.tour, 0, 0);
  truth('first answer, first tour and clean run are earned', ['first-answer', 'first-tour', 'clean-tour'].every(id => P.earned(st).includes(id)) && !P.earned(st).includes('five-tours'));
  { const s2 = P.empty(); P.record(s2, { type: 'need', slug: 'etching', n: 1 }); P.record(s2, { type: 'step', slug: 'etching', i: 3, kind: 'hint' });
    truth('a tour finished with “Show me” is finished but not a clean run', P.lessonDone(s2, 'etching') && !P.earned(s2).includes('clean-tour') && P.earned(s2).includes('first-tour')); }
  // every lesson finished → module marks and the full flow
  { const s3 = P.empty(), lessons = MFWn.PAGES.filter(p => p.slug !== 'processgame');
    lessons.forEach(p => { P.record(s3, { type: 'need', slug: p.slug, n: 1 }); P.record(s3, { type: 'step', slug: p.slug, i: 1, kind: 'solved' }); });
    const e = P.earned(s3);
    check('number of lessons with a tour', lessons.length, 21, 0, 0);
    truth('all tours → full process flow, five lessons, every module mark, own hands', e.includes('all-tours') && e.includes('five-tours') && e.includes('own-hands') && P.ACHIEVEMENTS.filter(a => a.module).every(a => e.includes(a.id)));
    check('one module mark per lesson module', P.ACHIEVEMENTS.filter(a => a.module).length, 8, 0, 0);
    truth('no game achievement without a run', !e.some(id => id.startsWith('game-'))); }
  // game
  check('the game counts with its score', P.record(st, { type: 'game', score: 72, reworks: 1, scraps: 0, docs: false }), 72, 0, 0);
  check('a better run adds the difference', P.record(st, { type: 'game', score: 95, reworks: 0, scraps: 0, docs: true }), 23, 0, 0);
  check('a worse run changes nothing', P.record(st, { type: 'game', score: 40, reworks: 0, scraps: 3, docs: false }), 0, 0, 0);
  truth('game achievements', ['game-done', 'game-90', 'game-first', 'game-docs', 'game-scrap'].every(id => P.earned(st).includes(id)));
  { const s4 = P.empty(); P.record(s4, { type: 'game', score: 85, reworks: 1, scraps: 0, docs: false }); truth('80 points after a rework is not first-pass yield', !P.earned(s4).includes('game-first') && P.earned(s4).includes('game-done')); }
  for (let i = 0; i < 5; i++) P.record(st, { type: 'source', slug: 'p' + i });
  truth('five source notes opened → fine print', P.earned(st).includes('fine-print'));
  truth('achievement ids are unique', new Set(P.ACHIEVEMENTS.map(a => a.id)).size === P.ACHIEVEMENTS.length);
  truth('ranks: Visitor at 0, Trainee from 100, top rank has no next', P.rank(0).name === 'Visitor' && P.rank(99).name === 'Visitor' && P.rank(100).name === 'Trainee' && P.rank(1e6).next === null && P.rank(1e6).frac === 1);
  check('rank bar: 200 points are halfway from Trainee to Operator', P.rank(200).frac, 0.5, 1e-12);
  check('most points of a tour with two predictions and one task', P.lessonMax([{}, { ask: 1 }, { ask: 1 }, { goal: 1 }]), 2 * PT.right + PT.solved + PT.tour, 0, 0);
  check('a tour without questions gives no points', P.lessonMax([{}, {}]), 0, 0, 0);
  truth('every badge has a mark and a colour family', P.ACHIEVEMENTS.every(a => a.mark && a.family));
}

console.log(`\n${n - fails}/${n} checks passed${fails ? `, ${fails} FAILED` : ''}.`);
process.exit(fails ? 1 : 0);
