// ============================================================
// AURA — Visual Engine v4 (Dual Camera Architecture)
//
// EDITOR CAMERA  — lives here, driven by mouse/keyboard (orbit/move)
// SCENE CAMERA   — lives in CameraEngine, driven by timeline keyframes
//
// previewMode === 'follow' → renders with sceneCamera, CameraHelper visible
// previewMode === 'orbit'|'move' → renders with editorCamera, CameraHelper shown
//
// getCameraSnapshot() always captures the EDITOR camera (what you see)
// applyStudioStateAtTime() drives the SCENE camera only
// ============================================================

// ── BEAT-SYNC UTILITIES (used by visual modes) ──────────────
function beatPulse(phase, width = 0.12) {
    if (phase < width) return 1 - (phase / width);
    const trailing = 1 - width;
    if (phase > trailing) return (phase - trailing) / width;
    return 0;
}
function barPulse(barPhase, width = 0.06)    { return beatPulse(barPhase, width); }
function halfTimePulse(barPhase, width = 0.10) { return beatPulse((barPhase * 2) % 1, width); }
function beatSaw(phase)  { return phase; }
function beatSine(phase) { return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2); }

// ── MATERIAL DISPOSAL HELPER ─────────────────────────────────
function disposeMaterial(mat) {
    ['map','normalMap','roughnessMap','metalnessMap','emissiveMap',
     'aoMap','envMap','alphaMap','lightMap'].forEach(slot => {
        if (mat[slot]) mat[slot].dispose();
    });
    mat.dispose();
}

const _tempColor = new THREE.Color();

