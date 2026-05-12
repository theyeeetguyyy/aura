// ============================================================
// AURA — Scene Orchestrator (Phase 1.5)
// Cinematic Director Layer
// Decouples visual simulation from presentation.
// Budgets visual complexity and enforces motion hierarchy.
// ============================================================

const SceneOrchestrator = (() => {
    // ── BEHAVIOR STATES ──
    const STATES = {
        AMBIENT: 'ambient',       // Low density, slow motion, negative space
        BUILDUP: 'buildup',       // Rising tension, increasing instability
        TENSION: 'tension',       // Near-stasis, suspended motion, maximum restraint
        DROP: 'drop',             // Maximum kinetic release, full visual budget
        AFTERMATH: 'aftermath'    // Decaying energy, fading particles
    };

    let currentState = STATES.AMBIENT;
    
    // ── VISUAL BUDGETING ──
    // 0.0 to 1.0 multipliers for downstream systems
    // These limit maximum permissible intensity of specific visual layers
    const budget = {
        cameraShake: 0.1,
        cameraRecoil: 0.2,
        geometryDisplacement: 0.1,
        particleEmission: 0.2,
        bloomIntensity: 0.4,
        colorStorm: 0.0
    };

    function init() {
        if (typeof AuraEvents !== 'undefined') {
            AuraEvents.on(AuraEvents.SECTION_CHANGE, handleSectionChange);
            AuraEvents.on(AuraEvents.DROP_ENTER, handleDropEnter);
        } else {
            console.warn("[SceneOrchestrator] AuraEvents not found. Orchestrator running without event triggers.");
        }
    }

    function handleSectionChange(data) {
        // data.section is 'intro', 'buildup', 'drop', 'breakdown', 'outro'
        if (!data || !data.section) return;
        
        switch (data.section) {
            case 'intro':
            case 'outro':
            case 'breakdown':
                transitionTo(STATES.AMBIENT);
                break;
            case 'buildup':
                transitionTo(STATES.BUILDUP);
                break;
            case 'drop':
                transitionTo(STATES.DROP);
                break;
            default:
                transitionTo(STATES.AMBIENT);
                break;
        }
    }
    
    function handleDropEnter(data) {
        transitionTo(STATES.DROP);
    }

    function transitionTo(newState) {
        if (currentState === newState) return;
        
        // Wait, if we are in buildup, and getting very close to the drop,
        // we should ideally transition to TENSION.
        // For now, Tension is handled manually or triggered by specific tension events.
        
        currentState = newState;
        
        // Update budgets based on the new cinematic state
        switch (newState) {
            case STATES.AMBIENT:
                budget.cameraShake = 0.1;
                budget.cameraRecoil = 0.2;
                budget.geometryDisplacement = 0.1;
                budget.particleEmission = 0.3;
                budget.bloomIntensity = 0.4;
                budget.colorStorm = 0.0;
                break;
            case STATES.BUILDUP:
                budget.cameraShake = 0.5;
                budget.cameraRecoil = 0.4;
                budget.geometryDisplacement = 0.3; // Restrained to build tension
                budget.particleEmission = 0.6;
                budget.bloomIntensity = 0.6;
                budget.colorStorm = 0.2;
                break;
            case STATES.TENSION: // High-restraint state (the "Fakeout")
                budget.cameraShake = 0.05; // Suspended motion
                budget.cameraRecoil = 0.0;
                budget.geometryDisplacement = 0.0; // Total geometric freeze
                budget.particleEmission = 0.1;
                budget.bloomIntensity = 0.8; // Heavy bloom pressure
                budget.colorStorm = 0.0;
                break;
            case STATES.DROP:
                budget.cameraShake = 1.0;
                budget.cameraRecoil = 1.0;
                budget.geometryDisplacement = 1.0; // Full procedural violence allowed
                budget.particleEmission = 1.0;
                budget.bloomIntensity = 1.0;
                budget.colorStorm = 1.0;
                break;
            case STATES.AFTERMATH:
                budget.cameraShake = 0.2;
                budget.cameraRecoil = 0.5;
                budget.geometryDisplacement = 0.4;
                budget.particleEmission = 0.5;
                budget.bloomIntensity = 0.5;
                budget.colorStorm = 0.0;
                break;
        }
        
        console.log(`[Orchestrator] Transitioned to: ${newState.toUpperCase()}`);
    }

    // ── PUBLIC API ──
    // Visual Modes call these to scale their internal parameters, ensuring they respect the global scene orchestration.
    
    return {
        init,
        STATES,
        getCurrentState: () => currentState,
        getBudget: (key) => budget[key] !== undefined ? budget[key] : 1.0,
        
        // Manual override for specialized moments (e.g., a Fakeout)
        forceState: transitionTo,
        
        // Convenience getters for hot paths (zero allocation)
        getDisplacementScale: () => budget.geometryDisplacement,
        getParticleScale: () => budget.particleEmission,
        getCameraShakeScale: () => budget.cameraShake,
        getCameraRecoilScale: () => budget.cameraRecoil,
        getBloomScale: () => budget.bloomIntensity,
        getColorStormScale: () => budget.colorStorm
    };
})();
