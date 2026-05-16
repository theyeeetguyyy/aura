// ============================================================
// AURA — Camera Engine v3 (Keyframe-Only)
// Pure keyframe interpolation — no physics, no predictions.
// User places camera keyframes on timeline, engine interpolates.
// ============================================================

const CameraEngine = (() => {
    let baseCamera = null;
    let baseFOV = 75;

    // Current interpolated state
    let currentPos = { x: 0, y: 0, z: 100 };
    let currentLookAt = { x: 0, y: 0, z: 0 };
    let currentFOV = 75;

    // Camera effects (user-triggered via reactivity mappings)
    let shakeIntensity = 0;
    let shakeTime = 0;
    let zoomPulse = 0;
    let zoomPulseTarget = 0;

    function init(cameraRef) {
        baseCamera = cameraRef;
        if (cameraRef) baseFOV = cameraRef.fov || 75;
    }

    // Evaluate camera track keyframes at time t
    function evaluateTrack(cameraTrack, t) {
        if (!cameraTrack || cameraTrack.length === 0) return null;

        if (typeof KeyframeEngine !== 'undefined') {
            const sorted = [...cameraTrack].sort((a, b) => a.time - b.time);
            const pos = KeyframeEngine.evalTrack(sorted, t, 'vector3', v => v.pos);
            const lookAt = KeyframeEngine.evalTrack(sorted, t, 'vector3', v => v.lookAt || { x: 0, y: 0, z: 0 });
            const fov = KeyframeEngine.evalTrack(sorted, t, 'scalar', v => v.fov);

            if (pos) currentPos = pos;
            if (lookAt) currentLookAt = lookAt;
            if (typeof fov === 'number') currentFOV = fov;

            return { pos: currentPos, lookAt: currentLookAt, fov: currentFOV };
        }
        return null;
    }

    // Apply current state to the THREE.js camera
    function applyToCamera(dt) {
        if (!baseCamera) return;

        // Apply position
        baseCamera.position.set(currentPos.x, currentPos.y, currentPos.z);
        baseCamera.lookAt(currentLookAt.x, currentLookAt.y, currentLookAt.z);

        // Apply shake effect (decays automatically)
        if (shakeIntensity > 0.01) {
            shakeTime += dt * 25;
            const sx = (Math.sin(shakeTime) * 0.6 + Math.sin(shakeTime * 2.3) * 0.4) * shakeIntensity;
            const sy = (Math.sin(shakeTime * 1.7) * 0.6 + Math.sin(shakeTime * 3.1) * 0.4) * shakeIntensity;
            baseCamera.translateX(sx);
            baseCamera.translateY(sy);
            shakeIntensity *= Math.pow(0.85, dt * 60);
        }

        // Apply zoom pulse
        zoomPulse += (zoomPulseTarget - zoomPulse) * 0.15;
        zoomPulseTarget *= 0.92;

        baseCamera.fov = Math.max(10, Math.min(160, currentFOV + zoomPulse));
        baseCamera.updateProjectionMatrix();
    }

    // === Effect triggers (called from reactivity mappings) ===
    function triggerShake(intensity) {
        shakeIntensity = Math.max(shakeIntensity, intensity);
    }

    function triggerZoomPulse(fovDelta) {
        zoomPulseTarget += fovDelta;
    }

    function setPosition(pos) {
        if (pos) {
            currentPos = { x: pos.x || 0, y: pos.y || 0, z: pos.z || 100 };
        }
    }

    function setLookAt(target) {
        if (target) {
            currentLookAt = { x: target.x || 0, y: target.y || 0, z: target.z || 0 };
        }
    }

    function setFOV(fov) {
        if (typeof fov === 'number') currentFOV = fov;
    }

    function reset() {
        currentPos = { x: 0, y: 0, z: 100 };
        currentLookAt = { x: 0, y: 0, z: 0 };
        currentFOV = 75;
        shakeIntensity = 0;
        zoomPulse = 0;
        zoomPulseTarget = 0;
    }

    return {
        init,
        evaluateTrack,
        applyToCamera,
        triggerShake,
        triggerZoomPulse,
        setPosition,
        setLookAt,
        setFOV,
        reset,
        get position() { return { ...currentPos }; },
        get lookAt() { return { ...currentLookAt }; },
        get fov() { return currentFOV; }
    };
})();
