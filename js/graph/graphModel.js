// ============================================================
// AURA — Graph Model (v1)
// Nodes store state snapshots; edges store transition metadata.
// ============================================================

const GraphModel = (() => {
  const EASINGS = {
    linear: (t) => t,
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeIn: (t) => t * t * t,
  };

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function deepBlend(a, b, t) {
    // Blend only numeric primitives. For other types, pick b when t >= 1, else a.
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

  function getEaseFn(name) {
    return EASINGS[name] || EASINGS.easeInOut;
  }

  return {
    EASINGS,
    clamp01,
    deepBlend,
    getEaseFn,
  };
})();

