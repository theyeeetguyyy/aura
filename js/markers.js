// ============================================================
// AURA — Marker System v4
// Section-aware reactivity: markers define energy intensity +
// per-effect multipliers consumed by audio.js → audioBus.
// Reads NLE markers from ProjectStore.timeline.markers.
// ============================================================

const MarkerSystem = (() => {

    // ── Section type definitions ────────────────────────────
    const MARKER_TYPES = {
        intro: {
            label: 'Intro',
            color: '#38bdf8',       // sky blue
            icon: '🌅',
            intensity: 0.45,
            effects: { shake: 0.25, flash: 0.35, zoom: 0.90, bloom: 0.75, speed: 0.80, particleScale: 0.80, displacementScale: 0.55 },
        },
        buildup: {
            label: 'Build-up',
            color: '#fb923c',       // orange
            icon: '📈',
            intensity: 1.25,
            effects: { shake: 0.85, flash: 1.00, zoom: 1.12, bloom: 1.30, speed: 1.25, particleScale: 1.15, displacementScale: 1.10 },
        },
        fakeout: {
            label: 'Fakeout',
            color: '#a78bfa',       // violet
            icon: '🎭',
            intensity: 0.80,
            effects: { shake: 0.55, flash: 0.65, zoom: 1.08, bloom: 0.95, speed: 0.88, particleScale: 0.90, displacementScale: 0.78 },
        },
        drop: {
            label: 'DROP',
            color: '#f43f5e',       // red-pink
            icon: '💥',
            intensity: 2.00,
            effects: { shake: 1.80, flash: 2.00, zoom: 1.50, bloom: 1.90, speed: 1.65, particleScale: 1.85, displacementScale: 2.00 },
        },
        fill: {
            label: 'Fill',
            color: '#f97316',       // deep orange
            icon: '🔥',
            intensity: 1.55,
            effects: { shake: 1.20, flash: 1.45, zoom: 1.22, bloom: 1.50, speed: 1.35, particleScale: 1.40, displacementScale: 1.50 },
        },
        outro: {
            label: 'Outro',
            color: '#94a3b8',       // slate
            icon: '🌙',
            intensity: 0.38,
            effects: { shake: 0.18, flash: 0.25, zoom: 0.85, bloom: 0.65, speed: 0.72, particleScale: 0.70, displacementScale: 0.48 },
        },
    };

    // ── Runtime state ───────────────────────────────────────
    let _currentSection   = null;   // currently active section marker
    let _smoothedEffects  = _neutralEffects();
    let _sectionIntensity = 1.0;
    let _transitionFade   = 1.0;    // 0→1 over 0.5 s on section change
    let _transitionFrames = 0;
    const TRANSITION_FRAMES = 30;   // ~0.5 s at 60 fps

    function _neutralEffects() {
        return { shake: 1, flash: 1, zoom: 1, bloom: 1, speed: 1, particleScale: 1, displacementScale: 1 };
    }

    // ── Source of truth: ProjectStore NLE markers ───────────
    function _getNLEMarkers() {
        if (typeof ProjectStore === 'undefined') return [];
        try {
            const state = ProjectStore.getState();
            return (state.timeline && state.timeline.markers) ? state.timeline.markers : [];
        } catch (_) { return []; }
    }

    // ── update(currentTime) — called every audio frame ──────
    function update(currentTime) {
        const markers = _getNLEMarkers();
        if (!markers.length) {
            _currentSection   = null;
            _sectionIntensity = 1.0;
            _smoothedEffects  = _neutralEffects();
            return;
        }

        // Sort by time (should already be sorted but be safe)
        const sorted = [...markers].sort((a, b) => a.time - b.time);

        // Find the active section: last marker whose time <= currentTime
        let active = null;
        for (const mk of sorted) {
            if (mk.time <= currentTime) active = mk;
            else break;
        }

        const prevType = _currentSection ? _currentSection.markerType : null;
        _currentSection = active;

        const typeKey  = active ? (active.markerType || active.label?.toLowerCase() || 'intro') : null;
        const typeDef  = typeKey ? (MARKER_TYPES[typeKey] || null) : null;

        // Section changed — reset transition
        if (typeKey !== prevType) {
            _transitionFrames = 0;
            _transitionFade   = 0;
        }

        // Advance transition fade
        _transitionFrames = Math.min(_transitionFrames + 1, TRANSITION_FRAMES);
        _transitionFade   = _transitionFrames / TRANSITION_FRAMES;

        // Target intensity + effects
        const targetIntensity = typeDef ? typeDef.intensity : 1.0;
        const targetEffects   = typeDef ? typeDef.effects   : _neutralEffects();

        // Smooth toward target (lerp per frame, fast attack)
        const alpha = 0.12;
        _sectionIntensity += (targetIntensity - _sectionIntensity) * alpha;
        for (const k of Object.keys(_smoothedEffects)) {
            const tgt = targetEffects[k] !== undefined ? targetEffects[k] : 1;
            _smoothedEffects[k] += (tgt - _smoothedEffects[k]) * alpha;
        }
    }

    // ── Public query API (consumed by audio.js → audioBus) ──
    function getCurrentSection() {
        if (!_currentSection) return null;
        const typeKey = _currentSection.markerType || null;
        const typeDef = typeKey ? MARKER_TYPES[typeKey] : null;
        return {
            id:        _currentSection.id,
            time:      _currentSection.time,
            type:      typeKey,
            label:     _currentSection.label || typeKey,
            color:     typeDef ? typeDef.color : '#78909c',
            intensity: typeDef ? typeDef.intensity : 1.0,
        };
    }

    function getSectionIntensity()  { return _sectionIntensity; }
    function getSmoothedEffects()   { return { ..._smoothedEffects }; }
    function isDropActive()         { return !!_currentSection && (_currentSection.markerType === 'drop' || _currentSection.markerType === 'fill'); }
    function getDropIntensity()     { return isDropActive() ? Math.max(0, (_sectionIntensity - 1.0) / 1.0) : 0; }
    function isHighEnergy()         { return _sectionIntensity >= 1.0; }
    function isCalm()               { return _sectionIntensity <= 0.5; }

    // ── Marker management (backed by ProjectStore) ────────
    function getMarkers() {
        const raw = _getNLEMarkers();
        return raw.map(m => {
            const typeKey = m.markerType || 'custom';
            const typeDef = MARKER_TYPES[typeKey] || null;
            return {
                ...m,
                color: typeDef ? typeDef.color : '#78909c',
                icon:  typeDef ? typeDef.icon  : '📌',
                label: typeDef ? typeDef.label : (m.label || typeKey),
            };
        });
    }

    function getTypes() { return MARKER_TYPES; }

    function addMarker(time, markerType) {
        if (typeof ProjectStore === 'undefined') return;
        const typeDef = MARKER_TYPES[markerType] || null;
        ProjectStore.dispatch({
            type: 'timeline/addMarker',
            time,
            label: typeDef ? typeDef.label : 'Marker',
            markerType: markerType || 'custom',
        });
    }

    function removeMarker(id) {
        if (typeof ProjectStore === 'undefined') return;
        ProjectStore.dispatch({ type: 'timeline/removeMarker', id });
    }

    function clearAll() {
        if (typeof ProjectStore === 'undefined') return;
        ProjectStore.dispatch({ type: 'timeline/clearMarkers' });
    }

    function moveMarker(id, newTime) {
        if (typeof ProjectStore === 'undefined') return;
        ProjectStore.dispatch({ type: 'timeline/updateMarker', id, patch: { time: newTime } });
    }

    function renameMarker(id, label) {
        if (typeof ProjectStore === 'undefined') return;
        ProjectStore.dispatch({ type: 'timeline/updateMarker', id, patch: { label } });
    }

    function exportMarkers() { return JSON.stringify(getMarkers()); }
    function importMarkers() { return false; }

    return {
        MARKER_TYPES,
        SECTION_TYPES: MARKER_TYPES,   // alias for old code
        update, getCurrentSection, getSectionIntensity,
        getSmoothedEffects, isDropActive, getDropIntensity,
        isHighEnergy, isCalm,
        getMarkers, getTypes,
        addMarker, removeMarker, clearAll, moveMarker, renameMarker,
        exportMarkers, importMarkers,
    };
})();

