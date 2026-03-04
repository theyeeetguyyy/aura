// ============================================================
// AURA — Parameter System
// Generic param schema → auto-generated UI controls
// ============================================================

const ParamSystem = (() => {
    // Global params applied across all modes
    const globalDefaults = {
        reactivity: { type: 'range', min: 0, max: 3, default: 1.0, step: 0.05, label: 'Reactivity' },
        smoothing: { type: 'range', min: 0, max: 0.99, default: 0.75, step: 0.01, label: 'Smoothing' },
        screenShake: { type: 'range', min: 0, max: 3, default: 0.4, step: 0.1, label: '💥 Screen Shake' },
        beatFlash: { type: 'range', min: 0, max: 2, default: 0.4, step: 0.1, label: '⚡ Beat Flash' },
        zoomPunch: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.1, label: '🔍 Zoom Punch' },
        bloomIntensity: { type: 'range', min: 0, max: 3, default: 0.6, step: 0.1, label: 'Bloom' },
        bloomThreshold: { type: 'range', min: 0, max: 1, default: 0.4, step: 0.05, label: 'Bloom Threshold' },
        cameraAutoRotate: { type: 'toggle', default: false, label: 'Auto Rotate Camera' },
        cameraRotateSpeed: { type: 'range', min: 0, max: 5, default: 0.3, step: 0.1, label: 'Rotate Speed' },
        postProcessing: { type: 'toggle', default: false, label: 'Post Processing' },
        backgroundColor: { type: 'color', default: '#000000', label: 'Background' },
        colorPalette: {
            type: 'select',
            options: ['rainbow', 'fire', 'ocean', 'neon', 'pastel', 'monochrome', 'cyberpunk', 'aurora', 'sunset', 'custom'],
            default: 'cyberpunk',
            label: 'Color Palette'
        }
    };

    // Current values
    let globalValues = {};
    let modeValues = {};
    let currentModeSchema = {};

    // Palette definitions (HSL arrays)
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
        custom: (t) => `hsl(${t * 360}, 90%, 55%)`
    };

    function getColor(t, palette) {
        const p = palette || globalValues.colorPalette || 'cyberpunk';
        const fn = palettes[p] || palettes.cyberpunk;
        return fn(Math.max(0, Math.min(1, t)));
    }

    function getColorHSL(t, palette) {
        const p = palette || globalValues.colorPalette || 'cyberpunk';
        const hueMap = {
            rainbow: t * 360,
            fire: t * 60,
            ocean: 180 + t * 60,
            neon: 280 + t * 80,
            pastel: t * 360,
            monochrome: 0,
            cyberpunk: 280 + t * 100,
            aurora: 120 + t * 120,
            sunset: t * 40 + 10,
            custom: t * 360
        };
        return { h: hueMap[p] || t * 360, s: 0.85, l: 0.55 };
    }

    function getColorThreeHSL(t, palette) {
        const hsl = getColorHSL(t, palette);
        return new THREE.Color().setHSL(hsl.h / 360, hsl.s, hsl.l);
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

    function getAllMode() {
        return { ...modeValues };
    }

    function getAllGlobal() {
        return { ...globalValues };
    }

    function exportPreset() {
        return JSON.stringify({ global: globalValues, mode: modeValues }, null, 2);
    }

    function importPreset(json) {
        try {
            const data = JSON.parse(json);
            if (data.global) Object.assign(globalValues, data.global);
            if (data.mode) Object.assign(modeValues, data.mode);
            return true;
        } catch (e) {
            console.warn('Failed to import preset:', e);
            return false;
        }
    }

    // Random parameter exploration
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

    initGlobals();

    return {
        globalDefaults,
        globalValues,
        get currentModeSchema() { return currentModeSchema; },
        get modeValues() { return modeValues; },
        getColor,
        getColorHSL,
        getColorThree,
        getColorThreeHSL,
        initGlobals,
        setModeSchema,
        get,
        set,
        getAllMode,
        getAllGlobal,
        exportPreset,
        importPreset,
        randomize,
        palettes
    };
})();
