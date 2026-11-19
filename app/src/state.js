/* Cover state: one plain object the whole app reads, plus undo/redo history.
   Photos live in a separate map (id -> { name, dataUrl, image }) so history
   snapshots stay small; a snapshot only records which photo sits in which panel. */

export const LAYOUTS = ['hero3', 'grid2', 'full', 'grid9', 'strip'];
export const GRADES = ['sunset', 'neon', 'palm', 'noir'];

export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    gradeStrength: 0.75,
    title: 'VICE CITY',
    subtitle: 'Neon Nights',
    showSubtitle: true,
    titleScale: 1.0,
    titleY: 0.78,
    // One slot per panel of the biggest layout (9). Layouts use a prefix of these.
    panels: Array.from({ length: 9 }, () => ({
      photoId: null,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    })),
    selectedPanel: 0,
  };
}

/** Deep-copy a state object (photos are referenced by id, never copied). */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** A serialisable snapshot for undo/redo. */
export function snapshotState(state) {
  return JSON.stringify(state);
}

export function restoreState(json) {
  const parsed = JSON.parse(json);
  const fresh = defaultState();
  return { ...fresh, ...parsed, panels: parsed.panels ?? fresh.panels };
}

/** Undo/redo history over state snapshots. */
export class CoverHistory {
  constructor(limit = 60) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }

  /** Record the state as it was before a change. */
  push(json) {
    this.past.push(json);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }

  undo(currentJson) {
    if (this.past.length === 0) return null;
    this.future.push(currentJson);
    return this.past.pop();
  }

  redo(currentJson) {
    if (this.future.length === 0) return null;
    this.past.push(currentJson);
    return this.future.pop();
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}

/** In-memory photo store: id -> { id, name, dataUrl, image, width, height }. */
export class PhotoStore {
  constructor() {
    this.photos = new Map();
    this.counter = 0;
  }

  /** Register a loaded image; returns its id. */
  add(name, dataUrl, image) {
    const id = `photo-${++this.counter}`;
    this.photos.set(id, { id, name, dataUrl, image, width: image.naturalWidth, height: image.naturalHeight });
    return id;
  }

  get(id) {
    return this.photos.get(id) ?? null;
  }

  has(id) {
    return this.photos.has(id);
  }

  /** First photo id, or null when the store is empty. */
  firstId() {
    const next = this.photos.keys().next();
    return next.done ? null : next.value;
  }

  /** Load an image from a URL (a local sample file) and register it. */
  async loadFromUrl(name, url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`could not load sample ${name}`);
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('could not read sample'));
      reader.readAsDataURL(blob);
    });
    return this.loadFromDataUrl(name, dataUrl);
  }

  /** Load an image from a data: URL and register it. */
  loadFromDataUrl(name, dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(this.add(name, dataUrl, image));
      image.onerror = () => reject(new Error(`could not read image ${name}`));
      image.src = dataUrl;
    });
  }
}
