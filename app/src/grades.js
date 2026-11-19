// Vice City Cover Studio — colour grades.
// Each grade paints the sky backdrop, tints the photos with a canvas
// wash, and sets the subtitle's neon glow. No image leaves the machine:
// every wash is drawn on the canvas itself.

export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    blurb: 'Orange-pink dusk over the bay.',
    skyTop: '#2b1055',
    skyMid: '#c94b7c',
    skyLow: '#ff9a5a',
    horizon: '#ffd28a',
    sun: '#fff3c4',
    sunGlow: 'rgba(255, 150, 80, 0.55)',
    wash: 'rgba(255, 110, 60, 0.16)',
    washMode: 'overlay',
    saturate: 1.25,
    contrast: 1.08,
    grain: 0.05,
    vignette: 0.32,
    neon: '#ff5da2',
    neonSoft: '#ffd166',
  },
  neon: {
    name: 'Neon Night',
    blurb: 'Electric pink and cyan after dark.',
    skyTop: '#0b0620',
    skyMid: '#3b0f66',
    skyLow: '#b5179e',
    horizon: '#4cc9f0',
    sun: '#f72585',
    sunGlow: 'rgba(247, 37, 133, 0.5)',
    wash: 'rgba(120, 40, 220, 0.20)',
    washMode: 'soft-light',
    saturate: 1.35,
    contrast: 1.12,
    grain: 0.07,
    vignette: 0.42,
    neon: '#4cc9f0',
    neonSoft: '#f72585',
  },
  gold: {
    name: 'Palm Gold',
    blurb: 'Warm golden hour, long shadows.',
    skyTop: '#3a1c0d',
    skyMid: '#b4652a',
    skyLow: '#f7b733',
    horizon: '#ffe9a8',
    sun: '#fff8d6',
    sunGlow: 'rgba(255, 190, 60, 0.55)',
    wash: 'rgba(255, 180, 40, 0.14)',
    washMode: 'overlay',
    saturate: 1.15,
    contrast: 1.05,
    grain: 0.04,
    vignette: 0.28,
    neon: '#ffb703',
    neonSoft: '#fb8500',
  },
  noir: {
    name: 'Mono Noir',
    blurb: 'Black and white with a hot-pink accent.',
    skyTop: '#0a0a0c',
    skyMid: '#3a3a40',
    skyLow: '#8a8a90',
    horizon: '#d8d8de',
    sun: '#ffffff',
    sunGlow: 'rgba(255, 255, 255, 0.35)',
    wash: 'rgba(255, 255, 255, 0.10)',
    washMode: 'soft-light',
    saturate: 0.0,
    contrast: 1.18,
    grain: 0.09,
    vignette: 0.45,
    neon: '#ff2e88',
    neonSoft: '#ffffff',
  },
};

/** The grade ids, in the order the picker shows them. */
export const GRADE_ORDER = ['sunset', 'neon', 'gold', 'noir'];

/** A grade by id, falling back to Vice Sunset. */
export function gradeOf(gradeId) {
  return GRADES[gradeId] ?? GRADES.sunset;
}
