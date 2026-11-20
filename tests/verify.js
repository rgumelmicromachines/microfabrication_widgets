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
  check('bare Si reflectance at 632.8 nm (Green 2008: n = 3.88, k = 0.016)', DE.reflectance(0), ((3.877 - 1) ** 2 + 0.0163 ** 2) / ((3.877 + 1) ** 2 + 0.0163 ** 2), 1e-3);
  check('one fringe per λ/2n: R(d + λ/2n) = R(d)', DE.reflectance(400 + s.period), DE.reflectance(400), 1e-9);
  check('fringe period for SiO₂ at 632.8 nm (nm)', s.period, 217.2, 1e-3);
  check('page task 1: bias (nm)', DE.state({ hf: 500, Rv: 50, Rl: 5, W: 1000, t: 12, Ssi: 20, Sr: 3, hr: 1000 }).B, 120, 1e-12);
  check('page task 1: Si recess (nm)', DE.state({ hf: 500, Rv: 50, Rl: 5, W: 1000, t: 12, Ssi: 20, Sr: 3, hr: 1000 }).recess, 5, 1e-12);
  check('page task 2: fringes in 800 nm', DE.state({ ...o, hf: 800 }).fringes, 3.68, 0.01); }

console.log(`\n${n - fails}/${n} checks passed${fails ? `, ${fails} FAILED` : ''}.`);
process.exit(fails ? 1 : 0);
