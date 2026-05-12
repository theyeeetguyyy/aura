// ============================================================
// AURA — Keyframe Engine (Phase 2.5)
// Evaluates track keyframes for absolute deterministic control.
// ============================================================

const KeyframeEngine = (() => {
    // Standard easing functions
    const EASING = {
        linear: (t) => t,
        step: (t) => 0, // Snaps at the end (beat jumps) - holds start value until t=1
        easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
    };

    function lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    function lerpVector3(v1, v2, amt) {
        if (!v1 || !v2) return v1 || v2;
        return {
            x: lerp(v1.x || 0, v2.x || 0, amt),
            y: lerp(v1.y || 0, v2.y || 0, amt),
            z: lerp(v1.z || 0, v2.z || 0, amt)
        };
    }

    function lerpEuler(e1, e2, amt) {
        if (!e1 || !e2) return e1 || e2;
        return {
            x: lerp(e1.x || 0, e2.x || 0, amt),
            y: lerp(e1.y || 0, e2.y || 0, amt),
            z: lerp(e1.z || 0, e2.z || 0, amt)
        };
    }

    /**
     * Evaluates a track of keyframes at time `t`.
     * @param {Array} trackData - Array of keyframes: [{time: 0, val: {...}, easing: 'easeInOutCubic'}, ...]
     * @param {number} t - Current time in seconds
     * @param {string} valueType - 'vector3', 'euler', or 'scalar'
     * @param {Function} valSelector - Optional function to extract value from kf.val
     */
    function evalTrack(trackData, t, valueType = 'scalar', valSelector = (v) => v) {
        if (!trackData || !Array.isArray(trackData) || trackData.length === 0) return null;
        
        // Before first keyframe
        if (t <= trackData[0].time) return valSelector(trackData[0].val);
        
        // After last keyframe
        if (t >= trackData[trackData.length - 1].time) return valSelector(trackData[trackData.length - 1].val);

        // Find surrounding keyframes
        let kf1 = trackData[0];
        let kf2 = trackData[1];
        
        for (let i = 0; i < trackData.length - 1; i++) {
            if (t >= trackData[i].time && t < trackData[i+1].time) {
                kf1 = trackData[i];
                kf2 = trackData[i+1];
                break;
            }
        }

        const duration = kf2.time - kf1.time;
        if (duration <= 0) return valSelector(kf2.val);

        let rawT = (t - kf1.time) / duration;
        const easeFn = EASING[kf1.easing] || EASING.easeInOutCubic;
        
        if (kf1.easing === 'step') {
            return valSelector(kf1.val); // Holds kf1 until exactly kf2.time (beat jumps)
        }

        const amt = easeFn(rawT);
        const v1 = valSelector(kf1.val);
        const v2 = valSelector(kf2.val);

        if (valueType === 'vector3') {
            return lerpVector3(v1, v2, amt);
        } else if (valueType === 'euler') {
            return lerpEuler(v1, v2, amt);
        } else {
            return lerp(v1, v2, amt);
        }
    }

    return {
        evalTrack,
        EASING
    };
})();
