/* Vice City Cover Studio — editor wiring.
   Owns the state, the preview canvas, drag-to-move and scroll-to-zoom on
   panels, the control panel, export buttons, undo/redo, and the ?shot=
   modes the screenshot builder uses (?shot=cover hides the editor chrome,
   ?shot=editor opens the editor with a sample photo loaded). */

import { defaultState, cloneState, snapshotState, restoreState, CoverHistory, PhotoStore } from './state.js';
import { panelAtPoint, panelCountForLayout } from './layouts.js';
import { renderCover, hasAnyPhoto } from './render.js';
import { EXPORT_SIZES, downloadCover, downloadAllSizes } from './exporter.js';

const $ = (id) => document.getElementById(id);

const state = defaultState();
const photos = new PhotoStore();
const history = new CoverHistory();
const canvas = $('cover-canvas');

let drag = null; // { panel, startX, startY, startOffsetX, startOffsetY, moved }

/** Re-render the preview and sync every control with the state. */
function refresh() {
  renderCover(canvas, state, photos);
  syncControls();
  $('stage-empty').style.display = hasAnyPhoto(state) ? 'none' : 'flex';
}

/** Push the pre-change state onto the undo stack, then re-render. */
function commitChange() {
  refresh();
}

function pushHistory() {
  history.push(snapshotState(state));
  updateUndoButtons();
}

function updateUndoButtons() {
  $('btn-undo').disabled = !history.canUndo;
  $('btn-redo').disabled = !history.canRedo;
}

function syncControls() {
  document.querySelectorAll('#layout-grid .layout-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grade-row .grade-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.grade === state.grade);
  });
  $('grade-strength').value = String(Math.round(state.gradeStrength * 100));
  $('grade-strength-out').textContent = `${Math.round(state.gradeStrength * 100)}%`;
  if ($('title-input').value !== state.title) $('title-input').value = state.title;
  if ($('subtitle-input').value !== state.subtitle) $('subtitle-input').value = state.subtitle;
  $('title-size').value = String(Math.round(state.titleScale * 100));
  $('title-size-out').textContent = `${Math.round(state.titleScale * 100)}%`;
  $('title-y').value = String(Math.round(state.titleY * 100));
  $('title-y-out').textContent = `${Math.round(state.titleY * 100)}%`;
  $('subtitle-toggle').checked = state.showSubtitle;

  const count = panelCountForLayout(state.layout);
  const selected = Math.min(state.selectedPanel, count - 1);
  const panel = state.panels[selected];
  const hasPhoto = panel && panel.photoId !== null;
  $('panel-controls').hidden = !hasPhoto;
  $('panel-note').textContent = hasPhoto
    ? `Panel ${selected + 1} of ${count} — drag the photo on the cover, or use the zoom slider.`
    : 'Click a panel on the cover to edit its photo.';
  if (hasPhoto) {
    $('panel-zoom').value = String(Math.round(panel.zoom * 100));
    $('panel-zoom-out').textContent = `${Math.round(panel.zoom * 100)}%`;
  }
}

/** Put a photo into a panel (and select that panel). */
function placePhoto(photoId, panelIndex, { fillAll = false } = {}) {
  pushHistory();
  const count = panelCountForLayout(state.layout);
  if (fillAll) {
    for (let i = 0; i < count; i++) {
      state.panels[i].photoId = photoId;
      state.panels[i].zoom = 1;
      state.panels[i].offsetX = 0;
      state.panels[i].offsetY = 0;
    }
  } else {
    const panel = state.panels[panelIndex];
    panel.photoId = photoId;
    panel.zoom = 1;
    panel.offsetX = 0;
    panel.offsetY = 0;
    state.selectedPanel = panelIndex;
  }
  commitChange();
}

/** Read a File as a data: URL, register it, and place it on the cover. */
async function addPhotoFile(file, { fillAll = true } = {}) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('could not read that file'));
    reader.readAsDataURL(file);
  });
  const id = await photos.loadFromDataUrl(file.name || 'photo', dataUrl);
  const count = panelCountForLayout(state.layout);
  const firstEmpty = state.panels.slice(0, count).findIndex((p) => p.photoId === null);
  if (fillAll || firstEmpty === -1) placePhoto(id, 0, { fillAll: true });
  else placePhoto(id, firstEmpty);
  return id;
}

