// ============================================================
// AURA — Project Schema (v1)
// Versioned, serializable editing state for Aura Studio
// ============================================================
//
// Design goals:
// - Deterministic: timeline evaluation is the source of truth
// - Portable: single JSON file represents the full edit
// - Migratable: version field enables future schema upgrades

const ProjectSchema = (() => {
  const VERSION = 1;

  function createEmptyProject() {
    return {
      version: VERSION,
      meta: {
        id: `proj_${Date.now()}`,
        name: 'Untitled Project',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      },

      audio: {
        // Browser limitation: we can’t persist the raw file bytes without extra work.
        // For now we persist just presentation metadata. The user re-imports audio on load.
        fileName: null,
        duration: 0,
      },

      // Minimal “state node” model: a stored snapshot you can place on the timeline.
      nodes: [
        {
          id: 'node_1',
          name: 'Default State',
          visual: {
            modeKey: 'geometryForge',
            globalParams: null, // null => use ParamSystem defaults
            modeParams: null,   // null => mode defaults
            mappings: null,     // audio modulation mappings
          },
          camera: {
            // For v1 we store camera snapshots but don’t yet keyframe them.
            orbitTheta: 0,
            orbitPhi: Math.PI / 2,
            orbitRadius: 100,
            fov: 75,
          },
          ui: {
            x: 120,
            y: 90,
          },
        },
      ],

      // Graph transitions between nodes (independent of timeline placement)
      // Timeline can reference these or override per-event.
      edges: [],

      timeline: {
        fps: 60,
        // Clips dropped onto the timeline that trigger a node state
        stateEvents: [
          { id: 'evt_1', time: 0, nodeId: 'node_1', transitionSec: 0.75, easing: 'easeInOut' },
        ],
        // Keyframes for the camera transform track
        cameraEvents: [],
      },

      editor: {
        followTimeline: true,
      },
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  return {
    VERSION,
    createEmptyProject,
    clone,
  };
})();

