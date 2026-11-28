/* Process game – one lithography level from the work order to the electrical test: an aluminium meander resistor with
   contact pads on existing contact windows. Pure functions, usable in the browser and in Node tests.
   The physics is taken from the lesson models (soft bake, lithography, development, alignment, PVD, dry etching,
   four-point probe); this file adds the data of the products, the scenario of the work order and the scoring.

   DATA OF THE PRODUCTS
   Spin curve of the AZ 1500 series: film thickness after soft bake at 1000 / 2000 / 3000 / 4000 rpm, read from the
     spin-curve graph of the technical data sheet "AZ 1500 Series – Positive Tone Photoresist", Merck, Rev. 03/21
     (150 mm wafers; reading accuracy about ±0.1 µm). An older data sheet of the series lists somewhat different
     values (for example 1.20 µm instead of 1.35 µm for AZ 1512 HS at 4000 rpm); the game follows the document the
     student is asked to open.
   Same data sheet: soft bake 90–110 °C, spectral sensitivity 310–450 nm, development 60 s (puddle or immersion),
     hard bake 100–110 °C.
   Lamp: 8.5 mW/cm² at 365 nm in the wafer plane of a 350 W mercury mask aligner (MicroChemicals GmbH, application
     note "Exposure of photoresists"). Proximity gap of a mask aligner 10–50 µm (SÜSS MicroTec, MJB4 brochure 02/2010).
   Exposure and development: model and parameters of the lesson "Development" (Dill parameters of AZ 1500 at 365 nm;
     Mack rate parameters of AZ 1350J in AZ Developer 1:1, prebake 70 °C – a stand-in, because no set is published
     for AZ 1500). The same rate parameters are used for every developer.
   Developer on aluminium: taken as 0 for AZ Developer ("optimised for minimal aluminium erosion", no rate published), 10 nm/min (0.26 N TMAH, Merck data sheet "AZ MIF Developers";
     MicroChemicals quotes 70 nm/min), 100 nm/min as reference rate for NaOH/KOH-based developers (quoted as
     "several 10 to over 100 nm/min").
   Positive resist cross-links above about 140 °C; "conventional strippers … or organic solvents reach their limits
     from hardbake temperatures of approx. 150 - 160°C" (MicroChemicals, application note "Hard bake, reflow and UV
     hardening of photoresists"). The game uses 150 °C. The same note: the resists are stable in H3PO4/HNO3 etchants
     "at least after a sufficient hardbake" – no number, so a missing hard bake has no effect in the game.
   Aluminium etchant (phosphoric / nitric / acetic acid): 30 Å/s at 25 °C and 80 Å/s at 40 °C, isotropic (Transene
     Company, "Aluminum Etchant Type A" product data). Photoresist is not attacked: 0 nm/min in Al Etch A
     (K. R. Williams, K. Gupta, M. Wasilik, J. Microelectromech. Syst. 12 (2003) 761, Table II).
   Resistivity of aluminium: 2.650 × 10⁻⁸ Ω·m at 293 K, bulk (P. D. Desai, H. M. James, C. Y. Ho, J. Phys. Chem. Ref.
     Data 13 (1984) 1131). A thin film has a higher resistivity; no thin-film value was verified, so the bulk value is
     a lower bound and all resistances of the game are lower bounds in the same sense.

   SCENARIO (work order – chosen for the game, not measured data)
   100 mm wafer, 500 nm evaporated aluminium at the centre from a small planar source 30 cm away (thickness profile:
   cosine law of the PVD lesson). Mask: meander of 5 µm lines and spaces, 60 mm long; the design expects 4.0 µm of
   electrical line width after the isotropic etch. Pads enclose the 10 µm contact windows by 2 µm. Soda-lime mask,
   room 1.5 K warmer than at the first exposure, marks 60 mm apart. Test limit ±10 % of the target resistance.

   RULES OF THE GAME (stated on the page)
   - Soft bake: a film that holds more solvent than the measured film of the soft-bake lesson after 90 °C / 50 s
     (the mildest bake in the manufacturer documents) sticks to the mask in contact printing and the pattern is lost.
   - PAC decomposed in the soft bake is lost for the exposure (pac option of the development model).
   - The developer attacks the aluminium sideways as fast as downwards; its attack and the etch are added up as one
     isotropic etch radius. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const W = n => require('../' + n + '/model.js');
    module.exports = factory(W('softbake'), W('lithography'), W('development'), W('alignment'), W('pvd'), W('dryetch'), W('fourpoint'));
  } else root.MFW_GAME = factory(root.MFW_SB, root.MFW_LITHO, root.MFW_DEV, root.MFW_ALN, root.MFW_PVD, root.MFW_DRY, root.MFW_4PP);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (SB, LI, DV, AL, PVD, DRY, FPP) {
  'use strict';
  const TDS = {
    url: 'https://www.microchemicals.com/dokumente/datenblaetter/tds/merck/en/tds_az_1500_series.pdf',
    rpm: [1000, 2000, 3000, 4000],
    resists: {                                                              // µm at the four speeds (graph, ±0.1 µm)
      az1505: { name: 'AZ 1505', t: [1.10, 0.82, 0.68, 0.60] },
      az1512: { name: 'AZ 1512 HS', t: [2.71, 1.94, 1.52, 1.35] },
      az1518: { name: 'AZ 1518', t: [3.94, 2.70, 2.19, 1.84] },
      az1529: { name: 'AZ 1529', t: [6.77, 4.61, 3.73, 3.24] },
    },
    softbake: [90, 110], sens: [310, 450], devTime: 60, hardbake: [100, 110],
  };
  const ETCH_URL = 'https://transene.com/aluminum/';
  const ETCH = { t25: { T: 25, As: 30 }, t40: { T: 40, As: 80 } };          // Å/s (Transene, Type A)
  const LAMP = 8.5;                                                         // mW/cm² at 365 nm (MicroChemicals)
  const RHO_AL = 2.650e-8;                                                  // Ω·m, bulk, 293 K (Desai et al. 1984)
  const AL_DEV = { azdev: 0, mif: 10, naoh: 100 };                          // nm/min used in the game (see above)
  const T_STRIP = 150;                                                      // °C: solvents no longer strip the resist (MicroChemicals)
  const ORDER = {                                                           // scenario
    h0: 500, srcDist: 30, srcN: 1,                                          // nm at the centre; cm; cosine exponent
    line: 5, length: 60e3, wTarget: 4,                                      // µm
    enclosure: 2, window: 10, marksL: 60, mask: 'soda', dT: 1.5,            // µm, µm, mm, –, K
    thick: [1.3, 1.6], tol: 0.10,                                           // resist thickness window (µm), test limit
  };
  const R_TARGET = RHO_AL * (ORDER.length * 1e-6) / (ORDER.wTarget * 1e-6 * ORDER.h0 * 1e-9);   // Ω
  const S_DEV = DV.MACK.pb70;
  const NX = 81, NZ = 32;

  /** Film thickness (µm) from the data-sheet spin curve: log–log interpolation, speeds limited to 1000–4000 rpm. */
  function thickness(resist, rpm) {
    const t = TDS.resists[resist].t, r = TDS.rpm, x = Math.min(r[3], Math.max(r[0], rpm));
    let i = 0;
    while (i < 2 && x > r[i + 1]) i++;
    const f = Math.log(x / r[i]) / Math.log(r[i + 1] / r[i]);
    return Math.exp(Math.log(t[i]) + f * Math.log(t[i + 1] / t[i]));
  }
  /** Residual solvent (wt%) of a film of thickness d (µm) after a hotplate bake – soft-bake lesson, slab of thickness d. */
  const solvent = (T, t, d) => SB.W0 - SB.desorbable(T) * SB.slabFraction(SB.diffusivity(T), t, d * 1e-4);
  const W_STICK = SB.solvent(90, 50);                                       // wt%: mildest documented bake, measured film
  /** Etch rate of the aluminium etchant in nm/min. */
  const etchRate = key => ETCH[key].As * 6;
  /** Local film thickness (nm) at the radius r (mm). */
  const filmAt = r => ORDER.h0 * PVD.thickness(r / 10, ORDER.srcDist, ORDER.srcN);

  /** The questions answered from the documents. recipe decides the expected value where it depends on a choice. */
  function questions(rc) {
    const th = thickness(rc.resist, rc.rpm);
    return [
      { id: 'qThick', station: 0, unit: 'µm', text: `Film thickness of ${TDS.resists[rc.resist].name} at ${Math.round(rc.rpm)} rpm from the spin curve`, want: th, tol: Math.max(0.15, 0.1 * th) },
      { id: 'qSbMin', station: 1, unit: '°C', text: 'Soft bake: lowest recommended temperature', want: TDS.softbake[0], tol: 0 },
      { id: 'qSbMax', station: 1, unit: '°C', text: 'Soft bake: highest recommended temperature', want: TDS.softbake[1], tol: 0 },
      { id: 'qSensMin', station: 3, unit: 'nm', text: 'Spectral sensitivity: shortest wavelength', want: TDS.sens[0], tol: 0 },
      { id: 'qSensMax', station: 3, unit: 'nm', text: 'Spectral sensitivity: longest wavelength', want: TDS.sens[1], tol: 0 },
      { id: 'qDev', station: 4, unit: 's', text: 'Development time in the data sheet', want: TDS.devTime, tol: 0 },
      { id: 'qHbMin', station: 5, unit: '°C', text: 'Hard bake: lowest recommended temperature', want: TDS.hardbake[0], tol: 0 },
      { id: 'qHbMax', station: 5, unit: '°C', text: 'Hard bake: highest recommended temperature', want: TDS.hardbake[1], tol: 0 },
      { id: 'qRate', station: 6, unit: 'Å/s', text: `Etch rate of the aluminium etchant at ${ETCH[rc.etT].T} °C`, want: ETCH[rc.etT].As, tol: 0 },
    ];
  }
  /** Grade the answers ({ id: number }): [{ id, ok, want, given }]. An empty answer is wrong. */
  function grade(ans, rc) {
    return questions(rc).map(q => {
      const g = ans ? ans[q.id] : undefined, ok = typeof g === 'number' && isFinite(g) && Math.abs(g - q.want) <= q.tol + 1e-9;
      return { ...q, given: g, ok };
    });
  }

  /** Lithography of one line: coating, bake, exposure, development. */
  function litho(rc) {
    const d = thickness(rc.resist, rc.rpm);
    const w = solvent(rc.sbT, rc.sbt, d), pac = SB.pacLeft(rc.sbT, rc.sbt);
    const gap = rc.mode === 'prox' ? rc.gap : 0, E = LAMP * rc.texp;
    const xs = []; for (let i = 0; i < NX; i++) xs.push(ORDER.line * i / (NX - 1));
    const I = LI.aerialImage({ mode: 'proximity', lambda: DV.DILL.lambda, hp: ORDER.line, xs, gap, resist: d, collimation: 2 });
    const R = DV.develop2D({ I, E, d, S: S_DEV, X: ORDER.line, nz: NZ, pac });
    const foot = DV.footEdge(R, rc.tdev), cd = 2 * (ORDER.line - foot);
    const tOpen = Math.max(0, rc.tdev - R.T[NZ * NX]);                       // s the aluminium in the space sees the developer
    return { d, w, pac, stick: w > W_STICK + 1e-9, gap, E, I, R, prof: DV.profile(R, rc.tdev), foot, cd,
      notOpen: foot <= 0, gone: foot >= ORDER.line, dark: Math.min(d, S_DEV.rmin * rc.tdev), tOpen, alLoss: AL_DEV[rc.dev] * tOpen / 60 };
  }
  /** Cross-section area (µm²) and widths of an aluminium line of resist width cd (µm) in a film h (nm) after an
      isotropic etch of radius r (nm) – wall shape from the etch-front model of the dry-etching lesson (R_l = R_v). */
  function lineSection(cd, h, r) {
    const pitch = 2 * ORDER.line * 1000, st = DRY.state({ hf: h, Rv: 1, Rl: 1, W: pitch - cd * 1000, t: r, Ssi: 1e9, Sr: 1e9, hr: 1 });
    if (r < h) return { cleared: false, area: Infinity, top: cd, bottom: Infinity };
    const n = 60;
    let a = 0;
    const wAt = y => Math.max(0, pitch - 2 * st.edge(y));
    for (let i = 0; i < n; i++) a += wAt((i + 0.5) * h / n) * h / n;          // nm²
    return { cleared: true, area: a * 1e-6, top: wAt(0) / 1000, bottom: wAt(h) / 1000, wEff: a / h / 1000 };
  }
  /** The whole run. rc: recipe, wf: { ox, oy (µm), oth (µrad) } – how the mask sat before the operator aligned it. */
  function run(rc, wf) {
    const L = litho(rc);
    const o = { Tx: wf.ox + rc.ax, Ty: wf.oy + rc.ay, th: wf.oth + rc.ath, M: AL.runout(ORDER.mask, ORDER.dT) };
    const mk = AL.marks(o, ORDER.marksL);
    const read = { lx: AL.vernier(mk.left.dx).reading, ly: AL.vernier(mk.left.dy).reading, rx: AL.vernier(mk.right.dx).reading, ry: AL.vernier(mk.right.dy).reading,
      off: [mk.left.dx, mk.left.dy, mk.right.dx, mk.right.dy].some(x => !AL.vernier(x).inRange) };
    const rate = etchRate(rc.etT), rEtch = L.alLoss + rate * rc.tet / 60;     // nm
    const xlink = rc.hbT >= T_STRIP && rc.hbt > 0;
    const mp = AL.map(o, ORDER.enclosure);
    const count = { pass: 0, high: 0, low: 0, open: 0, short: 0, nocontact: 0 };
    let sum = 0, sumDev = 0, nR = 0;
    const dies = mp.sites.map(s => {
      const h = filmAt(Math.hypot(s.x, s.y));
      let cls, R = NaN, sec = null;
      if (L.stick || L.gone) cls = 'open';
      else if (L.notOpen) cls = 'short';
      else {
        sec = lineSection(L.cd, h, rEtch);
        if (!sec.cleared) cls = 'short';
        else if (!(sec.area > 0)) cls = 'open';
        else {
          R = RHO_AL * ORDER.length * 1e-6 / (sec.area * 1e-12);
          cls = xlink || !s.ok ? 'nocontact' : Math.abs(R / R_TARGET - 1) <= ORDER.tol ? 'pass' : R > R_TARGET ? 'high' : 'low';
        }
      }
      if (isFinite(R) && cls !== 'nocontact') { sum += R; sumDev += Math.abs(R / R_TARGET - 1); nR++; }
      count[cls]++;
      return { x: s.x, y: s.y, dx: s.dx, dy: s.dy, h, cls, R, sec };
    });
    const centre = dies.find(d => d.x === 0 && d.y === 0);
    const tc0 = ORDER.h0 / rate * 60;                                          // s to clear the film at the centre
    return { L, o, mk, read, rate, rEtch, tc0, over: rc.tet / tc0 - 1, xlink, dies, count, n: dies.length, centre,
      yield: count.pass / dies.length, Rmean: nR ? sum / nR : NaN, dev: nR ? sumDev / nR : NaN, nR,
      Rs: RHO_AL / (ORDER.h0 * 1e-9), VI: RHO_AL / (ORDER.h0 * 1e-9) / FPP.K_INF, need: mp.need };
  }
  /** Score out of 100: resistance 35, yield 30, documents 20, economy 15. */
  function score(res, grades, reworks, scraps) {
    const acc = res.nR ? 35 * Math.min(1, Math.max(0, 1 - (res.dev - 0.02) / 0.18)) : 0;
    const yld = 30 * res.yield;
    const doc = 20 * grades.filter(g => g.ok).length / grades.length;
    const eco = Math.max(0, 15 - 5 * reworks - 10 * scraps);
    return { acc, yld, doc, eco, total: Math.round(acc + yld + doc + eco) };
  }
  /** A new wafer on the aligner: how far off the mask sits before alignment (u1…u3 uniform in 0…1). */
  const newWafer = (u1, u2, u3) => ({ ox: +(6 * u1 - 3).toFixed(2), oy: +(6 * u2 - 3).toFixed(2), oth: Math.round(240 * u3 - 120) });

  return { TDS, ETCH, ETCH_URL, LAMP, RHO_AL, AL_DEV, T_STRIP, ORDER, R_TARGET, S_DEV, W_STICK, NX, NZ, thickness, solvent, etchRate, filmAt,
    questions, grade, litho, lineSection, run, score, newWafer };
}));
