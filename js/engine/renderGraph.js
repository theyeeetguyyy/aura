// ============================================================
// AURA — Render Graph & Post-Processing Stack (v1)
// Modular, stackable cinematic effects pipeline.
// ============================================================

const RenderGraph = (() => {
    let _composer = null;
    let _renderPass = null;
    let _bloomPass = null;
    let _aberrationPass = null;
    let _grainPass = null;
    let _glitchPass = null;

    let _resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

    // --- CUSTOM SHADERS ---

    const ChromaticAberrationShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "amount":   { value: 0.005 },
            "angle":    { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float amount;
            uniform float angle;
            varying vec2 vUv;

            void main() {
                vec2 offset = amount * vec2( cos(angle), sin(angle) );
                vec4 cr = texture2D(tDiffuse, vUv + offset);
                vec4 cga = texture2D(tDiffuse, vUv);
                vec4 cb = texture2D(tDiffuse, vUv - offset);
                gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);
            }
        `
    };

    const FilmGrainShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "time":     { value: 0.0 },
            "amount":   { value: 0.05 },
            "speed":    { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float time;
            uniform float amount;
            uniform float speed;
            varying vec2 vUv;

            float random(vec2 p) {
                vec2 k1 = vec2(23.14069263277926, 2.665144142690225);
                return fract(cos(dot(p, k1)) * 12345.6789);
            }

            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                vec2 uvRandom = vUv;
                uvRandom.y *= random(vec2(uvRandom.y, time * speed));
                color.rgb += random(uvRandom) * amount - (amount / 2.0);
                gl_FragColor = color;
            }
        `
    };

    const GlitchShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "time": { value: 0.0 },
            "amount": { value: 0.0 },
            "angle": { value: 0.02 },
            "seed": { value: 0.02 },
            "seed_x": { value: 0.02 },
            "seed_y": { value: 0.02 },
            "distortion_x": { value: 0.5 },
            "distortion_y": { value: 0.6 },
            "col_s": { value: 0.05 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float time;
            uniform float amount;
            varying vec2 vUv;

            float rand(vec2 co){
                return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
            }

            void main() {
                vec2 p = vUv;
                float xs = floor(gl_FragCoord.x / 0.5);
                float ys = floor(gl_FragCoord.y / 0.5);
                
                // Blocky glitch if amount is high
                if (amount > 0.0) {
                    vec2 block = vec2(floor(p.x * 10.0) / 10.0, floor(p.y * 10.0) / 10.0);
                    float r = rand(block + time);
                    if (r < amount * 0.2) {
                        p.x += (rand(block) * 2.0 - 1.0) * amount * 0.1;
                    }
                }
                
                // Color shift
                vec4 normal = texture2D(tDiffuse, p);
                
                if (amount > 0.0) {
                    float shift = amount * 0.05;
                    vec4 cr = texture2D(tDiffuse, p + vec2(shift, 0.0));
                    vec4 cb = texture2D(tDiffuse, p - vec2(shift, 0.0));
                    gl_FragColor = vec4(cr.r, normal.g, cb.b, normal.a);
                } else {
                    gl_FragColor = normal;
                }
            }
        `
    };

    function init(renderer, scene, camera, width, height) {
        if (typeof THREE.EffectComposer === 'undefined') {
            console.warn("EffectComposer not found");
            return null;
        }

        _resolution.set(width, height);
        
        _composer = new THREE.EffectComposer(renderer);
        
        // 1. Scene Pass
        _renderPass = new THREE.RenderPass(scene, camera);
        _composer.addPass(_renderPass);

        // 2. Bloom Pass
        if (typeof THREE.UnrealBloomPass !== 'undefined') {
            _bloomPass = new THREE.UnrealBloomPass(_resolution, 0.8, 0.8, 0.1);
            _composer.addPass(_bloomPass);
        }

        // 3. Chromatic Aberration
        _aberrationPass = new THREE.ShaderPass(ChromaticAberrationShader);
        _aberrationPass.uniforms["amount"].value = 0.0;
        _composer.addPass(_aberrationPass);

        // 4. Glitch Pass
        _glitchPass = new THREE.ShaderPass(GlitchShader);
        _glitchPass.uniforms["amount"].value = 0.0;
        _composer.addPass(_glitchPass);

        // 5. Film Grain
        _grainPass = new THREE.ShaderPass(FilmGrainShader);
        _grainPass.uniforms["amount"].value = 0.0; // Dynamic based on intent/chaos
        _composer.addPass(_grainPass);

        return _composer;
    }

    function resize(width, height) {
        _resolution.set(width, height);
        if (_composer) _composer.setSize(width, height);
    }

    function update(dt, audioBus) {
        if (!_composer) return;

        // Base amounts
        let caAmount = 0.0;
        let grainAmount = 0.02; // Default slight grain
        let glitchAmount = 0.0;
        let bloomStrength = 0.5;
        let bloomRadius = 0.8;
        let bloomThreshold = 0.35;

        // Param overrides
        if (typeof ParamSystem !== 'undefined') {
            bloomStrength = ParamSystem.get('bloomIntensity') !== undefined ? ParamSystem.get('bloomIntensity') : 0.5;
            bloomRadius = ParamSystem.get('bloomRadius') !== undefined ? ParamSystem.get('bloomRadius') : 0.8;
            bloomThreshold = ParamSystem.get('bloomThreshold') !== undefined ? ParamSystem.get('bloomThreshold') : 0.35;
            
            caAmount = ParamSystem.get('chromaticAberration') !== undefined ? ParamSystem.get('chromaticAberration') : 0.0;
            grainAmount = ParamSystem.get('filmGrain') !== undefined ? ParamSystem.get('filmGrain') : 0.02;
            glitchAmount = ParamSystem.get('glitchIntensity') !== undefined ? ParamSystem.get('glitchIntensity') : 0.0;
        }

        // Audio reactivity
        let masterInt = 1.0;
        if (audioBus && audioBus.loaded) {
            _grainPass.uniforms["time"].value += dt;
            _glitchPass.uniforms["time"].value += dt;
            masterInt = audioBus.masterIntensity || 1.0;
            
            const effects = audioBus.sectionEffects || { bloom: 1 };
            bloomStrength *= effects.bloom;
            bloomStrength += (audioBus.bassBeatIntensity || 0) * 0.3 * masterInt;
        }

        // Cinematic Overrides from Orchestrator / Director
        let orchBloomScale = 1.0;
        if (typeof SceneOrchestrator !== 'undefined') {
            orchBloomScale = SceneOrchestrator.getBloomScale();
            const state = SceneOrchestrator.getCurrentState();
            
            // Tension state: increase grain and CA
            if (state === SceneOrchestrator.STATES.TENSION) {
                grainAmount += 0.05;
                caAmount += 0.005;
            }
            
            // Drop state: extreme bloom and slight glitch
            if (state === SceneOrchestrator.STATES.DROP) {
                if (audioBus && audioBus.bassBeat) {
                    glitchAmount = (audioBus.bassBeatIntensity || 0) * 0.5;
                    caAmount += (audioBus.bassBeatIntensity || 0) * 0.02;
                }
            }
        }

        // Apply uniforms
        if (_bloomPass) {
            _bloomPass.strength = Math.min(2.5, bloomStrength * orchBloomScale);
            _bloomPass.radius = bloomRadius;
            _bloomPass.threshold = bloomThreshold;
        }
        if (_aberrationPass) _aberrationPass.uniforms["amount"].value = caAmount;
        if (_grainPass) _grainPass.uniforms["amount"].value = grainAmount;
        if (_glitchPass) _glitchPass.uniforms["amount"].value = glitchAmount;
    }

    function render(dt) {
        if (_composer) _composer.render(dt);
    }

    return {
        init,
        resize,
        update,
        render,
        get composer() { return _composer; },
        get passes() {
            return {
                bloom: _bloomPass,
                aberration: _aberrationPass,
                grain: _grainPass,
                glitch: _glitchPass
            };
        }
    };
})();
