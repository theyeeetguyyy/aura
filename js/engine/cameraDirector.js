// ============================================================
// AURA — Camera Director (Phase 2)
// Translates cinematic intent into physics behaviors.
// Assumes CameraEngine is initialized.
// ============================================================

const CameraDirector = (() => {
    // ── CINEMATIC INTENTS ──
    const INTENTS = {
        NEUTRAL: 'neutral',
        OPPRESSIVE: 'oppressive', // Slow push in, low FOV, heavy mass
        VIOLENT: 'violent',       // High recoil, high shake, FOV slams
        DREAMLIKE: 'dreamlike',   // High drift, high damping, slow orbit
        CLAUSTROPHOBIC: 'claustrophobic', // Extreme zoom, no orbit
        HOVER: 'hover'            // Frozen orbit, waiting for impact
    };

    let currentIntent = INTENTS.NEUTRAL;

    function init() {
        if (typeof AuraEvents !== 'undefined') {
            AuraEvents.on(AuraEvents.BASS_IMPACT, handleBassImpact);
            AuraEvents.on(AuraEvents.GUNSHOT, handleGunshot);
            AuraEvents.on(AuraEvents.BEAT, handleBeat);
            AuraEvents.on(AuraEvents.SECTION_CHANGE, handleSectionChange);
            AuraEvents.on(AuraEvents.DROP_ENTER, handleDropEnter);
        } else {
            console.warn("[CameraDirector] AuraEvents not found.");
        }
    }

    function setIntent(intentName) {
        if (!Object.values(INTENTS).includes(intentName)) return;
        currentIntent = intentName;
        applyIntentProfile();
        console.log(`[CameraDirector] Intent: ${intentName.toUpperCase()}`);
    }

    function applyIntentProfile() {
        if (typeof CameraEngine === 'undefined' || !CameraEngine.layers) return;
        const engine = CameraEngine.layers;

        switch (currentIntent) {
            case INTENTS.OPPRESSIVE:
                engine.orbit.rotationSpeed = 0.05;
                engine.orbit.swayAmp = 0.02;
                engine.push.zVelocity = -2.0; // Constant slow forward pressure
                engine.impact.pitch.damping = 20; // Very stiff, hard to move
                engine.drift.amp = 0.2;
                engine.shake.weight = 0.3;
                break;
                
            case INTENTS.VIOLENT:
                engine.orbit.rotationSpeed = 1.2;
                engine.orbit.swayAmp = 0.2;
                engine.impact.pitch.damping = 8; // Bouncy, fast recovery
                engine.impact.zPush.damping = 8;
                engine.drift.amp = 0.1;
                engine.shake.weight = 1.0;
                break;
                
            case INTENTS.DREAMLIKE:
                engine.orbit.rotationSpeed = 0.2;
                engine.orbit.swayAmp = 0.4;
                engine.impact.pitch.damping = 30; // Almost no recoil allowed
                engine.impact.zPush.damping = 30;
                engine.drift.amp = 2.0; // High floating
                engine.shake.weight = 0.1;
                break;
                
            case INTENTS.HOVER:
                engine.orbit.rotationSpeed = 0.0;
                engine.orbit.swayAmp = 0.0;
                engine.push.zVelocity = 0;
                engine.drift.amp = 0.1;
                engine.shake.weight = 0.05;
                break;
                
            case INTENTS.CLAUSTROPHOBIC:
                engine.orbit.rotationSpeed = 0.0;
                engine.push.fovCompress.set(-40); // Hard zoom
                engine.drift.amp = 0.0;
                engine.shake.weight = 0.8;
                break;

            default: // NEUTRAL
                engine.orbit.rotationSpeed = 0.4;
                engine.orbit.swayAmp = 0.1;
                engine.impact.pitch.damping = 15;
                engine.impact.zPush.damping = 15;
                engine.drift.amp = 1.0;
                engine.shake.weight = 1.0;
                break;
        }
    }

    function handleSectionChange(data) {
        if (!data || !data.section) return;
        const paramIntent = typeof ParamSystem !== 'undefined' ? ParamSystem.get('cameraIntent') : 'auto';
        if (paramIntent !== 'auto') return; // User override active
        
        // Auto-pilot intent based on section type
        switch (data.section) {
            case 'intro':
            case 'outro':
            case 'breakdown':
                setIntent(INTENTS.DREAMLIKE);
                break;
            case 'buildup':
                setIntent(INTENTS.OPPRESSIVE);
                break;
            case 'drop':
                setIntent(INTENTS.VIOLENT);
                break;
        }
    }
    
    function handleDropEnter(data) {
        const paramIntent = typeof ParamSystem !== 'undefined' ? ParamSystem.get('cameraIntent') : 'auto';
        if (paramIntent === 'auto') {
            setIntent(INTENTS.VIOLENT);
        }
        
        // Massive burst of forward momentum on drop (always happens on drop regardless of intent, but can be scaled)
        if (typeof CameraEngine !== 'undefined') {
            CameraEngine.layers.push.zVelocity = -20;
            CameraEngine.layers.impact.impulse(0, -0.2); // Violent headbang
        }
    }

    function update(dt, audioBus) {
        if (typeof CameraEngine === 'undefined') return;

        let keyframeOverride = false;

        // --- PHASE 2.5: NLE KEYFRAME OVERRIDE ---
        if (typeof ProjectStore !== 'undefined' && typeof KeyframeEngine !== 'undefined') {
            const project = ProjectStore.getState();
            const rawCamEvents = project.timeline?.cameraEvents;
            if (rawCamEvents && rawCamEvents.length > 0) {
                const camEvents = [...rawCamEvents].sort((a,b) => a.time - b.time);
                const t = audioBus.currentTime || 0;
                
                const pos = KeyframeEngine.evalTrack(camEvents, t, 'vector3', (v) => v.pos);
                const rot = KeyframeEngine.evalTrack(camEvents, t, 'euler', (v) => v.rot);
                const fov = KeyframeEngine.evalTrack(camEvents, t, 'scalar', (v) => v.fov);

                if (pos && rot && typeof fov !== 'undefined') {
                    // Feed into VisualEngine so it respects the isDragging flag
                    if (typeof VisualEngine !== 'undefined' && VisualEngine.setOrbitState) {
                        VisualEngine.setOrbitState({
                            orbitRadius: pos.z,
                            orbitTheta: rot.y,
                            orbitPhi: rot.x,
                            fov: fov
                        });
                    }
                    
                    keyframeOverride = true;
                    // Note: We'd want a SplineLayer for absolute xyz, but mapping to Orbit keeps it stable
                }
            }
        }
        
        // --- PHASE 2: BEHAVIORAL INTENT ---
        let targetIntent = currentIntent;
        const paramIntent = typeof ParamSystem !== 'undefined' ? ParamSystem.get('cameraIntent') : 'auto';
        
        if (paramIntent !== 'auto') {
            targetIntent = paramIntent;
        } else {
            // Check orchestrator overrides (Autonomous Mode)
            if (typeof SceneOrchestrator !== 'undefined') {
                const state = SceneOrchestrator.getCurrentState();
                // If orchestrator forces Tension (Fakeout), we force Hover
                if (state === SceneOrchestrator.STATES.TENSION) {
                    targetIntent = INTENTS.HOVER;
                }
            }
        }
        
        if (targetIntent !== currentIntent) {
            setIntent(targetIntent);
        }
        
        const engine = CameraEngine.layers;
        
        // Continuous shake from audio energy
        if (audioBus.bassBeat && engine.shake.weight > 0) {
            const shakeMult = typeof SceneOrchestrator !== 'undefined' ? SceneOrchestrator.getCameraShakeScale() : 1.0;
            engine.shake.intensity += audioBus.bassBeatIntensity * 2.0 * shakeMult * engine.shake.weight;
        }

        // Delegate to physics engine
        CameraEngine.update(dt);
    }

    function handleBassImpact(data) {
        if (typeof CameraEngine === 'undefined') return;
        const engine = CameraEngine.layers;
        const recoilMult = typeof SceneOrchestrator !== 'undefined' ? SceneOrchestrator.getCameraRecoilScale() : 1.0;
        
        if (currentIntent === INTENTS.VIOLENT) {
            // Heavy backward push and pitch down
            engine.impact.impulse(data.intensity * 10 * recoilMult, data.intensity * 0.05 * recoilMult);
        } else if (currentIntent === INTENTS.OPPRESSIVE) {
            // Slow heavy thud
            engine.impact.impulse(data.intensity * 2 * recoilMult, data.intensity * 0.01 * recoilMult);
        } else if (currentIntent !== INTENTS.DREAMLIKE) {
            engine.impact.impulse(data.intensity * 4 * recoilMult, data.intensity * 0.02 * recoilMult);
        }
    }

    function handleGunshot(data) {
        if (typeof CameraEngine === 'undefined') return;
        const engine = CameraEngine.layers;
        const recoilMult = typeof SceneOrchestrator !== 'undefined' ? SceneOrchestrator.getCameraRecoilScale() : 1.0;
        
        // Gunshots punch forward and compress FOV violently
        engine.push.fovCompress.applyForce(-20 * data.intensity * recoilMult);
        engine.push.zVelocity = -15 * data.intensity * recoilMult;
        engine.impact.impulse(0, -0.08 * data.intensity * recoilMult); // Heavy upward recoil
    }

    function handleBeat(data) {
        if (typeof CameraEngine === 'undefined') return;
        const engine = CameraEngine.layers;
        
        if (currentIntent === INTENTS.VIOLENT && data.intensity > 0.5) {
            // Small FOV pumps on beat
            engine.push.fovCompress.applyForce(-2 * data.intensity);
        }
    }

    return {
        init,
        update,
        INTENTS,
        setIntent,
        getCurrentIntent: () => currentIntent
    };
})();
