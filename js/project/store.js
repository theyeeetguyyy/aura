// ============================================================
// AURA — Project Store v2
// Reducer-style state container with undo/redo
// Updated for dual timeline: visualTrack + cameraTrack + markers
// ============================================================

const ProjectStore = (() => {
  const MAX_HISTORY = 50;

  let history = {
    past: [],
    present: ProjectSchema.createEmptyProject(),
    future: [],
  };

  const listeners = new Set();

  function getState() { return history.present; }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

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

      case 'project/new':
        return ProjectSchema.createEmptyProject();

      case 'project/load': {
        // Migrate old projects on load
        const loaded = ProjectSchema.migrate ? ProjectSchema.migrate(action.project) : action.project;
        return loaded;
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

      // ── VISUAL TRACK ─────────────────────────────────────
      case 'timeline/addVisualClip': {
        const next = ProjectSchema.clone(state);
        const id = `clip_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        next.timeline.visualTrack.push({
          id,
          name: action.name || '',
          time: action.time,
          duration: typeof action.duration === 'number' ? action.duration : 5.0,
          nodeId: action.nodeId,
          transitionType: action.transitionType || 'transform',
          easing: action.easing || 'easeInOut',
          transitionSec: action.transitionSec || 0.75,
        });
        next.timeline.visualTrack.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'timeline/updateVisualClip': {
        const next = ProjectSchema.clone(state);
        const idx = next.timeline.visualTrack.findIndex(e => e.id === action.id);
        if (idx < 0) return state;
        next.timeline.visualTrack[idx] = { ...next.timeline.visualTrack[idx], ...action.patch };
        next.timeline.visualTrack.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'timeline/removeVisualClip': {
        if (!state.timeline.visualTrack.some(e => e.id === action.id)) return state;
        const next = ProjectSchema.clone(state);
        next.timeline.visualTrack = next.timeline.visualTrack.filter(e => e.id !== action.id);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      // Legacy aliases (backward compat)
      case 'timeline/addStateEvent': {
        return reduce(state, { ...action, type: 'timeline/addVisualClip', nodeId: action.nodeId });
      }
      case 'timeline/updateStateEvent': {
        return reduce(state, { ...action, type: 'timeline/updateVisualClip' });
      }
      case 'timeline/removeStateEvent': {
        return reduce(state, { ...action, type: 'timeline/removeVisualClip' });
      }

      // ── CAMERA TRACK ──────────────────────────────────────
      case 'timeline/addCameraKeyframe': {
        const next = ProjectSchema.clone(state);
        const id = `cam_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        next.timeline.cameraTrack.push({
          id,
          time: action.time,
          val: action.val, // { pos: {x,y,z}, lookAt: {x,y,z}, fov }
          easing: action.easing || 'easeInOutCubic',
        });
        next.timeline.cameraTrack.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'timeline/updateCameraKeyframe': {
        const next = ProjectSchema.clone(state);
        const idx = next.timeline.cameraTrack.findIndex(e => e.id === action.id);
        if (idx < 0) return state;
        next.timeline.cameraTrack[idx] = { ...next.timeline.cameraTrack[idx], ...action.patch };
        next.timeline.cameraTrack.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'timeline/removeCameraKeyframe': {
        if (!state.timeline.cameraTrack.some(e => e.id === action.id)) return state;
        const next = ProjectSchema.clone(state);
        next.timeline.cameraTrack = next.timeline.cameraTrack.filter(e => e.id !== action.id);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      // Legacy aliases
      case 'timeline/addCameraEvent':
        return reduce(state, { ...action, type: 'timeline/addCameraKeyframe' });
      case 'timeline/updateCameraEvent':
        return reduce(state, { ...action, type: 'timeline/updateCameraKeyframe' });
      case 'timeline/removeCameraEvent':
        return reduce(state, { ...action, type: 'timeline/removeCameraKeyframe' });

      // ── MARKERS ──────────────────────────────────────────
      case 'timeline/addMarker': {
        const next = ProjectSchema.clone(state);
        const id = `mkr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        next.timeline.markers.push({
          id,
          time: action.time,
          label: action.label || 'Marker',
          markerType: action.markerType || 'custom',
        });
        next.timeline.markers.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'timeline/updateMarker': {
        const next = ProjectSchema.clone(state);
        const idx = next.timeline.markers.findIndex(m => m.id === action.id);
        if (idx < 0) return state;
        next.timeline.markers[idx] = { ...next.timeline.markers[idx], ...action.patch };
        next.timeline.markers.sort((a, b) => a.time - b.time);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'timeline/removeMarker': {
        if (!state.timeline.markers.some(m => m.id === action.id)) return state;
        const next = ProjectSchema.clone(state);
        next.timeline.markers = next.timeline.markers.filter(m => m.id !== action.id);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'timeline/clearMarkers': {
        if (!state.timeline.markers.length) return state;
        const next = ProjectSchema.clone(state);
        next.timeline.markers = [];
        next.meta.modifiedAt = Date.now();
        return next;
      }

      // ── NODES ────────────────────────────────────────────
      case 'nodes/remove': {
        if (!state.nodes.some(n => n.id === action.id)) return state;
        const next = ProjectSchema.clone(state);
        next.nodes = next.nodes.filter(n => n.id !== action.id);
        next.timeline.visualTrack = next.timeline.visualTrack.filter(e => e.nodeId !== action.id);
        next.edges = (next.edges || []).filter(e => e.from !== action.id && e.to !== action.id);
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

      case 'graph/addEdge': {
        const next = ProjectSchema.clone(state);
        next.edges = next.edges || [];
        next.edges.push(action.edge);
        next.meta.modifiedAt = Date.now();
        return next;
      }

      case 'graph/removeEdge': {
        if (!(state.edges || []).some(e => e.id === action.id)) return state;
        const next = ProjectSchema.clone(state);
        next.edges = (next.edges || []).filter(e => e.id !== action.id);
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
    history = { past: history.past.slice(0, -1), present: previous, future: [history.present].concat(history.future) };
    emit();
  }

  function redo() {
    if (history.future.length === 0) return;
    const next = history.future[0];
    history = { past: history.past.concat([history.present]), present: next, future: history.future.slice(1) };
    emit();
  }

  // Selectors
  function getActiveVisualClipAtTime(t) {
    const clips = history.present.timeline.visualTrack || [];
    let active = null;
    for (let i = 0; i < clips.length; i++) {
      if (clips[i].time <= t) active = clips[i];
      else break;
    }
    return active;
  }

  // Legacy alias
  function getActiveStateEventAtTime(t) { return getActiveVisualClipAtTime(t); }

  function getNode(nodeId) {
    return history.present.nodes.find(n => n.id === nodeId) || null;
  }

  return {
    getState, subscribe, dispatch, undo, redo,
    getActiveVisualClipAtTime, getActiveStateEventAtTime, getNode,
    get canUndo() { return history.past.length > 0; },
    get canRedo() { return history.future.length > 0; },
  };
})();
