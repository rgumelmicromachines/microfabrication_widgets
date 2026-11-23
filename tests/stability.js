/* Layout-stability and frame-cost check (browser, dev only).
   MFWStability.run() drags every visible slider through its range in Explore mode (real 'input' events, one per frame)
   and reports how far any control, the stage or the caption moved on the page, and the slowest draw() in ms. */
(function () {
  'use strict';
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  async function run(steps = 40) {
    const w = [...MFW.instances][0];
    if (w.hasTour) w.setMode('explore');
    await frame();
    await new Promise(r => setTimeout(r, 350));          // let the caption cross-fade of the mode switch finish
    let slow = 0;
    const draw0 = w._draw.bind(w);
    w._draw = function () { const t = performance.now(); draw0(); slow = Math.max(slow, performance.now() - t); };
    const report = [];
    const watched = () => [...w.root.querySelectorAll('.mfw-param, .mfw-check, .mfw-stage, .mfw-caption, .mfw-readout, .mfw-explain')].filter(e => !e.hidden && e.offsetParent);
    for (const [name, c] of Object.entries(w.controls)) {
      if (!c.inp || c.inp.type !== 'range' || c.lab.hidden || c.inp.disabled) continue;
      // sticky elements (the stage on wide screens) stay put on screen while the page scrolls: compare them in viewport
      // coordinates; everything else in page coordinates. Controls hidden by a `when` condition are skipped.
      const isSticky = e => !!e.closest('.mfw-stagewrap') && getComputedStyle(e.closest('.mfw-stagewrap')).position === 'sticky';
      const pos = e => e.getBoundingClientRect().top + (isSticky(e) ? 0 : window.scrollY);
      c.inp.focus(); await frame();                       // focusing may scroll the page – measure after that
      const els = watched(), top0 = els.map(pos);
      const y0 = c.inp.getBoundingClientRect().top + window.scrollY;
      let maxMove = 0, sliderMove = 0, who = '';
      const min = parseFloat(c.inp.min), max = parseFloat(c.inp.max), start = c.inp.value;
      slow = 0;
      for (let i = 0; i <= steps; i++) {
        c.inp.value = String(min + (max - min) * i / steps);
        c.inp.focus();
        c.inp.dispatchEvent(new Event('input', { bubbles: true }));
        await frame();
        els.forEach((e, j) => {
          if (e.contains(c.inp) || e.classList.contains('mfw-readout') || !e.offsetParent) return;   // readout grows below everything; hidden controls
          const d = Math.abs(pos(e) - top0[j]);
          if (d > maxMove) { maxMove = d; who = e.className; }
        });
        sliderMove = Math.max(sliderMove, Math.abs(c.inp.getBoundingClientRect().top + window.scrollY - y0));
      }
      c.inp.value = start; c.inp.dispatchEvent(new Event('input', { bubbles: true })); c.inp.blur();
      await frame();
      report.push({ name, sliderMovedPx: +sliderMove.toFixed(1), otherMovedPx: +maxMove.toFixed(1), movedEl: maxMove > 0.5 ? who : '', slowestDrawMs: +slow.toFixed(1) });
    }
    w._draw = draw0;
    return report;
  }
  window.MFWStability = { run };
}());
