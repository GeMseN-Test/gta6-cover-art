/* Cover renderer: draws the whole poster onto a canvas at any size.
   Steps: sky backdrop -> photos in their panels (cover-fit, zoom, drag offset)
   -> colour-grade washes -> white panel gaps and borders -> bold caption
   with outline and shadow -> neon subtitle -> film grain + vignette.
   Nothing here touches the network; photos are Image objects already loaded. */

import { panelRectsPx } from './layouts.js';
import { gradeDef, gradeFilter, washGradient } from './grades.js';

/** A small tile of random grey noise, reused for the film grain. */
function makeGrainTile(size = 128) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 40) - 20;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  return tile;
}

const GRAIN_TILE = makeGrainTile();

/** Sunset sky behind the panels (also the backdrop of the strip layout). */
function drawSkyBackdrop(ctx, w, h, grade) {
  const def = gradeDef(grade);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (grade === 'neon') {
    sky.addColorStop(0, '#1b0f3a');
    sky.addColorStop(0.55, '#3d1160');
    sky.addColorStop(1, '#0d0518');
  } else if (grade === 'palm') {
    sky.addColorStop(0, '#ffe9a8');
    sky.addColorStop(0.55, '#f7b733');
    sky.addColorStop(1, '#0b3d4d');
  } else if (grade === 'noir') {
    sky.addColorStop(0, '#e8e8e8');
    sky.addColorStop(0.55, '#8a8a8a');
    sky.addColorStop(1, '#111111');
  } else {
    sky.addColorStop(0, '#ffd23c');
    sky.addColorStop(0.45, '#ff7a3c');
    sky.addColorStop(0.75, '#ff2e88');
    sky.addColorStop(1, '#4b1d8f');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // A low sun disc, soft and huge, for the sunset grades.
  if (grade === 'sunset' || grade === 'palm') {
    const sunR = Math.min(w, h) * 0.16;
    const sun = ctx.createRadialGradient(w * 0.72, h * 0.30, 0, w * 0.72, h * 0.30, sunR);
    sun.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    sun.addColorStop(0.6, 'rgba(255, 170, 80, 0.55)');
    sun.addColorStop(1, 'rgba(255, 120, 60, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  }
  void def;
}

/**
 * Draw one photo into a panel rect, cover-fit, with the panel's zoom and
 * drag offset (offsets are fractions of the panel size, -1..1).
 */
function drawPhotoInPanel(ctx, image, rect, panel, grade) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const scale = Math.max(rect.w / iw, rect.h / ih) * panel.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + panel.offsetX * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + panel.offsetY * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = gradeFilter(grade);
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

/** Wash a grade's gradients over one panel rect. */
function applyGradeWashes(ctx, rect, grade, strength) {
  const def = gradeDef(grade);
  for (const wash of def.washes) {
    ctx.save();
    ctx.globalAlpha = wash.alpha * strength;
    ctx.globalCompositeOperation = wash.blend;
    ctx.fillStyle = washGradient(ctx, wash, rect);
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
  if (def.tintAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = def.tintAlpha * strength;
    ctx.fillStyle = def.tint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

/** A soft dark edge so photos melt into the poster, plus film grain. */
function applyVignetteAndGrain(ctx, w, h) {
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(10, 2, 20, 0.38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const pattern = ctx.createPattern(GRAIN_TILE, 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/**
 * Fit one line of text to a max width by shrinking the font until it fits.
 * Returns the font size that fits.
 */
function fitFontSize(ctx, text, maxWidth, startSize, fontFor) {
  let size = startSize;
  while (size > 12) {
    ctx.font = fontFor(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

/** The bold poster title: white fill, dark outline, hard drop shadow. */
function drawTitle(ctx, w, h, state) {
  const title = (state.title || '').trim().toUpperCase();
  if (!title) return;
  const baseSize = Math.min(w, h) * 0.115 * state.titleScale;
  const maxWidth = w * 0.92;
  const fontFor = (size) => `900 ${size}px Impact, "Arial Black", "Franklin Gothic Medium", sans-serif`;
  const size = fitFontSize(ctx, title, maxWidth, baseSize, fontFor);
  const y = h * state.titleY;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = fontFor(size);
  ctx.lineJoin = 'round';
  // Hard offset shadow, poster style.
  ctx.shadowColor = 'rgba(20, 2, 30, 0.85)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = size * 0.055;
  ctx.shadowOffsetY = size * 0.055;
  ctx.strokeStyle = '#1a051f';
  ctx.lineWidth = size * 0.09;
  ctx.strokeText(title, w / 2, y);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  // Warm gradient fill, like sunlit lettering.
  const fill = ctx.createLinearGradient(0, y - size, 0, y + size * 0.12);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.55, '#ffe9c9');
  fill.addColorStop(1, '#ffb35c');
  ctx.fillStyle = fill;
  ctx.fillText(title, w / 2, y);
  ctx.restore();
}

/** The neon script subtitle under the title, glowing pink. */
function drawSubtitle(ctx, w, h, state) {
  if (!state.showSubtitle) return;
  const text = (state.subtitle || '').trim();
  if (!text) return;
  const size = Math.min(w, h) * 0.052;
  const y = h * state.titleY + size * 1.15;
  if (y > h * 0.97) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 700 ${size}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = size * 0.55;
  ctx.fillStyle = '#ffe3f1';
  ctx.fillText(text, w / 2, y);
  // A second pass makes the glow bloom without blurring the letters.
  ctx.shadowBlur = size * 0.2;
  ctx.fillText(text, w / 2, y);
  ctx.restore();
}

/**
 * Render the whole cover onto `canvas` at its own pixel size.
 * `photos` is the PhotoStore; panels without a photo get a placeholder
 * gradient so the layout still reads as a poster.
 */
export function renderCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const strength = state.gradeStrength ?? 0.75;
  const rects = panelRectsPx(state.layout, w, h);

  ctx.clearRect(0, 0, w, h);
  drawSkyBackdrop(ctx, w, h, state.grade);

  const gap = Math.max(2, Math.min(w, h) * 0.012);
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const panel = state.panels[i];
    const photo = panel && panel.photoId ? photos.get(panel.photoId) : null;
    ctx.save();
    if (rect.rotate) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rotate * Math.PI) / 180);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    if (photo) {
      drawPhotoInPanel(ctx, photo.image, rect, panel, state.grade);
    } else {
      // Placeholder: a soft gradient with a big plus, so an empty panel
      // still looks like part of the poster.
      const ph = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      ph.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
      ph.addColorStop(1, 'rgba(20, 5, 35, 0.35)');
      ctx.fillStyle = ph;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = `700 ${Math.min(rect.w, rect.h) * 0.28}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    applyGradeWashes(ctx, rect, state.grade, strength);
    // Crisp white frame around each panel.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = gap;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  drawTitle(ctx, w, h, state);
  drawSubtitle(ctx, w, h, state);
  applyVignetteAndGrain(ctx, w, h);
  return canvas;
}

/** Does this state have at least one photo on the cover? */
export function hasAnyPhoto(state) {
  return state.panels.some((p) => p.photoId !== null);
}
