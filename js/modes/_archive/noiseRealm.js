// ============================================================
// AURA Mode — Noise Realm
// Layered noise fields with domain warping, FBM, Worley, ridged
// multifractal — all audio-reactive via fragment shader
// ============================================================

const NoiseRealmMode = {
    name: 'Noise Realm',
    mesh: null,
    material: null,
    time: 0,

    params: {
        noiseType: { type: 'select', options: ['fbm', 'simplex', 'worley', 'ridged', 'turbulence', 'marble', 'electric'], default: 'fbm', label: '🌊 Noise Type' },
        octaves: { type: 'range', min: 1, max: 8, default: 5, step: 1, label: '📐 Octaves' },
        lacunarity: { type: 'range', min: 1.0, max: 4.0, default: 2.0, step: 0.1, label: '🔬 Lacunarity' },
        gain: { type: 'range', min: 0.1, max: 0.9, default: 0.5, step: 0.05, label: '📈 Gain' },
        warpStrength: { type: 'range', min: 0, max: 5, default: 1.5, step: 0.1, label: '🌀 Warp' },
        warpSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '⏩ Warp Speed' },
        colorCycle: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🎨 Color Cycle' },
        domainScale: { type: 'range', min: 0.5, max: 8, default: 3, step: 0.1, label: '🔎 Scale' },
        ridgeSharpness: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '⛰️ Ridge Sharp' },
        voidCenter: { type: 'toggle', default: false, label: '🕳️ Void Center' },
        layerBlend: { type: 'select', options: ['add', 'multiply', 'screen', 'overlay'], default: 'add', label: '🔀 Layer Blend' },
        animSpeed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🏃 Anim Speed' },
        saturation: { type: 'range', min: 0, max: 1.5, default: 0.8, step: 0.05, label: '🌈 Saturation' },
        brightness: { type: 'range', min: 0.2, max: 3, default: 1.2, step: 0.1, label: '💡 Brightness' },
        contrastBoost: { type: 'range', min: 0.5, max: 3, default: 1.2, step: 0.1, label: '🎭 Contrast' }
    },

    init(scene, camera, renderer) {
        camera.position.set(0, 0, 50);

        const vertShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragShader = `
            precision highp float;

            uniform float uTime;
            uniform float uBass;
            uniform float uMid;
            uniform float uTreble;
            uniform float uRMS;
            uniform float uBeatIntensity;
            uniform float uDropDecay;
            uniform float uWobbleLFO;
            uniform float uEnvelope;
            uniform float uSub;
            uniform float uHighMid;
            uniform float uBrilliance;

            uniform int uNoiseType;
            uniform float uOctaves;
            uniform float uLacunarity;
            uniform float uGain;
            uniform float uWarpStrength;
            uniform float uWarpSpeed;
            uniform float uColorCycle;
            uniform float uDomainScale;
            uniform float uRidgeSharpness;
            uniform bool uVoidCenter;
            uniform int uLayerBlend;
            uniform float uAnimSpeed;
            uniform float uSaturation;
            uniform float uBrightness;
            uniform float uContrast;

            varying vec2 vUv;

            #define PI 3.14159265359
            #define TAU 6.28318530718

            // ── Hash functions ──
            vec2 hash22(vec2 p) {
                p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
            }

            float hash21(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            vec3 hash33(vec3 p) {
                p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                         dot(p, vec3(269.5, 183.3, 246.1)),
                         dot(p, vec3(113.5, 271.9, 124.6)));
                return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
            }

            // ── Simplex-like noise 2D ──
            float simplex2D(vec2 p) {
                const float K1 = 0.366025404; // (sqrt(3)-1)/2
                const float K2 = 0.211324865; // (3-sqrt(3))/6

                vec2 i = floor(p + (p.x + p.y) * K1);
                vec2 a = p - i + (i.x + i.y) * K2;
                float m = step(a.y, a.x);
                vec2 o = vec2(m, 1.0 - m);
                vec2 b = a - o + K2;
                vec2 c = a - 1.0 + 2.0 * K2;

                vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
                vec3 n = h * h * h * h * vec3(
                    dot(a, hash22(i)),
                    dot(b, hash22(i + o)),
                    dot(c, hash22(i + 1.0))
                );

                return dot(n, vec3(70.0));
            }

            // ── Value noise 2D ──
            float valueNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                float a = hash21(i);
                float b = hash21(i + vec2(1.0, 0.0));
                float c = hash21(i + vec2(0.0, 1.0));
                float d = hash21(i + vec2(1.0, 1.0));

                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            // ── Worley / Cellular noise ──
            float worley(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float minDist = 1.0;

                for (int y = -1; y <= 1; y++) {
                    for (int x = -1; x <= 1; x++) {
                        vec2 neighbor = vec2(float(x), float(y));
                        vec2 point = hash22(i + neighbor) * 0.5 + 0.5;
                        point += sin(uTime * 0.5 + point * 6.28) * 0.15 * uBass;
                        float dist = length(neighbor + point - f);
                        minDist = min(minDist, dist);
                    }
                }
                return minDist;
            }

            // ── FBM ──
            float fbm(vec2 p, int octaves, float lac, float g) {
                float value = 0.0;
                float amp = 0.5;
                float freq = 1.0;
                for (int i = 0; i < 8; i++) {
                    if (i >= octaves) break;
                    value += amp * simplex2D(p * freq);
                    freq *= lac;
                    amp *= g;
                }
                return value;
            }

            // ── Ridged multifractal ──
            float ridged(vec2 p, int octaves, float lac, float g, float sharpness) {
                float value = 0.0;
                float amp = 0.5;
                float freq = 1.0;
                float prev = 1.0;
                for (int i = 0; i < 8; i++) {
                    if (i >= octaves) break;
                    float n = simplex2D(p * freq);
                    n = 1.0 - abs(n);
                    n = pow(n, 1.0 + sharpness);
                    n *= prev;
                    prev = n;
                    value += n * amp;
                    freq *= lac;
                    amp *= g;
                }
                return value;
            }

            // ── Turbulence ──
            float turb(vec2 p, int octaves, float lac, float g) {
                float value = 0.0;
                float amp = 0.5;
                float freq = 1.0;
                for (int i = 0; i < 8; i++) {
                    if (i >= octaves) break;
                    value += amp * abs(simplex2D(p * freq));
                    freq *= lac;
                    amp *= g;
                }
                return value;
            }

            // ── Get noise value based on type ──
            float getNoiseValue(vec2 p, int type, int octaves, float lac, float g) {
                if (type == 0) return fbm(p, octaves, lac, g) * 0.5 + 0.5;
                if (type == 1) return simplex2D(p * 2.0) * 0.5 + 0.5;
                if (type == 2) return worley(p * 2.0);
                if (type == 3) return ridged(p, octaves, lac, g, uRidgeSharpness);
                if (type == 4) return turb(p, octaves, lac, g);
                if (type == 5) { // marble
                    float n = fbm(p, octaves, lac, g);
                    return sin(p.x * 5.0 + n * 5.0 + uTime * 0.3) * 0.5 + 0.5;
                }
                // electric
                float w = worley(p * 3.0);
                float f = fbm(p, octaves, lac, g);
                return pow(max(0.0, 1.0 - w * 2.0), 3.0) + f * 0.3;
            }

            // ── Palette ──
            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.0, 0.33, 0.67);
                return a + b * cos(TAU * (c * t + d));
            }

            vec3 palette2(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(2.0, 1.0, 0.0);
                vec3 d = vec3(0.5, 0.2, 0.25);
                return a + b * cos(TAU * (c * t + d));
            }

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= 1.7778;

                float t = uTime * uAnimSpeed;

                // Domain scale
                vec2 p = uv * uDomainScale;

                // Domain warping — warp with audio
                float warpStr = uWarpStrength * (1.0 + uBass * 2.0 + uDropDecay * 3.0);
                float ws = uWarpSpeed;

                // First warp layer
                vec2 warp1 = vec2(
                    simplex2D(p + vec2(t * ws * 0.7, t * ws * 0.3)),
                    simplex2D(p + vec2(t * ws * 0.4 + 5.2, t * ws * 0.6 + 1.3))
                );

                // Second warp layer (warp of warp)
                vec2 warp2 = vec2(
                    simplex2D(p + warp1 * warpStr + vec2(1.7, 9.2) + t * ws * 0.2),
                    simplex2D(p + warp1 * warpStr + vec2(8.3, 2.8) + t * ws * 0.3)
                );

                vec2 warped = p + warp2 * warpStr;

                // Audio modulation of coordinates
                warped += vec2(uMid * sin(t * 2.0), uTreble * cos(t * 1.5)) * 0.5;

                // Wobble
                warped += vec2(uWobbleLFO * 0.3, uWobbleLFO * 0.2);

                // Get noise value
                int octaves = int(uOctaves);
                float n = getNoiseValue(warped, uNoiseType, octaves, uLacunarity, uGain);

                // Second layer for depth
                float n2 = getNoiseValue(warped * 1.5 + vec2(3.14, 2.72) + t * 0.1,
                                          uNoiseType, max(octaves - 2, 1), uLacunarity * 1.2, uGain);

                // Third layer — audio-reactive detail
                float n3 = getNoiseValue(warped * 3.0 + vec2(uBass * 2.0, uTreble * 2.0),
                                          uNoiseType, max(octaves - 3, 1), uLacunarity, uGain * 0.8);

                // Blend layers
                float combined;
                if (uLayerBlend == 0) combined = n * 0.6 + n2 * 0.3 + n3 * 0.1;
                else if (uLayerBlend == 1) combined = n * n2 * 2.0 + n3 * 0.2;
                else if (uLayerBlend == 2) combined = 1.0 - (1.0 - n) * (1.0 - n2) + n3 * 0.1;
                else { // overlay
                    combined = n < 0.5 ? 2.0 * n * n2 : 1.0 - 2.0 * (1.0 - n) * (1.0 - n2);
                    combined += n3 * 0.15;
                }

                // Void center
                if (uVoidCenter) {
                    float centerDist = length(uv);
                    float voidMask = smoothstep(0.2, 1.5, centerDist);
                    combined *= voidMask;
                    // Add glow around void
                    combined += exp(-centerDist * 3.0) * uBeatIntensity * 0.5;
                }

                // Contrast
                combined = pow(combined, uContrast);

                // Color mapping
                float colorT = combined * uColorCycle + uTime * 0.05;
                colorT += uBass * 0.2 + uHighMid * 0.1;

                vec3 col1 = palette(colorT);
                vec3 col2 = palette2(colorT + 0.3);

                // Blend palettes based on audio energy
                vec3 col = mix(col1, col2, uRMS * 0.5 + 0.25);
                col *= combined * uBrightness;

                // Audio glow
                col += uBeatIntensity * 0.2 * palette(uTime * 0.1);

                // Drop flash
                col += uDropDecay * 0.4 * vec3(1.0, 0.6, 0.2);

                // Saturation adjustment
                float lum = dot(col, vec3(0.299, 0.587, 0.114));
                col = mix(vec3(lum), col, uSaturation);

                // Edge darkening for depth
                float n_edge = simplex2D(warped * 0.5 + t * 0.1) * 0.5 + 0.5;
                col *= 0.8 + n_edge * 0.4;

                // Vignette
                float vig = 1.0 - length(vUv - 0.5) * 0.6;
                col *= vig;

                // Tone mapping
                col = col / (col + 1.0);

                gl_FragColor = vec4(col, 1.0);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            uniforms: {
                uTime: { value: 0 },
                uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
                uRMS: { value: 0 }, uBeatIntensity: { value: 0 },
                uDropDecay: { value: 0 }, uWobbleLFO: { value: 0 },
                uEnvelope: { value: 0 }, uSub: { value: 0 },
                uHighMid: { value: 0 }, uBrilliance: { value: 0 },
                uNoiseType: { value: 0 }, uOctaves: { value: 5.0 },
                uLacunarity: { value: 2.0 }, uGain: { value: 0.5 },
                uWarpStrength: { value: 1.5 }, uWarpSpeed: { value: 0.5 },
                uColorCycle: { value: 1.0 }, uDomainScale: { value: 3.0 },
                uRidgeSharpness: { value: 1.0 }, uVoidCenter: { value: false },
                uLayerBlend: { value: 0 }, uAnimSpeed: { value: 1.0 },
                uSaturation: { value: 0.8 }, uBrightness: { value: 1.2 },
                uContrast: { value: 1.2 }
            }
        });

        const geo = new THREE.PlaneGeometry(200, 200);
        this.mesh = new THREE.Mesh(geo, this.material);
        scene.add(this.mesh);
    },

    update(audio, params, dt) {
        if (!this.material) return;
        this.time += dt;
        const u = this.material.uniforms;
        u.uTime.value = this.time;

        // Audio
        u.uBass.value = (audio.smoothBands?.bass || 0) * (params.reactivity || 1);
        u.uMid.value = (audio.smoothBands?.mid || 0) * (params.reactivity || 1);
        u.uTreble.value = (audio.smoothBands?.treble || 0) * (params.reactivity || 1);
        u.uSub.value = (audio.smoothBands?.sub || 0) * (params.reactivity || 1);
        u.uHighMid.value = (audio.smoothBands?.highMid || 0) * (params.reactivity || 1);
        u.uBrilliance.value = (audio.smoothBands?.brilliance || 0) * (params.reactivity || 1);
        u.uRMS.value = audio.rms || 0;
        u.uBeatIntensity.value = audio.beatIntensity || 0;
        u.uDropDecay.value = audio.dropDecay || 0;
        u.uWobbleLFO.value = audio.wobbleLFO || 0;
        u.uEnvelope.value = audio.envelope || 0;

        // Params
        const types = ['fbm', 'simplex', 'worley', 'ridged', 'turbulence', 'marble', 'electric'];
        u.uNoiseType.value = types.indexOf(params.noiseType || 'fbm');
        u.uOctaves.value = params.octaves ?? 5;
        u.uLacunarity.value = params.lacunarity ?? 2.0;
        u.uGain.value = params.gain ?? 0.5;
        u.uWarpStrength.value = params.warpStrength ?? 1.5;
        u.uWarpSpeed.value = params.warpSpeed ?? 0.5;
        u.uColorCycle.value = params.colorCycle ?? 1.0;
        u.uDomainScale.value = params.domainScale ?? 3.0;
        u.uRidgeSharpness.value = params.ridgeSharpness ?? 1.0;
        u.uVoidCenter.value = params.voidCenter || false;
        const blends = ['add', 'multiply', 'screen', 'overlay'];
        u.uLayerBlend.value = blends.indexOf(params.layerBlend || 'add');
        u.uAnimSpeed.value = params.animSpeed ?? 1.0;
        u.uSaturation.value = params.saturation ?? 0.8;
        u.uBrightness.value = params.brightness ?? 1.2;
        u.uContrast.value = params.contrastBoost ?? 1.2;
    },

    destroy(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.material.dispose();
            this.mesh = null;
            this.material = null;
        }
    }
};
