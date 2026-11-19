// Vice City Cover Studio — PNG export.
// Renders the cover at a post size on an offscreen canvas and downloads
// it as a PNG. The preview canvas and the export canvas run the same
// renderCover, so what you see is what you share.

import { renderCover } from './render.js';

/** The common post sizes, in the order the export bar shows them. */
export const EXPORT_SIZES = [
  { id: '1080x1080', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
];

/** A size by id, falling back to the square. */
export function sizeOf(sizeId) {
  return EXPORT_SIZES.find((s) => s.id === sizeId) ?? EXPORT_SIZES[0];
}

/** Render the cover at W by H and resolve with a PNG blob. */
export function renderPngBlob(state, images, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, w, h, state, images);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed: the canvas gave no image'));
    }, 'image/png');
  });
}

/** Download a blob as a file, then release its object URL. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** A tidy file name for an export: vice-city-cover-1080x1080.png. */
export function exportName(state, sizeId) {
  const slug = (state.title || 'vice-city')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'vice-city';
  return `${slug}-cover-${sizeId}.png`;
}

/** Export one size and download it. Returns the blob's byte size. */
export async function exportOne(state, images, sizeId) {
  const size = sizeOf(sizeId);
  const blob = await renderPngBlob(state, images, size.w, size.h);
  downloadBlob(blob, exportName(state, size.id));
  return blob.size;
}

/** Export all three sizes, one after another. Returns the sizes done. */
export async function exportAll(state, images, onEach) {
  const done = [];
  for (const size of EXPORT_SIZES) {
    const bytes = await exportOne(state, images, size.id);
    done.push({ id: size.id, bytes });
    if (onEach) onEach(size.id, bytes);
    await new Promise((r) => setTimeout(r, 350));
  }
  return done;
}
