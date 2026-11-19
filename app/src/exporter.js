/* PNG export: re-render the cover at a post size and save it.
   Sizes are the common ones people actually post: square, portrait, wide. */

import { renderCover } from './render.js';

export const EXPORT_SIZES = [
  { label: '1080x1080', width: 1080, height: 1080, name: 'square' },
  { label: '1080x1350', width: 1080, height: 1350, name: 'portrait' },
  { label: '1920x1080', width: 1920, height: 1080, name: 'wide' },
];

/** Render the cover at a size and return a PNG blob. */
export function exportCoverBlob(state, photos, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  renderCover(canvas, state, photos);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('could not make a PNG'));
    }, 'image/png');
  });
}

/** Render at a size and trigger a download in the browser. */
export async function downloadCover(state, photos, size, title) {
  const blob = await exportCoverBlob(state, photos, size);
  const url = URL.createObjectURL(blob);
  const slug = (title || 'vice-city-cover').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vice-city-cover';
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}-${size.name}-${size.width}x${size.height}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return link.download;
}

/** Export all three sizes, one after another. Returns the file names. */
export async function downloadAllSizes(state, photos, title) {
  const names = [];
  for (const size of EXPORT_SIZES) {
    names.push(await downloadCover(state, photos, size, title));
  }
  return names;
}
