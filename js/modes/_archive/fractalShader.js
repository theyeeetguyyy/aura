// ============================================================
// AURA Mode — Fractal Shader
// Fragment-shader fractals: Mandelbrot, Julia, Burning Ship,
// Tricorn, Newton — audio-driven exploration and coloring
// ============================================================

const FractalShaderMode = {
    name: 'Fractal Shader',
    mesh: null,
    material: null,
    time: 0,

    params: {
        fractalType: { type: 'select', options: ['mandelbrot', 'julia', 'burningShip', 'tricorn', 'newton', 'phoenix', 'mandelbox'], default: 'julia', label: '🔮 Fractal' },
        maxIterations: { type: 'range', min: 20, max: 300, default: 100, step: 10, label: '🔢 Iterations' },
        zoom: { type: 'range', min: 0.1, max: 10, default: 1.5, step: 0.1, label: '🔎 Zoom' },
        juliaReal: { type: 'range', min: -2, max: 2, default: -0.7, step: 0.01, label: 'Julia Re' },
        juliaImag: { type: 'range', min: -2, max: 2, default: 0.27, step: 0.01, label: 'Julia Im' },
        colorScheme: { type: 'select', options: ['ultraFractal', 'fire', 'ocean', 'cosmic', 'neon', 'monochrome', 'rainbow'], default: 'cosmic', label: '🎨 Colors' },
        orbitTrap: { type: 'toggle', default: false, label: '🎯 Orbit Trap' },
        escapeRadius: { type: 'range', min: 2, max: 20, default: 4, step: 0.5, label: '💫 Escape R' },
        rotationSpeed: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.05, label: '🔄 Rotation' },
        colorCycleSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '🌈 Color Speed' },
        audioZoom: { type: 'toggle', default: true, label: '🎵 Audio Zoom' },
        audioJulia: { type: 'toggle', default: true, label: '🎶 Audio Julia' },
        glowIntensity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '✨ Glow' },
        centerX: { type: 'range', min: -2, max: 2, default: -0.5, step: 0.01, label: '↔️ Center X' },
        centerY: { type: 'range', min: -2, max: 2, default: 0, step: 0.01, label: '↕️ Center Y' }
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

            uniform int uFractalType;
            uniform float uMaxIter;
            uniform float uZoom;
            uniform float uJuliaRe;
            uniform float uJuliaIm;
            uniform int uColorScheme;
            uniform bool uOrbitTrap;
            uniform float uEscapeR;
            uniform float uRotSpeed;
            uniform float uColorCycleSpeed;
            uniform bool uAudioZoom;
            uniform bool uAudioJulia;
            uniform float uGlow;
            uniform float uCenterX;
            uniform float uCenterY;

            varying vec2 vUv;

            #define PI 3.14159265359
            #define TAU 6.28318530718

            mat2 rot2D(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            // ── Color palettes ──
            vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
                return a + b * cos(TAU * (c * t + d));
            }

            vec3 getColor(float iter, float maxIter, float orbitDist, int scheme, float smooth_val) {
                float t = smooth_val / maxIter;

                if (scheme == 0) { // ultraFractal
                    return palette(t + uTime * uColorCycleSpeed * 0.05,
                        vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
                }
                if (scheme == 1) { // fire
                    return palette(t + uTime * uColorCycleSpeed * 0.05,
                        vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
                }
                if (scheme == 2) { // ocean
                    return palette(t + uTime * uColorCycleSpeed * 0.05,
                        vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(0.8, 0.8, 0.5), vec3(0.0, 0.2, 0.5));
                }
                if (scheme == 3) { // cosmic
                    vec3 col = palette(t + uTime * uColorCycleSpeed * 0.05,
                        vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(1.0, 1.0, 0.5), vec3(0.8, 0.9, 0.3));
                    col += vec3(0.1, 0.0, 0.2) * (1.0 - t);
                    return col;
                }
                if (scheme == 4) { // neon
                    return palette(t * 2.0 + uTime * uColorCycleSpeed * 0.05,
                        vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(1.0, 1.0, 1.0), vec3(0.3, 0.2, 0.2));
                }
                if (scheme == 5) { // monochrome
                    float v = pow(t, 0.5);
                    return vec3(v);
                }
                // rainbow
                float hue = t * 3.0 + uTime * uColorCycleSpeed * 0.1;
                vec3 col;
                col.r = 0.5 + 0.5 * sin(hue * TAU);
                col.g = 0.5 + 0.5 * sin(hue * TAU + TAU / 3.0);
                col.b = 0.5 + 0.5 * sin(hue * TAU + 2.0 * TAU / 3.0);
                return col;
            }

            // ── Complex multiplication ──
            vec2 cmul(vec2 a, vec2 b) {
                return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
            }

            // ── Complex division ──
            vec2 cdiv(vec2 a, vec2 b) {
                float denom = dot(b, b);
                return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / denom;
            }

            // ── Complex power ──
            vec2 cpow(vec2 z, float n) {
                float r = length(z);
                float theta = atan(z.y, z.x);
                return pow(r, n) * vec2(cos(n * theta), sin(n * theta));
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= 1.7778;

                // Zoom and centering
                float zoom = uZoom;
                if (uAudioZoom) {
                    zoom += uBass * 0.5 + uDropDecay * 2.0;
                }
                zoom = max(zoom, 0.01);

                vec2 center = vec2(uCenterX, uCenterY);
                vec2 c_coord = uv / zoom + center;

                // Rotation
                float angle = uTime * uRotSpeed + uWobbleLFO * 0.3;
                c_coord = rot2D(angle) * (c_coord - center) + center;

                // Julia constant with audio modulation
                vec2 juliaC = vec2(uJuliaRe, uJuliaIm);
                if (uAudioJulia) {
                    juliaC += vec2(
                        sin(uTime * 0.5) * uBass * 0.3 + uMid * 0.1,
                        cos(uTime * 0.7) * uTreble * 0.3 + uBeatIntensity * 0.1
                    );
                }

                // Iterate
                vec2 z, c;
                int maxIter = int(uMaxIter);
                float escR2 = uEscapeR * uEscapeR;

                // Set up based on fractal type
                if (uFractalType == 0) { // Mandelbrot
                    z = vec2(0.0);
                    c = c_coord;
                } else if (uFractalType == 1) { // Julia
                    z = c_coord;
                    c = juliaC;
                } else if (uFractalType == 2) { // Burning Ship
                    z = vec2(0.0);
                    c = c_coord;
                } else if (uFractalType == 3) { // Tricorn
                    z = vec2(0.0);
                    c = c_coord;
                } else if (uFractalType == 4) { // Newton (z^3 - 1)
                    z = c_coord;
                    c = juliaC;
                } else if (uFractalType == 5) { // Phoenix
                    z = c_coord;
                    c = juliaC;
                } else { // Mandelbox
                    z = c_coord;
                    c = juliaC;
                }

                float iter = 0.0;
                float minOrbitDist = 1e10;
                vec2 prevZ = z;

                for (int i = 0; i < 300; i++) {
                    if (i >= maxIter) break;

                    if (uFractalType == 0) { // Mandelbrot: z = z^2 + c
                        z = cmul(z, z) + c;
                    } else if (uFractalType == 1) { // Julia: z = z^2 + c
                        z = cmul(z, z) + c;
                    } else if (uFractalType == 2) { // Burning Ship
                        z = vec2(abs(z.x), abs(z.y));
                        z = cmul(z, z) + c;
                    } else if (uFractalType == 3) { // Tricorn
                        z = vec2(z.x, -z.y);
                        z = cmul(z, z) + c;
                    } else if (uFractalType == 4) { // Newton z^3 - 1
                        vec2 z3 = cmul(cmul(z, z), z);
                        vec2 dz = 3.0 * cmul(z, z);
                        if (length(dz) < 0.0001) break;
                        z = z - cdiv(z3 - vec2(1.0, 0.0), dz);
                        z += c * 0.01; // perturbation
                        if (length(z3 - vec2(1.0, 0.0)) < 0.001) break;
                    } else if (uFractalType == 5) { // Phoenix
                        vec2 newZ = cmul(z, z) + c.x + c.y * prevZ;
                        prevZ = z;
                        z = newZ;
                    } else { // Mandelbox-like
                        // Box fold
                        z = clamp(z, -1.0, 1.0) * 2.0 - z;
                        // Sphere fold
                        float r2 = dot(z, z);
                        if (r2 < 0.25) z *= 4.0;
                        else if (r2 < 1.0) z /= r2;
                        z = z * 2.0 + c_coord;
                    }

                    float r2 = dot(z, z);

                    // Orbit trap
                    if (uOrbitTrap) {
                        minOrbitDist = min(minOrbitDist, length(z - vec2(0.0, 0.0)));
                        minOrbitDist = min(minOrbitDist, abs(z.x));
                        minOrbitDist = min(minOrbitDist, abs(z.y));
                    }

                    if (uFractalType != 4 && r2 > escR2) break;

                    iter += 1.0;
                }

                // Smooth iteration count
                float smooth_val = iter;
                if (iter < float(maxIter) && uFractalType != 4) {
                    float log_zn = log(dot(z, z)) / 2.0;
                    float nu = log(log_zn / log(2.0)) / log(2.0);
                    smooth_val = iter + 1.0 - nu;
                }

                vec3 col;

                if (iter >= float(maxIter)) {
                    // Inside the set
                    col = vec3(0.0);
                    // Add subtle inner glow based on audio
                    col += vec3(0.05, 0.01, 0.1) * uRMS;
                } else {
                    // Outside — color based on iteration
                    if (uOrbitTrap) {
                        float orbitT = minOrbitDist * 2.0;
                        col = getColor(iter, float(maxIter), minOrbitDist, uColorScheme, orbitT * float(maxIter));
                        col *= pow(minOrbitDist, 0.3);
                    } else {
                        col = getColor(iter, float(maxIter), 0.0, uColorScheme, smooth_val);
                    }

                    // Glow based on iteration depth
                    float glowFactor = 1.0 / (1.0 + smooth_val * 0.01);
                    col += col * glowFactor * uGlow * 0.3;
                }

                // Beat flash
                col += uBeatIntensity * 0.12 * vec3(0.5, 0.3, 1.0);

                // Drop burst — brighten center
                float centerDist = length(uv);
                col += uDropDecay * 0.3 * exp(-centerDist * 2.0) * vec3(1.0, 0.6, 0.3);

                // Audio brightness modulation
                col *= 0.8 + uRMS * 0.4;

                // Vignette
                float vig = 1.0 - centerDist * 0.3;
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
                uEnvelope: { value: 0 },
                uFractalType: { value: 1 }, uMaxIter: { value: 100.0 },
                uZoom: { value: 1.5 }, uJuliaRe: { value: -0.7 },
                uJuliaIm: { value: 0.27 }, uColorScheme: { value: 3 },
                uOrbitTrap: { value: false }, uEscapeR: { value: 4.0 },
                uRotSpeed: { value: 0.3 }, uColorCycleSpeed: { value: 0.5 },
                uAudioZoom: { value: true }, uAudioJulia: { value: true },
                uGlow: { value: 1.0 }, uCenterX: { value: -0.5 },
                uCenterY: { value: 0.0 }
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
        u.uRMS.value = audio.rms || 0;
        u.uBeatIntensity.value = audio.beatIntensity || 0;
        u.uDropDecay.value = audio.dropDecay || 0;
        u.uWobbleLFO.value = audio.wobbleLFO || 0;
        u.uEnvelope.value = audio.envelope || 0;

        // Params
        const types = ['mandelbrot', 'julia', 'burningShip', 'tricorn', 'newton', 'phoenix', 'mandelbox'];
        u.uFractalType.value = types.indexOf(params.fractalType || 'julia');
        u.uMaxIter.value = params.maxIterations ?? 100;
        u.uZoom.value = params.zoom ?? 1.5;
        u.uJuliaRe.value = params.juliaReal ?? -0.7;
        u.uJuliaIm.value = params.juliaImag ?? 0.27;
        const schemes = ['ultraFractal', 'fire', 'ocean', 'cosmic', 'neon', 'monochrome', 'rainbow'];
        u.uColorScheme.value = schemes.indexOf(params.colorScheme || 'cosmic');
        u.uOrbitTrap.value = params.orbitTrap || false;
        u.uEscapeR.value = params.escapeRadius ?? 4.0;
        u.uRotSpeed.value = params.rotationSpeed ?? 0.3;
        u.uColorCycleSpeed.value = params.colorCycleSpeed ?? 0.5;
        u.uAudioZoom.value = params.audioZoom !== false;
        u.uAudioJulia.value = params.audioJulia !== false;
        u.uGlow.value = params.glowIntensity ?? 1.0;
        u.uCenterX.value = params.centerX ?? -0.5;
        u.uCenterY.value = params.centerY ?? 0.0;
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
