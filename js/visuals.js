// ============================================================
// AURA — Visual Engine v2
// Mode registry, Three.js scene, DUBSTEP EFFECTS:
// screen shake, camera zoom punch, flash, drop reactions
// ============================================================

// ── SECTION BEHAVIOR CONTRACT ──────────────────────────────
const SECTION_BEHAVIORS = {
    intro: { displaceModeHint: 'noise', rotationMultiplier: 0.4, particleEmissionRate: 0.2, colorSaturationMult: 0.7, beatReactivity: 0.2, bloomGlowMult: 0.5, halfTimeMode: false, trailLength: 'short' },
    verse: { displaceModeHint: 'frequency', rotationMultiplier: 0.6, particleEmissionRate: 0.5, colorSaturationMult: 0.85, beatReactivity: 0.5, bloomGlowMult: 0.7, halfTimeMode: false, trailLength: 'short' },
    buildup: { displaceModeHint: 'spike', rotationMultiplier: 1.0, particleEmissionRate: 0.8, colorSaturationMult: 1.1, beatReactivity: 0.8, bloomGlowMult: 1.0, halfTimeMode: false, trailLength: 'medium', useSectionProgressRamp: true },
    fakeout: { displaceModeHint: 'breathe', rotationMultiplier: 0.1, particleEmissionRate: 0.05, colorSaturationMult: 0.4, beatReactivity: 0.0, bloomGlowMult: 0.2, halfTimeMode: false, trailLength: 'none', onEnter: 'hard-cut-to-minimal' },
    drop: { displaceModeHint: 'shatter', rotationMultiplier: 1.8, particleEmissionRate: 1.5, colorSaturationMult: 1.5, beatReactivity: 1.4, bloomGlowMult: 1.8, halfTimeMode: true, trailLength: 'long', onEnter: 'morph-explode', gunShotReaction: 'spike-max', screechReaction: 'chromatic', sirenReaction: 'stretch-up' },
    drop2: { displaceModeHint: 'glitch', rotationMultiplier: 2.2, particleEmissionRate: 2.0, colorSaturationMult: 1.8, beatReactivity: 1.8, bloomGlowMult: 2.5, halfTimeMode: true, trailLength: 'long', onEnter: 'morph-explode', gunShotReaction: 'spike-max' },
    breakdown: { displaceModeHint: 'melt', rotationMultiplier: 0.5, particleEmissionRate: 0.4, colorSaturationMult: 1.0, beatReactivity: 0.3, bloomGlowMult: 1.4, halfTimeMode: false, trailLength: 'long', wobbleReaction: 'displace-lfo' },
    bridge: { displaceModeHint: 'ripple', rotationMultiplier: 0.5, particleEmissionRate: 0.4, beatReactivity: 0.4, bloomGlowMult: 0.8, halfTimeMode: false, trailLength: 'medium' },
    climax: { displaceModeHint: 'harmonics', rotationMultiplier: 2.5, particleEmissionRate: 2.5, colorSaturationMult: 2.0, beatReactivity: 2.0, bloomGlowMult: 3.0, halfTimeMode: false, trailLength: 'long', onEnter: 'morph-explode', screechReaction: 'chromatic', sirenReaction: 'stretch-up' },
    outro: { displaceModeHint: 'breathe', rotationMultiplier: 0.2, particleEmissionRate: 0.1, colorSaturationMult: 0.5, beatReactivity: 0.1, bloomGlowMult: 0.3, halfTimeMode: false, trailLength: 'long' },
};

// ── MODULE-SCOPE COLOR MAPS (7.7: Never allocate inside frame loop) ──
const _fogColorMap = {
    cool: new THREE.Color(0x000520),
    neutral: new THREE.Color(0x000000),
    warm: new THREE.Color(0x150500),
    hot: new THREE.Color(0x1a0000),
    ethereal: new THREE.Color(0x0a0015),
    extreme: new THREE.Color(0x200000),
};
const _colorTempHue = { cool: 240, neutral: 280, warm: 30, hot: 5, ethereal: 300, extreme: 0 };
const _tempColor = new THREE.Color(); // reusable scratch color

// ── BEAT-SYNC UTILITIES ────────────────────────────────────
function beatPulse(phase, width = 0.12) {
    if (phase < width) return 1 - (phase / width);
    const trailing = 1 - width;
    if (phase > trailing) return (phase - trailing) / width;
    return 0;
}
function barPulse(barPhase, width = 0.06) {
    return beatPulse(barPhase, width);
}
function halfTimePulse(barPhase, width = 0.10) {
    const phase2 = (barPhase * 2) % 1;
    return beatPulse(phase2, width);
}
function beatSaw(phase) { return phase; }
function beatSine(phase) { return 0.5 + 0.5 * Math.sin(phase * Math.PI * 2); }

