// ============================================================
// AURA — Graph Evaluator (v2) - True NLE
// Given project + time t, resolve active clip and overlap transition.
// ============================================================

const GraphEvaluator = (() => {
  function getNode(project, nodeId) {
    return project?.nodes?.find(n => n.id === nodeId) || null;
  }

  function evalAtTime(project, t) {
    const events = project?.timeline?.stateEvents || [];
    if (events.length === 0) return { node: null, blended: null, appliedEventId: null };

    // Find all active clips at time t
    const activeClips = [];
    let lastPastClip = null;
    
    for (let i = 0; i < events.length; i++) {
      const clip = events[i];
      const start = clip.time;
      const duration = clip.duration || 5;
      const end = start + duration;
      
      if (t >= start && t <= end) {
        activeClips.push(clip);
      } else if (end < t) {
        if (!lastPastClip || end > (lastPastClip.time + (lastPastClip.duration || 5))) {
          lastPastClip = clip;
        }
      }
    }

    // Sort active clips by start time
    activeClips.sort((a, b) => a.time - b.time);

    // No active clip? Hold the most recent past clip
    if (activeClips.length === 0) {
      if (lastPastClip) {
        const node = getNode(project, lastPastClip.nodeId);
        return { node, blended: { a: null, b: node, t: 1, easing: 'linear', type: lastPastClip.transitionType }, appliedEventId: lastPastClip.id };
      }
      return { node: null, blended: null, appliedEventId: null };
    }

    // Exactly one active clip
    if (activeClips.length === 1) {
      const clip = activeClips[0];
      const node = getNode(project, clip.nodeId);
      return { node, blended: { a: null, b: node, t: 1, easing: clip.easing || 'easeInOut', type: clip.transitionType }, appliedEventId: clip.id };
    }

    // Multiple active clips (Overlap / Transition)
    // We only transition between the last two overlapping clips
    const clipA = activeClips[activeClips.length - 2];
    const clipB = activeClips[activeClips.length - 1];
    
    const nodeA = getNode(project, clipA.nodeId);
    const nodeB = getNode(project, clipB.nodeId);
    
    if (!nodeA || !nodeB) {
      const valid = nodeB || nodeA;
      return { node: valid, blended: { a: null, b: valid, t: 1, easing: clipB.easing, type: clipB.transitionType }, appliedEventId: clipB.id };
    }

    const aEnd = clipA.time + (clipA.duration || 5);
    const overlapStart = clipB.time;
    const overlapEnd = Math.min(aEnd, clipB.time + (clipB.duration || 5));
    const overlapDuration = overlapEnd - overlapStart;

    if (overlapDuration <= 0) {
      return { node: nodeB, blended: { a: null, b: nodeB, t: 1, easing: clipB.easing, type: clipB.transitionType }, appliedEventId: clipB.id };
    }

    // Calculate transition blend [0..1]
    const rawT = (t - overlapStart) / overlapDuration;
    const clampedT = GraphModel.clamp01(rawT);
    const easeFn = GraphModel.getEaseFn(clipB.easing || 'easeInOut');
    const easedT = easeFn(clampedT);

    return { 
      node: nodeB, 
      blended: { a: nodeA, b: nodeB, t: easedT, easing: clipB.easing, type: clipB.transitionType }, 
      appliedEventId: clipB.id 
    };
  }

  return { evalAtTime };
})();

