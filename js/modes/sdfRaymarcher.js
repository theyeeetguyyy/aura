// ============================================================
// AURA Mode — SDF Raymarcher
// Fullscreen GLSL raymarched signed-distance-field geometry
// with audio-reactive morphing, boolean ops, glow, and fog
// ============================================================

const SDFRaymarcherMode = {
    name: 'SDF Raymarcher',
    mesh: null,
    material: null,
    time: 0,

    params: {
        shape: { type: 'select', options: ['sphere', 'torus', 'gyroid', 'octahedron', 'capsule', 'knot', 'compound'], default: 'gyroid', label: '🔷 Shape' },
        boolOp: { type: 'select', options: ['smoothUnion', 'union', 'intersection', 'subtraction'], default: 'smoothUnion', label: '🔗 Boolean Op' },
        morphAmount: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.05, label: '🌀 Morph' },
        rotationSpeed: { type: 'range', min: 0, max: 3, default: 0.8, step: 0.05, label: '🔄 Rotation' },
        glowIntensity: { type: 'range', min: 0, max: 5, default: 1.5, step: 0.1, label: '✨ Glow' },
        smoothness: { type: 'range', min: 0.01, max: 1.5, default: 0.3, step: 0.01, label: '🫧 Smoothness' },
        repetition: { type: 'range', min: 0, max: 5, default: 0, step: 1, label: '🔁 Repeat' },
        displacementScale: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.05, label: '💥 Displacement' },
        colorMode: { type: 'select', options: ['normals', 'orbit', 'frequency', 'depth', 'fresnel'], default: 'orbit', label: '🎨 Color' },
        fogDensity: { type: 'range', min: 0, max: 1, default: 0.15, step: 0.01, label: '🌫️ Fog' },
        aoStrength: { type: 'range', min: 0, max: 2, default: 0.8, step: 0.1, label: '🌑 AO' },
        beatDisplace: { type: 'toggle', default: true, label: '🥁 Beat Displace' },
        innerStructure: { type: 'toggle', default: true, label: '🏗️ Inner Structure' },
        animateJulia: { type: 'toggle', default: false, label: '🌈 Julia Animate' },
        specularPower: { type: 'range', min: 1, max: 64, default: 16, step: 1, label: '💎 Specular' }
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
            uniform float uSpectralCentroid;

            // Params
            uniform int uShape;
            uniform int uBoolOp;
            uniform float uMorph;
            uniform float uRotSpeed;
            uniform float uGlow;
            uniform float uSmoothness;
            uniform float uRepetition;
            uniform float uDisplacement;
            uniform int uColorMode;
            uniform float uFog;
            uniform float uAO;
            uniform bool uBeatDisplace;
            uniform bool uInnerStructure;
            uniform bool uAnimateJulia;
            uniform float uSpecular;

            varying vec2 vUv;

            #define PI 3.14159265359
            #define MAX_STEPS 80
            #define MAX_DIST 50.0
            #define SURF_DIST 0.002
            #define TAU 6.28318530718

            // ── Rotation matrices ──
            mat2 rot2D(float a) {
                float s = sin(a), c = cos(a);
                return mat2(c, -s, s, c);
            }

            mat3 rotateY(float a) {
                float s = sin(a), c = cos(a);
                return mat3(c,0,s, 0,1,0, -s,0,c);
            }

            mat3 rotateX(float a) {
                float s = sin(a), c = cos(a);
                return mat3(1,0,0, 0,c,-s, 0,s,c);
            }

            // ── SDF Primitives ──
            float sdSphere(vec3 p, float r) {
                return length(p) - r;
            }

            float sdTorus(vec3 p, vec2 t) {
                vec2 q = vec2(length(p.xz) - t.x, p.y);
                return length(q) - t.y;
            }

            float sdBox(vec3 p, vec3 b) {
                vec3 q = abs(p) - b;
                return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
            }

            float sdOctahedron(vec3 p, float s) {
                p = abs(p);
                float m = p.x + p.y + p.z - s;
                vec3 q;
                if (3.0 * p.x < m) q = p.xyz;
                else if (3.0 * p.y < m) q = p.yzx;
                else if (3.0 * p.z < m) q = p.zxy;
                else return m * 0.57735027;
                float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
                return length(vec3(q.x, q.y - s + k, q.z - k));
            }

            float sdCapsule(vec3 p, float h, float r) {
                p.y -= clamp(p.y, 0.0, h);
                return length(p) - r;
            }

            float sdGyroid(vec3 p, float scale, float thickness) {
                p *= scale;
                return (abs(dot(sin(p), cos(p.zxy))) - thickness) / scale;
            }

            float sdKnot(vec3 p, float ra, float rb) {
                float d = length(p.xz);
                float a = atan(p.z, p.x);
                // Trefoil knot
                vec3 q = vec3(d - ra, p.y, 0.0);
                q.xy = rot2D(a * 1.5) * q.xy;
                q.x = abs(q.x) - ra * 0.3;
                return length(q) - rb;
            }

            // ── Boolean Operations ──
            float opUnion(float d1, float d2) { return min(d1, d2); }

            float opSmoothUnion(float d1, float d2, float k) {
                float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
                return mix(d2, d1, h) - k * h * (1.0 - h);
            }

            float opIntersection(float d1, float d2) { return max(d1, d2); }

            float opSubtraction(float d1, float d2) { return max(-d1, d2); }

            // ── Noise for displacement ──
            float hash(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float noise3D(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
                    f.z
                );
            }

            float fbm(vec3 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 4; i++) {
                    v += a * noise3D(p);
                    p = p * 2.0 + 0.1;
                    a *= 0.5;
                }
                return v;
            }

            // ── Apply domain repetition ──
            vec3 repeat(vec3 p, float s) {
                return mod(p + s * 0.5, s) - s * 0.5;
            }

            // ── Scene SDF ──
            float getShape(vec3 p, int shape, float morph) {
                float t = uTime * 0.3;

                if (shape == 0) { // sphere
                    float r = 1.2 + sin(t) * morph * 0.3;
                    return sdSphere(p, r);
                }
                if (shape == 1) { // torus
                    vec2 dims = vec2(1.0 + morph * 0.3, 0.35 + sin(t) * morph * 0.15);
                    return sdTorus(p, dims);
                }
                if (shape == 2) { // gyroid
                    float scale = 3.0 + morph;
                    float thick = 0.03 + morph * 0.02 + uBass * 0.05;
                    return sdGyroid(p, scale, thick);
                }
                if (shape == 3) { // octahedron
                    return sdOctahedron(p, 1.3 + morph * 0.2);
                }
                if (shape == 4) { // capsule
                    return sdCapsule(p - vec3(0, -0.5, 0), 1.0 + morph * 0.3, 0.4 + sin(t) * 0.1);
                }
                if (shape == 5) { // knot
                    return sdKnot(p, 1.0 + morph * 0.2, 0.2 + sin(t) * 0.05);
                }
                // compound — mix multiple
                float d1 = sdSphere(p, 1.0);
                float d2 = sdTorus(p, vec2(1.2, 0.3));
                float d3 = sdOctahedron(p, 1.1);
                float d = opSmoothUnion(d1, d2, 0.3 + morph * 0.3);
                d = opSmoothUnion(d, d3, 0.5);
                return d;
            }

            float sceneSDF(vec3 p) {
                // Rotation
                float rotAngle = uTime * uRotSpeed;
                float audioRot = uBass * 0.5 + uMid * 0.3;
                p = rotateY(rotAngle + audioRot) * p;
                p = rotateX(rotAngle * 0.3 + uTreble * 0.2) * p;

                // Domain repetition
                vec3 rp = p;
                if (uRepetition > 0.5) {
                    float spacing = 4.0 + (5.0 - uRepetition);
                    rp = repeat(p, spacing);
                }

                // Primary shape
                float morph = uMorph + uMid * 0.5;
                float d = getShape(rp, uShape, morph);

                // Inner structure
                if (uInnerStructure) {
                    float inner = sdGyroid(rp, 5.0 + uTreble * 3.0, 0.02 + uBass * 0.03);
                    if (uBoolOp == 0) d = opSmoothUnion(d, inner, uSmoothness);
                    else if (uBoolOp == 1) d = opUnion(d, inner);
                    else if (uBoolOp == 2) d = opIntersection(d, inner);
                    else d = opSubtraction(inner, d);
                }

                // Audio displacement
                float disp = uDisplacement * (1.0 + uBass * 2.0);
                if (uBeatDisplace) {
                    disp += uBeatIntensity * 0.5 + uDropDecay * 0.8;
                }
                if (disp > 0.001) {
                    float n = fbm(rp * 2.0 + uTime * 0.5) - 0.5;
                    d += n * disp * 0.3;
                }

                return d;
            }

            // ── Raymarching ──
            float rayMarch(vec3 ro, vec3 rd) {
                float d = 0.0;
                for (int i = 0; i < MAX_STEPS; i++) {
                    vec3 p = ro + rd * d;
                    float ds = sceneSDF(p);
                    d += ds;
                    if (abs(ds) < SURF_DIST || d > MAX_DIST) break;
                }
                return d;
            }

            // ── Normal calculation ──
            vec3 getNormal(vec3 p) {
                vec2 e = vec2(0.003, 0.0);
                return normalize(vec3(
                    sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
                    sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
                    sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
                ));
            }

            // ── Ambient Occlusion ──
            float calcAO(vec3 p, vec3 n) {
                float occ = 0.0;
                float sca = 1.0;
                for (int i = 0; i < 5; i++) {
                    float h = 0.02 + 0.12 * float(i);
                    float d = sceneSDF(p + h * n);
                    occ += (h - d) * sca;
                    sca *= 0.75;
                }
                return clamp(1.0 - uAO * occ, 0.0, 1.0);
            }

            // ── HSV to RGB ──
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            // ── Palette ──
            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.263, 0.416, 0.557);
                return a + b * cos(TAU * (c * t + d));
            }

            // ── Coloring ──
            vec3 getColor(vec3 p, vec3 n, vec3 rd, float d, int mode) {
                if (mode == 0) { // normals
                    return n * 0.5 + 0.5;
                }
                if (mode == 1) { // orbit trap
                    float orbit = length(p) * 0.5 + uTime * 0.1;
                    return palette(orbit + uBass * 0.3);
                }
                if (mode == 2) { // frequency
                    float hue = uBass * 0.3 + uMid * 0.3 + uTreble * 0.3 + uTime * 0.05;
                    return hsv2rgb(vec3(hue, 0.7 + uRMS * 0.3, 0.8 + uBeatIntensity * 0.2));
                }
                if (mode == 3) { // depth
                    float depth = 1.0 - d / MAX_DIST;
                    return palette(depth + uTime * 0.05);
                }
                // fresnel
                float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
                float hue = fresnel * 0.5 + uTime * 0.1 + uBass * 0.2;
                return hsv2rgb(vec3(hue, 0.8, 0.5 + fresnel * 0.5));
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0;
                uv.x *= 1.7778; // 16:9

                // Camera
                float camDist = 3.5 + sin(uTime * 0.2) * 0.5 - uBass * 0.3;
                vec3 ro = vec3(0.0, 0.0, camDist);
                vec3 rd = normalize(vec3(uv, -1.5));

                // Camera sway
                float swayX = sin(uTime * 0.4) * 0.1 * (1.0 + uWobbleLFO * 0.3);
                float swayY = cos(uTime * 0.3) * 0.08;
                rd.xy = rot2D(swayX) * rd.xy;
                rd.yz = rot2D(swayY) * rd.yz;

                // Raymarch
                float d = rayMarch(ro, rd);

                vec3 col = vec3(0.0);

                if (d < MAX_DIST) {
                    vec3 p = ro + rd * d;
                    vec3 n = getNormal(p);

                    // Lighting
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
                    vec3 lightDir2 = normalize(vec3(-1.0, -0.5, -0.3));
                    float diff = max(dot(n, lightDir), 0.0);
                    float diff2 = max(dot(n, lightDir2), 0.0) * 0.3;

                    // Specular
                    vec3 halfVec = normalize(lightDir - rd);
                    float spec = pow(max(dot(n, halfVec), 0.0), uSpecular);

                    // AO
                    float ao = calcAO(p, n);

                    // Color
                    vec3 baseColor = getColor(p, n, rd, d, uColorMode);

                    col = baseColor * (diff + diff2 + 0.15) * ao;
                    col += spec * 0.5 * (1.0 + uTreble);

                    // Fresnel rim light
                    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
                    col += fresnel * uGlow * 0.3 * palette(uTime * 0.1 + uBass);

                    // Edge glow
                    col += fresnel * vec3(0.3, 0.1, 0.8) * uGlow * (0.5 + uBeatIntensity);

                    // Fog
                    float fog = 1.0 - exp(-d * uFog * 0.3);
                    vec3 fogColor = palette(uTime * 0.03 + 0.5) * 0.1;
                    col = mix(col, fogColor, fog);
                } else {
                    // Background — subtle grid + glow
                    float bgGlow = exp(-length(uv) * 1.5) * uGlow * 0.2;
                    col = palette(uTime * 0.02) * bgGlow;

                    // Subtle radial lines
                    float a = atan(uv.y, uv.x);
                    float rays = abs(sin(a * 8.0 + uTime * 0.5));
                    col += rays * 0.02 * uRMS;
                }

                // Beat flash
                col += uBeatIntensity * 0.15 * vec3(0.5, 0.3, 1.0);

                // Drop burst
                col += uDropDecay * 0.3 * vec3(1.0, 0.5, 0.2);

                // Vignette
                float vig = 1.0 - length(vUv - 0.5) * 0.8;
                col *= vig;

                // Tone mapping
                col = col / (col + 1.0);
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
                uEnvelope: { value: 0 }, uSpectralCentroid: { value: 0 },
                uShape: { value: 2 }, uBoolOp: { value: 0 },
                uMorph: { value: 0.5 }, uRotSpeed: { value: 0.8 },
                uGlow: { value: 1.5 }, uSmoothness: { value: 0.3 },
                uRepetition: { value: 0 }, uDisplacement: { value: 0.3 },
                uColorMode: { value: 1 }, uFog: { value: 0.15 },
                uAO: { value: 0.8 }, uBeatDisplace: { value: true },
                uInnerStructure: { value: true }, uAnimateJulia: { value: false },
                uSpecular: { value: 16.0 }
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
        u.uSpectralCentroid.value = audio.spectralCentroid || 0;

        // Params
        const shapes = ['sphere', 'torus', 'gyroid', 'octahedron', 'capsule', 'knot', 'compound'];
        u.uShape.value = shapes.indexOf(params.shape || 'gyroid');
        const ops = ['smoothUnion', 'union', 'intersection', 'subtraction'];
        u.uBoolOp.value = ops.indexOf(params.boolOp || 'smoothUnion');
        u.uMorph.value = params.morphAmount ?? 0.5;
        u.uRotSpeed.value = params.rotationSpeed ?? 0.8;
        u.uGlow.value = params.glowIntensity ?? 1.5;
        u.uSmoothness.value = params.smoothness ?? 0.3;
        u.uRepetition.value = params.repetition ?? 0;
        u.uDisplacement.value = params.displacementScale ?? 0.3;
        const colors = ['normals', 'orbit', 'frequency', 'depth', 'fresnel'];
        u.uColorMode.value = colors.indexOf(params.colorMode || 'orbit');
        u.uFog.value = params.fogDensity ?? 0.15;
        u.uAO.value = params.aoStrength ?? 0.8;
        u.uBeatDisplace.value = params.beatDisplace !== false;
        u.uInnerStructure.value = params.innerStructure !== false;
        u.uAnimateJulia.value = params.animateJulia || false;
        u.uSpecular.value = params.specularPower ?? 16;
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