const VisualEngine = (() => {

    // ── Core THREE objects ────────────────────────────────
    let renderer     = null;
    let scene        = null;
    let editorCamera = null;   // mouse/keyboard driven — for authoring
    let composer     = null;
    let clock        = null;

    // ── Mode registry ─────────────────────────────────────
    const modes = {};
    let activeModeKey    = null;
    let activeMode       = null;
    let modeKeys         = [];
    let modeErrorReported = false;

    // ── Post-processing ───────────────────────────────────
    let renderPass = null;
    let bloomPass  = null;

    // ── Flash overlay ─────────────────────────────────────
    let flashOverlay  = null;
    let flashIntensity = 0;
    let flashEnabled   = true;

    // ── Editor camera orbit state ─────────────────────────
    // These ONLY control the editorCamera. The sceneCamera is
    // controlled exclusively by CameraEngine.
    let editorFOV    = 75;
    let orbitTheta   = 0;
    let orbitPhi     = Math.PI / 2;
    let orbitRadius  = 100;
    let orbitDirty   = false;
    let isDragging   = false;
    let touchDragging = false;
    let lastMouseX   = 0;
    let lastMouseY   = 0;

    // ── Free-move state (WASD) ────────────────────────────
    let freeMoveYaw   = 0;
    let freeMovePitch = 0;
    let keysDown      = new Set();

    // ── Preview mode ──────────────────────────────────────
    let previewMode = 'orbit'; // 'orbit' | 'move' | 'follow'

    // ──────────────────────────────────────────────────────
    // INIT
    // ──────────────────────────────────────────────────────
    function init(canvas) {
        clock = new THREE.Clock();

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        scene.fog = new THREE.FogExp2(0x000000, 0.001);

        // Editor camera — user's viewport camera
        editorCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        editorCamera.position.set(0, 0, 100);
        editorCamera.lookAt(0, 0, 0);

        // Flash overlay — attached to editor camera so it's always visible
        const flashGeo = new THREE.PlaneGeometry(4, 4);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide
        });
        flashOverlay = new THREE.Mesh(flashGeo, flashMat);
        flashOverlay.position.set(0, 0, -0.5);
        flashOverlay.renderOrder = 9999;
        scene.add(editorCamera);
        editorCamera.add(flashOverlay);

        // Scene camera — CameraEngine creates & owns it
        if (typeof CameraEngine !== 'undefined') {
            CameraEngine.init(scene, window.innerWidth / window.innerHeight);
            // Show helper by default (orbit mode is default)
            CameraEngine.setHelperVisible(true);
        }

        // Wire camera mode buttons (moved here from stemManager.js)
        _setupCameraModeButtons();

        initPostProcessing();
        window.addEventListener('resize', onResize);
        setupMouseControls(canvas);
        setupKeyboardControls();
    }

    function _setupCameraModeButtons() {
        const pmBtns = {
            orbit:  document.getElementById('pmt-orbit'),
            move:   document.getElementById('pmt-move'),
            follow: document.getElementById('pmt-follow'),
        };
        const followBadge = document.getElementById('follow-badge');
        Object.entries(pmBtns).forEach(([mode, btn]) => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                Object.values(pmBtns).forEach(b => b?.classList.remove('active'));
                btn.classList.add('active');
                setPreviewMode(mode);
                if (followBadge) followBadge.style.display = mode === 'follow' ? '' : 'none';
            });
        });
    }

    function initPostProcessing() {
        // Use editorCamera by default; swapped in render() for follow mode
        if (typeof RenderGraph !== 'undefined') {
            composer = RenderGraph.init(renderer, scene, editorCamera, window.innerWidth, window.innerHeight);
        } else if (typeof THREE.EffectComposer !== 'undefined') {
            composer = new THREE.EffectComposer(renderer);
            renderPass = new THREE.RenderPass(scene, editorCamera);
            composer.addPass(renderPass);
            if (typeof THREE.UnrealBloomPass !== 'undefined') {
                bloomPass = new THREE.UnrealBloomPass(
                    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.8, 0.1
                );
                composer.addPass(bloomPass);
            }
        }
    }

    function onResize() {
        const aspectTarget = typeof ParamSystem !== 'undefined' ? ParamSystem.get('aspectRatio') : 'Free (Fill Window)';
        let W = window.innerWidth;
        let H = window.innerHeight;

        if (aspectTarget === '16:9 (Landscape)') {
            const a = 16/9;
            if (W/H > a) W = H * a; else H = W / a;
        } else if (aspectTarget === '9:16 (Vertical)') {
            const a = 9/16;
            if (W/H > a) W = H * a; else H = W / a;
        }
        W = Math.floor(W/2)*2;
        H = Math.floor(H/2)*2;

        renderer.domElement.style.width  = W + 'px';
        renderer.domElement.style.height = H + 'px';
        renderer.setSize(W, H, false);

        editorCamera.aspect = W / H;
        editorCamera.updateProjectionMatrix();

        if (typeof CameraEngine !== 'undefined') CameraEngine.resize(W, H);
        if (typeof RenderGraph !== 'undefined') RenderGraph.resize(W, H);
        else if (composer) composer.setSize(W, H);
    }

    // ──────────────────────────────────────────────────────
    // MODE MANAGEMENT
    // ──────────────────────────────────────────────────────
    function registerMode(key, modeObj) { modes[key] = modeObj; modeKeys.push(key); }
    function getModeKeys()              { return [...modeKeys]; }
    function getModeName(key)           { return modes[key]?.name || key; }

    function setMode(key) {
        if (!modes[key]) { console.warn(`Mode "${key}" not found`); return; }
        const previousKey = activeModeKey;

        if (activeMode && activeMode.destroy) activeMode.destroy(scene);

        // Clear scene but protect cameras
        const toRemove = scene.children.filter(obj => obj !== editorCamera && obj !== CameraEngine?.camera);
        for (const obj of toRemove) {
            obj.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(disposeMaterial);
                    else disposeMaterial(child.material);
                }
            });
            scene.remove(obj);
        }
        // Re-add cameraHelper after scene clear (it gets removed with the scene)
        if (typeof CameraEngine !== 'undefined' && CameraEngine.camera) {
            // CameraHelper is added in CameraEngine.init - re-add if removed
        }

        activeModeKey = key;
        activeMode = modes[key];
        modeErrorReported = false;
        ParamSystem.setModeSchema(activeMode.params || {});

        // Reset editor camera to default
        orbitRadius = 100; orbitTheta = 0; orbitPhi = Math.PI / 2; orbitDirty = true;
        editorFOV   = 75;
        applyEditorOrbit();

        try {
            if (activeMode.init) activeMode.init(scene, editorCamera, renderer);
        } catch (err) {
            console.error(`Mode "${key}" failed to init:`, err);
        }

        // Sync editor orbit to wherever the mode placed the camera
        orbitRadius = editorCamera.position.length() || 100;
        editorFOV   = editorCamera.fov || 75;

        if (typeof AuraEvents !== 'undefined' && previousKey !== activeModeKey) {
            const eventTime = AudioEngine?.audioBus?.currentTime || 0;
            AuraEvents.emitModeChange(previousKey || '', activeModeKey || '', eventTime);
        }
    }

    function nextMode() { const i = modeKeys.indexOf(activeModeKey); setMode(modeKeys[(i+1) % modeKeys.length]); return activeModeKey; }
    function prevMode() { const i = modeKeys.indexOf(activeModeKey); setMode(modeKeys[(i-1+modeKeys.length) % modeKeys.length]); return activeModeKey; }

    // ──────────────────────────────────────────────────────
    // EDITOR CAMERA — MOUSE ORBIT & ZOOM
    // ──────────────────────────────────────────────────────
    function setupMouseControls(canvas) {
        canvas.addEventListener('wheel', (e) => {
            if (previewMode !== 'orbit') return;
            e.preventDefault();
            orbitRadius *= (1 + Math.sign(e.deltaY) * 0.08);
            orbitRadius = Math.max(10, Math.min(2000, orbitRadius));
            orbitDirty = true;
        }, { passive: false });

        canvas.addEventListener('mousedown', (e) => {
            if (previewMode === 'follow') return;
            if (e.button === 0 && e.target === canvas) {
                isDragging = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            if (previewMode === 'orbit') {
                orbitTheta -= dx * 0.005;
                orbitPhi   -= dy * 0.005;
                orbitPhi = Math.max(0.087, Math.min(Math.PI - 0.087, orbitPhi));
                orbitDirty = true;
            } else if (previewMode === 'move') {
                freeMoveYaw   -= dx * 0.003;
                freeMovePitch -= dy * 0.003;
                freeMovePitch = Math.max(-1.5, Math.min(1.5, freeMovePitch));
            }
        });

        window.addEventListener('mouseup', (e) => { if (e.button === 0) isDragging = false; });

        // Touch
        let lastTouchX = 0, lastTouchY = 0, pinchStartDist = 0;
        canvas.addEventListener('touchstart', (e) => {
            if (previewMode === 'follow') return;
            if (e.touches.length === 1) { touchDragging = true; lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
            else if (e.touches.length === 2) {
                touchDragging = false;
                const ddx = e.touches[0].clientX - e.touches[1].clientX;
                const ddy = e.touches[0].clientY - e.touches[1].clientY;
                pinchStartDist = Math.sqrt(ddx*ddx + ddy*ddy);
            }
        }, { passive: true });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && touchDragging) {
                const ddx = e.touches[0].clientX - lastTouchX;
                const ddy = e.touches[0].clientY - lastTouchY;
                lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
                orbitTheta -= ddx * 0.005; orbitPhi -= ddy * 0.005;
                orbitPhi = Math.max(0.087, Math.min(Math.PI - 0.087, orbitPhi)); orbitDirty = true;
            } else if (e.touches.length === 2) {
                const ddx = e.touches[0].clientX - e.touches[1].clientX;
                const ddy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(ddx*ddx + ddy*ddy);
                if (pinchStartDist > 0) { orbitRadius *= pinchStartDist / dist; orbitRadius = Math.max(10, Math.min(2000, orbitRadius)); orbitDirty = true; }
                pinchStartDist = dist;
            }
        }, { passive: false });
        canvas.addEventListener('touchend', () => { touchDragging = false; pinchStartDist = 0; }, { passive: true });
    }

    // ── WASD Free-Move ────────────────────────────────────
    function setupKeyboardControls() {
        window.addEventListener('keydown', e => keysDown.add(e.code));
        window.addEventListener('keyup',   e => keysDown.delete(e.code));
    }

    function updateFreeMove(dt) {
        const speed = 80 * dt;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(editorCamera.quaternion);
        const right   = new THREE.Vector3(1, 0,  0).applyQuaternion(editorCamera.quaternion);

        if (keysDown.has('KeyW')) editorCamera.position.addScaledVector(forward,  speed);
        if (keysDown.has('KeyS')) editorCamera.position.addScaledVector(forward, -speed);
        if (keysDown.has('KeyA')) editorCamera.position.addScaledVector(right,   -speed);
        if (keysDown.has('KeyD')) editorCamera.position.addScaledVector(right,    speed);
        if (keysDown.has('KeyQ') || keysDown.has('ControlLeft')  || keysDown.has('ControlRight'))  editorCamera.position.y -= speed;
        if (keysDown.has('KeyE') || keysDown.has('ShiftLeft')    || keysDown.has('ShiftRight'))    editorCamera.position.y += speed;

        editorCamera.rotation.order = 'YXZ';
        editorCamera.rotation.y = freeMoveYaw;
        editorCamera.rotation.x = freeMovePitch;
    }

    function applyEditorOrbit() {
        if (!orbitDirty) return;
        editorCamera.position.set(
            orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta),
            orbitRadius * Math.cos(orbitPhi),
            orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)
        );
        editorCamera.lookAt(0, 0, 0);
        editorCamera.fov = editorFOV;
        editorCamera.updateProjectionMatrix();
        orbitDirty = false;
    }

    // ──────────────────────────────────────────────────────
    // PREVIEW MODE SWITCHING
    // ──────────────────────────────────────────────────────
    function setPreviewMode(mode) {
        if (!['orbit', 'move', 'follow'].includes(mode)) return;
        previewMode = mode;

        if (mode === 'move') {
            freeMoveYaw   = orbitTheta;
            freeMovePitch = 0;
        }

        // Show CameraHelper only when user is NOT in follow mode
        if (typeof CameraEngine !== 'undefined') {
            CameraEngine.setHelperVisible(mode !== 'follow');
        }

        // Swap which camera the composer/renderPass uses
        _updateComposerCamera();
    }

    function _updateComposerCamera() {
        const cam = previewMode === 'follow' && typeof CameraEngine !== 'undefined'
            ? CameraEngine.camera
            : editorCamera;
        if (renderPass) renderPass.camera = cam;
        if (typeof RenderGraph !== 'undefined' && RenderGraph.setCamera) RenderGraph.setCamera(cam);
    }

    // ──────────────────────────────────────────────────────
    // CAMERA UPDATE (called every frame)
    // ──────────────────────────────────────────────────────
    function updateCamera(dt, audioBus) {
        if (previewMode === 'follow') {
            // Drive scene camera from timeline
            if (typeof CameraEngine !== 'undefined' && typeof ProjectStore !== 'undefined') {
                const track = ProjectStore.getState().timeline?.cameraTrack || [];
                if (track.length > 0) {
                    CameraEngine.evaluateAtTime(track, audioBus.currentTime || 0);
                }
                // Tick FX (shake, zoom pulse decay) every frame
                CameraEngine.tickEffects(dt);
            }
        } else if (previewMode === 'move') {
            updateFreeMove(dt);
        } else {
            // Orbit mode — recompute editor camera from spherical
            applyEditorOrbit();
        }
    }

    // ──────────────────────────────────────────────────────
    // SNAPSHOT — what the EDITOR camera currently sees
    // Always captures editorCamera, regardless of preview mode.
    // This is what gets stored into a camera keyframe.
    // ──────────────────────────────────────────────────────
    function getCameraSnapshot() {
        if (!editorCamera) return { pos: { x:0, y:0, z:100 }, lookAt: { x:0, y:0, z:0 }, fov: 75 };

        const pos = editorCamera.position;

        // In orbit mode the camera always looks at origin
        const lookAt = previewMode === 'orbit'
            ? { x: 0, y: 0, z: 0 }
            : (() => {
                const dir = new THREE.Vector3();
                editorCamera.getWorldDirection(dir);
                const lk = editorCamera.position.clone().add(dir.multiplyScalar(100));
                return { x: lk.x, y: lk.y, z: lk.z };
              })();

        return {
            pos:    { x: pos.x, y: pos.y, z: pos.z },
            lookAt,
            fov:    editorCamera.fov || editorFOV || 75
        };
    }

    // ──────────────────────────────────────────────────────
    // APPLY STUDIO STATE AT TIME
    // Evaluates the timeline at time t and drives sceneCamera.
    // Also applies visual params for scrubbing in Follow mode.
    // ──────────────────────────────────────────────────────
    function applyStudioStateAtTime(t) {
        if (typeof ProjectStore === 'undefined' || typeof GraphEvaluator === 'undefined') return;
        const project = ProjectStore.getState();

        // Drive camera track
        const cameraTrack = project.timeline?.cameraTrack || [];
        if (typeof CameraEngine !== 'undefined' && cameraTrack.length > 0) {
            CameraEngine.evaluateAtTime(cameraTrack, t || 0);
        }

        // Drive visual state (params, mode, etc.)
        const res = GraphEvaluator.evalAtTime(project, t || 0);
        if (res?.blended) applyBlendedState(res.blended);
    }

    // ──────────────────────────────────────────────────────
    // APPLY BLENDED STATE (visual params, mode, mappings)
    // Camera portion now routes only to CameraEngine.
    // ──────────────────────────────────────────────────────
    function applyBlendedState(blended) {
        if (!blended) return;
        const a = blended.a;
        const b = blended.b;
        let t = blended.t;
        if (blended.type === 'cut') t = t < 0.5 ? 0 : 1;

        // Visual mode switching
        const modeA = a?.visual?.modeKey || null;
        const modeB = b?.visual?.modeKey || null;
        const desiredMode = (modeA && modeB && modeA !== modeB && t < 0.5) ? modeA : modeB;
        if (desiredMode && desiredMode !== activeModeKey) setMode(desiredMode);

        // Blend global params
        const ag = a?.visual?.globalParams, bg = b?.visual?.globalParams;
        if (ag && bg)     { const mix = _deepBlend(ag, bg, t); for (const [k,v] of Object.entries(mix)) ParamSystem.set(k,v); }
        else if (bg)      { for (const [k,v] of Object.entries(bg)) ParamSystem.set(k,v); }

        // Blend mode params
        const am = a?.visual?.modeParams, bm = b?.visual?.modeParams;
        if (am && bm)     { const mix = _deepBlend(am, bm, t); for (const [k,v] of Object.entries(mix)) ParamSystem.set(k,v); }
        else if (bm)      { for (const [k,v] of Object.entries(bm)) ParamSystem.set(k,v); }

        // Mappings
        const mappings = b?.visual?.mappings;
        if (ParamSystem.setMapping) {
            const current = ParamSystem.getMappings ? ParamSystem.getMappings() : {};
            for (const key of Object.keys(current)) ParamSystem.setMapping(key, null, 0, current[key]?.type);
            if (mappings && typeof mappings === 'object') {
                for (const [k, m] of Object.entries(mappings)) { if (m) ParamSystem.setMapping(k, m.band, m.amount, m.type); }
            }
        }

        // Camera — only drive the scene camera (CameraEngine), never editorCamera
        // Note: the visual node stores a camera snapshot; we use it here only
        // when there is NO dedicated cameraTrack (backward compat with node.camera)
        const project = typeof ProjectStore !== 'undefined' ? ProjectStore.getState() : null;
        const hasCameraTrack = (project?.timeline?.cameraTrack?.length || 0) > 0;

        if (!hasCameraTrack && b?.camera && typeof CameraEngine !== 'undefined') {
            // Drive scene camera from node camera snapshot if no dedicated track
            const snap = b.camera;
            if (a?.camera) {
                const blendedSnap = _deepBlend(a.camera, snap, t);
                CameraEngine.evaluateAtTime([
                    { time: 0, val: blendedSnap, easing: 'linear' }
                ], 0);
            } else {
                CameraEngine.evaluateAtTime([{ time: 0, val: snap, easing: 'linear' }], 0);
            }
        }
    }

    // Internal blend helper (replaces GraphModel.deepBlend dependency)
    function _deepBlend(a, b, t) {
        const result = {};
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) {
            if (!(k in a)) { result[k] = b[k]; continue; }
            if (!(k in b)) { result[k] = a[k]; continue; }
            const av = a[k], bv = b[k];
            if (typeof av === 'number' && typeof bv === 'number') {
                result[k] = av + (bv - av) * t;
            } else if (av && bv && typeof av === 'object' && typeof bv === 'object' && !Array.isArray(av)) {
                result[k] = _deepBlend(av, bv, t);
            } else {
                result[k] = t < 0.5 ? av : bv;
            }
        }
        return result;
    }

    // ──────────────────────────────────────────────────────
    // APPLY NODE SNAPSHOT (left sidebar "Apply" button)
    // Snaps visual params AND the editor camera to the stored state.
    // Does NOT touch the scene camera.
    // ──────────────────────────────────────────────────────
    function applyNodeSnapshot(node) {
        if (!node) return;
        applyBlendedState({ a: null, b: node, t: 1, easing: 'linear', type: 'transform' });

        // Also snap the editor camera so "Snap to View" works correctly
        if (node.camera && editorCamera) {
            const { pos, fov } = node.camera;
            if (pos) editorCamera.position.set(pos.x || 0, pos.y || 0, pos.z ?? 100);
            editorCamera.lookAt(
                node.camera.lookAt?.x || 0,
                node.camera.lookAt?.y || 0,
                node.camera.lookAt?.z || 0
            );
            editorCamera.fov = typeof fov === 'number' ? fov : editorFOV;
            editorCamera.updateProjectionMatrix();

            // Sync orbit state so dragging feels right after snap
            const p = editorCamera.position;
            orbitRadius = p.length() || 100;
            orbitPhi    = Math.acos(Math.max(-1, Math.min(1, p.y / orbitRadius)));
            orbitTheta  = Math.atan2(p.x, p.z);
            editorFOV   = editorCamera.fov;
            orbitDirty  = false;
        }
    }

    // ──────────────────────────────────────────────────────
    // EFFECTS (audio-reactive, editor camera only)
    // ──────────────────────────────────────────────────────
    function updateEffects(audio, params, dt) {
        if (!audio.isPlaying) return;

        const shakeAmount = params.screenShake ?? 0;
        const flashAmount = params.beatFlash   ?? 0;
        const zoomPunch   = params.zoomPunch   ?? 0;

        if (shakeAmount > 0 && audio.bassBeat && typeof CameraEngine !== 'undefined') {
            CameraEngine.triggerShake(audio.bassBeatIntensity * shakeAmount * 2.0);
        }
        if (zoomPunch > 0 && audio.bassBeat && typeof CameraEngine !== 'undefined') {
            CameraEngine.triggerZoomPulse(-audio.bassBeatIntensity * zoomPunch * 5);
        }
        if (flashEnabled && flashAmount > 0 && audio.bassBeat) {
            flashIntensity = Math.max(flashIntensity, audio.bassBeatIntensity * flashAmount * 0.5);
        }

        flashIntensity *= 0.8;
        if (flashOverlay) {
            flashOverlay.visible = flashEnabled;
            flashOverlay.material.opacity = flashEnabled ? Math.min(0.7, flashIntensity) : 0;
            if (flashEnabled && flashIntensity > 0.05) {
                const c = ParamSystem.getColorThree(audio.rms + (clock?.elapsedTime || 0) * 0.2);
                flashOverlay.material.color.lerp(c, 0.3);
            }
        }

        renderer.toneMappingExposure += (1.0 - renderer.toneMappingExposure) * 0.1;

        if (scene.fog) {
            const distanceScale = 100 / Math.max(1, orbitRadius);
            scene.fog.density += (0.001 * distanceScale - scene.fog.density) * 0.05;
        }
    }

    // ──────────────────────────────────────────────────────
    // MAIN UPDATE LOOP
    // ──────────────────────────────────────────────────────
    function update() {
        const dt       = Math.min(clock.getDelta(), 0.05);
        const audioBus = AudioEngine.audioBus;
        const dt_visual = audioBus.isPlaying ? dt : 0;

        // Timeline-driven visual state (params) — follow mode, playing
        if (previewMode === 'follow' &&
            typeof ProjectStore !== 'undefined' &&
            typeof GraphEvaluator !== 'undefined' &&
            audioBus?.loaded && audioBus.isPlaying) {
            try {
                const res = GraphEvaluator.evalAtTime(ProjectStore.getState(), audioBus.currentTime || 0);
                if (res?.blended?.b) applyBlendedState(res.blended);
            } catch (e) { /* keep rendering */ }
        }

        // Background
        const bgColor = ParamSystem.get('backgroundColor') || '#000000';
        scene.background.set(bgColor);

        // Camera update
        updateCamera(dt, audioBus);

        // Effects
        updateEffects(audioBus, { ...ParamSystem.getAllGlobal(), ...ParamSystem.getAllMode() }, dt);

        // Mode update
        if (activeMode && activeMode.update) {
            try {
                const baseParams = { ...ParamSystem.getAllGlobal(), ...ParamSystem.getAllMode() };
                if (audioBus.isPlaying) {
                    const mappings = ParamSystem.getMappings();
                    for (const key in mappings) {
                        const map = mappings[key];
                        let audioVal = 0;
                        if      (map.band === 'onset')     audioVal = audioBus.onsetStrength;
                        else if (map.band === 'envelope')  audioVal = audioBus.envelope;
                        else if (map.band === 'rms')       audioVal = audioBus.rms;
                        else if (map.band === 'beatPhase') audioVal = audioBus.beatPhase;
                        else    audioVal = audioBus.smoothBands[map.band] || audioBus.rawBands[map.band] || 0;

                        const stemMap = { sub:'stemReactivity_drums', bass:'stemReactivity_bass', lowMid:'stemReactivity_mids', mid:'stemReactivity_mids', highMid:'stemReactivity_highs', treble:'stemReactivity_highs', brilliance:'stemReactivity_highs' };
                        if (stemMap[map.band]) audioVal *= (ParamSystem.get(stemMap[map.band]) || 1.0);

                        if (baseParams[key] !== undefined && typeof baseParams[key] === 'number') {
                            baseParams[key] += audioVal * map.amount;
                        }
                    }
                }
                activeMode.update(audioBus, baseParams, dt_visual);
                modeErrorReported = false;
            } catch (err) {
                if (!modeErrorReported) { console.warn(`Mode "${activeModeKey}" error:`, err.message); modeErrorReported = true; }
            }
        }

        // Render — pick which camera to render with
        const renderCam = previewMode === 'follow' && typeof CameraEngine !== 'undefined' && CameraEngine.camera
            ? CameraEngine.camera
            : editorCamera;

        try {
            if (typeof RenderGraph !== 'undefined' && RenderGraph.composer && ParamSystem.get('postProcessing')) {
                if (RenderGraph.setCamera) RenderGraph.setCamera(renderCam);
                RenderGraph.update(dt, audioBus);
                RenderGraph.render(dt);
            } else if (composer && ParamSystem.get('postProcessing')) {
                if (renderPass) renderPass.camera = renderCam;
                composer.render();
            } else {
                renderer.setRenderTarget(null);
                renderer.render(scene, renderCam);
            }
        } catch (err) {
            console.warn('Render error:', err);
            ParamSystem.set('postProcessing', false);
            renderer.setRenderTarget(null);
            renderer.render(scene, renderCam);
        }
    }

    // ──────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────
    return {
        init, registerMode, getModeKeys, getModeName, setMode, nextMode, prevMode, update,
        setPreviewMode,
        getCameraSnapshot,
        applyStudioStateAtTime,
        applyNodeSnapshot,
        toggleFlash() { flashEnabled = !flashEnabled; return flashEnabled; },
        get flashEnabled()  { return flashEnabled; },
        get activeModeKey() { return activeModeKey; },
        get activeMode()    { return activeMode; },
        get scene()         { return scene; },
        get camera()        { return editorCamera; },   // backward-compat alias
        get renderer()      { return renderer; },
        get previewMode()   { return previewMode; },
        // Beat-sync utilities (used by visual modes via VisualEngine.*)
        beatPulse, barPulse, halfTimePulse, beatSaw, beatSine,
    };
})();
