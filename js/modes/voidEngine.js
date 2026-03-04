// ============================================================
// AURA Mode — Void Engine
// The "boss mode" — raymarched black hole with gravitational
// lensing, accretion disk, relativistic jets, nebula glow,
// spacetime ripples — all audio-reactive
// ============================================================

const VoidEngineMode = {
    name: 'Void Engine',
    mesh: null,
    material: null,
    time: 0,

    params: {
        holeSize: { type: 'range', min: 0.1, max: 2, default: 0.4, step: 0.05, label: '🕳️ Hole Size' },
        lensStrength: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '🔭 Lensing' },
        diskSpeed: { type: 'range', min: 0, max: 5, default: 1.5, step: 0.1, label: '💫 Disk Speed' },
        diskLayers: { type: 'range', min: 1, max: 6, default: 3, step: 1, label: '📐 Disk Layers' },
        diskWidth: { type: 'range', min: 0.2, max: 3, default: 1, step: 0.1, label: '📏 Disk Width' },
        jetIntensity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🚀 Jets' },
        jetSpread: { type: 'range', min: 0.05, max: 0.5, default: 0.15, step: 0.01, label: '📐 Jet Spread' },
        starDensity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '⭐ Stars' },
        spacetimeRipple: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '🌊 Ripples' },
        colorScheme: { type: 'select', options: ['inferno', 'cosmic', 'plasma', 'ice', 'void', 'golden'], default: 'inferno', label: '🎨 Colors' },
        warpIntensity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🌀 Warp' },
        nebulaGlow: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '🌌 Nebula' },
        cameraOrbit: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.05, label: '🎥 Orbit' },
        eventHorizonGlow: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '✨ EH Glow' },
        dopplerShift: { type: 'toggle', default: true, label: '🔴🔵 Doppler' }
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

            uniform float uHoleSize;
            uniform float uLensStrength;
            uniform float uDiskSpeed;
            uniform float uDiskLayers;
            uniform float uDiskWidth;
            uniform float uJetIntensity;
            uniform float uJetSpread;
            uniform float uStarDensity;
            uniform float uRipple;
            uniform int uColorScheme;
            uniform float uWarp;
            uniform float uNebula;
            uniform float uOrbit;
            uniform float uEHGlow;
            uniform bool uDoppler;

            varying vec2 vUv;

            #define PI 3.14159265359
            #define TAU 6.28318530718

            mat2 rot2D(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            // ── Hash ──
            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            float hash3(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            // ── 2D Noise ──
            float noise2D(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            // ── FBM ──
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
                for (int i = 0; i < 5; i++) {
                    v += a * noise2D(p);
                    p = rot * p * 2.0 + 0.1;
                    a *= 0.5;
                }
                return v;
            }

            // ── Star field ──
            float stars(vec2 uv, float density) {
                vec2 cell = floor(uv * 80.0 * density);
                vec2 local = fract(uv * 80.0 * density);
                float star = hash(cell);
                if (star > 0.97) {
                    vec2 center = vec2(hash(cell + 0.1), hash(cell + 0.2));
                    float dist = length(local - center);
                    float brightness = star * 10.0 - 9.7;
                    float twinkle = 0.7 + 0.3 * sin(uTime * 3.0 + star * 100.0);
                    return smoothstep(0.05, 0.0, dist) * brightness * twinkle;
                }
                return 0.0;
            }

            // ── Color palettes ──
            vec3 infernoColor(float t) {
                t = clamp(t, 0.0, 1.0);
                // Inferno-inspired: black → purple → red → orange → yellow → white
                vec3 c0 = vec3(0.0, 0.0, 0.04);
                vec3 c1 = vec3(0.4, 0.0, 0.5);
                vec3 c2 = vec3(0.9, 0.15, 0.15);
                vec3 c3 = vec3(1.0, 0.6, 0.0);
                vec3 c4 = vec3(1.0, 1.0, 0.7);

                if (t < 0.25) return mix(c0, c1, t * 4.0);
                if (t < 0.5) return mix(c1, c2, (t - 0.25) * 4.0);
                if (t < 0.75) return mix(c2, c3, (t - 0.5) * 4.0);
                return mix(c3, c4, (t - 0.75) * 4.0);
            }

            vec3 cosmicColor(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 0.7, 0.4);
                vec3 d = vec3(0.0, 0.15, 0.2);
                return a + b * cos(TAU * (c * t + d));
            }

            vec3 plasmaColor(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(2.0, 1.0, 0.0);
                vec3 d = vec3(0.5, 0.2, 0.25);
                return a + b * cos(TAU * (c * t + d));
            }

            vec3 getSchemeColor(float t, int scheme) {
                if (scheme == 0) return infernoColor(t);
                if (scheme == 1) return cosmicColor(t);
                if (scheme == 2) return plasmaColor(t);
                if (scheme == 3) { // ice
                    return mix(vec3(0.0, 0.0, 0.2), vec3(0.7, 0.9, 1.0), t) + vec3(0.0, 0.1, 0.3) * t * t;
                }
                if (scheme == 4) { // void
                    return mix(vec3(0.0), vec3(0.4, 0.0, 0.6), t * t) + vec3(0.1, 0.0, 0.2) * t;
                }
                // golden
                return mix(vec3(0.1, 0.05, 0.0), vec3(1.0, 0.8, 0.3), t);
            }

            // ── Accretion disk ──
            vec3 accretionDisk(vec2 uv, float angle, float dist, float effectiveHoleSize) {
                float diskInner = effectiveHoleSize * 1.5;
                float diskOuter = effectiveHoleSize * 1.5 + uDiskWidth * 2.0;

                if (dist < diskInner || dist > diskOuter) return vec3(0.0);

                float diskT = (dist - diskInner) / (diskOuter - diskInner);

                vec3 totalDisk = vec3(0.0);
                float layerCount = uDiskLayers;

                for (float layer = 0.0; layer < 6.0; layer++) {
                    if (layer >= layerCount) break;

                    float layerOffset = layer * 0.15;
                    float speed = uDiskSpeed * (1.0 + layer * 0.3) * (1.0 + uBass * 0.5);

                    // Disk pattern — spiral noise
                    float diskAngle = angle + uTime * speed + layer * 1.3;
                    vec2 diskUV = vec2(diskAngle / TAU, diskT + layerOffset);

                    float pattern = fbm(diskUV * vec2(6.0, 3.0) + uTime * 0.2);
                    pattern += noise2D(diskUV * vec2(12.0, 6.0) + uTime * 0.5) * 0.3;

                    // Radial falloff
                    float radialFade = sin(diskT * PI) * (1.0 - diskT * 0.5);

                    // Audio modulation
                    float audioMod = 1.0 + uMid * sin(diskAngle * 4.0 + layer) * 0.5;

                    float intensity = pattern * radialFade * audioMod;
                    intensity *= 1.0 / (1.0 + layer * 0.3);

                    // Color
                    float colorT = diskT * 0.7 + pattern * 0.3 + uTime * 0.02;
                    vec3 diskColor = getSchemeColor(colorT, uColorScheme);

                    // Doppler shift
                    if (uDoppler) {
                        float dopplerFactor = sin(angle + uTime * speed) * 0.3;
                        diskColor = mix(diskColor, diskColor * vec3(1.0 + dopplerFactor, 1.0, 1.0 - dopplerFactor), 0.5);
                    }

                    totalDisk += diskColor * intensity;
                }

                // Beat pulse along disk
                float beatRing = smoothstep(0.02, 0.0, abs(diskT - fract(uTime * 0.5 + uBeatIntensity)) - 0.02);
                totalDisk += beatRing * uBeatIntensity * vec3(1.0, 0.5, 0.3);

                return totalDisk;
            }

            // ── Relativistic jets ──
            vec3 jets(vec2 uv, float effectiveHoleSize) {
                if (uJetIntensity < 0.01) return vec3(0.0);

                vec3 jetCol = vec3(0.0);

                // Two jets — top and bottom
                for (float dir = -1.0; dir <= 1.0; dir += 2.0) {
                    // Jet axis
                    float jetX = abs(uv.x);
                    float jetY = uv.y * dir;

                    if (jetY < 0.0) continue;

                    // Cone shape
                    float coneWidth = uJetSpread * jetY;
                    float inJet = smoothstep(coneWidth, coneWidth * 0.5, jetX);

                    if (inJet < 0.01) continue;

                    // Internal structure
                    float jetLen = jetY;
                    float pattern = noise2D(vec2(jetLen * 10.0 + uTime * 3.0, uv.x * 20.0)) * 0.5 + 0.5;
                    pattern *= noise2D(vec2(jetLen * 5.0 + uTime * 1.5, uv.x * 10.0 + 5.0)) * 0.5 + 0.5;

                    // Fade with distance
                    float fade = exp(-jetLen * 2.0);

                    // Audio modulation
                    float audioBoost = 1.0 + uTreble * 2.0 + uBeatIntensity;

                    float intensity = inJet * pattern * fade * uJetIntensity * audioBoost;

                    // Jet color — hot core, cooler edges
                    vec3 core = getSchemeColor(0.9 + uTime * 0.05, uColorScheme);
                    vec3 edge = getSchemeColor(0.3 + jetLen * 0.5, uColorScheme);
                    vec3 jColor = mix(core, edge, jetX / coneWidth);

                    jetCol += jColor * intensity;
                }

                return jetCol;
            }

            // ── Background nebula ──
            vec3 nebula(vec2 uv) {
                if (uNebula < 0.01) return vec3(0.0);

                float n1 = fbm(uv * 2.0 + uTime * 0.05);
                float n2 = fbm(uv * 3.0 + vec2(5.0, 3.0) + uTime * 0.03);

                float nebPattern = n1 * n2;
                nebPattern = pow(nebPattern, 1.5);

                vec3 nebCol = getSchemeColor(nebPattern + uTime * 0.01, uColorScheme) * 0.3;
                nebCol += getSchemeColor(n1 * 0.5 + 0.5, uColorScheme) * 0.1;

                return nebCol * uNebula * (0.5 + uRMS * 0.5);
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= 1.7778;

                // Camera orbit
                float orbitAngle = uTime * uOrbit;
                uv = rot2D(orbitAngle * 0.1 + sin(uTime * 0.15) * 0.2) * uv;

                // Spacetime ripples
                if (uRipple > 0.01) {
                    float dist = length(uv);
                    float ripple = sin(dist * 10.0 - uTime * 3.0) * uRipple * 0.02 * (1.0 + uBeatIntensity * 2.0);
                    uv += normalize(uv + 0.001) * ripple;

                    // Drop shockwave
                    float shockRadius = uDropDecay * 3.0;
                    float shock = smoothstep(0.1, 0.0, abs(dist - shockRadius)) * uDropDecay;
                    uv += normalize(uv + 0.001) * shock * 0.1;
                }

                // Core distance
                float dist = length(uv);
                float angle = atan(uv.y, uv.x);

                // Effective hole size with audio
                float effectiveHoleSize = uHoleSize * (1.0 + uSub * 0.5 + uBass * 0.3);

                // ── Gravitational lensing ──
                vec2 lensedUV = uv;
                if (uLensStrength > 0.01) {
                    float schwarzschild = effectiveHoleSize * 0.5;
                    float lensR = max(dist, 0.01);
                    float deflection = uLensStrength * schwarzschild * schwarzschild / (lensR * lensR);
                    deflection = min(deflection, 2.0); // clamp for stability

                    // Warp UV toward center
                    lensedUV = uv * (1.0 + deflection);

                    // Additional audio warp
                    float audioWarp = uWarp * uBass * 0.1;
                    float warpAngle = angle + uTime * 0.5;
                    lensedUV += vec2(cos(warpAngle), sin(warpAngle)) * audioWarp / (dist + 0.5);
                }

                // ── Background: stars + nebula through lensed coordinates ──
                vec3 col = vec3(0.0);

                // Stars (seen through gravitational lens)
                float starField = stars(lensedUV, uStarDensity);
                col += vec3(starField);

                // Lensed star ring (Einstein ring)
                float ringDist = abs(dist - effectiveHoleSize * 2.0);
                float einsteinRing = smoothstep(0.15, 0.0, ringDist) * uLensStrength * 0.3;
                col += getSchemeColor(0.7 + uTime * 0.05, uColorScheme) * einsteinRing;

                // Nebula
                col += nebula(lensedUV);

                // ── Accretion disk ──
                vec3 disk = accretionDisk(uv, angle, dist, effectiveHoleSize);
                col += disk;

                // ── Relativistic jets ──
                col += jets(uv, effectiveHoleSize);

                // ── Event horizon ──
                float ehDist = dist / effectiveHoleSize;
                if (ehDist < 1.0) {
                    // Inside event horizon — darkness
                    float darkness = smoothstep(1.0, 0.3, ehDist);
                    col *= (1.0 - darkness);

                    // Inner glow
                    float innerGlow = exp(-ehDist * 5.0) * uRMS * 0.5;
                    col += getSchemeColor(0.1 + uTime * 0.02, uColorScheme) * innerGlow;
                }

                // Event horizon glow ring
                float ehGlow = exp(-abs(ehDist - 1.0) * 10.0) * uEHGlow;
                ehGlow *= 1.0 + uBeatIntensity * 2.0 + uBass;
                vec3 glowColor = getSchemeColor(0.8 + sin(angle * 3.0 + uTime) * 0.1, uColorScheme);
                col += glowColor * ehGlow;

                // Photon sphere glow
                float photonSphere = exp(-abs(ehDist - 1.5) * 8.0) * uEHGlow * 0.5;
                col += getSchemeColor(0.6 + uTime * 0.03, uColorScheme) * photonSphere;

                // ── Beat and drop effects ──
                col += uBeatIntensity * 0.1 * getSchemeColor(uTime * 0.1, uColorScheme);

                // Drop — flash from center
                float dropFlash = uDropDecay * exp(-dist * 3.0);
                col += getSchemeColor(0.9, uColorScheme) * dropFlash * 2.0;

                // ── Vignette ──
                float vig = 1.0 - length(vUv - 0.5) * 0.7;
                col *= vig;

                // ── Tone mapping ──
                col = 1.0 - exp(-col * 1.5);
                col = pow(col, vec3(0.9));

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
                uHighMid: { value: 0 },
                uHoleSize: { value: 0.4 }, uLensStrength: { value: 2.0 },
                uDiskSpeed: { value: 1.5 }, uDiskLayers: { value: 3.0 },
                uDiskWidth: { value: 1.0 }, uJetIntensity: { value: 1.0 },
                uJetSpread: { value: 0.15 }, uStarDensity: { value: 1.0 },
                uRipple: { value: 0.5 }, uColorScheme: { value: 0 },
                uWarp: { value: 1.0 }, uNebula: { value: 0.5 },
                uOrbit: { value: 0.3 }, uEHGlow: { value: 2.0 },
                uDoppler: { value: true }
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
        u.uRMS.value = audio.rms || 0;
        u.uBeatIntensity.value = audio.beatIntensity || 0;
        u.uDropDecay.value = audio.dropDecay || 0;
        u.uWobbleLFO.value = audio.wobbleLFO || 0;
        u.uEnvelope.value = audio.envelope || 0;

        // Params
        u.uHoleSize.value = params.holeSize ?? 0.4;
        u.uLensStrength.value = params.lensStrength ?? 2.0;
        u.uDiskSpeed.value = params.diskSpeed ?? 1.5;
        u.uDiskLayers.value = params.diskLayers ?? 3;
        u.uDiskWidth.value = params.diskWidth ?? 1.0;
        u.uJetIntensity.value = params.jetIntensity ?? 1.0;
        u.uJetSpread.value = params.jetSpread ?? 0.15;
        u.uStarDensity.value = params.starDensity ?? 1.0;
        u.uRipple.value = params.spacetimeRipple ?? 0.5;
        const schemes = ['inferno', 'cosmic', 'plasma', 'ice', 'void', 'golden'];
        u.uColorScheme.value = schemes.indexOf(params.colorScheme || 'inferno');
        u.uWarp.value = params.warpIntensity ?? 1.0;
        u.uNebula.value = params.nebulaGlow ?? 0.5;
        u.uOrbit.value = params.cameraOrbit ?? 0.3;
        u.uEHGlow.value = params.eventHorizonGlow ?? 2.0;
        u.uDoppler.value = params.dopplerShift !== false;
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
