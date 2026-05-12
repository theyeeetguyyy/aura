// ============================================================
// AURA — Event Bus (v1)
// Typed, zero-allocation event emitter for engine-wide events.
// AudioEngine emits → Modes/Camera/PostFX subscribe.
//
// Design: Pre-allocated event objects prevent GC in hot paths.
// Events are fire-and-forget — no queuing, no async.
// ============================================================

const AuraEvents = (() => {
    // ── EVENT TYPE CONSTANTS ──
    const BASS_IMPACT       = 'bass_impact';
    const DROP_ENTER        = 'drop_enter';
    const DROP_EXIT         = 'drop_exit';
    const SECTION_CHANGE    = 'section_change';
    const GUNSHOT           = 'gunshot';
    const SCREECH           = 'screech';
    const SIREN             = 'siren';
    const ONSET             = 'onset';
    const BEAT              = 'beat';
    const MODE_CHANGE       = 'mode_change';

    // ── PRE-ALLOCATED EVENT DATA OBJECTS ──
    // These are reused every emission to avoid per-frame allocation.
    const _eventData = {
        [BASS_IMPACT]:    { type: BASS_IMPACT,    intensity: 0, time: 0 },
        [DROP_ENTER]:     { type: DROP_ENTER,     intensity: 0, time: 0, chaos: 0 },
        [DROP_EXIT]:      { type: DROP_EXIT,      time: 0 },
        [SECTION_CHANGE]: { type: SECTION_CHANGE, section: '', time: 0, effects: null },
        [GUNSHOT]:        { type: GUNSHOT,         intensity: 0, time: 0 },
        [SCREECH]:        { type: SCREECH,         intensity: 0, time: 0 },
        [SIREN]:          { type: SIREN,           intensity: 0, time: 0 },
        [ONSET]:          { type: ONSET,           strength: 0, time: 0 },
        [BEAT]:           { type: BEAT,            intensity: 0, bpm: 0, time: 0 },
        [MODE_CHANGE]:    { type: MODE_CHANGE,     from: '', to: '', time: 0 },
    };

    // ── LISTENER REGISTRY ──
    // Map<string, Set<Function>>
    const _listeners = {};

    function on(eventType, callback) {
        if (!_listeners[eventType]) _listeners[eventType] = new Set();
        _listeners[eventType].add(callback);
        // Return unsubscribe function
        return () => _listeners[eventType].delete(callback);
    }

    function off(eventType, callback) {
        if (_listeners[eventType]) _listeners[eventType].delete(callback);
    }

    function emit(eventType, data) {
        const set = _listeners[eventType];
        if (!set || set.size === 0) return;
        for (const fn of set) {
            try { fn(data); } catch (e) { console.warn(`[AuraEvents] Listener error for "${eventType}":`, e); }
        }
    }

    // ── CONVENIENCE EMITTERS ──
    // These reuse pre-allocated objects — zero GC pressure.

    function emitBassImpact(intensity, time) {
        const d = _eventData[BASS_IMPACT];
        d.intensity = intensity; d.time = time;
        emit(BASS_IMPACT, d);
    }

    function emitDropEnter(intensity, time, chaos) {
        const d = _eventData[DROP_ENTER];
        d.intensity = intensity; d.time = time; d.chaos = chaos || 0;
        emit(DROP_ENTER, d);
    }

    function emitDropExit(time) {
        const d = _eventData[DROP_EXIT];
        d.time = time;
        emit(DROP_EXIT, d);
    }

    function emitSectionChange(section, time, effects) {
        const d = _eventData[SECTION_CHANGE];
        d.section = section; d.time = time; d.effects = effects;
        emit(SECTION_CHANGE, d);
    }

    function emitGunshot(intensity, time) {
        const d = _eventData[GUNSHOT];
        d.intensity = intensity; d.time = time;
        emit(GUNSHOT, d);
    }

    function emitScreech(intensity, time) {
        const d = _eventData[SCREECH];
        d.intensity = intensity; d.time = time;
        emit(SCREECH, d);
    }

    function emitSiren(intensity, time) {
        const d = _eventData[SIREN];
        d.intensity = intensity; d.time = time;
        emit(SIREN, d);
    }

    function emitOnset(strength, time) {
        const d = _eventData[ONSET];
        d.strength = strength; d.time = time;
        emit(ONSET, d);
    }

    function emitBeat(intensity, bpm, time) {
        const d = _eventData[BEAT];
        d.intensity = intensity; d.bpm = bpm; d.time = time;
        emit(BEAT, d);
    }

    function emitModeChange(from, to, time) {
        const d = _eventData[MODE_CHANGE];
        d.from = from; d.to = to; d.time = time;
        emit(MODE_CHANGE, d);
    }

    return {
        // Event type constants
        BASS_IMPACT, DROP_ENTER, DROP_EXIT, SECTION_CHANGE,
        GUNSHOT, SCREECH, SIREN, ONSET, BEAT, MODE_CHANGE,

        // Core API
        on, off, emit,

        // Convenience emitters (zero-allocation)
        emitBassImpact, emitDropEnter, emitDropExit,
        emitSectionChange, emitGunshot, emitScreech,
        emitSiren, emitOnset, emitBeat, emitModeChange,
    };
})();
