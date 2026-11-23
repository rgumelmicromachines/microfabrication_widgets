# Contents-page miniatures

Each `<slug>-light.jpg` / `<slug>-dark.jpg` is a screenshot of that lesson's own figure (`.mfw-stage`) in the
first tour step, taken in a 1440 × 900 browser window (spin coating frozen at t = 6 s with `MFW_SPIN_TP`),
cropped by the 1 px plate border and scaled to 640 px wide (JPEG, quality 84). Nothing is drawn by hand.

Regenerate after a figure changes visibly: capture the stages again (Playwright or the preview browser), then
scale them down the same way.
