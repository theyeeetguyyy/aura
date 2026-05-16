// ============================================================
// AURA — Event Bus (v2)
// Stripped of prediction events. Only factual audio data events.
// ============================================================

const AuraEvents = (() => {
    // ── EVENT TYPE CONSTANTS (factual only) ──
    const BASS_IMPACT    = 'bass_impact';
    const ONSET          = 'onset';
    const BEAT           = 'beat';
    const MODE_CHANGE    = 'mode_change';

    // ── PRE-ALLOCATED EVENT DATA OBJECTS ──
    const _eventData = {
        [BASS_IMPACT]: { type: BASS_IMPACT, intensity: 0, time: 0 },
        [ONSET]:       { type: ONSET,       strength: 0, time: 0 },
        [BEAT]:        { type: BEAT,        intensity: 0, bpm: 0, time: 0 },
        [MODE_CHANGE]: { type: MODE_CHANGE, from: '', to: '', time: 0 },
    };

    const _listeners = {};

    function on(eventType, callback) {
        if (!_listeners[eventType]) _listeners[eventType] = new Set();
        _listeners[eventType].add(callback);
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

    function emitBassImpact(intensity, time) {
        const d = _eventData[BASS_IMPACT];
        d.intensity = intensity; d.time = time;
        emit(BASS_IMPACT, d);
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
        BASS_IMPACT, ONSET, BEAT, MODE_CHANGE,
        on, off, emit,
        emitBassImpact, emitOnset, emitBeat, emitModeChange,
    };
})();
