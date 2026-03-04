// ============================================================
// AURA — Visual Engine v2
// Mode registry, Three.js scene, DUBSTEP EFFECTS:
// screen shake, camera zoom punch, flash, drop reactions
// ============================================================

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

    // Post-processing
    let renderPass = null;
    let bloomPass = null;

    // === DUBSTEP EFFECTS STATE ===
    let baseCameraPos = new THREE.Vector3(0, 0, 100);
    let cameraShake = { x: 0, y: 0, z: 0, intensity: 0 };
    let shakeTime = 0;
    let cameraZoomPunch = 0;
    let flashOverlay = null;
    let flashIntensity = 0;
    let flashEnabled = true;   // toggled by UI button
    let strobeCounter = 0;
    let baseFOV = 75;

    // Mouse orbit & zoom state
    let orbitTheta = 0;      // horizontal angle
    let orbitPhi = Math.PI / 2; // vertical angle (start at equator)
    let orbitRadius = 100;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let orbitDirty = false;  // true if user has manually orbited

    function init(canvas) {
        clock = new THREE.Clock();

        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true
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

        // Flash overlay — child of camera so it:
        //   1. Always covers the full view regardless of orbit angle
        //   2. Lives in the WebGL scene → captured by canvas.captureStream → visible in recordings
        //   3. Never touches the DOM → can't overlap UI panels
        //
        // Plane is oversized (4x4 units at z=-0.5 from camera).
        // At FOV=75°, the visible frustum at z=0.5 is ~0.77 wide, so 4 units massively overcovers it.
        const flashGeo = new THREE.PlaneGeometry(4, 4);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        flashOverlay = new THREE.Mesh(flashGeo, flashMat);
        flashOverlay.position.set(0, 0, -0.5); // 0.5 units in front of camera lens
        flashOverlay.renderOrder = 9999;

        // Add camera to scene so its children (the flash) get rendered
        scene.add(camera);
        camera.add(flashOverlay);

        initPostProcessing();
        window.addEventListener('resize', onResize);
        setupMouseControls(canvas);
    }

    function initPostProcessing() {
        if (!THREE.EffectComposer) return;
        composer = new THREE.EffectComposer(renderer);
        renderPass = new THREE.RenderPass(scene, camera);
        composer.addPass(renderPass);
        if (THREE.UnrealBloomPass) {
            bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.8, 0.4, 0.3
            );
            composer.addPass(bloomPass);
        }
    }

    function onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (composer) composer.setSize(w, h);
    }

    function registerMode(key, modeObj) {
        modes[key] = modeObj;
        modeKeys.push(key);
    }

    function getModeKeys() { return [...modeKeys]; }
    function getModeName(key) { return modes[key]?.name || key; }

    function setMode(key) {
        if (!modes[key]) { console.warn(`Mode "${key}" not found`); return; }
        if (activeMode && activeMode.destroy) activeMode.destroy(scene);

        // Clear scene but protect the camera (and its flash child)
        const toRemove = scene.children.filter(obj => obj !== camera);
        for (const obj of toRemove) {
            obj.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            scene.remove(obj);
        }

        activeModeKey = key;
        activeMode = modes[key];
        ParamSystem.setModeSchema(activeMode.params || {});

        // Reset camera to mode default
        baseCameraPos.set(0, 0, 100);
        camera.position.copy(baseCameraPos);
        camera.lookAt(0, 0, 0);
        baseFOV = 75;

        // Reset orbit
        orbitDirty = false;
        orbitRadius = 100;
        orbitTheta = 0;
        orbitPhi = Math.PI / 2;

        if (activeMode.init) activeMode.init(scene, camera, renderer);

        // Remember the mode's camera position as base
        baseCameraPos.copy(camera.position);
        baseFOV = camera.fov;
        // Derive orbit radius from mode's camera distance
        orbitRadius = baseCameraPos.length() || 100;
    }

    function nextMode() {
        const idx = modeKeys.indexOf(activeModeKey);
        setMode(modeKeys[(idx + 1) % modeKeys.length]);
        return activeModeKey;
    }

    function prevMode() {
        const idx = modeKeys.indexOf(activeModeKey);
        setMode(modeKeys[(idx - 1 + modeKeys.length) % modeKeys.length]);
        return activeModeKey;
    }

    // ── MOUSE ORBIT & ZOOM ─────────────────────────────────

    function setupMouseControls(canvas) {
        // Scroll to zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.08;
            orbitRadius *= (1 + Math.sign(e.deltaY) * zoomSpeed);
            orbitRadius = Math.max(10, Math.min(500, orbitRadius));
            orbitDirty = true;
        }, { passive: false });

        // Left-click drag to rotate
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
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

            const sensitivity = 0.005;
            orbitTheta -= dx * sensitivity;
            orbitPhi -= dy * sensitivity;
            // Clamp phi to avoid flipping (5° to 175°)
            orbitPhi = Math.max(0.087, Math.min(Math.PI - 0.087, orbitPhi));
            orbitDirty = true;
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) isDragging = false;
        });
    }

    function applyOrbit() {
        if (!orbitDirty) return;
        // Spherical to cartesian
        baseCameraPos.x = orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
        baseCameraPos.y = orbitRadius * Math.cos(orbitPhi);
        baseCameraPos.z = orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
    }

    // ── DUBSTEP EFFECTS v3 — Section-aware ──────────────────

    function updateEffects(audio, params, dt) {
        // Get section-specific effect multipliers from marker system
        const effects = (typeof MarkerSystem !== 'undefined' && MarkerSystem.getSmoothedEffects)
            ? MarkerSystem.getSmoothedEffects()
            : { shake: 1, flash: 1, zoom: 1, bloom: 1, speed: 1, particleScale: 1, displacementScale: 1 };

        const masterInt = audio.masterIntensity || 1.0;
        const sectionInt = audio.sectionIntensity || 1.0;

        // Use marker-specific multipliers for each effect
        const shakeAmount = (params.screenShake || 1) * effects.shake * masterInt;
        const flashAmount = (params.beatFlash || 0.5) * effects.flash * masterInt;
        const zoomPunch = (params.zoomPunch || 0.5) * effects.zoom * masterInt;
        const reactivity = (params.reactivity || 1) * sectionInt;

        // === AUTO ROTATE (section-speed-aware) ===
        if (params.cameraAutoRotate && !isDragging) {
            const speed = (params.cameraRotateSpeed || 0.5) * effects.speed * (1 + audio.energySmooth * 2);
            orbitTheta += speed * dt;
            orbitDirty = true;
        }

        // === APPLY USER ORBIT ===
        applyOrbit();

        // === SCREEN SHAKE — smooth sinusoidal, not random jitter ===
        if (audio.bassBeat && shakeAmount > 0) {
            cameraShake.intensity = audio.bassBeatIntensity * shakeAmount * 4 * reactivity;
        }
        cameraShake.intensity *= 0.88;
        shakeTime += dt * 28;
        cameraShake.x = (Math.sin(shakeTime * 1.0) * 0.6 + Math.sin(shakeTime * 2.3) * 0.4) * cameraShake.intensity;
        cameraShake.y = (Math.sin(shakeTime * 1.7) * 0.6 + Math.sin(shakeTime * 3.1) * 0.4) * cameraShake.intensity;
        cameraShake.z = Math.sin(shakeTime * 0.9) * cameraShake.intensity * 0.2;

        camera.position.x = baseCameraPos.x + cameraShake.x;
        camera.position.y = baseCameraPos.y + cameraShake.y;
        camera.position.z = baseCameraPos.z + cameraShake.z;
        camera.lookAt(0, 0, 0);

        // === CAMERA ZOOM PUNCH (section-weighted) ===
        if (audio.beat && zoomPunch > 0) {
            cameraZoomPunch = audio.beatIntensity * zoomPunch * 6 * reactivity;
        }
        cameraZoomPunch *= 0.88;

        // Anticipation zoom (slow tighten approaching a drop)
        let anticipationZoom = 0;
        if (audio.anticipation > 0) {
            anticipationZoom = audio.anticipation * 8;
        }

        camera.fov = Math.max(10, baseFOV - cameraZoomPunch - anticipationZoom);
        camera.updateProjectionMatrix();

        // === BEAT FLASH — inside WebGL scene, visible in recording ===
        if (flashEnabled && flashAmount > 0) {
            if (audio.isDrop) {
                flashIntensity = audio.dropIntensity * flashAmount * 1.2;
            } else if (audio.bassBeat) {
                flashIntensity = Math.max(flashIntensity, audio.bassBeatIntensity * flashAmount * 0.35);
            }
        }
        flashIntensity *= 0.8;

        if (flashOverlay) {
            flashOverlay.visible = flashEnabled;
            flashOverlay.material.opacity = flashEnabled ? Math.min(0.5, flashIntensity) : 0;
            if (flashEnabled && flashIntensity > 0.05) {
                const c = ParamSystem.getColorThree(audio.rms + clock.elapsedTime * 0.2);
                flashOverlay.material.color.lerp(c, 0.3);
            }
        }

        // === EXPOSURE — section-aware ===
        let targetExposure = 1.2;
        if (audio.dropDecay > 0.1) {
            targetExposure = 1.2 + audio.dropDecay * 1.5 * effects.flash;
        }
        if (audio.isHighEnergy) {
            targetExposure *= 1.1; // Slightly brighter during drops
        }
        if (audio.isCalm) {
            targetExposure *= 0.85; // Dimmer during calm sections
        }
        renderer.toneMappingExposure += (targetExposure - renderer.toneMappingExposure) * 0.1;

        // === FOG — adapts to section energy ===
        if (scene.fog) {
            const fogTarget = audio.isHighEnergy ? 0.0005 : (audio.isCalm ? 0.003 : 0.001);
            scene.fog.density += (fogTarget - scene.fog.density) * 0.05;
        }
    }

    // ── MAIN UPDATE ────────────────────────────────────────

    function update() {
        const dt = clock.getDelta();
        const audioBus = AudioEngine.audioBus;

        // Background color
        const bg = ParamSystem.get('backgroundColor') || '#000000';
        scene.background.set(bg);

        // Bloom — section-aware
        if (bloomPass) {
            const pp = ParamSystem.get('postProcessing');
            bloomPass.enabled = pp;
            if (pp) {
                const effects = (typeof MarkerSystem !== 'undefined' && MarkerSystem.getSmoothedEffects)
                    ? MarkerSystem.getSmoothedEffects() : { bloom: 1 };
                const masterInt = audioBus.masterIntensity || 1;
                bloomPass.strength = (ParamSystem.get('bloomIntensity') || 0.8) * effects.bloom
                    + audioBus.bassBeatIntensity * 0.5 * masterInt;
                bloomPass.threshold = ParamSystem.get('bloomThreshold') || 0.3;
            }
        }

        // Dubstep visual effects (shake, flash, zoom)
        updateEffects(audioBus, {
            ...ParamSystem.getAllGlobal(),
            ...ParamSystem.getAllMode()
        }, dt);

        // Update active mode
        if (activeMode && activeMode.update) {
            try {
                activeMode.update(audioBus, {
                    ...ParamSystem.getAllGlobal(),
                    ...ParamSystem.getAllMode()
                }, dt);
            } catch (err) {
                console.warn(`Mode "${activeModeKey}" error:`, err.message);
            }
        }

        // Render
        try {
            if (composer && ParamSystem.get('postProcessing')) {
                composer.render();
            } else {
                renderer.setRenderTarget(null);
                renderer.render(scene, camera);
            }
        } catch (err) {
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
        }
    }

    return {
        init,
        registerMode,
        getModeKeys,
        getModeName,
        setMode,
        nextMode,
        prevMode,
        update,
        toggleFlash() { flashEnabled = !flashEnabled; return flashEnabled; },
        get flashEnabled() { return flashEnabled; },
        get activeModeKey() { return activeModeKey; },
        get activeMode() { return activeMode; },
        get scene() { return scene; },
        get camera() { return camera; },
        get renderer() { return renderer; }
    };
})();
