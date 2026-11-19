// Vice City Cover Studio — cover state and undo history.
// A panel holds one photo (a local file or a bundled sample, never
// uploaded anywhere) plus its crop: zoom and a drag offset in fractions
// of the panel. The whole state is plain JSON, so undo is a snapshot.

import { panelCount } from './layouts.js';

/** One empty panel: no photo yet, full-frame crop. */
export function emptyPanel() {
  return { photo: null, zoom: 1, ox: 0, oy: 0 };
}

/** The cover a fresh visitor sees: Hero + 3, Vice Sunset, VICE CITY. */
export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    title: 'VICE CITY',
    subtitle: 'Neon Nights',
    titleSize: 1.0,
    titleY: 0.94,
    exportSize: '1080x1080',
    panels: [emptyPanel(), emptyPanel(), emptyPanel(), emptyPanel()],
    selected: 0,
  };
}

/** Grow or shrink the panel list when the layout changes, keeping photos. */
export function fitPanels(state) {
  const want = panelCount(state.layout);
  while (state.panels.length < want) state.panels.push(emptyPanel());
  if (state.panels.length > want) state.panels.length = want;
  if (state.selected >= want) state.selected = 0;
  return state;
}

/** A deep copy of a state, for the history stack. */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** Undo/redo history: a stack of past states and a stack of undone ones. */
export function createHistory(limit = 60) {
  return { past: [], future: [], limit };
}

/** Push the current state before a change, clearing the redo stack. */
export function historyPush(history, state) {
  history.past.push(cloneState(state));
  if (history.past.length > history.limit) history.past.shift();
  history.future.length = 0;
}

/** Step back one change, returning the state to show (or null). */
export function historyUndo(history, state) {
  if (history.past.length === 0) return null;
  history.future.push(cloneState(state));
  return history.past.pop();
}

/** Step forward one undone change, returning the state (or null). */
export function historyRedo(history, state) {
  if (history.future.length === 0) return null;
  history.past.push(cloneState(state));
  return history.future.pop();
}

/** Load a saved state (from localStorage), or the default when it is stale. */
export function reviveState(saved) {
  try {
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return defaultState();
    const state = { ...defaultState(), ...parsed };
    state.panels = Array.isArray(parsed.panels) ? parsed.panels : defaultState().panels;
    return fitPanels(state);
  } catch {
    return defaultState();
  }
}
