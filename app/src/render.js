// Vice City Cover Studio — the canvas renderer.
// Draws the whole cover: sunset sky with a low sun and a skyline, the
// photo panels (cover-fit, white frames, optional tilt), the bold title
// with a warm gradient fill, the glowing neon subtitle, then the grade
// wash, grain and vignette. Everything is drawn from the state, so the
// editor preview and the exported PNG are the same picture.

import { layoutRects } from './layouts.js';
import { gradeOf } from './grades.js';

/** A tiny deterministic random generator, so grain never flickers. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A reusable grain tile: random grey dots on a transparent canvas. */
function grainTile(size = 160, seed = 20261119) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const g = tile.getContext('2d');
  const rand = mulberry32(seed);
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.floor(rand() * 38);
  }
  g.putImageData(img, 0, 0);
  return tile;
}

let cachedGrain = null;
function grainPattern(ctx) {
  if (!cachedGrain) cachedGrain = ctx.createPattern(grainTile(), 'repeat');
  return cachedGrain;
}

/** The sky: a three-stop sunset gradient, a glowing low sun, soft clouds. */
function drawSky(ctx, W, H, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.45, grade.skyMid);
  sky.addColorStop(0.8, grade.skyLow);
  sky.addColorStop(1, grade.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun: a wide glow, then the disc itself, low on the horizon.
  const sunX = W * 0.68;
  const sunY = H * 0.52;
  const sunR = Math.min(W, H) * 0.11;
  const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.2);
  glow.addColorStop(0, grade.sunGlow);
  glow.addColorStop(1, 'rgba(255, 120, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = grade.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Soft horizontal cloud bands catching the light.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  const rand = mulberry32(7);
  for (let i = 0; i < 9; i++) {
    const cy = H * (0.08 + rand() * 0.4);
    const cw = W * (0.2 + rand() * 0.45);
    const cx = rand() * W;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, H * 0.014, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A dark skyline silhouette with a few lit windows, along the bottom.
 * A solid dark ground band first, so the strip under the title reads as
 * night ground — never as bright bars — with the towers rising from it. */
function drawSkyline(ctx, W, H, grade) {
  const base = H * 0.86;
  ctx.fillStyle = 'rgba(16, 5, 28, 0.94)';
  ctx.fillRect(0, base, W, H - base);
  const rand = mulberry32(42);
  ctx.fillStyle = 'rgba(9, 3, 18, 0.95)';
  let x = 0;
  while (x < W) {
    const bw = W * (0.02 + rand() * 0.05);
    const bh = H * (0.02 + rand() * 0.08);
    ctx.fillRect(x, base - bh, bw, bh);
    // A couple of lit windows on taller towers.
    if (bh > H * 0.06) {
      ctx.fillStyle = 'rgba(255, 214, 120, 0.9)';
      ctx.fillRect(x + bw * 0.3, base - bh + bh * 0.25, bw * 0.12, bh * 0.08);
      ctx.fillRect(x + bw * 0.6, base - bh + bh * 0.45, bw * 0.12, bh * 0.08);
      ctx.fillStyle = 'rgba(9, 3, 18, 0.95)';
    }
    x += bw + W * 0.012;
  }
}

/** Draw one photo cover-fit inside a rect, with zoom and drag offsets. */
function drawPhotoCover(ctx, img, rect, panel, grade) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (panel.oy || 0) * rect.h;
  ctx.save();
  ctx.filter = `saturate(${grade.saturate}) contrast(${grade.contrast})`;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** An empty panel: a dark placeholder with a photo icon and a hint. */
function drawEmptyPanel(ctx, rect, index) {
  ctx.fillStyle = 'rgba(12, 6, 24, 0.72)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1.5, rect.w * 0.006);
  ctx.setLineDash([rect.w * 0.02, rect.w * 0.015]);
  ctx.strokeRect(rect.x + rect.w * 0.04, rect.y + rect.h * 0.05, rect.w * 0.92, rect.h * 0.9);
  ctx.setLineDash([]);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const s = Math.min(rect.w, rect.h) * 0.16;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.strokeRect(cx - s, cy - s * 0.7, s * 2, s * 1.4);
  ctx.beginPath();
  ctx.arc(cx - s * 0.45, cy - s * 0.35, s * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.7);
  ctx.lineTo(cx - s * 0.2, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.25, cy + s * 0.35);
  ctx.lineTo(cx + s * 0.6, cy);
  ctx.lineTo(cx + s, cy + s * 0.7);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `600 ${Math.max(11, rect.w * 0.045)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`PHOTO ${index + 1} — CLICK TO ADD`, cx, cy + s * 0.95);
}

/** The big title: condensed capitals, warm gradient, hard shadow. */
function drawTitle(ctx, W, H, state, grade) {
  const text = (state.title || 'VICE CITY').toUpperCase();
  const size = H * 0.115 * (state.titleSize || 1);
  const y = H * (state.titleY ?? 0.94);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${size}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
  ctx.letterSpacing = `${size * 0.02}px`;
  // Hard offset shadow, then a dark outline, then the warm gradient fill.
  ctx.fillStyle = 'rgba(20, 4, 28, 0.85)';
  ctx.fillText(text, W / 2 + size * 0.045, y + size * 0.05);
  const fill = ctx.createLinearGradient(0, y - size, 0, y + size * 0.1);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.45, '#ffe9a8');
  fill.addColorStop(0.75, '#ffb703');
  fill.addColorStop(1, '#fb6f00');
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeStyle = '#1c0a24';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, W / 2, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

/** The subtitle: neon script glowing over the title's tail. */
function drawSubtitle(ctx, W, H, state, grade) {
  const text = state.subtitle || '';
  if (!text.trim()) return;
  const size = H * 0.042;
  const y = H * (state.titleY ?? 0.94) - H * 0.115 * (state.titleSize || 1) - H * 0.012;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 700 ${size}px "Brush Script MT", "Segoe Script", "Comic Sans MS", cursive`;
  ctx.shadowColor = grade.neon;
  ctx.shadowBlur = size * 0.55;
  ctx.fillStyle = grade.neonSoft;
  ctx.fillText(text, W / 2, y);
  ctx.shadowBlur = size * 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, W / 2, y);
  ctx.restore();
}

/** A scrim behind the title on the full-bleed layout, so it always reads. */
function drawTitleScrim(ctx, W, H, state) {
  if (state.layout !== 'fullbleed') return;
  const y = H * (state.titleY ?? 0.94);
  const grad = ctx.createLinearGradient(0, y - H * 0.22, 0, H);
  grad.addColorStop(0, 'rgba(10, 4, 20, 0)');
  grad.addColorStop(1, 'rgba(10, 4, 20, 0.62)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y - H * 0.22, W, H * 0.22 + 1);
}

/**
 * Render the whole cover onto ctx at W by H.
 * `images` maps a photo src to a loaded HTMLImageElement (or null).
 */
export function renderCover(ctx, W, H, state, images) {
  const grade = gradeOf(state.grade);
  ctx.clearRect(0, 0, W, H);
  drawSky(ctx, W, H, grade);
  drawSkyline(ctx, W, H, grade);

  const rects = layoutRects(state.layout, W, H);
  const frame = Math.max(3, Math.min(W, H) * 0.008);
  rects.forEach((rect, i) => {
    const panel = state.panels[i];
    if (!panel) return;
    ctx.save();
    if (rect.tilt) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.tilt * Math.PI) / 180);
      ctx.translate(-rect.w / 2, -rect.h / 2);
      rect = { ...rect, x: 0, y: 0 };
    }
    // White poster frame, then the photo clipped inside it.
    ctx.fillStyle = '#fdfbf7';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.min(W, H) * 0.02;
    ctx.shadowOffsetY = Math.min(W, H) * 0.006;
    ctx.fillRect(rect.x - frame, rect.y - frame, rect.w + frame * 2, rect.h + frame * 2);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const img = panel.photo ? images.get(panel.photo.src) : null;
    if (img) drawPhotoCover(ctx, img, rect, panel, grade);
    else drawEmptyPanel(ctx, rect, i);
    ctx.restore();
  });

  drawTitleScrim(ctx, W, H, state);
  drawTitle(ctx, W, H, state, grade);
  drawSubtitle(ctx, W, H, state, grade);

  // Grade wash, grain and vignette over the whole cover.
  ctx.save();
  ctx.globalCompositeOperation = grade.washMode;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = grade.grain * 2.2;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, `rgba(0, 0, 0, ${grade.vignette})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** Measure the title's width at a size, for the editor's fit check. */
export function titleWidth(ctx, text, size) {
  ctx.save();
  ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  const w = ctx.measureText((text || '').toUpperCase()).width;
  ctx.restore();
  return w;
}
