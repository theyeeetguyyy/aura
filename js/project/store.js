// ============================================================
// AURA — Project Store (v1)
// Reducer-style state container with undo/redo
// ============================================================

const ProjectStore = (() => {
  const MAX_HISTORY = 50;

  /** @type {{past:any[], present:any, future:any[]}} */
  let history = {
    past: [],
    present: ProjectSchema.createEmptyProject(),
    future: [],
  };

  /** @type {Set<Function>} */
  const listeners = new Set();

  function getState() {
    return history.present;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function emit() {
    for (const fn of listeners) {
      try { fn(history.present); } catch (e) { console.warn('Store listener error', e); }
    }
  }

  function withHistory(nextPresent) {
    const past = history.past.concat([history.present]);
    const trimmed = past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;
    history = { past: trimmed, present: nextPresent, future: [] };
  }

  function reduce(state, action) {
    switch (action.type) {
      case 'project/new': {
        return ProjectSchema.createEmptyProject();
      }
      case 'project/load': {
        return action.project;
      }
      case 'project/meta': {
        const next = ProjectSchema.clone(state);
        next.meta = { ...next.meta, ...action.meta, modifiedAt: Date.now() };
        return next;
      }
      case 'editor/set': {
        const next = ProjectSchema.clone(state);
        next.editor = { ...(next.editor || {}), ...(action.editor || {}) };
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'audio/meta': {
        const next = ProjectSchema.clone(state);
        next.audio = { ...next.audio, ...action.audio, modifiedAt: Date.now() };
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'timeline/addStateEvent': {
        const next = ProjectSchema.clone(state);
        const id = `evt_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        next.timeline.stateEvents.push({
          id,
          time: action.time,
          nodeId: action.nodeId,
          transitionSec: typeof action.transitionSec === 'number' ? action.transitionSec : 0.75,
          easing: action.easing || 'easeInOut',
        });
        next.timeline.stateEvents.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'timeline/updateStateEvent': {
        const next = ProjectSchema.clone(state);
        const idx = next.timeline.stateEvents.findIndex(e => e.id === action.id);
        if (idx < 0) return state;
        next.timeline.stateEvents[idx] = { ...next.timeline.stateEvents[idx], ...action.patch };
        next.timeline.stateEvents.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'timeline/removeStateEvent': {
        const next = ProjectSchema.clone(state);
        next.timeline.stateEvents = next.timeline.stateEvents.filter(e => e.id !== action.id);
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'nodes/remove': {
        const next = ProjectSchema.clone(state);
        next.nodes = next.nodes.filter(n => n.id !== action.id);
        // Remove any events referencing it
        next.timeline.stateEvents = next.timeline.stateEvents.filter(e => e.nodeId !== action.id);
        // Remove edges referencing it
        next.edges = (next.edges || []).filter(e => e.from !== action.id && e.to !== action.id);
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'graph/addEdge': {
        const next = ProjectSchema.clone(state);
        next.edges = next.edges || [];
        next.edges.push(action.edge);
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'graph/removeEdge': {
        const next = ProjectSchema.clone(state);
        next.edges = (next.edges || []).filter(e => e.id !== action.id);
        next.meta.modifiedAt = Date.now();
        return next;
      }
      case 'nodes/upsert': {
        const next = ProjectSchema.clone(state);
        const idx = next.nodes.findIndex(n => n.id === action.node.id);
        if (idx >= 0) next.nodes[idx] = action.node;
        else next.nodes.push(action.node);
        next.meta.modifiedAt = Date.now();
        return next;
      }
      default:
        return state;
    }
  }

  function dispatch(action, opts = { recordHistory: true }) {
    if (!action || !action.type) return;
    const next = reduce(history.present, action);
    if (next === history.present) return;
    if (opts.recordHistory) withHistory(next);
    else history = { ...history, present: next };
    emit();
  }

  function undo() {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const past = history.past.slice(0, -1);
    const future = [history.present].concat(history.future);
    history = { past, present: previous, future };
    emit();
  }

  function redo() {
    if (history.future.length === 0) return;
    const next = history.future[0];
    const future = history.future.slice(1);
    const past = history.past.concat([history.present]);
    history = { past, present: next, future };
    emit();
  }

  // Selectors
  function getActiveStateEventAtTime(t) {
    const events = history.present.timeline.stateEvents;
    let active = null;
    for (let i = 0; i < events.length; i++) {
      if (events[i].time <= t) active = events[i];
      else break;
    }
    return active;
  }

  function getNode(nodeId) {
    return history.present.nodes.find(n => n.id === nodeId) || null;
  }

  return {
    getState,
    subscribe,
    dispatch,
    undo,
    redo,
    // selectors
    getActiveStateEventAtTime,
    getNode,
  };
})();

