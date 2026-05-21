// ============================================================
// AURA — Camera Engine v4 (Dual Camera Architecture)
//
// This engine owns the SCENE CAMERA (the one the timeline animates).
// The EDITOR CAMERA lives in visuals.js and is driven by mouse/keyboard.
//
// In Follow mode  → renderer uses sceneCamera
// In Orbit/Move   → renderer uses editorCamera (from visuals.js)
//                   + CameraHelper wireframe shows sceneCamera in scene
//
// The engine is the SOLE authority over sceneCamera. Nothing else
// may call sceneCamera.position.set() or .lookAt() directly.
// ============================================================

const CameraEngine = (() => {

    // ── Scene Camera (timeline-driven) ────────────────────
    let sceneCamera = null;
    let cameraHelper = null;
    let _scene = null;

    // Current interpolated state (plain JS objects, not THREE)
    let _pos    = { x: 0, y: 0, z: 100 };
    let _lookAt = { x: 0, y: 0, z: 0 };
    let _fov    = 75;

    // ── Camera FX (additive, non-destructive) ─────────────
    let shakeIntensity = 0;
    let shakeTime      = 0;
    let zoomPulse      = 0;
    let zoomPulseTarget = 0;

    // ──────────────────────────────────────────────────────
    // INIT — creates the scene camera & its helper
    // Call once from VisualEngine.init()
    // ──────────────────────────────────────────────────────
    function init(scene, aspectRatio) {
        _scene = scene;
        sceneCamera = new THREE.PerspectiveCamera(75, aspectRatio || (16 / 9), 0.1, 2000);
        sceneCamera.position.set(_pos.x, _pos.y, _pos.z);
        sceneCamera.lookAt(_lookAt.x, _lookAt.y, _lookAt.z);

        // Wireframe helper — visible when user is in Orbit/Move mode
        if (typeof THREE.CameraHelper !== 'undefined') {
            cameraHelper = new THREE.CameraHelper(sceneCamera);
            cameraHelper.visible = false; // hidden by default until orbit mode
            scene.add(cameraHelper);
        }
    }

    // ──────────────────────────────────────────────────────
    // EVALUATE TRACK — spherical interpolation between keyframes
    // ──────────────────────────────────────────────────────
    function evaluateAtTime(cameraTrack, t) {
        if (!cameraTrack || cameraTrack.length === 0) return;
        if (typeof KeyframeEngine === 'undefined') return;

        const sorted = [...cameraTrack].sort((a, b) => a.time - b.time);

        // Convert every KF pos → spherical coords relative to its lookAt target.
        // This ensures interpolation sweeps arcs around the target instead of
        // cutting through the origin (the "chaos" bug).
        let lastTheta = 0;
        const spherical = sorted.map((kf, i) => {
            const px = kf.val.pos?.x    || 0;
            const py = kf.val.pos?.y    || 0;
            const pz = kf.val.pos?.z    || 0;
            const lx = kf.val.lookAt?.x || 0;
            const ly = kf.val.lookAt?.y || 0;
            const lz = kf.val.lookAt?.z || 0;

            const dx = px - lx, dy = py - ly, dz = pz - lz;
            const r   = Math.max(0.001, Math.sqrt(dx*dx + dy*dy + dz*dz));
            const phi = Math.acos(Math.max(-1, Math.min(1, dy / r)));
            let theta  = Math.atan2(dx, dz);

            // Unwrap theta so the camera sweeps the short way round
            if (i > 0) {
                let d = theta - lastTheta;
                while (d >  Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                theta = lastTheta + d;
            }
            lastTheta = theta;

            return { ...kf, val: { ...kf.val, _r: r, _phi: phi, _theta: theta } };
        });

        // Interpolate each spherical component independently
        const r     = KeyframeEngine.evalTrack(spherical, t, 'scalar',  v => v._r);
        const phi   = KeyframeEngine.evalTrack(spherical, t, 'scalar',  v => v._phi);
        const theta = KeyframeEngine.evalTrack(spherical, t, 'scalar',  v => v._theta);
        const lookAt = KeyframeEngine.evalTrack(spherical, t, 'vector3', v => v.lookAt || { x:0, y:0, z:0 });
        const fov   = KeyframeEngine.evalTrack(spherical, t, 'scalar',  v => v.fov);

        if (lookAt) _lookAt = lookAt;

        if (r !== null && phi !== null && theta !== null) {
            _pos = {
                x: _lookAt.x + r * Math.sin(phi) * Math.sin(theta),
                y: _lookAt.y + r * Math.cos(phi),
                z: _lookAt.z + r * Math.sin(phi) * Math.cos(theta)
            };
        }

        if (typeof fov === 'number' && isFinite(fov)) _fov = fov;

        _applyToSceneCamera();
    }

    // ──────────────────────────────────────────────────────
    // APPLY — writes _pos/_lookAt/_fov + FX to the THREE camera
    // (called internally after evaluateAtTime and after reset)
    // ──────────────────────────────────────────────────────
    function _applyToSceneCamera(dt) {
        if (!sceneCamera) return;

        sceneCamera.position.set(_pos.x, _pos.y, _pos.z);
        sceneCamera.lookAt(_lookAt.x, _lookAt.y, _lookAt.z);

        // Camera shake (additive, decays each frame)
        if (shakeIntensity > 0.001 && dt) {
            shakeTime += dt * 25;
            const sx = (Math.sin(shakeTime) * 0.6 + Math.sin(shakeTime * 2.3) * 0.4) * shakeIntensity;
            const sy = (Math.sin(shakeTime * 1.7) * 0.6 + Math.sin(shakeTime * 3.1) * 0.4) * shakeIntensity;
            sceneCamera.translateX(sx);
            sceneCamera.translateY(sy);
            shakeIntensity *= Math.pow(0.85, dt * 60);
        }

        // Zoom pulse (additive FOV delta, decays)
        if (dt) {
            zoomPulse += (zoomPulseTarget - zoomPulse) * 0.15;
            zoomPulseTarget *= 0.92;
        }

        sceneCamera.fov = Math.max(10, Math.min(160, _fov + zoomPulse));
        sceneCamera.updateProjectionMatrix();

        // Keep helper in sync
        if (cameraHelper) cameraHelper.update();
    }

    // Called every frame from VisualEngine.updateCamera() when in Follow mode
    function tickEffects(dt) {
        _applyToSceneCamera(dt);
    }

    // ──────────────────────────────────────────────────────
    // SNAPSHOT — returns the current scene camera state as plain JS
    // Used for "Snap to View" and inspector display
    // ──────────────────────────────────────────────────────
    function snapshot() {
        return {
            pos:    { x: _pos.x,    y: _pos.y,    z: _pos.z },
            lookAt: { x: _lookAt.x, y: _lookAt.y, z: _lookAt.z },
            fov:    _fov
        };
    }

    // ──────────────────────────────────────────────────────
    // RESIZE — keep aspect ratio in sync
    // ──────────────────────────────────────────────────────
    function resize(w, h) {
        if (!sceneCamera) return;
        sceneCamera.aspect = w / h;
        sceneCamera.updateProjectionMatrix();
    }

    // ──────────────────────────────────────────────────────
    // HELPER VISIBILITY — show when user is NOT in follow mode
    // ──────────────────────────────────────────────────────
    function setHelperVisible(visible) {
        if (cameraHelper) cameraHelper.visible = !!visible;
    }

    // ──────────────────────────────────────────────────────
    // EFFECTS — triggered by reactivity mappings
    // ──────────────────────────────────────────────────────
    function triggerShake(intensity) {
        shakeIntensity = Math.max(shakeIntensity, intensity || 0);
    }

    function triggerZoomPulse(fovDelta) {
        zoomPulseTarget += (fovDelta || 0);
    }

    // ──────────────────────────────────────────────────────
    // RESET — snap scene camera back to default
    // ──────────────────────────────────────────────────────
    function reset() {
        _pos    = { x: 0, y: 0, z: 100 };
        _lookAt = { x: 0, y: 0, z: 0 };
        _fov    = 75;
        shakeIntensity  = 0;
        zoomPulse       = 0;
        zoomPulseTarget = 0;
        _applyToSceneCamera();
    }

    // ──────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────
    return {
        init,
        evaluateAtTime,
        tickEffects,
        snapshot,
        resize,
        setHelperVisible,
        triggerShake,
        triggerZoomPulse,
        reset,
        // Read-only accessors
        get camera()  { return sceneCamera; },
        get pos()     { return { ..._pos }; },
        get lookAt()  { return { ..._lookAt }; },
        get fov()     { return _fov; },
    };
})();