// ── MATERIAL DISPOSAL HELPER (7.8: Disposes all textures) ──
function disposeMaterial(mat) {
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
        'aoMap', 'envMap', 'alphaMap', 'lightMap'].forEach(slot => {
            if (mat[slot]) mat[slot].dispose();
        });
    mat.dispose();
}

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
        const previousKey = activeModeKey;
        const previousMode = activeMode;

        if (activeMode && activeMode.destroy) activeMode.destroy(scene);

        // Clear scene but protect the camera (and its flash child)
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
        modeErrorReported = false; // 1.3: Reset error throttle on mode switch
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

        // 7.5: Error boundary around mode init
        try {
            if (activeMode.init) activeMode.init(scene, camera, renderer);
        } catch (err) {
            console.error(`Mode "${key}" failed to init:`, err);
            // Revert to previous mode if available
            if (previousKey && previousMode && previousKey !== key) {
                activeModeKey = previousKey;
                activeMode = previousMode;
                ParamSystem.setModeSchema(activeMode.params || {});
                return;
            }
        }

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
            orbitRadius = Math.max(10, Math.min(2000, orbitRadius));
            orbitDirty = true;
        }, { passive: false });

        // Left-click drag to rotate — only if directly on canvas (1.5)
        canvas.addEventListener('mousedown', (e) => {
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

        // 8.1: Touch support for orbit (single finger drag) & zoom (pinch)
        let lastTouchX = 0, lastTouchY = 0;
        let touchDragging = false;
        let pinchStartDist = 0;

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchDragging = true;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                touchDragging = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                pinchStartDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && touchDragging) {
                const dx = e.touches[0].clientX - lastTouchX;
                const dy = e.touches[0].clientY - lastTouchY;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
                const sensitivity = 0.005;
                orbitTheta -= dx * sensitivity;
                orbitPhi -= dy * sensitivity;
                orbitPhi = Math.max(0.087, Math.min(Math.PI - 0.087, orbitPhi));
                orbitDirty = true;
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (pinchStartDist > 0) {
                    const scale = pinchStartDist / dist;
                    orbitRadius *= scale;
                    orbitRadius = Math.max(10, Math.min(2000, orbitRadius));
                    orbitDirty = true;
                }
                pinchStartDist = dist;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', () => {
            touchDragging = false;
            pinchStartDist = 0;
        }, { passive: true });
    }

    function applyOrbit() {
        if (!orbitDirty) return;
        // Spherical to cartesian
        baseCameraPos.x = orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta);
        baseCameraPos.y = orbitRadius * Math.cos(orbitPhi);
        baseCameraPos.z = orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta);
        orbitDirty = false; // 1.2: Reset so applyOrbit doesn't run every frame
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
            // 6.1: Color temperature → flash color
            const tempHue = _colorTempHue[audio.colorTemp] ?? 280;
            _tempColor.setHSL(tempHue / 360, 0.9, 0.6);
            if (flashEnabled) flashOverlay.material.color.lerp(_tempColor, 0.05);
        }

        // === EXPOSURE — section-aware ===
        let targetExposure = 1.2;
        if (audio.dropDecay > 0.1) {
            targetExposure = 1.2 + audio.dropDecay * 1.5 * effects.flash;
        }
        if (audio.isHighEnergy) {
            targetExposure *= 1.1;
        }
        if (audio.isCalm) {
            targetExposure *= 0.85;
        }
        renderer.toneMappingExposure += (targetExposure - renderer.toneMappingExposure) * 0.1;

        // === FOG — adapts to section energy + colorTemp ===
        if (scene.fog) {
            const fogTarget = audio.isHighEnergy ? 0.0005 : (audio.isCalm ? 0.003 : 0.001);
            scene.fog.density += (fogTarget - scene.fog.density) * 0.05;
            // 6.2: Color temperature → fog color
            const targetFogColor = _fogColorMap[audio.colorTemp] || _fogColorMap.neutral;
            scene.fog.color.lerp(targetFogColor, 0.03);
        }
    }

    // ── MAIN UPDATE ────────────────────────────────────────

    function update() {
        const dt = Math.min(clock.getDelta(), 0.05); // 1.1: Clamp to 50ms max (prevents tab-switch explosion)
        const audioBus = AudioEngine.audioBus;

        // Background color — 6.3: tint toward colorTemp when section active
        const bgColor = ParamSystem.get('backgroundColor') || '#000000';
        if (audioBus.sectionType && audioBus.colorTemp !== 'neutral') {
            const tempTint = _fogColorMap[audioBus.colorTemp] || _fogColorMap.neutral;
            const userBg = _tempColor.set(bgColor);
            scene.background.copy(userBg).lerp(tempTint, 0.15 * (audioBus.transitionFade || 0));
        } else {
            scene.background.set(bgColor);
        }

        // Bloom — section-aware
        if (bloomPass) {
            const pp = ParamSystem.get('postProcessing');
            bloomPass.enabled = pp;
            if (pp) {
                const effects = audioBus.sectionEffects || { bloom: 1 };
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

        // Update active mode — inject section effects into params
        if (activeMode && activeMode.update) {
            try {
                const sectionEffects = audioBus.sectionEffects || {};
                activeMode.update(audioBus, {
                    ...ParamSystem.getAllGlobal(),
                    ...ParamSystem.getAllMode(),
                    _displacementScale: sectionEffects.displacementScale ?? 1,
                    _particleScale: sectionEffects.particleScale ?? 1,
                    _speedScale: sectionEffects.speed ?? 1,
                }, dt);
                modeErrorReported = false;
            } catch (err) {
                if (!modeErrorReported) {
                    console.warn(`Mode "${activeModeKey}" error:`, err.message);
                    modeErrorReported = true;
                }
            }
        }

        // Render (1.4: disable post-processing on composer error instead of double render)
        try {
            if (composer && ParamSystem.get('postProcessing')) {
                composer.render();
            } else {
                renderer.setRenderTarget(null);
                renderer.render(scene, camera);
            }
        } catch (err) {
            console.warn('Composer error, disabling post-processing:', err);
            ParamSystem.set('postProcessing', false);
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
        // Beat-sync utilities exposed for modes
        beatPulse,
        barPulse,
        halfTimePulse,
        beatSaw,
        beatSine,
        SECTION_BEHAVIORS,
        get flashEnabled() { return flashEnabled; },
        get activeModeKey() { return activeModeKey; },
        get activeMode() { return activeMode; },
        get scene() { return scene; },
        get camera() { return camera; },
        get renderer() { return renderer; }
    };
})();