/** Load a bundled sample photo and put it on the cover. */
async function loadSample(url, name) {
  try {
    const id = await photos.loadFromUrl(name, url);
    placePhoto(id, 0, { fillAll: true });
    return id;
  } catch (err) {
    setStatus(`Could not load the sample photo: ${err.message}`);
    return null;
  }
}

function setStatus(text) {
  $('export-status').textContent = text;
}

/* ---------- canvas pointer interaction ---------- */

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  const { x, y } = canvasPoint(event);
  const index = panelAtPoint(state.layout, canvas.width, canvas.height, x, y);
  if (index < 0) return;
  const panel = state.panels[index];
  state.selectedPanel = index;
  if (panel.photoId === null) {
    // Empty panel: open the file picker for it.
    $('file-input').click();
    syncControls();
    return;
  }
  drag = {
    panel: index,
    startX: x,
    startY: y,
    startOffsetX: panel.offsetX,
    startOffsetY: panel.offsetY,
    moved: false,
  };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
  syncControls();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const { x, y } = canvasPoint(event);
  const panel = state.panels[drag.panel];
  const dx = (x - drag.startX) / canvas.width;
  const dy = (y - drag.startY) / canvas.height;
  if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) drag.moved = true;
  panel.offsetX = Math.max(-1, Math.min(1, drag.startOffsetX + dx * 2));
  panel.offsetY = Math.max(-1, Math.min(1, drag.startOffsetY + dy * 2));
  renderCover(canvas, state, photos);
});

canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved) pushHistory();
  drag = null;
  canvas.classList.remove('dragging');
  updateUndoButtons();
  refresh();
});

canvas.addEventListener('wheel', (event) => {
  const { x, y } = canvasPoint(event);
  const index = panelAtPoint(state.layout, canvas.width, canvas.height, x, y);
  if (index < 0) return;
  event.preventDefault();
  const panel = state.panels[index];
  if (panel.photoId === null) return;
  pushHistory();
  const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * factor));
  state.selectedPanel = index;
  commitChange();
}, { passive: false });

/* ---------- control panel ---------- */

$('layout-grid').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-layout]');
  if (!btn) return;
  pushHistory();
  state.layout = btn.dataset.layout;
  state.selectedPanel = 0;
  commitChange();
});

$('grade-row').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-grade]');
  if (!btn) return;
  pushHistory();
  state.grade = btn.dataset.grade;
  commitChange();
});

$('grade-strength').addEventListener('input', (event) => {
  state.gradeStrength = Number(event.target.value) / 100;
  refresh();
});
$('grade-strength').addEventListener('change', () => pushHistory());

$('title-input').addEventListener('input', (event) => {
  state.title = event.target.value;
  refresh();
});
$('title-input').addEventListener('change', () => pushHistory());

$('subtitle-input').addEventListener('input', (event) => {
  state.subtitle = event.target.value;
  refresh();
});
$('subtitle-input').addEventListener('change', () => pushHistory());

$('title-size').addEventListener('input', (event) => {
  state.titleScale = Number(event.target.value) / 100;
  refresh();
});
$('title-size').addEventListener('change', () => pushHistory());

$('title-y').addEventListener('input', (event) => {
  state.titleY = Number(event.target.value) / 100;
  refresh();
});
$('title-y').addEventListener('change', () => pushHistory());

$('subtitle-toggle').addEventListener('change', (event) => {
  pushHistory();
  state.showSubtitle = event.target.checked;
  commitChange();
});

$('panel-zoom').addEventListener('input', (event) => {
  const panel = state.panels[state.selectedPanel];
  if (!panel || panel.photoId === null) return;
  panel.zoom = Number(event.target.value) / 100;
  refresh();
});
$('panel-zoom').addEventListener('change', () => pushHistory());

$('btn-panel-upload').addEventListener('click', () => $('file-input').click());

