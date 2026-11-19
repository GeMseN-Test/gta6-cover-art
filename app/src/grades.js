/* Colour grades: the sunset / neon look of a Vice City poster.
   Each grade is a set of translucent gradient washes drawn over a photo with
   'overlay' and 'soft-light' blending, plus a warm or cool tint. The photo
   itself is drawn first (grayscale + contrast for Mono Noir), so the grade
   works on any photo the user drops in. */

export const GRADE_DEFS = {
  sunset: {
    label: 'Vice Sunset',
    // Warm orange sky melting into magenta and violet.
    washes: [
      { type: 'linear', from: [0, 0], to: [0, 1], stops: [[0, '#ffd23c'], [0.45, '#ff7a3c'], [0.75, '#ff2e88'], [1, '#7b2ff7']], blend: 'overlay', alpha: 0.55 },
      { type: 'linear', from: [0, 1], to: [0, 0], stops: [[0, '#ff9a3c'], [1, '#ff2e88']], blend: 'soft-light', alpha: 0.5 },
    ],
    tint: '#ff8a3c',
    tintAlpha: 0.06,
    saturation: 1.15,
    contrast: 1.08,
  },
  neon: {
    label: 'Neon Night',
    // Hot pink against electric cyan, like a neon sign at midnight.
    washes: [
      { type: 'linear', from: [0, 0], to: [1, 1], stops: [[0, '#2ee6ff'], [0.5, '#2e7bff'], [1, '#ff2ee6']], blend: 'overlay', alpha: 0.55 },
      { type: 'radial', from: [0.5, 0.5], to: [0.5, 0.5], stops: [[0, '#ff2ee6'], [1, '#12081f']], blend: 'soft-light', alpha: 0.55 },
    ],
    tint: '#2e7bff',
    tintAlpha: 0.08,
    saturation: 1.25,
    contrast: 1.12,
  },
  palm: {
    label: 'Palm Gold',
    // Golden hour with a deep teal shadow, like late sun on palm leaves.
    washes: [
      { type: 'linear', from: [0, 0], to: [0, 1], stops: [[0, '#fff3b0'], [0.5, '#ffc93c'], [1, '#2fae7d']], blend: 'overlay', alpha: 0.5 },
      { type: 'linear', from: [0, 1], to: [0, 0], stops: [[0, '#0b3d4d'], [1, '#ffc93c']], blend: 'soft-light', alpha: 0.45 },
    ],
    tint: '#ffc93c',
    tintAlpha: 0.07,
    saturation: 1.1,
    contrast: 1.05,
  },
  noir: {
    label: 'Mono Noir',
    // Black and white with a hard contrast and a faint silver sheen.
    washes: [
      { type: 'linear', from: [0, 0], to: [0, 1], stops: [[0, '#ffffff'], [1, '#000000']], blend: 'soft-light', alpha: 0.35 },
    ],
    tint: '#888888',
    tintAlpha: 0.05,
    saturation: 0,
    contrast: 1.25,
  },
};

/** The grade definition for a grade name (falls back to sunset). */
export function gradeDef(grade) {
  return GRADE_DEFS[grade] ?? GRADE_DEFS.sunset;
}

/**
 * Build a CanvasGradient for one wash over a rect.
 * `wash.from` / `wash.to` are fractions of the rect; radial washes are
 * centred on the rect and fade to its corners.
 */
export function washGradient(ctx, wash, rect) {
  let gradient;
  if (wash.type === 'radial') {
    const cx = rect.x + wash.from[0] * rect.w;
    const cy = rect.y + wash.from[1] * rect.h;
    const radius = Math.max(rect.w, rect.h) * 0.75;
    gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  } else {
    gradient = ctx.createLinearGradient(
      rect.x + wash.from[0] * rect.w,
      rect.y + wash.from[1] * rect.h,
      rect.x + wash.to[0] * rect.w,
      rect.y + wash.to[1] * rect.h,
    );
  }
  for (const [offset, color] of wash.stops) gradient.addColorStop(offset, color);
  return gradient;
}

/** The CSS filter string that gives a photo its grade's punch before washes. */
export function gradeFilter(grade) {
  const def = gradeDef(grade);
  return `saturate(${def.saturation}) contrast(${def.contrast})`;
}
