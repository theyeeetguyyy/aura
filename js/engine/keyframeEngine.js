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

    function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }

    function catmullRomVector3(p0, p1, p2, p3, t) {
        return {
            x: catmullRom(p0.x || 0, p1.x || 0, p2.x || 0, p3.x || 0, t),
            y: catmullRom(p0.y || 0, p1.y || 0, p2.y || 0, p3.y || 0, t),
            z: catmullRom(p0.z || 0, p1.z || 0, p2.z || 0, p3.z || 0, t)
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

        if (kf1.easing === 'catmullRom') {
            // Find kf0 and kf3
            let kf0Index = Math.max(0, trackData.indexOf(kf1) - 1);
            let kf3Index = Math.min(trackData.length - 1, trackData.indexOf(kf2) + 1);
            
            const kf0 = trackData[kf0Index];
            const kf3 = trackData[kf3Index];

            const v0 = valSelector(kf0.val);
            const v3 = valSelector(kf3.val);

            // Use simple lerp for non-vector3 values in catmullRom for now, 
            // since catmullRom mainly benefits camera paths
            if (valueType === 'vector3') {
                return catmullRomVector3(v0, v1, v2, v3, rawT);
            } else if (valueType === 'euler') {
                return lerpEuler(v1, v2, rawT);
            } else {
                return catmullRom(v0, v1, v2, v3, rawT);
            }
        }

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
