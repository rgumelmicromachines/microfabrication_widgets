/* Contact sheet for visual review (browser, dev only): renders many states of the widget on one page-sized canvas.
   MFWSheet.make(list) – list of {step} or {label, P}; MFWSheet.steps(); MFWSheet.random(n). The canvas has id "sheet". */
(function () {
  'use strict';
  async function make(list, cols = 2, cw = 760) {
    const w = [...MFW.instances][0];
    const ch = Math.round(cw / w.aspect), rows = Math.ceil(list.length / cols);
    let cv = document.getElementById('sheet'); if (cv) cv.remove();
    cv = document.createElement('canvas'); cv.id = 'sheet'; cv.width = cols * cw; cv.height = rows * (ch + 22);
    cv.style.cssText = `position:absolute;left:0;top:0;z-index:999;width:${cols * cw}px;height:${rows * (ch + 22)}px;background:#888`;
    document.body.appendChild(cv);
    const g = cv.getContext('2d');
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.step !== undefined) { w.stop(); w.goStep(s.step, { instant: true }); }
      else { if (w.mode !== 'explore' && w.hasTour) w.setMode('explore'); Object.assign(w.P, s.P); }
      w.renderNow();
      const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 22);
      g.drawImage(w.canvas, x, y + 22, cw, ch);
      g.fillStyle = '#ff0'; g.fillRect(x, y, cw, 22); g.fillStyle = '#000'; g.font = '13px sans-serif';
      g.fillText(((s.label || ('step ' + (s.step + 1))) + (w.captionEl.textContent ? '  |  ' + w.captionEl.textContent : '')).slice(0, 110), x + 6, y + 16);
    }
    window.scrollTo(0, 0);
    return [cv.width, cv.height];
  }
  const steps = () => make([...MFW.instances][0].cfg.steps.map((s, i) => ({ step: i })));
  function random(n, seed = 7) {
    const w = [...MFW.instances][0], list = [];
    let st = seed >>> 0; const R = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
    for (let i = 0; i < n; i++) {
      const P = {};
      for (const [k, d] of Object.entries(w.cfg.params)) {
        if (d.options) { const o = Object.keys(d.options); P[k] = o[Math.floor(R() * o.length)]; }
        else if (typeof d.value === 'boolean') P[k] = R() < 0.5;
        else { const u = R(); P[k] = d.log ? 10 ** (Math.log10(d.min) + u * (Math.log10(d.max) - Math.log10(d.min))) : d.min + u * (d.max - d.min); }
      }
      list.push({ label: Object.entries(P).map(([k, x]) => `${k}=${typeof x === 'number' ? +x.toPrecision(3) : x}`).join(' '), P });
    }
    return make(list);
  }
  window.MFWSheet = { make, steps, random };
}());
