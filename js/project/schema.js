// ============================================================
// AURA — Project Schema v2
// Dual timeline: visualTrack (clips) + cameraTrack (keyframes)
// Markers are bookmarks only — no prediction effects.
// ============================================================

const ProjectSchema = (() => {
  const VERSION = 2;

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
        mode: 'single', // 'single' | 'stems'
        fileName: null,
        duration: 0,
        bpm: 140,
        stems: {
          // Each stem: { fileName, enabled, reactivity }
          drums:   { fileName: null, enabled: true, reactivity: 1.0 },
          bass:    { fileName: null, enabled: true, reactivity: 1.0 },
          mids:    { fileName: null, enabled: true, reactivity: 1.0 },
          highs:   { fileName: null, enabled: true, reactivity: 1.0 },
        },
      },

      // State nodes (snapshots of mode + params + camera)
      nodes: [
        {
          id: 'node_1',
          name: 'Default State',
          visual: {
            modeKey: 'geometryForge',
            globalParams: null,
            modeParams: null,
            mappings: null,
          },
          camera: {
            pos: { x: 0, y: 0, z: 100 },
            lookAt: { x: 0, y: 0, z: 0 },
            fov: 75,
          },
          ui: { x: 120, y: 90 },
        },
      ],

      edges: [],

      timeline: {
        fps: 60,
        // Visual state clips — draggable colored blocks
        visualTrack: [
          { id: 'evt_1', time: 0, duration: 5.0, nodeId: 'node_1', transitionSec: 0.75, easing: 'easeInOut', transitionType: 'transform' },
        ],
        // Camera keyframes — diamond markers with spline interpolation
        cameraTrack: [],
        // Markers — bookmarks only, no effect multipliers
        markers: [],
      },

      editor: {
        followTimeline: true,
      },
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Migrate v1 projects to v2
  function migrate(project) {
    if (!project || project.version === VERSION) return project;
    const migrated = clone(project);
    migrated.version = VERSION;

    // v1 → v2: rename stateEvents → visualTrack, cameraEvents → cameraTrack
    if (migrated.timeline) {
      if (migrated.timeline.stateEvents && !migrated.timeline.visualTrack) {
        migrated.timeline.visualTrack = migrated.timeline.stateEvents;
        delete migrated.timeline.stateEvents;
      }
      if (migrated.timeline.cameraEvents && !migrated.timeline.cameraTrack) {
        migrated.timeline.cameraTrack = migrated.timeline.cameraEvents;
        delete migrated.timeline.cameraEvents;
      }
      if (!migrated.timeline.markers) migrated.timeline.markers = [];
    }

    // v1 camera nodes: orbitTheta/Phi/Radius → pos/lookAt
    if (migrated.nodes) {
      for (const node of migrated.nodes) {
        if (node.camera && node.camera.orbitRadius !== undefined) {
          const r = node.camera.orbitRadius || 100;
          const theta = node.camera.orbitTheta || 0;
          const phi = node.camera.orbitPhi || Math.PI / 2;
          node.camera = {
            pos: {
              x: r * Math.sin(phi) * Math.sin(theta),
              y: r * Math.cos(phi),
              z: r * Math.sin(phi) * Math.cos(theta),
            },
            lookAt: { x: 0, y: 0, z: 0 },
            fov: node.camera.fov || 75,
          };
        }
      }
    }

    if (!migrated.audio) migrated.audio = { mode: 'single', fileName: null, duration: 0, bpm: 140, stems: {} };
    if (!migrated.audio.bpm) migrated.audio.bpm = 140;

    console.log('[ProjectSchema] Migrated v1 → v2');
    return migrated;
  }

  return { VERSION, createEmptyProject, clone, migrate };
})();