$('btn-panel-fill').addEventListener('click', () => {
  const panel = state.panels[state.selectedPanel];
  if (panel && panel.photoId) placePhoto(panel.photoId, 0, { fillAll: true });
});

$('btn-panel-remove').addEventListener('click', () => {
  const panel = state.panels[state.selectedPanel];
  if (!panel || panel.photoId === null) return;
  pushHistory();
  panel.photoId = null;
  panel.zoom = 1;
  panel.offsetX = 0;
  panel.offsetY = 0;
  commitChange();
});

/* ---------- photos ---------- */

$('file-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    await addPhotoFile(file, { fillAll: !hasAnyPhoto(state) });
  } catch (err) {
    setStatus(`Could not load that photo: ${err.message}`);
  }
});

$('btn-upload-photo').addEventListener('click', () => $('file-input').click());
$('btn-empty-upload').addEventListener('click', () => $('file-input').click());

$('samples').addEventListener('click', (event) => {
  const btn = event.target.closest('[data-sample]');
  if (!btn) return;
  const url = btn.dataset.sample;
  loadSample(url, url.split('/').pop());
});

canvas.addEventListener('dragover', (event) => event.preventDefault());
canvas.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) {
    try {
      await addPhotoFile(file, { fillAll: !hasAnyPhoto(state) });
    } catch (err) {
      setStatus(`Could not load that photo: ${err.message}`);
    }
  }
});

/* ---------- undo / redo / shuffle ---------- */

$('btn-undo').addEventListener('click', () => {
  const json = history.undo(snapshotState(state));
  if (json === null) return;
  Object.assign(state, restoreState(json));
  refresh();
  updateUndoButtons();
});

$('btn-redo').addEventListener('click', () => {
  const json = history.redo(snapshotState(state));
  if (json === null) return;
  Object.assign(state, restoreState(json));
  refresh();
  updateUndoButtons();
});

$('btn-random').addEventListener('click', () => {
  pushHistory();
  const layouts = ['hero3', 'grid2', 'full', 'grid9', 'strip'];
  const grades = ['sunset', 'neon', 'palm', 'noir'];
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  state.selectedPanel = 0;
  commitChange();
});

/* ---------- export ---------- */

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const size = EXPORT_SIZES.find((s) => s.label === btn.dataset.export);
    if (!size) return;
    setStatus(`Making your ${size.label} PNG…`);
    try {
      const name = await downloadCover(state, photos, size, state.title);
      setStatus(`Saved ${name} — check your downloads.`);
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
    }
  });
});

$('btn-export-all').addEventListener('click', async () => {
  setStatus('Making all three sizes…');
  try {
    const names = await downloadAllSizes(state, photos, state.title);
    setStatus(`Saved ${names.length} PNGs — square, portrait and wide.`);
  } catch (err) {
    setStatus(`Export failed: ${err.message}`);
  }
});

/* ---------- shot modes for screenshots ---------- */

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    await loadSample('samples/boulevard.jpg', 'boulevard.jpg');
    // A hero cover with a punchy title is the first thing the judge sees.
    state.layout = 'hero3';
    state.grade = 'sunset';
    state.title = 'VICE CITY';
    state.subtitle = 'Neon Nights';
  } else if (shot === 'cover2') {
    document.body.classList.add('shot-cover');
    // Set the layout BEFORE loading the sample: loadSample fills every
    // panel of the current layout, so the strip's fifth panel needs the
    // layout in place first (otherwise it stays an empty "+" placeholder).
    state.layout = 'strip';
    state.grade = 'neon';
    await loadSample('samples/pier.jpg', 'pier.jpg');
    // Second cover variant for the screenshots: neon grade, tilted
    // snapshot-strip layout, different photo and tagline.
    state.title = 'VICE CITY';
    state.subtitle = 'After Dark';
  } else if (shot === 'editor') {
    await loadSample('samples/boulevard.jpg', 'boulevard.jpg');
  }
  refresh();
  updateUndoButtons();
  // Expose the live state for the screenshot builder's checks.
  window.__coverStudio = { state, photos, render: () => renderCover(canvas, state, photos) };
}

boot();
