// ============================================================
// AURA — Marker System v2
// Timeline markers with rich section behaviors:
// intensity curves, transition blending, camera hints,
// color temperature, effect scaling per section type
// ============================================================

const MarkerSystem = (() => {
    // Section types with comprehensive visual behavior definitions
    const SECTION_TYPES = {
        intro: {
            label: 'Intro', color: '#4fc3f7', icon: '🎵', intensity: 0.4, glyph: 'I',
            shake: 0.2, flash: 0.1, zoom: 0.2, bloom: 0.5, speed: 0.5,
            colorTemp: 'cool', cameraPreset: 'slow-orbit',
            particleScale: 0.3, displacementScale: 0.3
        },
        verse: {
            label: 'Verse', color: '#81c784', icon: '🎤', intensity: 0.5, glyph: 'V',
            shake: 0.3, flash: 0.2, zoom: 0.3, bloom: 0.6, speed: 0.6,
            colorTemp: 'neutral', cameraPreset: 'gentle-sway',
            particleScale: 0.5, displacementScale: 0.5
        },
        buildup: {
            label: 'Build-up', color: '#ffb74d', icon: '📈', intensity: 0.8, glyph: 'B',
            shake: 0.5, flash: 0.3, zoom: 0.6, bloom: 0.8, speed: 1.0,
            colorTemp: 'warm', cameraPreset: 'zoom-in',
            particleScale: 0.8, displacementScale: 0.8,
            // Buildup special: intensity ramps from 0.5 to 1.5 over section
            intensityRamp: true, rampStart: 0.5, rampEnd: 1.5
        },
        fakeout: {
            label: 'Fakeout', color: '#ff8a65', icon: '🎭', intensity: 0.3, glyph: 'F',
            shake: 0.1, flash: 0.5, zoom: 0.1, bloom: 0.3, speed: 0.3,
            colorTemp: 'cool', cameraPreset: 'sudden-pull',
            particleScale: 0.2, displacementScale: 0.2
        },
        drop: {
            label: 'DROP', color: '#f44336', icon: '💥', intensity: 1.5, glyph: 'D',
            shake: 1.2, flash: 1.0, zoom: 1.2, bloom: 1.5, speed: 1.5,
            colorTemp: 'hot', cameraPreset: 'shake-heavy',
            particleScale: 1.4, displacementScale: 1.4,
            beatSync: true, rhythmLock: true
        },
        drop2: {
            label: 'DROP 2', color: '#e91e63', icon: '🔥', intensity: 1.8, glyph: 'D2',
            shake: 1.5, flash: 1.2, zoom: 1.5, bloom: 2.0, speed: 1.8,
            colorTemp: 'extreme', cameraPreset: 'shake-insane',
            particleScale: 1.6, displacementScale: 1.6,
            beatSync: true, rhythmLock: true
        },
        breakdown: {
            label: 'Breakdown', color: '#ba68c8', icon: '🌀', intensity: 0.6, glyph: 'BD',
            shake: 0.3, flash: 0.2, zoom: 0.4, bloom: 1.0, speed: 0.7,
            colorTemp: 'ethereal', cameraPreset: 'drift',
            particleScale: 0.6, displacementScale: 0.6
        },
        bridge: {
            label: 'Bridge', color: '#64b5f6', icon: '🌉', intensity: 0.5, glyph: 'BR',
            shake: 0.2, flash: 0.2, zoom: 0.3, bloom: 0.7, speed: 0.5,
            colorTemp: 'cool', cameraPreset: 'slow-orbit',
            particleScale: 0.5, displacementScale: 0.4
        },
        climax: {
            label: 'Climax', color: '#ff1744', icon: '⚡', intensity: 2.0, glyph: 'CL',
            shake: 1.8, flash: 1.5, zoom: 1.8, bloom: 2.5, speed: 2.0,
            colorTemp: 'extreme', cameraPreset: 'shake-insane',
            particleScale: 1.8, displacementScale: 1.8,
            beatSync: true, rhythmLock: true
        },
        outro: {
            label: 'Outro', color: '#90a4ae', icon: '🎬', intensity: 0.3, glyph: 'O',
            shake: 0.1, flash: 0.05, zoom: 0.1, bloom: 0.4, speed: 0.3,
            colorTemp: 'cool', cameraPreset: 'slow-pull-away',
            particleScale: 0.2, displacementScale: 0.2
        }
    };

    let markers = [];
    let nextId = 1;
    let currentSection = null;
    let currentSectionIntensity = 1.0;

    // ── NEW v2: Smoothed effect multipliers ──
    let smoothedEffects = {
        shake: 1.0, flash: 1.0, zoom: 1.0, bloom: 1.0, speed: 1.0,
        particleScale: 1.0, displacementScale: 1.0
    };
    let targetEffects = { ...smoothedEffects };

    function addMarker(time, type) {
        if (!SECTION_TYPES[type]) return null;
        const marker = {
            id: nextId++,
            time: time,
            type: type,
            ...SECTION_TYPES[type]
        };
        markers.push(marker);
        markers.sort((a, b) => a.time - b.time);
        return marker;
    }

    function removeMarker(id) {
        markers = markers.filter(m => m.id !== id);
    }

    function clearAll() {
        markers = [];
        nextId = 1;
        currentSection = null;
        currentSectionIntensity = 1.0;
    }

    function getMarkers() {
        return [...markers];
    }

    function getTypes() {
        return SECTION_TYPES;
    }

    function update(currentTime) {
        let active = null;
        for (let i = markers.length - 1; i >= 0; i--) {
            if (currentTime >= markers[i].time) {
                active = markers[i];
                break;
            }
        }

        if (active) {
            currentSection = active;
            let baseIntensity = active.intensity;

            // Buildup ramp: intensity increases over the section
            if (active.intensityRamp) {
                const idx = markers.findIndex(m => m.id === active.id);
                let progress = 0;
                if (idx >= 0 && idx < markers.length - 1) {
                    const sectionLen = markers[idx + 1].time - active.time;
                    progress = sectionLen > 0 ? (currentTime - active.time) / sectionLen : 0;
                } else {
                    progress = Math.min(1, (currentTime - active.time) / 30);
                }
                progress = Math.max(0, Math.min(1, progress));
                baseIntensity = active.rampStart + (active.rampEnd - active.rampStart) * progress;
            }

            currentSectionIntensity = baseIntensity;

            // Update target effects
            targetEffects.shake = active.shake ?? 1;
            targetEffects.flash = active.flash ?? 1;
            targetEffects.zoom = active.zoom ?? 1;
            targetEffects.bloom = active.bloom ?? 1;
            targetEffects.speed = active.speed ?? 1;
            targetEffects.particleScale = active.particleScale ?? 1;
            targetEffects.displacementScale = active.displacementScale ?? 1;
        } else {
            currentSection = null;
            currentSectionIntensity = 1.0;
            targetEffects.shake = 1; targetEffects.flash = 1; targetEffects.zoom = 1;
            targetEffects.bloom = 1; targetEffects.speed = 1;
            targetEffects.particleScale = 1; targetEffects.displacementScale = 1;
        }

        // Smooth transition between effect states — directional lerp
        // Fast attack entering high-energy, slow release leaving
        for (const key of Object.keys(smoothedEffects)) {
            const delta = targetEffects[key] - smoothedEffects[key];
            const lerpRate = delta > 0 ? 0.18 : 0.05; // Fast attack, slow decay
            smoothedEffects[key] += delta * lerpRate;
        }
    }

    function getCurrentSection() {
        return currentSection;
    }

    function getSectionIntensity() {
        return currentSectionIntensity;
    }

    function getSmoothedEffects() {
        return { ...smoothedEffects };
    }

    function isHighEnergy() {
        if (!currentSection) return false;
        return currentSection.intensity >= 1.0;
    }

    function isCalm() {
        if (!currentSection) return false;
        return currentSection.intensity <= 0.5;
    }

    // Get the next section marker (for anticipation)
    function getNextSection(currentTime) {
        for (let i = 0; i < markers.length; i++) {
            if (markers[i].time > currentTime) {
                return markers[i];
            }
        }
        return null;
    }

    // Distance in seconds to next section
    function timeToNextSection(currentTime) {
        const next = getNextSection(currentTime);
        return next ? next.time - currentTime : 9999;
    }

    function exportMarkers() {
        return JSON.stringify(markers.map(m => ({ time: m.time, type: m.type })));
    }

    function importMarkers(json) {
        try {
            const data = JSON.parse(json);
            clearAll();
            data.forEach(m => addMarker(m.time, m.type));
            return true;
        } catch (e) {
            console.warn('Failed to import markers:', e);
            return false;
        }
    }

    return {
        SECTION_TYPES,
        addMarker,
        removeMarker,
        clearAll,
        getMarkers,
        getTypes,
        update,
        getCurrentSection,
        getSectionIntensity,
        getSmoothedEffects,
        getNextSection,
        timeToNextSection,
        isHighEnergy,
        isCalm,
        exportMarkers,
        importMarkers
    };
})();
