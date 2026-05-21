// ============================================================
// AURA — Visual Engine v3
// Clean: no predictions, no autonomous camera, 100% music-synced.
// Camera is keyframe-driven. Visuals freeze when audio paused.
// ============================================================

// ── BEAT-SYNC UTILITIES ────────────────────────────────────
function beatPulse(phase, width = 0.12) {
    if (phase < width) return 1 - (phase / width);
    const trailing = 1 - width;
    if (phase > trailing) return (phase - trailing) / width;
    return 0;
}
function barPulse(barPhase, width = 0.06) { return beatPulse(barPhase, width); }
function halfTimePulse(barPhase, width = 0.10) { return beatPulse((barPhase * 2) % 1, width); }
function beatSaw(phase) { return phase; }
function beatSine(phase) { return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2); }

// ── MATERIAL DISPOSAL HELPER ──
function disposeMaterial(mat) {
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
        'aoMap', 'envMap', 'alphaMap', 'lightMap'].forEach(slot => {
            if (mat[slot]) mat[slot].dispose();
        });
    mat.dispose();
}

const _tempColor = new THREE.Color();

const VisualEngine = (() => {
    let renderer = null;
    let scene = null;
    let camera = null;
    let composer = null;
    let clock = null;

    // Mode registry
    const modes = {};
    let activeModeKey = null;
    let activeMode = null;
    let modeKeys = [];
    let modeErrorReported = false;

    // Post-processing
    let renderPass = null;
    let bloomPass = null;

    // Flash overlay
    let flashOverlay = null;
    let flashIntensity = 0;
    let flashEnabled = true;
    let baseFOV = 75;

    // Mouse orbit & zoom state
    let orbitTheta = 0;
    let orbitPhi = Math.PI / 2;
    let orbitRadius = 100;
    let isDragging = false;
    let touchDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let orbitDirty = false;

    // Preview mode: 'orbit' | 'move' | 'follow'
    let previewMode = 'orbit';

    // Free-move camera state (WASD)
    let freeMoveVelocity = { x: 0, y: 0, z: 0 };
    let freeMoveYaw = 0;
    let freeMovePitch = 0;
    let keysDown = new Set();

    // Camera position for non-follow modes
    let baseCameraPos = new THREE.Vector3(0, 0, 100);

    // Timeline-driven state
    let _lastAppliedEventId = null;

    function init(canvas) {
        clock = new THREE.Clock();

        renderer = new THREE.WebGLRenderer({
            canvas, antialias: true, alpha: false, preserveDrawingBuffer: true
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        scene.fog = new THREE.FogExp2(0x000000, 0.001);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);

        // Flash overlay (in-scene for recording capture)
        const flashGeo = new THREE.PlaneGeometry(4, 4);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, side: THREE.DoubleSide
        });
        flashOverlay = new THREE.Mesh(flashGeo, flashMat);
        flashOverlay.position.set(0, 0, -0.5);
        flashOverlay.renderOrder = 9999;
        scene.add(camera);
        camera.add(flashOverlay);

        if (typeof CameraEngine !== 'undefined') CameraEngine.init(camera);

        initPostProcessing();
        window.addEventListener('resize', onResize);
        setupMouseControls(canvas);
        setupKeyboardControls();
    }

    function initPostProcessing() {
        if (typeof RenderGraph !== 'undefined') {
            composer = RenderGraph.init(renderer, scene, camera, window.innerWidth, window.innerHeight);
        } else if (typeof THREE.EffectComposer !== 'undefined') {
            composer = new THREE.EffectComposer(renderer);
            renderPass = new THREE.RenderPass(scene, camera);
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
        let targetW = window.innerWidth;
        let targetH = window.innerHeight;

        if (aspectTarget === '16:9 (Landscape)') {
            const aspect = 16 / 9;
            if (targetW / targetH > aspect) targetW = targetH * aspect;
            else targetH = targetW / aspect;
        } else if (aspectTarget === '9:16 (Vertical)') {
            const aspect = 9 / 16;
            if (targetW / targetH > aspect) targetW = targetH * aspect;
            else targetH = targetW / aspect;
        }

        targetW = Math.floor(targetW / 2) * 2;
        targetH = Math.floor(targetH / 2) * 2;

        renderer.domElement.style.width = targetW + 'px';
        renderer.domElement.style.height = targetH + 'px';
        camera.aspect = targetW / targetH;
        camera.updateProjectionMatrix();
        renderer.setSize(targetW, targetH, false);
        if (typeof RenderGraph !== 'undefined') RenderGraph.resize(targetW, targetH);
        else if (composer) composer.setSize(targetW, targetH);
    }

    function registerMode(key, modeObj) { modes[key] = modeObj; modeKeys.push(key); }
    function getModeKeys() { return [...modeKeys]; }
    function getModeName(key) { return modes[key]?.name || key; }

    function setMode(key) {
        if (!modes[key]) { console.warn(`Mode "${key}" not found`); return; }
        const previousKey = activeModeKey;

        if (activeMode && activeMode.destroy) activeMode.destroy(scene);

        // Clear scene but protect camera
        const toRemove = scene.children.filter(obj => obj !== camera);
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

        activeModeKey = key;
        activeMode = modes[key];
        modeErrorReported = false;
        ParamSystem.setModeSchema(activeMode.params || {});

        baseCameraPos.set(0, 0, 100);
        camera.position.copy(baseCameraPos);
        camera.lookAt(0, 0, 0);
        baseFOV = 75;
        orbitDirty = false;
        orbitRadius = 100;
        orbitTheta = 0;
        orbitPhi = Math.PI / 2;

        try {
            if (activeMode.init) activeMode.init(scene, camera, renderer);
        } catch (err) {
            console.error(`Mode "${key}" failed to init:`, err);
        }

        baseCameraPos.copy(camera.position);
        baseFOV = camera.fov;
        orbitRadius = baseCameraPos.length() || 100;

        if (typeof AuraEvents !== 'undefined' && previousKey !== activeModeKey) {
            const eventTime = AudioEngine?.audioBus?.currentTime || 0;
            AuraEvents.emitModeChange(previousKey || '', activeModeKey || '', eventTime);
        }
    }

    function nextMode() { const idx = modeKeys.indexOf(activeModeKey); setMode(modeKeys[(idx + 1) % modeKeys.length]); return activeModeKey; }
    function prevMode() { const idx = modeKeys.indexOf(activeModeKey); setMode(modeKeys[(idx - 1 + modeKeys.length) % modeKeys.length]); return activeModeKey; }

    // ── MOUSE ORBIT & ZOOM ─────────────────────────────────
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
                const sensitivity = 0.005;
                orbitTheta -= dx * sensitivity;
                orbitPhi -= dy * sensitivity;
                orbitPhi = Math.max(0.087, Math.min(Math.PI - 0.087, orbitPhi));
                orbitDirty = true;
            } else if (previewMode === 'move') {
                freeMoveYaw -= dx * 0.003;
                freeMovePitch -= dy * 0.003;
                freeMovePitch = Math.max(-1.5, Math.min(1.5, freeMovePitch));
            }
        });

        window.addEventListener('mouseup', (e) => { if (e.button === 0) isDragging = false; });

        // Touch support
        let lastTouchX = 0, lastTouchY = 0, pinchStartDist = 0;
        canvas.addEventListener('touchstart', (e) => {
            if (previewMode === 'follow') return;
            if (e.touches.length === 1) { touchDragging = true; lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
            else if (e.touches.length === 2) { touchDragging = false; const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; pinchStartDist = Math.sqrt(dx*dx+dy*dy); }
        }, { passive: true });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && touchDragging) {
                const dx = e.touches[0].clientX - lastTouchX; const dy = e.touches[0].clientY - lastTouchY;
                lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
                orbitTheta -= dx * 0.005; orbitPhi -= dy * 0.005;
                orbitPhi = Math.max(0.087, Math.min(Math.PI - 0.087, orbitPhi)); orbitDirty = true;
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx*dx+dy*dy);
                if (pinchStartDist > 0) { orbitRadius *= pinchStartDist / dist; orbitRadius = Math.max(10, Math.min(2000, orbitRadius)); orbitDirty = true; }
                pinchStartDist = dist;
            }
        }, { passive: false });
        canvas.addEventListener('touchend', () => { touchDragging = false; pinchStartDist = 0; }, { passive: true });
    }

    // ── WASD FREE-MOVE CONTROLS ────────────────────────────
    function setupKeyboardControls() {
        window.addEventListener('keydown', (e) => { keysDown.add(e.code); });
        window.addEventListener('keyup', (e) => { keysDown.delete(e.code); });
    }

    function updateFreeMove(dt) {
        if (previewMode !== 'move') return;
        const speed = 80 * dt;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

        if (keysDown.has('KeyW')) camera.position.addScaledVector(forward, speed);
        if (keysDown.has('KeyS')) camera.position.addScaledVector(forward, -speed);
        if (keysDown.has('KeyA')) camera.position.addScaledVector(right, -speed);
        if (keysDown.has('KeyD')) camera.position.addScaledVector(right, speed);
        if (keysDown.has('KeyQ') || keysDown.has('ControlLeft') || keysDown.has('ControlRight')) camera.position.y -= speed;
        if (keysDown.has('KeyE') || keysDown.has('ShiftLeft') || keysDown.has('ShiftRight')) camera.position.y += speed;

        camera.rotation.order = 'YXZ';
        camera.rotation.y = freeMoveYaw;
        camera.rotation.x = freeMovePitch;
    }

    function applyOrbit() {
        if (!orbitDirty) return;
        baseCameraPos.x = orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
        baseCameraPos.y = orbitRadius * Math.cos(orbitPhi);
        baseCameraPos.z = orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
        orbitDirty = false;
    }

    function getOrbitState() {
        return { orbitTheta, orbitPhi, orbitRadius, fov: camera ? camera.fov : baseFOV };
    }

    function setOrbitState(state) {
        if (!state) return;
        if (isDragging || touchDragging) return;
        if (typeof state.orbitTheta === 'number') orbitTheta = state.orbitTheta;
        if (typeof state.orbitPhi === 'number') orbitPhi = state.orbitPhi;
        if (typeof state.orbitRadius === 'number') orbitRadius = Math.max(10, Math.min(2000, state.orbitRadius));
        if (typeof state.fov === 'number' && camera) { baseFOV = state.fov; camera.fov = state.fov; camera.updateProjectionMatrix(); }
        orbitDirty = true;
        applyOrbit();
    }

    function setPreviewMode(mode) {
        if (['orbit', 'move', 'follow'].includes(mode)) {
            previewMode = mode;
            if (mode === 'move') {
                freeMoveYaw = orbitTheta;
                freeMovePitch = 0;
            }
        }
    }

    function getCameraLookAt(distance = 100) {
        if (!camera) return { x: 0, y: 0, z: 0 };
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const lookAt = camera.position.clone().add(dir.multiplyScalar(distance));
        return { x: lookAt.x, y: lookAt.y, z: lookAt.z };
    }

    function getCameraSnapshot() {
        if (!camera) {
            return {
                pos: { x: 0, y: 0, z: 100 },
                lookAt: { x: 0, y: 0, z: 0 },
                fov: 75
            };
        }

        return {
            pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
            lookAt: getCameraLookAt(),
            fov: camera.fov || baseFOV || 75
        };
    }

    function applyAbsoluteCameraState(state) {
        if (!state) return;

        const pos = state.pos || { x: 0, y: 0, z: 100 };
        const lookAt = state.lookAt || { x: 0, y: 0, z: 0 };
        const fov = typeof state.fov === 'number' ? state.fov : (camera?.fov || baseFOV || 75);

        baseCameraPos.set(pos.x || 0, pos.y || 0, pos.z || 100);
        baseFOV = fov;

        const radius = Math.max(0.0001, baseCameraPos.length());
        orbitRadius = radius;
        orbitPhi = Math.acos(Math.max(-1, Math.min(1, baseCameraPos.y / radius)));
        orbitTheta = Math.atan2(baseCameraPos.x, baseCameraPos.z);

        if (typeof CameraEngine !== 'undefined') {
            CameraEngine.setPosition(pos);
            CameraEngine.setLookAt(lookAt);
            CameraEngine.setFOV(fov);
        }

        if (camera) {
            camera.position.set(pos.x || 0, pos.y || 0, pos.z || 100);
            camera.lookAt(lookAt.x || 0, lookAt.y || 0, lookAt.z || 0);
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }
    }

    function applyCameraState(state) {
        if (!state) return;
        if (state.pos || state.lookAt) {
            applyAbsoluteCameraState(state);
            return;
        }
        if (state.orbitRadius !== undefined || state.orbitTheta !== undefined || state.orbitPhi !== undefined) {
            setOrbitState(state);
        }
    }

    function applyNodeSnapshot(node) {
        if (!node) return;
        applyBlendedState({ a: null, b: node, t: 1, easing: 'linear', type: 'transform' });
    }

    // ── EFFECTS (user-controlled only) ──────────────────────
    function updateEffects(audio, params, dt) {
        // Only react to audio when playing
        if (!audio.isPlaying) return;

        const shakeAmount = params.screenShake ?? 0;
        const flashAmount = params.beatFlash ?? 0;
        const zoomPunch = params.zoomPunch ?? 0;

        // Camera shake (driven by user's screenShake param + bass beats)
        if (shakeAmount > 0 && audio.bassBeat && typeof CameraEngine !== 'undefined') {
            CameraEngine.triggerShake(audio.bassBeatIntensity * shakeAmount * 2.0);
        }

        // Zoom punch on bass beat
        if (zoomPunch > 0 && audio.bassBeat && typeof CameraEngine !== 'undefined') {
            CameraEngine.triggerZoomPulse(-audio.bassBeatIntensity * zoomPunch * 5);
        }

        // Beat flash
        if (flashEnabled && flashAmount > 0 && audio.bassBeat) {
            flashIntensity = Math.max(flashIntensity, audio.bassBeatIntensity * flashAmount * 0.5);
        }

        // Decay flash
        flashIntensity *= 0.8;
        if (flashOverlay) {
            flashOverlay.visible = flashEnabled;
            flashOverlay.material.opacity = flashEnabled ? Math.min(0.7, flashIntensity) : 0;
            if (flashEnabled && flashIntensity > 0.05) {
                const c = ParamSystem.getColorThree(audio.rms + (clock?.elapsedTime || 0) * 0.2);
                flashOverlay.material.color.lerp(c, 0.3);
            }
        }

        // Exposure
        renderer.toneMappingExposure += (1.0 - renderer.toneMappingExposure) * 0.1;

        // Fog density scales with distance
        if (scene.fog) {
            const distanceScale = 100 / Math.max(1, orbitRadius);
            scene.fog.density += (0.001 * distanceScale - scene.fog.density) * 0.05;
        }
    }

    // ── CAMERA UPDATE (based on preview mode) ──────────────
    function updateCamera(dt, audioBus) {
        if (previewMode === 'follow') {
            // Timeline-driven camera
            if (typeof ProjectStore !== 'undefined' && typeof CameraEngine !== 'undefined') {
                const project = ProjectStore.getState();
                const cameraTrack = project.timeline?.cameraTrack || project.timeline?.cameraEvents || [];
                if (cameraTrack.length > 0) {
                    const t = audioBus.currentTime || 0;
                    CameraEngine.evaluateTrack(cameraTrack, t);
                }
            }
            if (typeof CameraEngine !== 'undefined') CameraEngine.applyToCamera(dt);
        } else if (previewMode === 'move') {
            updateFreeMove(dt);
        } else {
            // Orbit mode
            applyOrbit();
            camera.position.copy(baseCameraPos);
            camera.lookAt(0, 0, 0);
            camera.fov = baseFOV;
            camera.updateProjectionMatrix();
        }
    }

    // ── MAIN UPDATE ────────────────────────────────────────
    function update() {
        const dt = Math.min(clock.getDelta(), 0.05);
        const audioBus = AudioEngine.audioBus;

        // ★ CRITICAL FIX: When not playing, dt_visual = 0 → visuals freeze
        const dt_visual = audioBus.isPlaying ? dt : 0;

        // Timeline-driven state application — ONLY active in 'follow' mode
        // Orbit and Move modes give the user full manual control
        if (previewMode === 'follow' &&
            typeof ProjectStore !== 'undefined' &&
            typeof GraphEvaluator !== 'undefined' &&
            audioBus?.loaded && audioBus.isPlaying) {
            try {
                const project = ProjectStore.getState();
                const t = audioBus.currentTime || 0;
                const res = GraphEvaluator.evalAtTime(project, t);
                if (res?.appliedEventId || res?.blended?.b) {
                    applyBlendedState(res.blended);
                    _lastAppliedEventId = res.appliedEventId;
                }
            } catch (e) { /* keep rendering */ }
        }

        // Background color
        const bgColor = ParamSystem.get('backgroundColor') || '#000000';
        scene.background.set(bgColor);

        // Update camera based on preview mode
        updateCamera(dt, audioBus);

        // Effects (only apply when playing)
        updateEffects(audioBus, { ...ParamSystem.getAllGlobal(), ...ParamSystem.getAllMode() }, dt);

        // Update active mode — ★ use dt_visual so visuals freeze when paused
        if (activeMode && activeMode.update) {
            try {
                const baseParams = { ...ParamSystem.getAllGlobal(), ...ParamSystem.getAllMode() };

                // Apply audio modulation mappings (only when playing)
                if (audioBus.isPlaying) {
                    const mappings = ParamSystem.getMappings();
                    for (const key in mappings) {
                        const map = mappings[key];
                        let audioVal = 0;
                        if (map.band === 'onset') audioVal = audioBus.onsetStrength;
                        else if (map.band === 'envelope') audioVal = audioBus.envelope;
                        else if (map.band === 'rms') audioVal = audioBus.rms;
                        else if (map.band === 'beatPhase') audioVal = audioBus.beatPhase;
                        else audioVal = audioBus.smoothBands[map.band] || audioBus.rawBands[map.band] || 0;

                        // Apply stem reactivity scaling
                        const stemMap = { sub: 'stemReactivity_drums', bass: 'stemReactivity_bass', lowMid: 'stemReactivity_mids', mid: 'stemReactivity_mids', highMid: 'stemReactivity_highs', treble: 'stemReactivity_highs', brilliance: 'stemReactivity_highs' };
                        if (stemMap[map.band]) {
                            audioVal *= (ParamSystem.get(stemMap[map.band]) || 1.0);
                        }

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

        // Render
        try {
            if (typeof RenderGraph !== 'undefined' && RenderGraph.composer && ParamSystem.get('postProcessing')) {
                RenderGraph.update(dt, audioBus);
                RenderGraph.render(dt);
            } else if (composer && ParamSystem.get('postProcessing')) {
                composer.render();
            } else {
                renderer.setRenderTarget(null);
                renderer.render(scene, camera);
            }
        } catch (err) {
            console.warn('Composer error:', err);
            ParamSystem.set('postProcessing', false);
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
        }
    }

    function applyBlendedState(blended) {
        const a = blended.a;
        const b = blended.b;
        let t = blended.t;

        if (blended.type === 'cut') t = t < 0.5 ? 0 : 1;

        const modeA = a?.visual?.modeKey || null;
        const modeB = b?.visual?.modeKey || null;
        const desiredMode = (modeA && modeB && modeA !== modeB && t < 0.5) ? modeA : modeB;
        if (desiredMode && desiredMode !== activeModeKey) setMode(desiredMode);

        // Blend params
        const ag = a?.visual?.globalParams, bg = b?.visual?.globalParams;
        if (ag && bg) { const mix = GraphModel.deepBlend(ag, bg, t); for (const [k, v] of Object.entries(mix)) ParamSystem.set(k, v); }
        else if (bg) { for (const [k, v] of Object.entries(bg)) ParamSystem.set(k, v); }

        const am = a?.visual?.modeParams, bm = b?.visual?.modeParams;
        if (am && bm) { const mix = GraphModel.deepBlend(am, bm, t); for (const [k, v] of Object.entries(mix)) ParamSystem.set(k, v); }
        else if (bm) { for (const [k, v] of Object.entries(bm)) ParamSystem.set(k, v); }

        // Mappings
        const mappings = b?.visual?.mappings;
        if (ParamSystem.setMapping) {
            const current = ParamSystem.getMappings ? ParamSystem.getMappings() : {};
            for (const key of Object.keys(current)) ParamSystem.setMapping(key, null, 0, current[key]?.type);
            if (mappings && typeof mappings === 'object') {
                for (const [k, m] of Object.entries(mappings)) { if (m) ParamSystem.setMapping(k, m.band, m.amount, m.type); }
            }
        }

        // Camera blending
        const ac = a?.camera, bc = b?.camera;
        if (bc) {
            let c = bc;
            if (ac) c = GraphModel.deepBlend(ac, bc, t);
            applyCameraState(c);
        }
    }

    return {
        init, registerMode, getModeKeys, getModeName, setMode, nextMode, prevMode, update,
        toggleFlash() { flashEnabled = !flashEnabled; return flashEnabled; },
        beatPulse, barPulse, halfTimePulse, beatSaw, beatSine,
        get flashEnabled() { return flashEnabled; },
        get activeModeKey() { return activeModeKey; },
        get activeMode() { return activeMode; },
        get scene() { return scene; },
        get camera() { return camera; },
        get renderer() { return renderer; },
        get previewMode() { return previewMode; },
        getOrbitState, setOrbitState, setPreviewMode, getCameraSnapshot, applyNodeSnapshot,
        applyStudioStateAtTime(t) {
            if (typeof ProjectStore === 'undefined' || typeof GraphEvaluator === 'undefined') return;
            const project = ProjectStore.getState();
            const res = GraphEvaluator.evalAtTime(project, t || 0);
            if (res?.blended) {
                applyBlendedState(res.blended);
                _lastAppliedEventId = res.appliedEventId || null;
            }
        }
    };
})();
