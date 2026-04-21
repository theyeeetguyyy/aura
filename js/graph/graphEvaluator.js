// ============================================================
// AURA — Graph Evaluator (v1)
// Given project + time t, resolve active node and transition blend.
// ============================================================

const GraphEvaluator = (() => {
  function getActiveEvent(project, t) {
    const events = project?.timeline?.stateEvents || [];
    let active = null;
    for (let i = 0; i < events.length; i++) {
      if (events[i].time <= t) active = events[i];
      else break;
    }
    return active;
  }

  function getPrevEvent(project, activeEvent) {
    const events = project?.timeline?.stateEvents || [];
    const idx = events.findIndex(e => e.id === activeEvent?.id);
    if (idx <= 0) return null;
    return events[idx - 1] || null;
  }

  function getNode(project, nodeId) {
    return project?.nodes?.find(n => n.id === nodeId) || null;
  }

  function evalAtTime(project, t) {
    const evt = getActiveEvent(project, t);
    if (!evt) return { node: null, blended: null, appliedEventId: null };

    const node = getNode(project, evt.nodeId);
    if (!node) return { node: null, blended: null, appliedEventId: evt.id };

    const transitionSec = Math.max(0, Number(evt.transitionSec || 0));
    const easing = evt.easing || 'easeInOut';

    if (transitionSec <= 0) {
      return { node, blended: { a: null, b: node, t: 1, easing }, appliedEventId: evt.id };
    }

    // Transition is considered to start at evt.time and blend from previous event’s node.
    const prevEvt = getPrevEvent(project, evt);
    const prevNode = prevEvt ? getNode(project, prevEvt.nodeId) : null;
    if (!prevNode) {
      return { node, blended: { a: null, b: node, t: 1, easing }, appliedEventId: evt.id };
    }

    const raw = (t - evt.time) / transitionSec;
    const tt = GraphModel.clamp01(raw);
    const easeFn = GraphModel.getEaseFn(easing);
    const te = easeFn(tt);
    return { node, blended: { a: prevNode, b: node, t: te, easing }, appliedEventId: evt.id };
  }

  return { evalAtTime };
})();

