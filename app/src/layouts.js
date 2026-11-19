/* Cover layouts: where each panel sits, in fractions of the canvas (0..1).
   The same fractions scale to any export size, so a cover looks the same at
   1080x1080, 1080x1350 and 1920x1080. A panel is { x, y, w, h, rotate }.
   rotate is in degrees and only the snapshot strip uses it. */

const GAP = 0.012; // white gap between panels, as a fraction of the short side

function grid(rows, cols, top = 0, height = 1) {
  const panels = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      panels.push({
        x: (c / cols) + GAP / 2,
        y: top + (r / rows) * height + GAP / 2,
        w: 1 / cols - GAP,
        h: height / rows - GAP,
        rotate: 0,
      });
    }
  }
  return panels;
}

export const LAYOUT_DEFS = {
  // One big hero photo on top, three small panels along the bottom.
  hero3: [
    { x: 0, y: 0, w: 1, h: 0.6, rotate: 0 },
    { x: 0, y: 0.6 + GAP / 2, w: 1 / 3 - GAP, h: 0.4 - GAP, rotate: 0 },
    { x: 1 / 3 + GAP / 2, y: 0.6 + GAP / 2, w: 1 / 3 - GAP, h: 0.4 - GAP, rotate: 0 },
    { x: 2 / 3 + GAP / 2, y: 0.6 + GAP / 2, w: 1 / 3 - GAP, h: 0.4 - GAP, rotate: 0 },
  ],
  // Four equal panels.
  grid2: grid(2, 2),
  // One photo fills the whole cover; the caption sits on top of it.
  full: [{ x: 0, y: 0, w: 1, h: 1, rotate: 0 }],
  // Nine equal panels, a contact-sheet poster.
  grid9: grid(3, 3),
  // Five tilted snapshots fanned across a gradient sky, like photos on a wall.
  strip: [
    { x: 0.03, y: 0.10, w: 0.30, h: 0.52, rotate: -7 },
    { x: 0.21, y: 0.05, w: 0.30, h: 0.52, rotate: -2 },
    { x: 0.40, y: 0.03, w: 0.30, h: 0.52, rotate: 2 },
    { x: 0.58, y: 0.05, w: 0.30, h: 0.52, rotate: 6 },
    { x: 0.72, y: 0.12, w: 0.26, h: 0.48, rotate: 9 },
  ],
};

/** Panel rects for a layout, in fractions of the canvas. */
export function panelsForLayout(layout) {
  return LAYOUT_DEFS[layout] ?? LAYOUT_DEFS.hero3;
}

/** How many panels a layout shows. */
export function panelCountForLayout(layout) {
  return panelsForLayout(layout).length;
}

/** Panel rects in pixels for a canvas of width w and height h. */
export function panelRectsPx(layout, w, h) {
  return panelsForLayout(layout).map((p) => ({
    x: p.x * w,
    y: p.y * h,
    w: p.w * w,
    h: p.h * h,
    rotate: p.rotate,
  }));
}

/** Which panel (if any) contains point (px, py) on a canvas of w x h. */
export function panelAtPoint(layout, w, h, px, py) {
  const rects = panelRectsPx(layout, w, h);
  // Later panels are drawn on top, so test them first.
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}
