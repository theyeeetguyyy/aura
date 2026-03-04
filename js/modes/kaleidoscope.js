// ============================================================
// AURA Mode — Kaleidoscope V2
// Mirror symmetry shader with recursive depth, mandala,
// color inversion, center shapes, edge glow, beat zoom
// ============================================================

const KaleidoscopeMode = {
    name: 'Kaleidoscope',
    mesh: null,
    material: null,
    time: 0,

    params: {
        segments: { type: 'range', min: 2, max: 32, default: 8, step: 1, label: 'Segments' },
        zoom: { type: 'range', min: 0.5, max: 5, default: 1.5, step: 0.1, label: 'Zoom' },
        complexity: { type: 'range', min: 1, max: 10, default: 4, step: 0.5, label: 'Complexity' },
        speed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Speed' },
        pattern: { type: 'select', options: ['fractal', 'waves', 'cells', 'plasma', 'spiral', 'mandala', 'hyperbolic', 'crystalline'], default: 'fractal', label: 'Pattern' },
        colorShift: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: 'Color Shift' },
        saturation: { type: 'range', min: 0, max: 1, default: 0.8, step: 0.05, label: 'Saturation' },
        rotation: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: 'Rotation' },
        // V2 params
        recursionDepth: { type: 'range', min: 1, max: 5, default: 1, step: 1, label: '🔄 Recursion' },
        mandalaMode: { type: 'toggle', default: false, label: '🕉️ Mandala Mode' },
        centerShape: { type: 'select', options: ['none', 'circle', 'triangle', 'hexagon', 'star'], default: 'none', label: '⭐ Center Shape' },
        edgeGlow: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '✨ Edge Glow' },
        mirrorType: { type: 'select', options: ['reflect', 'rotate', 'invert', 'glide'], default: 'reflect', label: '🪞 Mirror Type' },
        distortionWarp: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌀 Warp' },
        beatZoom: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '💥 Beat Zoom' },
        colorInversion: { type: 'toggle', default: false, label: '🔄 Invert Colors' },
        dropShatter: { type: 'toggle', default: false, label: '🔥 Drop Shatter' },
        backgroundPattern: { type: 'select', options: ['black', 'noise', 'gradient', 'mirror'], default: 'black', label: '🎨 Background' },
        chromaticAberration: { type: 'range', min: 0, max: 0.05, default: 0, step: 0.002, label: '🌈 Chromatic' },
        pulseIntensity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '💫 Pulse' }
    },

    init(scene, camera, renderer) {
        camera.position.set(0, 0, 50);
        camera.lookAt(0, 0, 0);

        const vertShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        const fragShader = `
            uniform float uTime;
            uniform float uSegments;
            uniform float uZoom;
            uniform float uComplexity;
            uniform float uSpeed;
            uniform float uBass;
            uniform float uMid;
            uniform float uTreble;
            uniform float uRMS;
            uniform float uBeatIntensity;
            uniform float uColorShift;
            uniform float uSaturation;
            uniform float uRotation;
            uniform int uPattern;
            uniform float uRecursion;
            uniform bool uMandala;
            uniform int uCenterShape;
            uniform float uEdgeGlow;
            uniform int uMirrorType;
            uniform float uWarp;
            uniform float uBeatZoom;
            uniform bool uInvertColors;
            uniform bool uShatter;
            uniform float uDropDecay;
            uniform int uBackground;
            uniform float uChromatic;
            uniform float uPulse;
            varying vec2 vUv;

            #define PI 3.14159265359

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }

            vec2 applyKaleidoscope(vec2 uv, float segments, int mirrorType) {
                float angle = atan(uv.y, uv.x);
                float radius = length(uv);
                float segAngle = PI * 2.0 / segments;
                float segIdx = floor(angle / segAngle);

                if (mirrorType == 0) { // reflect
                    angle = mod(angle, segAngle);
                    if (mod(segIdx, 2.0) > 0.5) angle = segAngle - angle;
                } else if (mirrorType == 1) { // rotate
                    angle = mod(angle, segAngle);
                } else if (mirrorType == 2) { // invert
                    angle = mod(angle, segAngle);
                    if (mod(segIdx, 2.0) > 0.5) {
                        angle = segAngle - angle;
                        radius = 1.0 / (radius + 0.5);
                    }
                } else { // glide
                    angle = mod(angle + segIdx * 0.3, segAngle);
                    if (mod(segIdx, 2.0) > 0.5) angle = segAngle - angle;
                }

                return vec2(cos(angle), sin(angle)) * radius;
            }

            void main() {
                vec2 uv = vUv - 0.5;

                // Beat zoom
                float zoomMod = uZoom + uBeatIntensity * uBeatZoom * 0.5;
                // Pulse
                zoomMod += sin(uTime * 3.0) * uPulse * uBass * 0.1;

                // Shatter distortion
                if (uShatter && uDropDecay > 0.1) {
                    uv += vec2(
                        sin(uv.y * 30.0 + uTime * 10.0) * uDropDecay * 0.05,
                        cos(uv.x * 30.0 + uTime * 10.0) * uDropDecay * 0.05
                    );
                }

                // Warp distortion
                if (uWarp > 0.0) {
                    uv += vec2(
                        sin(uv.y * 5.0 + uTime) * uWarp * 0.05 * uBass,
                        cos(uv.x * 5.0 + uTime * 0.7) * uWarp * 0.05 * uMid
                    );
                }

                // Apply kaleidoscope with rotation
                float rotAngle = uTime * uRotation;
                mat2 rot = mat2(cos(rotAngle), -sin(rotAngle), sin(rotAngle), cos(rotAngle));
                uv = rot * uv;

                // Recursive kaleidoscope
                vec2 kUv = uv;
                for (float r = 0.0; r < 5.0; r++) {
                    if (r >= uRecursion) break;
                    kUv = applyKaleidoscope(kUv, uSegments, uMirrorType);
                    kUv *= 1.0 + r * 0.3;
                }
                kUv *= zoomMod;

                // Mandala mode
                if (uMandala) {
                    float mAngle = atan(kUv.y, kUv.x);
                    float mRadius = length(kUv);
                    kUv = vec2(mRadius, mAngle / PI);
                }

                float t = uTime * uSpeed;
                float value = 0.0;

                // Pattern selection
                if (uPattern == 0) { // fractal
                    for (float i = 1.0; i < 8.0; i++) {
                        if (i > uComplexity) break;
                        kUv = abs(kUv) / dot(kUv, kUv) - 1.0;
                        kUv *= 1.0 + uBass * 0.5;
                        value += length(kUv) * (1.0 / i);
                    }
                } else if (uPattern == 1) { // waves
                    value = sin(kUv.x * uComplexity * 5.0 + t) * cos(kUv.y * uComplexity * 5.0 + t * 0.7);
                    value += sin(length(kUv) * 10.0 - t * 2.0) * uBass;
                    value = abs(value);
                } else if (uPattern == 2) { // cells
                    vec2 cell = fract(kUv * uComplexity * 2.0) - 0.5;
                    value = 1.0 - smoothstep(0.0, 0.3 + uBass * 0.3, length(cell));
                    value += sin(t + length(kUv) * 5.0) * 0.3;
                } else if (uPattern == 3) { // plasma
                    value = sin(kUv.x * 10.0 * uComplexity + t);
                    value += sin(kUv.y * 8.0 * uComplexity + t * 1.3);
                    value += sin((kUv.x + kUv.y) * 6.0 * uComplexity + t * 0.7);
                    value += sin(length(kUv) * 12.0 - t * 2.0);
                    value = (value + 4.0) / 8.0;
                    value *= (1.0 + uBass);
                } else if (uPattern == 4) { // spiral
                    float a = atan(kUv.y, kUv.x);
                    float r = length(kUv);
                    value = sin(a * uComplexity * 3.0 + r * 20.0 - t * 3.0);
                    value *= (1.0 + uBass * 2.0);
                    value = abs(value);
                } else if (uPattern == 5) { // mandala
                    float a = atan(kUv.y, kUv.x);
                    float r = length(kUv);
                    value = sin(a * uComplexity * 5.0) * cos(r * 10.0 - t);
                    value += sin(r * 15.0 - a * 3.0 + t * 2.0) * 0.5;
                    value = abs(value) * (1.0 + uBass);
                } else if (uPattern == 6) { // hyperbolic
                    vec2 hp = kUv;
                    for (float i = 0.0; i < 6.0; i++) {
                        if (i > uComplexity) break;
                        hp = vec2(hp.x * hp.x - hp.y * hp.y, 2.0 * hp.x * hp.y) + kUv * 0.5;
                        hp *= 0.8;
                    }
                    value = length(hp) * 0.5;
                    value *= (1.0 + uBass);
                } else { // crystalline
                    vec2 cp = kUv * uComplexity;
                    vec2 ip = floor(cp);
                    vec2 fp = fract(cp);
                    float minDist = 1.0;
                    for (int j = -1; j <= 1; j++) {
                        for (int k = -1; k <= 1; k++) {
                            vec2 neighbor = vec2(float(j), float(k));
                            vec2 point = hash(ip + neighbor) * vec2(0.5 + uBass * 0.5) + neighbor;
                            float d = length(fp - point);
                            minDist = min(minDist, d);
                        }
                    }
                    value = 1.0 - minDist;
                }

                // Beat flash
                value += uBeatIntensity * 0.5 * uPulse;

                // Color
                float hue = value * uColorShift + uTime * 0.1 + length(kUv) * 2.0;
                vec3 color = hsv2rgb(vec3(hue, uSaturation, clamp(value, 0.0, 1.0)));

                // Chromatic aberration
                if (uChromatic > 0.0) {
                    vec2 offset = (vUv - 0.5) * uChromatic;
                    color.r *= 1.0 + length(offset) * 10.0;
                    color.b *= 1.0 - length(offset) * 5.0;
                }

                // Edge glow
                if (uEdgeGlow > 0.0) {
                    float edge = length(vUv - 0.5) * 2.0;
                    color += vec3(0.3, 0.1, 0.8) * pow(edge, 2.0) * uEdgeGlow * uBass;
                }

                // Center shape
                float centerDist = length(vUv - 0.5);
                if (uCenterShape == 1) { // circle
                    float circle = smoothstep(0.12, 0.1, centerDist);
                    color += circle * vec3(1.0, 0.8, 0.3) * 0.5;
                } else if (uCenterShape == 2) { // triangle
                    float a2 = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float tri = smoothstep(0.12, 0.1, centerDist * (1.0 + 0.3 * sin(a2 * 3.0)));
                    color += tri * vec3(0.3, 1.0, 0.8) * 0.5;
                } else if (uCenterShape == 3) { // hexagon
                    float a2 = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float hex = smoothstep(0.12, 0.1, centerDist * (1.0 + 0.15 * sin(a2 * 6.0)));
                    color += hex * vec3(0.8, 0.3, 1.0) * 0.5;
                } else if (uCenterShape == 4) { // star
                    float a2 = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float star = smoothstep(0.15, 0.1, centerDist * (1.0 + 0.4 * sin(a2 * 5.0)));
                    color += star * vec3(1.0, 1.0, 0.5) * 0.5;
                }

                // Audio-reactive brightness
                color *= (0.5 + uRMS * 2.0);
                color *= (1.0 + uTreble * 0.5);

                // Color inversion
                if (uInvertColors) {
                    color = vec3(1.0) - color;
                }

                // Background
                if (uBackground == 1) { // noise
                    float n = hash(vUv * 100.0 + uTime);
                    color = max(color, vec3(n * 0.05));
                } else if (uBackground == 2) { // gradient
                    color = max(color, vec3(0.0, 0.0, 0.05 + vUv.y * 0.05));
                }

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            uniforms: {
                uTime: { value: 0 },
                uSegments: { value: 8 },
                uZoom: { value: 1.5 },
                uComplexity: { value: 4 },
                uSpeed: { value: 1 },
                uBass: { value: 0 },
                uMid: { value: 0 },
                uTreble: { value: 0 },
                uRMS: { value: 0 },
                uBeatIntensity: { value: 0 },
                uColorShift: { value: 1 },
                uSaturation: { value: 0.8 },
                uRotation: { value: 0.5 },
                uPattern: { value: 0 },
                uRecursion: { value: 1.0 },
                uMandala: { value: false },
                uCenterShape: { value: 0 },
                uEdgeGlow: { value: 0 },
                uMirrorType: { value: 0 },
                uWarp: { value: 0 },
                uBeatZoom: { value: 0 },
                uInvertColors: { value: false },
                uShatter: { value: false },
                uDropDecay: { value: 0 },
                uBackground: { value: 0 },
                uChromatic: { value: 0 },
                uPulse: { value: 1 }
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
        u.uSegments.value = params.segments || 8;
        u.uZoom.value = params.zoom || 1.5;
        u.uComplexity.value = params.complexity || 4;
        u.uSpeed.value = params.speed || 1;
        u.uBass.value = audio.smoothBands.bass * (params.reactivity || 1);
        u.uMid.value = audio.smoothBands.mid * (params.reactivity || 1);
        u.uTreble.value = audio.smoothBands.treble * (params.reactivity || 1);
        u.uRMS.value = audio.rms;
        u.uBeatIntensity.value = audio.beatIntensity;
        u.uColorShift.value = params.colorShift || 1;
        u.uSaturation.value = params.saturation || 0.8;
        u.uRotation.value = params.rotation || 0.5;
        u.uRecursion.value = params.recursionDepth || 1;
        u.uMandala.value = params.mandalaMode || false;
        u.uEdgeGlow.value = params.edgeGlow || 0;
        u.uWarp.value = params.distortionWarp || 0;
        u.uBeatZoom.value = params.beatZoom || 0;
        u.uInvertColors.value = params.colorInversion || false;
        u.uShatter.value = params.dropShatter || false;
        u.uDropDecay.value = audio.dropDecay || 0;
        u.uChromatic.value = params.chromaticAberration || 0;
        u.uPulse.value = params.pulseIntensity || 1;

        const patterns = ['fractal', 'waves', 'cells', 'plasma', 'spiral', 'mandala', 'hyperbolic', 'crystalline'];
        u.uPattern.value = patterns.indexOf(params.pattern || 'fractal');

        const centers = ['none', 'circle', 'triangle', 'hexagon', 'star'];
        u.uCenterShape.value = centers.indexOf(params.centerShape || 'none');

        const mirrors = ['reflect', 'rotate', 'invert', 'glide'];
        u.uMirrorType.value = mirrors.indexOf(params.mirrorType || 'reflect');

        const bgs = ['black', 'noise', 'gradient', 'mirror'];
        u.uBackground.value = bgs.indexOf(params.backgroundPattern || 'black');
    },

    destroy(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.material.dispose();
        }
    }
};
