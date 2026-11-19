// Vice City Cover Studio — the editor.
// Wires the controls to the cover state: layout and grade pickers,
// caption editing, per-panel photo upload / drag / zoom / swap /
// remove, undo-redo, shuffle, and the export bar. Photos are read with
// FileReader on this machine and never leave it. The ?shot=cover,
// ?shot=editor and ?shot=cover2 modes load a sample cover for screenshots.

import { LAYOUTS, LAYOUT_ORDER, layoutRects } from './layouts.js';
import { GRADES, GRADE_ORDER } from './grades.js';
import { renderCover } from './render.js';
import {
  defaultState, fitPanels, cloneState,
  createHistory, historyPush, historyUndo, historyRedo, reviveState,
} from './state.js';
import { EXPORT_SIZES, sizeOf, exportOne, exportAll } from './exporter.js';

const $ = (id) => document.getElementById(id);
const SAMPLES = [
  { src: 'samples/boulevard.jpg', name: 'Boulevard' },
  { src: 'samples/pier.jpg', name: 'Pier' },
];

const state = reviveState(localStorage.getItem('vice-city-cover-studio'));
const history = createHistory();
const images = new Map();
let shotMode = '';

/** Load an image by src (sample path or data URL), cached. */
function loadImage(src) {
  const hit = images.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** Load every photo the state references, then repaint. */
async function ensureImages() {
  for (const panel of state.panels) {
    if (panel.photo) {
      try {
        await loadImage(panel.photo.src);
      } catch {
        panel.photo = null;
      }
    }
  }
}

/** Paint the preview canvas at the chosen export size. */
function render() {
  const size = sizeOf(state.exportSize);
  const canvas = $('coverCanvas');
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  const ctx = canvas.getContext('2d');
  renderCover(ctx, size.w, size.h, state, images);
  updatePanelBar();
}

/** Save the text settings (not the photo bytes) for the next visit. */
function persist() {
  try {
    const copy = cloneState(state);
    for (const panel of copy.panels) {
      if (panel.photo && panel.photo.src.startsWith('data:')) panel.photo = null;
    }
    localStorage.setItem('vice-city-cover-studio', JSON.stringify(copy));
  } catch {
    // Private mode or a full store: the cover still works, it just
    // does not remember itself. Nothing to do here.
  }
}

function setStatus(text) {
  const el = $('statusLine');
  if (el) el.textContent = text;
}

/**
 * Arm a control so its first input of an editing burst pushes the
 * pre-change state onto the history stack, once. The burst ends on
 * change, which also persists the result.
 */
function armOnce(el, onDone) {
  el.addEventListener('input', () => {
    if (!el.dataset.armed) {
      historyPush(history, state);
      el.dataset.armed = '1';
    }
  });
  el.addEventListener('change', () => {
    delete el.dataset.armed;
    persist();
    updateUndoButtons();
    if (onDone) onDone();
  });
}

function updateUndoButtons() {
  $('undoBtn').disabled = history.past.length === 0;
  $('redoBtn').disabled = history.future.length === 0;
}

// ------------------------------------------------------------ pickers

function buildLayoutPicker() {
  const box = $('layoutPicker');
  box.innerHTML = '';
  for (const id of LAYOUT_ORDER) {
    const layout = LAYOUTS[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick';
    btn.dataset.layout = id;
    btn.title = layout.blurb;
    btn.innerHTML = `<span class="pick-name">${layout.name}</span><span class="pick-blurb">${layout.blurb}</span>`;
    btn.addEventListener('click', () => {
      if (state.layout === id) return;
      historyPush(history, state);
      state.layout = id;
      fitPanels(state);
      render();
      persist();
      updateUndoButtons();
      markPickers();
      setStatus(`${layout.name} layout — drag a photo to move it.`);
    });
    box.appendChild(btn);
  }
}

function buildGradePicker() {
  const box = $('gradePicker');
  box.innerHTML = '';
  for (const id of GRADE_ORDER) {
    const grade = GRADES[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pick grade-pick';
    btn.dataset.grade = id;
    btn.title = grade.blurb;
    btn.innerHTML = `<span class="swatch" style="background:linear-gradient(135deg,${grade.skyTop},${grade.skyMid} 45%,${grade.skyLow} 80%,${grade.horizon})"></span><span class="pick-name">${grade.name}</span>`;
    btn.addEventListener('click', () => {
      if (state.grade === id) return;
      historyPush(history, state);
      state.grade = id;
      render();
      persist();
      updateUndoButtons();
      markPickers();
      setStatus(`${grade.name} — ${grade.blurb}`);
    });
    box.appendChild(btn);
  }
}

function markPickers() {
  document.querySelectorAll('#layoutPicker .pick').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradePicker .pick').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
}

// ------------------------------------------------------------ panel bar

function selectedPanel() {
  return state.panels[state.selected] ?? state.panels[0];
}

function updatePanelBar() {
  const panel = selectedPanel();
  const i = state.selected;
  $('panelName').textContent = panel.photo
    ? `Panel ${i + 1} — ${panel.photo.name || 'your photo'}`
    : `Panel ${i + 1} — empty`;
  $('panelZoom').value = String(panel.zoom || 1);
  $('panelZoomVal').textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
  $('panelRemove').disabled = !panel.photo;
  $('panelFillAll').disabled = !panel.photo;
  $('panelSwap').disabled = state.panels.length < 2 || !panel.photo;
  // Mark the selected panel's number in the hint line.
  $('panelHint').textContent = panel.photo
    ? 'Drag the photo inside its frame to move it. Scroll over the cover to zoom.'
    : 'Pick a sample below, or upload your own photo for this panel.';
}

/** Read a file into the selected panel (local only, FileReader). */
function uploadToPanel(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('That file is not a photo — pick a JPG or PNG.');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result);
    loadImage(src).then(() => {
      historyPush(history, state);
      selectedPanel().photo = { src, name: file.name };
      selectedPanel().zoom = 1;
      selectedPanel().ox = 0;
      selectedPanel().oy = 0;
      render();
      persist();
      updateUndoButtons();
      setStatus(`"${file.name}" is in panel ${state.selected + 1}.`);
    }).catch(() => setStatus('That photo could not be read. Try another file.'));
  };
  reader.onerror = () => setStatus('That photo could not be read. Try another file.');
  reader.readAsDataURL(file);
}

function bindPanelBar() {
  $('panelUpload').addEventListener('click', () => $('photoInput').click());
  $('photoInput').addEventListener('change', (e) => {
    uploadToPanel(e.target.files?.[0]);
    e.target.value = '';
  });
  $('panelZoom').addEventListener('input', (e) => {
    if (!e.target.dataset.armed) {
      historyPush(history, state);
      e.target.dataset.armed = '1';
    }
    selectedPanel().zoom = Number(e.target.value);
    render();
    $('panelZoomVal').textContent = `${Math.round(selectedPanel().zoom * 100)}%`;
  });
  $('panelZoom').addEventListener('change', (e) => {
    delete e.target.dataset.armed;
    persist();
    updateUndoButtons();
  });
  $('panelRemove').addEventListener('click', () => {
    historyPush(history, state);
    const panel = selectedPanel();
    panel.photo = null;
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
    render();
    persist();
    updateUndoButtons();
    setStatus(`Panel ${state.selected + 1} is empty again.`);
  });
  $('panelSwap').addEventListener('click', () => {
    const next = (state.selected + 1) % state.panels.length;
    historyPush(history, state);
    const a = state.panels[state.selected];
    const b = state.panels[next];
    const photo = a.photo;
    a.photo = b.photo;
    b.photo = photo;
    render();
    persist();
    updateUndoButtons();
    setStatus(`Swapped panels ${state.selected + 1} and ${next + 1}.`);
  });
  $('panelFillAll').addEventListener('click', () => {
    const photo = selectedPanel().photo;
    if (!photo) return;
    historyPush(history, state);
    for (const panel of state.panels) {
      panel.photo = { ...photo };
      panel.zoom = 1;
      panel.ox = 0;
      panel.oy = 0;
    }
    render();
    persist();
    updateUndoButtons();
    setStatus('One photo across every panel — drag each to frame it.');
  });
}

// ------------------------------------------------------------ canvas input

/** Which panel (if any) sits under a canvas point, in CSS pixels. */
function hitPanel(clientX, clientY) {
  const canvas = $('coverCanvas');
  const box = canvas.getBoundingClientRect();
  const px = ((clientX - box.left) / box.width) * canvas.width;
  const py = ((clientY - box.top) / box.height) * canvas.height;
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    let x = px;
    let y = py;
    if (r.tilt) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const a = (-r.tilt * Math.PI) / 180;
      const dx = px - cx;
      const dy = py - cy;
      x = cx + dx * Math.cos(a) - dy * Math.sin(a);
      y = cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function bindCanvas() {
  const canvas = $('coverCanvas');
  let drag = null;

  canvas.addEventListener('pointerdown', (e) => {
    const i = hitPanel(e.clientX, e.clientY);
    if (i < 0) return;
    state.selected = i;
    updatePanelBar();
    const panel = state.panels[i];
    drag = {
      index: i,
      startX: e.clientX,
      startY: e.clientY,
      ox: panel.ox || 0,
      oy: panel.oy || 0,
      moved: false,
      pushed: false,
    };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const box = canvas.getBoundingClientRect();
    const rects = layoutRects(state.layout, canvas.width, canvas.height);
    const rect = rects[drag.index];
    const dx = ((e.clientX - drag.startX) / box.width) * canvas.width;
    const dy = ((e.clientY - drag.startY) / box.height) * canvas.height;
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 4) {
      drag.moved = true;
      if (!drag.pushed) {
        historyPush(history, state);
        drag.pushed = true;
      }
    }
    if (drag.moved) {
      const panel = state.panels[drag.index];
      const span = 0.6 / (panel.zoom || 1);
      panel.ox = Math.max(-span, Math.min(span, drag.ox + dx / rect.w));
      panel.oy = Math.max(-span, Math.min(span, drag.oy + dy / rect.h));
      render();
    }
  });

  canvas.addEventListener('pointerup', () => {
    if (drag?.moved) {
      persist();
      updateUndoButtons();
    }
    drag = null;
  });

  canvas.addEventListener('wheel', (e) => {
    const i = hitPanel(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    const panel = state.panels[i];
    if (!panel.photo) return;
    const next = Math.max(1, Math.min(3, (panel.zoom || 1) * (e.deltaY < 0 ? 1.08 : 0.92)));
    if (Math.abs(next - (panel.zoom || 1)) < 0.005) return;
    panel.zoom = next;
    state.selected = i;
    render();
    $('panelZoom').value = String(next);
    $('panelZoomVal').textContent = `${Math.round(next * 100)}%`;
  }, { passive: false });
}

// ------------------------------------------------------------ sample strip

function buildSampleStrip() {
  const strip = $('sampleStrip');
  strip.innerHTML = '';
  for (const sample of SAMPLES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sample';
    btn.innerHTML = `<img src="${sample.src}" alt="${sample.name} sample photo"><span>${sample.name}</span>`;
    btn.addEventListener('click', async () => {
      try {
        await loadImage(sample.src);
      } catch {
        setStatus('The sample photo did not load. Try uploading your own.');
        return;
      }
      historyPush(history, state);
      const panel = selectedPanel();
      panel.photo = { src: sample.src, name: `${sample.name} (sample)` };
      panel.zoom = 1;
      panel.ox = 0;
      panel.oy = 0;
      render();
      persist();
      updateUndoButtons();
      setStatus(`Sample "${sample.name}" is in panel ${state.selected + 1}.`);
    });
    strip.appendChild(btn);
  }
  const note = document.createElement('p');
  note.className = 'sample-note';
  note.textContent = 'Samples are bundled with the app — they never leave your machine either.';
  strip.appendChild(note);
}

// ------------------------------------------------------------ top bar

function shuffleCover() {
  historyPush(history, state);
  const layouts = LAYOUT_ORDER.filter((id) => id !== state.layout);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  const grades = GRADE_ORDER.filter((id) => id !== state.grade);
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  fitPanels(state);
  // Deal the loaded photos around the panels at random.
  const photos = state.panels.map((p) => p.photo);
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
  state.panels.forEach((panel, i) => {
    panel.photo = photos[i];
    panel.zoom = 1;
    panel.ox = 0;
    panel.oy = 0;
  });
  render();
  persist();
  updateUndoButtons();
  markPickers();
  setStatus('Shuffled — a fresh take on the same photos.');
}

function bindTopBar() {
  $('undoBtn').addEventListener('click', () => {
    const prev = historyUndo(history, state);
    if (!prev) return;
    Object.assign(state, prev);
    fitPanels(state);
    render();
    persist();
    updateUndoButtons();
    markPickers();
    setStatus('Undone.');
  });
  $('redoBtn').addEventListener('click', () => {
    const next = historyRedo(history, state);
    if (!next) return;
    Object.assign(state, next);
    fitPanels(state);
    render();
    persist();
    updateUndoButtons();
    markPickers();
    setStatus('Redone.');
  });
  $('shuffleBtn').addEventListener('click', shuffleCover);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      $('undoBtn').click();
    } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      $('redoBtn').click();
    }
  });

  $('exportSize').addEventListener('change', (e) => {
    state.exportSize = e.target.value;
    render();
    persist();
  });
  $('exportBtn').addEventListener('click', async () => {
    const btn = $('exportBtn');
    btn.disabled = true;
    btn.textContent = 'Exporting…';
    try {
      const bytes = await exportOne(state, images, state.exportSize);
      setStatus(`PNG saved (${Math.round(bytes / 1024)} KB) — share it anywhere.`);
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Export PNG';
    }
  });
  $('exportAllBtn').addEventListener('click', async () => {
    const btn = $('exportAllBtn');
    btn.disabled = true;
    btn.textContent = 'Exporting all…';
    try {
      await exportAll(state, images, (id) => setStatus(`Saved ${id}…`));
      setStatus('All three sizes saved — square, portrait and wide.');
    } catch (err) {
      setStatus(`Export failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Export all three';
    }
  });
}

// ------------------------------------------------------------ caption bar

function bindCaptionBar() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('titleSize').value = String(state.titleSize);
  $('titleY').value = String(state.titleY);
  // Arm history first: each control records one undo step per editing
  // burst, taken before its first keystroke or slider move.
  for (const el of [$('titleInput'), $('subtitleInput'), $('titleSize'), $('titleY')]) {
    armOnce(el);
  }
  $('titleInput').addEventListener('input', (e) => {
    state.title = e.target.value;
    render();
  });
  $('subtitleInput').addEventListener('input', (e) => {
    state.subtitle = e.target.value;
    render();
  });
  $('titleSize').addEventListener('input', (e) => {
    state.titleSize = Number(e.target.value);
    render();
  });
  $('titleY').addEventListener('input', (e) => {
    state.titleY = Number(e.target.value);
    render();
  });
}

// ------------------------------------------------------------ shot modes

/** Fill the cover with the bundled samples, for screenshots and demos. */
async function loadSampleCover(variant) {
  const first = variant === 2 ? SAMPLES[1] : SAMPLES[0];
  const second = variant === 2 ? SAMPLES[0] : SAMPLES[1];
  if (variant === 2) {
    state.layout = 'strip';
    state.grade = 'neon';
    state.subtitle = 'After Dark';
  } else {
    state.layout = 'hero3';
    state.grade = 'sunset';
    state.subtitle = 'Neon Nights';
  }
  state.title = 'VICE CITY';
  fitPanels(state);
  for (const sample of [first, second]) {
    try {
      await loadImage(sample.src);
    } catch {
      // A missing sample still leaves a styled empty frame.
    }
  }
  state.panels.forEach((panel, i) => {
    const sample = i % 2 === 0 ? first : second;
    if (images.has(sample.src)) {
      panel.photo = { src: sample.src, name: `${sample.name} (sample)` };
      panel.zoom = 1;
      panel.ox = 0;
      panel.oy = 0;
    }
  });
  // A tall portrait in a wide hero panel crops the face off: shift the
  // hero photo down so the face stays in frame. Landscape photos and
  // square panels need no shift.
  const heroPhoto = state.panels[0]?.photo;
  const heroImg = heroPhoto ? images.get(heroPhoto.src) : null;
  if (heroImg && heroImg.naturalHeight > heroImg.naturalWidth) {
    state.panels[0].zoom = 1;
    state.panels[0].oy = 0.5;
  }
}

/** Boot: build the UI, honour ?shot=, paint the first cover. */
async function boot() {
  const params = new URLSearchParams(location.search);
  shotMode = params.get('shot') ?? '';
  buildLayoutPicker();
  buildGradePicker();
  buildSampleStrip();
  bindPanelBar();
  bindCanvas();
  bindTopBar();
  bindCaptionBar();
  for (const size of EXPORT_SIZES) {
    const opt = document.createElement('option');
    opt.value = size.id;
    opt.textContent = size.label;
    if (size.id === state.exportSize) opt.selected = true;
    $('exportSize').appendChild(opt);
  }
  markPickers();
  updateUndoButtons();

  if (shotMode === 'cover' || shotMode === 'cover2') {
    document.body.classList.add('shot-cover');
    await loadSampleCover(shotMode === 'cover2' ? 2 : 1);
  } else if (shotMode === 'editor') {
    await loadSampleCover(1);
  } else {
    await ensureImages();
  }
  render();
  setStatus(
    shotMode.startsWith('cover')
      ? 'Cover ready — right-click the image to save it, or use Export PNG.'
      : 'Pick a layout, drop in your photos, write your caption, export.',
  );
}

boot();
