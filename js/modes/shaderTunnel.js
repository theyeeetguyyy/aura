// ============================================================
// AURA Mode — Shader Tunnel V2
// GLSL raymarched tunnel with wormhole, fractal walls,
// nested layers, fog, speed warp, camera sway, color bands
// ============================================================

const ShaderTunnelMode = {
    name: 'Shader Tunnel',
    mesh: null,
    material: null,
    time: 0,

    params: {
        tunnelType: { type: 'select', options: ['round', 'hexagonal', 'square', 'octagonal', 'twisted', 'organic', 'fractal'], default: 'round', label: 'Shape' },
        speed: { type: 'range', min: 0, max: 5, default: 1.5, step: 0.1, label: 'Speed' },
        complexity: { type: 'range', min: 1, max: 8, default: 3, step: 0.5, label: 'Complexity' },
        colorSpeed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Color Speed' },
        distortion: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Distortion' },
        zoom: { type: 'range', min: 0.5, max: 3, default: 1, step: 0.1, label: 'Zoom' },
        glow: { type: 'range', min: 0, max: 2, default: 0.8, step: 0.1, label: 'Glow' },
        rings: { type: 'toggle', default: true, label: 'Show Rings' },
        // V2 params
        tunnelLayers: { type: 'range', min: 1, max: 4, default: 1, step: 1, label: '📐 Layers' },
        wormholeEnabled: { type: 'toggle', default: false, label: '🌀 Wormhole' },
        wormholePull: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'WH Pull' },
        fractalWalls: { type: 'toggle', default: false, label: '🔮 Fractal Walls' },
        wallPattern: { type: 'select', options: ['smooth', 'bricks', 'hexGrid', 'voronoi', 'circuit'], default: 'smooth', label: '🧱 Wall Pattern' },
        fogDepth: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '🌫️ Fog' },
        speedWarp: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '⚡ Bass Warp' },
        colorBands: { type: 'range', min: 0, max: 10, default: 0, step: 1, label: '🌈 Color Bands' },
        pulseRings: { type: 'range', min: 0, max: 5, default: 0, step: 0.5, label: '💫 Pulse Rings' },
        cameraSwayX: { type: 'range', min: 0, max: 2, default: 0, step: 0.1, label: '↔️ Sway X' },
        cameraSwayY: { type: 'range', min: 0, max: 2, default: 0, step: 0.1, label: '↕️ Sway Y' },
        dropWarp: { type: 'toggle', default: true, label: '🔥 Drop Warp' },
        saturation: { type: 'range', min: 0, max: 1, default: 0.8, step: 0.05, label: 'Saturation' },
        innerGlow: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '✨ Inner Glow' }
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
            uniform float uTime;
            uniform float uSpeed;
            uniform float uComplexity;
            uniform float uColorSpeed;
            uniform float uDistortion;
            uniform float uZoom;
            uniform float uGlow;
            uniform float uBass;
            uniform float uMid;
            uniform float uTreble;
            uniform float uRMS;
            uniform float uBeatIntensity;
            uniform int uTunnelType;
            uniform bool uRings;
            uniform float uLayers;
            uniform bool uWormhole;
            uniform float uWormholePull;
            uniform bool uFractalWalls;
            uniform int uWallPattern;
            uniform float uFogDepth;
            uniform float uSpeedWarp;
            uniform float uColorBands;
            uniform float uPulseRings;
            uniform float uSwayX;
            uniform float uSwayY;
            uniform bool uDropWarp;
            uniform float uDropDecay;
            uniform float uSaturation;
            uniform float uInnerGlow;
            varying vec2 vUv;

            #define PI 3.14159265359

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            float hash21(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            float tunnelDist(vec2 p, int type) {
                if (type == 0) return length(p);
                if (type == 1) { p = abs(p); return max(p.x + p.y * 0.577, p.y * 1.154); }
                if (type == 2) { p = abs(p); return max(p.x, p.y); }
                if (type == 3) { p = abs(p); return max(p.x, max(p.y, (p.x + p.y) * 0.707)); }
                if (type == 4) {
                    float a = atan(p.y, p.x) + uTime * 0.5;
                    return length(p) * (1.0 + sin(a * 4.0) * 0.2 * uDistortion);
                }
                if (type == 5) { // organic
                    float a = atan(p.y, p.x);
                    return length(p) * (1.0 + sin(a * 3.0 + uTime) * 0.15 + sin(a * 7.0 - uTime * 1.5) * 0.08 * uBass);
                }
                // fractal
                float a = atan(p.y, p.x);
                float r = length(p);
                r *= 1.0 + sin(a * 5.0 + uTime * 0.3) * 0.1;
                r *= 1.0 + sin(a * 13.0 - uTime * 0.7) * 0.05 * uBass;
                return r;
            }

            float wallPattern(vec2 uv, int pattern) {
                if (pattern == 1) { // bricks
                    vec2 b = uv * 5.0;
                    b.x += floor(b.y) * 0.5;
                    vec2 f = fract(b);
                    return step(0.05, f.x) * step(0.05, f.y);
                }
                if (pattern == 2) { // hex grid
                    vec2 h = uv * 4.0;
                    float hx = abs(fract(h.x) - 0.5);
                    float hy = abs(fract(h.y * 1.732) - 0.5);
                    return smoothstep(0.02, 0.05, min(hx, hy));
                }
                if (pattern == 3) { // voronoi
                    vec2 ip = floor(uv * 3.0);
                    vec2 fp = fract(uv * 3.0);
                    float d = 1.0;
                    for (int j = -1; j <= 1; j++)
                        for (int k = -1; k <= 1; k++) {
                            vec2 n = vec2(float(j), float(k));
                            vec2 pt = vec2(hash21(ip + n));
                            d = min(d, length(fp - pt - n));
                        }
                    return d;
                }
                if (pattern == 4) { // circuit
                    vec2 c = uv * 6.0;
                    float cx = abs(fract(c.x) - 0.5);
                    float cy = abs(fract(c.y) - 0.5);
                    return step(0.4, max(cx, cy)) + step(0.48, min(cx, cy)) * 0.5;
                }
                return 1.0;
            }

            void main() {
                vec2 uv = (vUv - 0.5) * 2.0 / uZoom;

                // Camera sway
                uv.x += sin(uTime * 0.7) * uSwayX * 0.1;
                uv.y += cos(uTime * 0.5) * uSwayY * 0.1;

                // Drop warp
                if (uDropWarp && uDropDecay > 0.05) {
                    uv *= 1.0 + uDropDecay * 0.3;
                    uv += vec2(sin(uv.y * 10.0 + uTime * 5.0), cos(uv.x * 10.0 + uTime * 5.0)) * uDropDecay * 0.05;
                }

                // Distort with audio
                uv += vec2(
                    sin(uv.y * 3.0 + uTime) * uDistortion * uBass * 0.1,
                    cos(uv.x * 3.0 + uTime) * uDistortion * uMid * 0.1
                );

                // Wormhole pull
                if (uWormhole) {
                    float dist = length(uv);
                    uv *= 1.0 + (1.0 / (dist + 0.5) - 1.0) * uWormholePull * 0.2 * (1.0 + uBass);
                }

                float effectiveSpeed = uSpeed + uSpeedWarp * uBass;

                vec3 totalColor = vec3(0.0);

                for (float layer = 0.0; layer < 4.0; layer++) {
                    if (layer >= uLayers) break;

                    vec2 layerUv = uv * (1.0 + layer * 0.3);
                    float layerTime = uTime + layer * 0.5;

                    float r = tunnelDist(layerUv, uTunnelType);
                    float a = atan(layerUv.y, layerUv.x);

                    float depth = 1.0 / (r + 0.001) * 0.2;

                    float tx = a / PI;
                    float ty = depth + layerTime * effectiveSpeed * 0.5;

                    // Wall pattern
                    float wp = 1.0;
                    if (uFractalWalls) {
                        for (float i = 1.0; i <= 3.0; i++) {
                            wp *= 0.5 + 0.5 * sin(tx * i * 10.0 + ty * i * 5.0 + layerTime);
                        }
                        wp = 0.5 + wp * 0.5;
                    }
                    wp *= wallPattern(vec2(tx, ty), uWallPattern);

                    // Layers of detail
                    float v = 0.0;
                    for (float i = 1.0; i <= 5.0; i++) {
                        if (i > uComplexity) break;
                        float scale = pow(2.0, i);
                        v += sin(tx * scale * 3.0 + ty * scale * 2.0) / scale;
                        v += cos(ty * scale * 1.5 + layerTime * 0.3) / scale * uBass;
                    }
                    v = v * 0.5 + 0.5;
                    v *= wp;

                    // Rings
                    float ring = 0.0;
                    if (uRings) {
                        ring = smoothstep(0.02, 0.0, abs(fract(depth * 5.0 + layerTime * effectiveSpeed) - 0.5) - 0.45);
                        ring *= (1.0 + uBeatIntensity * 3.0);
                    }

                    // Pulse rings
                    if (uPulseRings > 0.0) {
                        float pr = smoothstep(0.03, 0.0, abs(fract(depth * uPulseRings + layerTime * effectiveSpeed * 0.5) - 0.5) - 0.4);
                        ring += pr * uBass * 2.0;
                    }

                    // Color
                    float hue = v * uColorSpeed + depth * 0.5 + layerTime * 0.1;
                    if (uColorBands > 0.0) {
                        hue = floor(hue * uColorBands) / uColorBands;
                    }
                    float val = v * (1.0 + uRMS) * (0.3 + depth * 3.0);
                    val = clamp(val, 0.0, 1.0);

                    vec3 color = hsv2rgb(vec3(hue, uSaturation, val));

                    // Edge glow
                    float edge = smoothstep(0.0, 0.3, r);
                    color *= edge;

                    // Ring overlay
                    color += ring * uGlow * vec3(0.5, 0.3, 1.0);

                    // Beat flash
                    color += uBeatIntensity * 0.2;

                    // Center glow
                    float centerGlow = exp(-r * 3.0) * uInnerGlow * uBass;
                    color += centerGlow * vec3(0.6, 0.2, 1.0);

                    // Fog
                    color *= exp(-depth * 0.3 * uFogDepth);

                    float layerOpacity = 1.0 / (1.0 + layer * 0.5);
                    totalColor += color * layerOpacity;
                }

                gl_FragColor = vec4(totalColor, 1.0);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            uniforms: {
                uTime: { value: 0 }, uSpeed: { value: 1.5 }, uComplexity: { value: 3 },
                uColorSpeed: { value: 1 }, uDistortion: { value: 1 }, uZoom: { value: 1 },
                uGlow: { value: 0.8 }, uBass: { value: 0 }, uMid: { value: 0 },
                uTreble: { value: 0 }, uRMS: { value: 0 }, uBeatIntensity: { value: 0 },
                uTunnelType: { value: 0 }, uRings: { value: true },
                uLayers: { value: 1 }, uWormhole: { value: false }, uWormholePull: { value: 1 },
                uFractalWalls: { value: false }, uWallPattern: { value: 0 },
                uFogDepth: { value: 0.5 }, uSpeedWarp: { value: 0 }, uColorBands: { value: 0 },
                uPulseRings: { value: 0 }, uSwayX: { value: 0 }, uSwayY: { value: 0 },
                uDropWarp: { value: true }, uDropDecay: { value: 0 },
                uSaturation: { value: 0.8 }, uInnerGlow: { value: 0.5 }
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
        u.uSpeed.value = params.speed || 1.5;
        u.uComplexity.value = params.complexity || 3;
        u.uColorSpeed.value = params.colorSpeed || 1;
        u.uDistortion.value = params.distortion || 1;
        u.uZoom.value = params.zoom || 1;
        u.uGlow.value = params.glow || 0.8;
        u.uBass.value = audio.smoothBands.bass * (params.reactivity || 1);
        u.uMid.value = audio.smoothBands.mid * (params.reactivity || 1);
        u.uTreble.value = audio.smoothBands.treble * (params.reactivity || 1);
        u.uRMS.value = audio.rms;
        u.uBeatIntensity.value = audio.beatIntensity;
        u.uRings.value = params.rings !== false;
        u.uLayers.value = params.tunnelLayers || 1;
        u.uWormhole.value = params.wormholeEnabled || false;
        u.uWormholePull.value = params.wormholePull || 1;
        u.uFractalWalls.value = params.fractalWalls || false;
        u.uFogDepth.value = params.fogDepth || 0.5;
        u.uSpeedWarp.value = params.speedWarp || 0;
        u.uColorBands.value = params.colorBands || 0;
        u.uPulseRings.value = params.pulseRings || 0;
        u.uSwayX.value = params.cameraSwayX || 0;
        u.uSwayY.value = params.cameraSwayY || 0;
        u.uDropWarp.value = params.dropWarp !== false;
        u.uDropDecay.value = audio.dropDecay || 0;
        u.uSaturation.value = params.saturation || 0.8;
        u.uInnerGlow.value = params.innerGlow || 0.5;

        const types = ['round', 'hexagonal', 'square', 'octagonal', 'twisted', 'organic', 'fractal'];
        u.uTunnelType.value = types.indexOf(params.tunnelType || 'round');

        const walls = ['smooth', 'bricks', 'hexGrid', 'voronoi', 'circuit'];
        u.uWallPattern.value = walls.indexOf(params.wallPattern || 'smooth');
    },

    destroy(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.material.dispose();
        }
    }
};
