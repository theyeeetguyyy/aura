// ============================================================
// AURA — Parameter System v2
// Removed auto-camera params. Added stem reactivity + manual BPM.
// ============================================================

const ParamSystem = (() => {
    const globalDefaults = {
        // Stem Reactivity (maps to frequency bands)
        stemReactivity_drums: { type: 'range', min: 0, max: 3, default: 1.0, step: 0.05, label: '🥁 Drums Reactivity' },
        stemReactivity_bass: { type: 'range', min: 0, max: 3, default: 1.0, step: 0.05, label: '🎸 Bass Reactivity' },
        stemReactivity_mids: { type: 'range', min: 0, max: 3, default: 1.0, step: 0.05, label: '🎹 Mids Reactivity' },
        stemReactivity_highs: { type: 'range', min: 0, max: 3, default: 1.0, step: 0.05, label: '🎼 Highs Reactivity' },

        // Global visual controls
        reactivity: { type: 'range', min: 0, max: 5, default: 1.0, step: 0.05, label: '⚡ Reactivity' },
        smoothing: { type: 'range', min: 0, max: 0.99, default: 0.75, step: 0.01, label: '〰️ Smoothing' },
        screenShake: { type: 'range', min: 0, max: 5, default: 0.0, step: 0.1, label: '💥 Screen Shake' },
        beatFlash: { type: 'range', min: 0, max: 3, default: 0.0, step: 0.1, label: '⚡ Beat Flash' },
        zoomPunch: { type: 'range', min: 0, max: 3, default: 0.0, step: 0.1, label: '🔍 Zoom Punch' },

        // Post-processing
        postProcessing: { type: 'toggle', default: false, label: '🎬 Post Processing' },
        bloomIntensity: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '✨ Bloom Intensity' },
        bloomThreshold: { type: 'range', min: 0, max: 1, default: 0.35, step: 0.05, label: '🔆 Bloom Threshold' },
        bloomRadius: { type: 'range', min: 0, max: 2, default: 0.8, step: 0.1, label: '🌫️ Bloom Radius' },
        chromaticAberration: { type: 'range', min: 0, max: 0.05, default: 0.0, step: 0.001, label: '🌈 Chromatic Aberration' },
        filmGrain: { type: 'range', min: 0, max: 0.5, default: 0.02, step: 0.01, label: '🎞️ Film Grain' },
        glitchIntensity: { type: 'range', min: 0, max: 1.0, default: 0.0, step: 0.05, label: '📺 Glitch Intensity' },

        // Display
        liveUIMapping: { type: 'toggle', default: true, label: 'Live UI Slider Sync' },
        backgroundColor: { type: 'color', default: '#000000', label: 'Background' },
        colorPalette: {
            type: 'select',
            options: ['rainbow', 'fire', 'ocean', 'neon', 'pastel', 'monochrome', 'cyberpunk', 'aurora', 'sunset', 'synthwave'],
            default: 'cyberpunk',
            label: 'Color Palette'
        },
        aspectRatio: {
            type: 'select',
            options: ['Free (Fill Window)', '16:9 (Landscape)', '9:16 (Vertical)'],
            default: 'Free (Fill Window)',
            label: '📱 Aspect Ratio'
        }
    };

    let globalValues = {};
    let modeValues = {};
    let currentModeSchema = {};
    let paramMappings = {};

    let _cachedColor = null;

    const palettes = {
        rainbow: (t) => `hsl(${t * 360}, 85%, 60%)`,
        fire: (t) => `hsl(${t * 60}, 100%, ${40 + t * 30}%)`,
        ocean: (t) => `hsl(${180 + t * 60}, 80%, ${30 + t * 40}%)`,
        neon: (t) => `hsl(${280 + t * 80}, 100%, ${50 + t * 20}%)`,
        pastel: (t) => `hsl(${t * 360}, 60%, 80%)`,
        monochrome: (t) => `hsl(0, 0%, ${t * 100}%)`,
        cyberpunk: (t) => `hsl(${280 + t * 100}, 100%, ${40 + t * 30}%)`,
        aurora: (t) => `hsl(${120 + t * 120}, 80%, ${40 + t * 30}%)`,
        sunset: (t) => `hsl(${t * 40 + 10}, 90%, ${45 + t * 25}%)`,
        synthwave: (t) => `hsl(${300 + t * 60}, 100%, ${35 + t * 35}%)`
    };

    function getColor(t, palette) {
        const p = palette || globalValues.colorPalette || 'cyberpunk';
        const fn = palettes[p] || palettes.cyberpunk;
        return fn(Math.max(0, Math.min(1, t)));
    }

    function getColorHSL(t, palette) {
        const p = palette || globalValues.colorPalette || 'cyberpunk';
        const hueMap = {
            rainbow: t * 360, fire: t * 60, ocean: 180 + t * 60, neon: 280 + t * 80,
            pastel: t * 360, monochrome: 0, cyberpunk: 280 + t * 100,
            aurora: 120 + t * 120, sunset: t * 40 + 10, synthwave: 300 + t * 60
        };
        return { h: hueMap[p] || t * 360, s: 0.85, l: 0.55 };
    }

    function getColorThreeHSL(t, palette) {
        const hsl = getColorHSL(t, palette);
        if (!_cachedColor) _cachedColor = new THREE.Color();
        _cachedColor.setHSL(hsl.h / 360, hsl.s, hsl.l);
        return _cachedColor;
    }

    function getColorThree(t, palette) {
        return getColorThreeHSL(t, palette);
    }

    function initGlobals() {
        for (const [key, schema] of Object.entries(globalDefaults)) {
            globalValues[key] = schema.default;
        }
    }

    function setModeSchema(schema) {
        currentModeSchema = schema || {};
        modeValues = {};
        for (const [key, s] of Object.entries(currentModeSchema)) {
            modeValues[key] = s.default;
        }
    }

    function get(key) {
        if (key in modeValues) return modeValues[key];
        if (key in globalValues) return globalValues[key];
        return undefined;
    }

    function set(key, value) {
        if (key in currentModeSchema) {
            modeValues[key] = value;
        } else if (key in globalDefaults) {
            globalValues[key] = value;
        }
    }

    function getAllMode() { return { ...modeValues }; }
    function getAllGlobal() { return { ...globalValues }; }

    function exportPreset() {
        return JSON.stringify({ global: globalValues, mode: modeValues, mappings: paramMappings }, null, 2);
    }

    function importPreset(json) {
        try {
            const data = JSON.parse(json);
            if (data.global) Object.assign(globalValues, data.global);
            if (data.mode) Object.assign(modeValues, data.mode);
            if (data.mappings) Object.assign(paramMappings, data.mappings);
            return true;
        } catch (e) {
            console.warn('Failed to import preset:', e);
            return false;
        }
    }

    function randomize() {
        for (const [key, schema] of Object.entries(currentModeSchema)) {
            if (schema.type === 'range') {
                modeValues[key] = schema.min + Math.random() * (schema.max - schema.min);
            } else if (schema.type === 'toggle') {
                modeValues[key] = Math.random() > 0.5;
            } else if (schema.type === 'select') {
                modeValues[key] = schema.options[Math.floor(Math.random() * schema.options.length)];
            }
        }
    }

    function handleModeChange() {
        const keysToRemove = [];
        for (const key in paramMappings) {
            if (paramMappings[key].type === 'mode') keysToRemove.push(key);
        }
        for (const k of keysToRemove) delete paramMappings[k];
    }

    function setMapping(key, band, amount, type) {
        if (!band || amount === 0) { delete paramMappings[key]; return; }
        paramMappings[key] = { band, amount, type: type || 'mode' };
    }

    function getMapping(key) { return paramMappings[key]; }
    function getMappings() { return paramMappings; }

    initGlobals();

    return {
        globalDefaults,
        globalValues,
        get currentModeSchema() { return currentModeSchema; },
        get modeValues() { return modeValues; },
        getColor, getColorHSL, getColorThree, getColorThreeHSL,
        initGlobals, setModeSchema, get, set,
        getAllMode, getAllGlobal,
        exportPreset, importPreset, randomize,
        palettes, setMapping, getMapping, getMappings, handleModeChange
    };
})();
