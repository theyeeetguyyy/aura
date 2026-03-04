// ============================================================
// AURA — Main Application
// Bootstrap, animation loop, initialization
// ============================================================

const AuraApp = (() => {
    let running = false;
    let canvas = null;

    function init() {
        canvas = document.getElementById('aura-canvas');

        // Init audio engine
        AudioEngine.init();

        // Init visual engine
        VisualEngine.init(canvas);

        // Register all modes
        registerModes();

        // Init UI
        UI.init();

        // Set default mode
        VisualEngine.setMode('geometryForge');
        UI.updateModeList();
        UI.buildParamsUI();

        // Start animation loop
        running = true;
        loop();

        console.log('🎵 AURA initialized — drop a music file to start!');
    }

    function registerModes() {
        VisualEngine.registerMode('frequencyBars', FrequencyBarsMode);
        VisualEngine.registerMode('particleStorm', ParticleStormMode);
        VisualEngine.registerMode('radialBloom', RadialBloomMode);
        VisualEngine.registerMode('terrainMesh', TerrainMeshMode);
        VisualEngine.registerMode('waveformScope', WaveformScopeMode);
        VisualEngine.registerMode('spectrogram', SpectrogramMode);
        VisualEngine.registerMode('kaleidoscope', KaleidoscopeMode);
        VisualEngine.registerMode('shaderTunnel', ShaderTunnelMode);
        VisualEngine.registerMode('geometryForge', GeometryForgeMode);
        VisualEngine.registerMode('hyperforge', HyperforgeMode);
        VisualEngine.registerMode('godRays', GodRaysMode);
        VisualEngine.registerMode('particleManipulation', ParticleManipulationMode);
        VisualEngine.registerMode('mathMode', MathModeMode);
        VisualEngine.registerMode('fractalTree', FractalTreeMode);
        VisualEngine.registerMode('voronoiField', VoronoiFieldMode);
        VisualEngine.registerMode('lissajous', LissajousMode);
        VisualEngine.registerMode('mobiusRings', MobiusRingsMode);
        VisualEngine.registerMode('gridDistortion', GridDistortionMode);
        VisualEngine.registerMode('dnaHelix', DnaHelixMode);
        VisualEngine.registerMode('polyhedronExplode', PolyhedronExplodeMode);
        VisualEngine.registerMode('starfield', StarfieldMode);
        VisualEngine.registerMode('nebula', NebulaMode);
        VisualEngine.registerMode('aurora', AuroraMode);
        VisualEngine.registerMode('cyberGrid', CyberGridMode);
        VisualEngine.registerMode('neonPlasma', NeonPlasmaMode);
        VisualEngine.registerMode('dimensionalRift', DimensionalRiftMode);
        VisualEngine.registerMode('rhythmicGeometry', RhythmicGeometryMode);
    }

    function loop() {
        if (!running) return;
        requestAnimationFrame(loop);

        // 1. Update audio analysis
        AudioEngine.update();

        // 2. Update visuals (mode + render)
        VisualEngine.update();

        // 3. Update UI
        UI.update();
    }

    function stop() {
        running = false;
    }

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { init, stop };
})();
