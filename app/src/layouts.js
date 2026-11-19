// Vice City Cover Studio — cover layouts.
// Every layout is a list of panels as normalized rects (fractions of the
// cover's width and height), so a cover looks the same at 1080x1080,
// 1080x1350 and 1920x1080. A panel may carry a tilt in degrees for the
// snapshot-strip layout. The title band is drawn over the sky backdrop
// below the panels, never inside a photo.

export const LAYOUTS = {
  hero3: {
    name: 'Hero + 3',
    blurb: 'One big hero shot, three moments underneath.',
    panels: [
      { x: 0.035, y: 0.035, w: 0.93, h: 0.52 },
      { x: 0.035, y: 0.595, w: 0.295, h: 0.27 },
      { x: 0.3525, y: 0.595, w: 0.295, h: 0.27 },
      { x: 0.67, y: 0.595, w: 0.295, h: 0.27 },
    ],
  },
  grid2: {
    name: '2 x 2 Grid',
    blurb: 'Four equal frames, classic poster grid.',
    panels: [
      { x: 0.035, y: 0.035, w: 0.455, h: 0.40 },
      { x: 0.51, y: 0.035, w: 0.455, h: 0.40 },
      { x: 0.035, y: 0.455, w: 0.455, h: 0.40 },
      { x: 0.51, y: 0.455, w: 0.455, h: 0.40 },
    ],
  },
  fullbleed: {
    name: 'Full Bleed',
    blurb: 'One photo edge to edge, title over the sky.',
    panels: [
      { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
    ],
  },
  grid9: {
    name: '9-Panel Grid',
    blurb: 'A contact sheet of nine moments.',
    panels: [
      { x: 0.03, y: 0.03, w: 0.30, h: 0.27 },
      { x: 0.35, y: 0.03, w: 0.30, h: 0.27 },
      { x: 0.67, y: 0.03, w: 0.30, h: 0.27 },
      { x: 0.03, y: 0.32, w: 0.30, h: 0.27 },
      { x: 0.35, y: 0.32, w: 0.30, h: 0.27 },
      { x: 0.67, y: 0.32, w: 0.30, h: 0.27 },
      { x: 0.03, y: 0.61, w: 0.30, h: 0.24 },
      { x: 0.35, y: 0.61, w: 0.30, h: 0.24 },
      { x: 0.67, y: 0.61, w: 0.30, h: 0.24 },
    ],
  },
  strip: {
    name: 'Snapshot Strip',
    blurb: 'Tilted polaroids scattered on the sunset.',
    panels: [
      { x: 0.05, y: 0.10, w: 0.40, h: 0.34, tilt: -4 },
      { x: 0.55, y: 0.06, w: 0.40, h: 0.34, tilt: 3 },
      { x: 0.08, y: 0.50, w: 0.40, h: 0.34, tilt: 2.5 },
      { x: 0.52, y: 0.46, w: 0.40, h: 0.34, tilt: -3 },
    ],
  },
};

/** The layout ids, in the order the picker shows them. */
export const LAYOUT_ORDER = ['hero3', 'grid2', 'fullbleed', 'grid9', 'strip'];

/** How many photo panels a layout holds. */
export function panelCount(layoutId) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.hero3;
  return layout.panels.length;
}

/** A layout's panel rects as pixel rects on a canvas of W by H. */
export function layoutRects(layoutId, W, H) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.hero3;
  return layout.panels.map((p) => ({
    x: p.x * W,
    y: p.y * H,
    w: p.w * W,
    h: p.h * H,
    tilt: p.tilt ?? 0,
  }));
}
