// ============================================================
// AURA Studio — Scene Presets v2
// Curated visual recipes using LAYER COMPOSITION.
// Each preset defines: main mode + background + accent + overlay layers
// Multiple modes render simultaneously for rich, unique scenes.
// ============================================================

const ScenePresets = (() => {

    // ── PRESET DEFINITIONS ──────────────────────────────────
    const PRESETS = [

        // ═══════════════════════════════════════════════════
        // ⚡  HIGH ENERGY
        // ═══════════════════════════════════════════════════
        {
            id: 'cosmic-forge',
            name: 'Cosmic Forge',
            category: 'high-energy',
            icon: '⚡',
            description: 'Hyperforge geometry floating in a starfield with particle dust',
            mode: 'hyperforge',
            layers: { background: 'starfield', accent: 'particleStorm' },
            params: {
                outerSurface: 'superformula', outerDetail: 50, outerSize: 24,
                sfM: 6, sfN1: 1, sfN2: 1, sfN3: 1, sfAudioMap: true,
                displaceMode: 'fourier', displaceAmt: 10, displaceSpeed: 1.5,
                colorMode: 'plasma', solidOpacity: 0.15, wireOpacity: 0.8,
                attractorType: 'lorenz', attractorCount: 5000, attractorSpeed: 1.2,
                flowEnabled: true, flowCount: 3000, flowPattern: 'orbit',
                showTrails: true, showInner: true, innerSurface: 'icosahedron',
                reactivity: 1.3, bassBreath: 1.8, beatExplode: 2.5,
                rotSpeed: 0.4, rotationEnabled: true,
            },
            postFx: { bloomStrength: 1.4, chromaticAberration: 0.3, filmGrain: 0.08, glitchIntensity: 0 },
            camera: { x: 0, y: 15, z: 60 },
            globals: { colorPalette: 'cosmic', reactivity: 1.3, smoothing: 0.85 },
        },
        {
            id: 'bass-quake',
            name: 'Bass Quake',
            category: 'high-energy',
            icon: '💥',
            description: 'Rhythmic geometry over a cyber grid with GPU particles',
            mode: 'rhythmicGeometry',
            layers: { background: 'cyberGrid', accent: 'gpgpuParticles' },
            params: { reactivity: 1.5 },
            postFx: { bloomStrength: 1.6, chromaticAberration: 0.5, filmGrain: 0.05, glitchIntensity: 0.15 },
            camera: { x: 0, y: 10, z: 55 },
            globals: { colorPalette: 'neon', reactivity: 1.5, smoothing: 0.7 },
        },
        {
            id: 'titans-wrath',
            name: "Titan's Wrath",
            category: 'high-energy',
            icon: '🔥',
            description: 'Titanforge over terrain with particle storm sparks',
            mode: 'titanforge',
            layers: { background: 'terrainMesh', accent: 'particleStorm' },
            params: { reactivity: 1.4 },
            postFx: { bloomStrength: 1.5, chromaticAberration: 0.4, filmGrain: 0.1, glitchIntensity: 0.08 },
            camera: { x: 5, y: 20, z: 65 },
            globals: { colorPalette: 'fire', reactivity: 1.4, smoothing: 0.75 },
        },
        {
            id: 'neon-assault',
            name: 'Neon Assault',
            category: 'high-energy',
            icon: '⚡',
            description: 'Plasma fusion with grid distortion and lissajous curves',
            mode: 'neonPlasma',
            layers: { background: 'gridDistortion', accent: 'lissajous' },
            params: {
                plasmaMode: 'fusion', tendrilCount: 12, tendrilLength: 50,
                electricIntensity: 3.5, plasmaWave: 6, beatBurst: 3,
                arcLightning: true, arcCount: 5, fusionCore: true, coreIntensity: 3,
                containmentField: true, containRadius: 30,
                beatShockwave: true, dropDischarge: true,
                colorCycle: 1.5, chromaticSplit: 0.5,
                ringEnabled: true, orbCount: 5,
            },
            postFx: { bloomStrength: 1.8, chromaticAberration: 0.6, filmGrain: 0.05, glitchIntensity: 0.1 },
            camera: { x: 0, y: 0, z: 50 },
            globals: { colorPalette: 'electric', reactivity: 1.5, smoothing: 0.65 },
        },

        // ═══════════════════════════════════════════════════
        // 🌌  ATMOSPHERIC
        // ═══════════════════════════════════════════════════
        {
            id: 'cosmic-drift',
            name: 'Cosmic Drift',
            category: 'atmospheric',
            icon: '🌌',
            description: 'Möbius rings drifting through a galaxy spiral with particles',
            mode: 'mobiusRings',
            layers: { background: 'starfield', accent: 'gpgpuParticles' },
            params: { reactivity: 0.7 },
            postFx: { bloomStrength: 0.8, chromaticAberration: 0.1, filmGrain: 0.15, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 80 },
            globals: { colorPalette: 'ocean', reactivity: 0.8, smoothing: 0.92 },
        },
        {
            id: 'void-meditation',
            name: 'Void Meditation',
            category: 'atmospheric',
            icon: '🕳️',
            description: 'Black hole pulsing gently with particle dust',
            mode: 'voidEngine',
            layers: { accent: 'gpgpuParticles' },
            params: { reactivity: 0.8 },
            postFx: { bloomStrength: 1.2, chromaticAberration: 0.2, filmGrain: 0.12, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 100 },
            globals: { colorPalette: 'cosmic', reactivity: 0.8, smoothing: 0.93 },
        },
        {
            id: 'fractal-dreams',
            name: 'Fractal Dreams',
            category: 'atmospheric',
            icon: '🌿',
            description: 'Fractal tree on a voronoi field with lissajous curves',
            mode: 'fractalTree',
            layers: { background: 'voronoiField', accent: 'lissajous' },
            params: { reactivity: 0.9 },
            postFx: { bloomStrength: 1.0, chromaticAberration: 0.15, filmGrain: 0.18, glitchIntensity: 0 },
            camera: { x: 0, y: 10, z: 80 },
            globals: { colorPalette: 'forest', reactivity: 0.9, smoothing: 0.9 },
        },
        {
            id: 'terrain-journey',
            name: 'Terrain Journey',
            category: 'atmospheric',
            icon: '🏔️',
            description: 'Terrain with starfield and particles floating above',
            mode: 'terrainMesh',
            layers: { background: 'starfield', accent: 'particleManipulation' },
            params: { reactivity: 1.0 },
            postFx: { bloomStrength: 0.9, chromaticAberration: 0.1, filmGrain: 0.2, glitchIntensity: 0 },
            camera: { x: 0, y: 30, z: 80 },
            globals: { colorPalette: 'sunset', reactivity: 1.0, smoothing: 0.88 },
        },

        // ═══════════════════════════════════════════════════
        // 🎵  RHYTHMIC
        // ═══════════════════════════════════════════════════
        {
            id: 'beat-geometry',
            name: 'Beat Geometry',
            category: 'rhythmic',
            icon: '🎵',
            description: 'Geometry forge over a cyber grid with frequency bars',
            mode: 'geometryForge',
            layers: { background: 'cyberGrid', overlay: 'frequencyBars' },
            params: { reactivity: 1.2 },
            postFx: { bloomStrength: 1.2, chromaticAberration: 0.2, filmGrain: 0.05, glitchIntensity: 0 },
            camera: { x: 0, y: 10, z: 50 },
            globals: { colorPalette: 'neon', reactivity: 1.2, smoothing: 0.8 },
        },
        {
            id: 'pulse-grid',
            name: 'Pulse Grid',
            category: 'rhythmic',
            icon: '📊',
            description: 'Grid distortion with particles and waveform overlay',
            mode: 'gridDistortion',
            layers: { accent: 'particleManipulation', overlay: 'waveformScope' },
            params: { reactivity: 1.3 },
            postFx: { bloomStrength: 1.0, chromaticAberration: 0.3, filmGrain: 0.08, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 80 },
            globals: { colorPalette: 'electric', reactivity: 1.3, smoothing: 0.78 },
        },
        {
            id: 'radial-engine',
            name: 'Radial Engine',
            category: 'rhythmic',
            icon: '🔮',
            description: 'Radial bloom with particle storm ring',
            mode: 'radialBloom',
            layers: { accent: 'particleStorm' },
            params: { reactivity: 1.2 },
            postFx: { bloomStrength: 1.3, chromaticAberration: 0.15, filmGrain: 0.06, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 60 },
            globals: { colorPalette: 'cosmic', reactivity: 1.2, smoothing: 0.82 },
        },
        {
            id: 'frequency-cathedral',
            name: 'Frequency Cathedral',
            category: 'rhythmic',
            icon: '🏛️',
            description: 'Geometry in a shader tunnel with spectrogram overlay',
            mode: 'geometryForge',
            layers: { background: 'shaderTunnel', overlay: 'spectrogram' },
            params: { reactivity: 1.1 },
            postFx: { bloomStrength: 1.1, chromaticAberration: 0.2, filmGrain: 0.1, glitchIntensity: 0 },
            camera: { x: 0, y: 5, z: 60 },
            globals: { colorPalette: 'neon', reactivity: 1.1, smoothing: 0.8 },
        },

        // ═══════════════════════════════════════════════════
        // 🔮  PSYCHEDELIC
        // ═══════════════════════════════════════════════════
        {
            id: 'kaleidoscope-trip',
            name: 'Kaleidoscope Trip',
            category: 'psychedelic',
            icon: '🔮',
            description: 'Neon plasma through a kaleidoscope with lissajous curves',
            mode: 'neonPlasma',
            layers: { accent: 'lissajous', overlay: 'kaleidoscope' },
            params: { reactivity: 1.3 },
            postFx: { bloomStrength: 1.5, chromaticAberration: 0.6, filmGrain: 0.05, glitchIntensity: 0.05 },
            camera: { x: 0, y: 0, z: 50 },
            globals: { colorPalette: 'rainbow', reactivity: 1.3, smoothing: 0.75 },
        },
        {
            id: 'fractal-bloom',
            name: 'Fractal Bloom',
            category: 'psychedelic',
            icon: '🌸',
            description: 'Exotic hyperforge on grid distortion with GPU particles',
            mode: 'hyperforge',
            layers: { background: 'gridDistortion', accent: 'gpgpuParticles' },
            params: {
                outerSurface: 'boysSurface', outerDetail: 45, outerSize: 20,
                displaceMode: 'superposition', displaceAmt: 12, displaceSpeed: 2,
                colorMode: 'holographic', solidOpacity: 0.2, wireOpacity: 0.9,
                attractorType: 'aizawa', secondAttractor: 'thomas', attractorBlend: 0.5,
                attractorCount: 6000, attractorSpeed: 1.5,
                flowEnabled: true, flowCount: 4000, flowPattern: 'chaos',
                showTrails: true, showInner: true, innerSurface: 'torusKnot',
                reactivity: 1.4, bassBreath: 2, beatExplode: 2,
                rotSpeed: 0.5, rotationEnabled: true, dualWireColors: true,
            },
            postFx: { bloomStrength: 1.6, chromaticAberration: 0.5, filmGrain: 0.08, glitchIntensity: 0.12 },
            camera: { x: -10, y: 20, z: 55 },
            globals: { colorPalette: 'rainbow', reactivity: 1.4, smoothing: 0.72 },
        },
        {
            id: 'plasma-vortex',
            name: 'Plasma Vortex',
            category: 'psychedelic',
            icon: '🌀',
            description: 'Plasma tendrils in a starfield with particle helix',
            mode: 'neonPlasma',
            layers: { background: 'starfield', accent: 'particleStorm' },
            params: {
                plasmaMode: 'tendrils', tendrilCount: 10, tendrilLength: 60,
                electricIntensity: 4, plasmaWave: 8, beatBurst: 2.5,
                orbCount: 6, orbSize: 4, orbInterconnect: true,
                ringEnabled: true, colorCycle: 2, chromaticSplit: 1,
                dropReaction: true,
            },
            postFx: { bloomStrength: 1.5, chromaticAberration: 0.7, filmGrain: 0.06, glitchIntensity: 0.08 },
            camera: { x: 0, y: 5, z: 55 },
            globals: { colorPalette: 'rainbow', reactivity: 1.3, smoothing: 0.7 },
        },
        {
            id: 'lissajous-trance',
            name: 'Lissajous Trance',
            category: 'psychedelic',
            icon: '∞',
            description: 'Lissajous curves inside a shader tunnel with particles',
            mode: 'lissajous',
            layers: { background: 'shaderTunnel', accent: 'gpgpuParticles' },
            params: { reactivity: 1.2 },
            postFx: { bloomStrength: 1.3, chromaticAberration: 0.4, filmGrain: 0.1, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 80 },
            globals: { colorPalette: 'vaporwave', reactivity: 1.2, smoothing: 0.85 },
        },

        // ═══════════════════════════════════════════════════
        // ✨  MINIMAL
        // ═══════════════════════════════════════════════════
        {
            id: 'clean-bars',
            name: 'Clean Bars',
            category: 'minimal',
            icon: '📊',
            description: 'Simple frequency bars — clean and professional',
            mode: 'frequencyBars',
            params: { reactivity: 0.9 },
            postFx: { bloomStrength: 0.6, chromaticAberration: 0, filmGrain: 0.04, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 60 },
            globals: { colorPalette: 'mono', reactivity: 0.9, smoothing: 0.88 },
        },
        {
            id: 'soft-pulse',
            name: 'Soft Pulse',
            category: 'minimal',
            icon: '○',
            description: 'Möbius rings in a gentle starfield with waveform overlay',
            mode: 'mobiusRings',
            layers: { background: 'starfield', overlay: 'waveformScope' },
            params: { reactivity: 0.7 },
            postFx: { bloomStrength: 0.8, chromaticAberration: 0.05, filmGrain: 0.15, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 80 },
            globals: { colorPalette: 'pastel', reactivity: 0.7, smoothing: 0.93 },
        },
        {
            id: 'glass-particles',
            name: 'Glass Particles',
            category: 'minimal',
            icon: '✨',
            description: 'Geometry shapes with gentle GPU particle dust',
            mode: 'geometryForge',
            layers: { accent: 'gpgpuParticles' },
            params: { reactivity: 0.8 },
            postFx: { bloomStrength: 0.7, chromaticAberration: 0.1, filmGrain: 0.2, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 100 },
            globals: { colorPalette: 'mono', reactivity: 0.8, smoothing: 0.9 },
        },
        {
            id: 'mono-scope',
            name: 'Mono Scope',
            category: 'minimal',
            icon: '〰️',
            description: 'Math surface with waveform overlay',
            mode: 'mathMode',
            layers: { overlay: 'waveformScope' },
            params: { reactivity: 0.9 },
            postFx: { bloomStrength: 0.5, chromaticAberration: 0, filmGrain: 0.12, glitchIntensity: 0 },
            camera: { x: 0, y: 0, z: 60 },
            globals: { colorPalette: 'mono', reactivity: 0.9, smoothing: 0.88 },
        },
    ];

    // ── CATEGORY METADATA ──────────────────────────────────
    const CATEGORIES = [
        { id: 'high-energy', name: 'High Energy', icon: '⚡', color: '#ef4444' },
        { id: 'atmospheric', name: 'Atmospheric', icon: '🌌', color: '#3b82f6' },
        { id: 'rhythmic',    name: 'Rhythmic',    icon: '🎵', color: '#8b5cf6' },
        { id: 'psychedelic', name: 'Psychedelic',  icon: '🔮', color: '#ec4899' },
        { id: 'minimal',     name: 'Minimal',      icon: '✨', color: '#6b7280' },
    ];

    // ── APPLY PRESET ────────────────────────────────────────
    function apply(presetId) {
        const preset = PRESETS.find(p => p.id === presetId);
        if (!preset) { console.warn(`[ScenePresets] Unknown preset: ${presetId}`); return false; }

        console.log(`[ScenePresets] Applying: "${preset.name}"`);

        // 0. Clear all existing layers first
        if (typeof VisualEngine !== 'undefined' && VisualEngine.clearAllLayers) {
            VisualEngine.clearAllLayers();
        }

        // 1. Switch main visual mode
        if (preset.mode && typeof VisualEngine !== 'undefined') {
            VisualEngine.setMode(preset.mode);
        }

        // 2. Apply composition layers (THE MERGING)
        if (preset.layers && typeof VisualEngine !== 'undefined' && VisualEngine.setLayer) {
            for (const [slot, modeKey] of Object.entries(preset.layers)) {
                if (modeKey) {
                    VisualEngine.setLayer(slot, modeKey);
                }
            }
        }

        // 3. Apply mode-specific params
        if (preset.params && typeof ParamSystem !== 'undefined') {
            for (const [key, value] of Object.entries(preset.params)) {
                ParamSystem.set(key, value);
            }
        }

        // 4. Apply global params
        if (preset.globals && typeof ParamSystem !== 'undefined') {
            for (const [key, value] of Object.entries(preset.globals)) {
                ParamSystem.set(key, value);
            }
        }

        // 5. Apply post FX (RenderGraph reads from ParamSystem)
        if (preset.postFx && typeof ParamSystem !== 'undefined') {
            for (const [key, value] of Object.entries(preset.postFx)) {
                ParamSystem.set(key, value);
            }
        }

        // 6. Apply camera position
        if (preset.camera && typeof VisualEngine !== 'undefined') {
            const cam = VisualEngine.camera;
            if (cam) {
                cam.position.set(preset.camera.x || 0, preset.camera.y || 10, preset.camera.z || 60);
                cam.lookAt(0, 0, 0);
            }
        }

        // 7. Rebuild params UI if available
        if (typeof UI !== 'undefined' && UI.buildParamsUI) {
            UI.buildParamsUI();
        }

        return true;
    }

    // ── GETTERS ─────────────────────────────────────────────
    function getAll() { return PRESETS; }

    function getByCategory(categoryId) {
        return PRESETS.filter(p => p.category === categoryId);
    }

    function getCategories() { return CATEGORIES; }

    function getById(id) { return PRESETS.find(p => p.id === id) || null; }

    // ── PUBLIC API ──────────────────────────────────────────
    return {
        apply,
        getAll,
        getByCategory,
        getCategories,
        getById,
        PRESETS,
        CATEGORIES,
    };
})();
