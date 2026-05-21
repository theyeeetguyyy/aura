// ============================================================
// AURA — Graph Evaluator (v3)
// Merged from graphModel.js + graphEvaluator.js
// Given project + time t, resolve active clip and overlap transition.
// ============================================================

// GraphModel is kept as a namespace alias for backward compatibility
// (some old code may call GraphModel.deepBlend / GraphModel.clamp01)
const GraphModel = (() => {
  const EASINGS = {
    linear:    t => t,
    easeInOut: t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2,
    easeOut:   t => 1 - Math.pow(1-t, 3),
    easeIn:    t => t * t * t,
  };
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function deepBlend(a, b, t) {
    if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
    if (Array.isArray(a) && Array.isArray(b)) {
      const n = Math.max(a.length, b.length);
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = deepBlend(a[i], b[i], t);
      return out;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const out = { ...a };
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) out[k] = deepBlend(a[k], b[k], t);
      return out;
    }
    return t >= 1 ? b : a;
  }
  function getEaseFn(name) { return EASINGS[name] || EASINGS.easeInOut; }
  return { EASINGS, clamp01, deepBlend, getEaseFn };
})();

const GraphEvaluator = (() => {
  function getNode(project, nodeId) {
    return project?.nodes?.find(n => n.id === nodeId) || null;
  }

  function evalAtTime(project, t) {
    const events = project?.timeline?.visualTrack || project?.timeline?.stateEvents || [];
    if (events.length === 0) return { node: null, blended: null, appliedEventId: null };

    const activeClips = [];
    let lastPastClip = null;

    for (let i = 0; i < events.length; i++) {
      const clip = events[i];
      const start    = clip.time;
      const duration = clip.duration || 5;
      const end      = start + duration;
      if (t >= start && t <= end) {
        activeClips.push(clip);
      } else if (end < t) {
        if (!lastPastClip || end > (lastPastClip.time + (lastPastClip.duration || 5))) {
          lastPastClip = clip;
        }
      }
    }

    activeClips.sort((a, b) => a.time - b.time);

    if (activeClips.length === 0) {
      if (lastPastClip) {
        const node = getNode(project, lastPastClip.nodeId);
        return { node, blended: { a: null, b: node, t: 1, easing: 'linear', type: lastPastClip.transitionType }, appliedEventId: lastPastClip.id };
      }
      return { node: null, blended: null, appliedEventId: null };
    }

    if (activeClips.length === 1) {
      const clip = activeClips[0];
      const node = getNode(project, clip.nodeId);
      return { node, blended: { a: null, b: node, t: 1, easing: clip.easing || 'easeInOut', type: clip.transitionType }, appliedEventId: clip.id };
    }

    const clipA = activeClips[activeClips.length - 2];
    const clipB = activeClips[activeClips.length - 1];
    const nodeA = getNode(project, clipA.nodeId);
    const nodeB = getNode(project, clipB.nodeId);

    if (!nodeA || !nodeB) {
      const valid = nodeB || nodeA;
      return { node: valid, blended: { a: null, b: valid, t: 1, easing: clipB.easing, type: clipB.transitionType }, appliedEventId: clipB.id };
    }

    const aEnd            = clipA.time + (clipA.duration || 5);
    const overlapStart    = clipB.time;
    const overlapEnd      = Math.min(aEnd, clipB.time + (clipB.duration || 5));
    const overlapDuration = overlapEnd - overlapStart;

    if (overlapDuration <= 0) {
      return { node: nodeB, blended: { a: null, b: nodeB, t: 1, easing: clipB.easing, type: clipB.transitionType }, appliedEventId: clipB.id };
    }

    const rawT   = (t - overlapStart) / overlapDuration;
    const clamped = GraphModel.clamp01(rawT);
    const easedT  = GraphModel.getEaseFn(clipB.easing || 'easeInOut')(clamped);

    return {
      node: nodeB,
      blended: { a: nodeA, b: nodeB, t: easedT, easing: clipB.easing, type: clipB.transitionType },
      appliedEventId: clipB.id
    };
  }

  return { evalAtTime };
})();
