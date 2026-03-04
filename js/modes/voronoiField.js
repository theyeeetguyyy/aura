// ============================================================
// AURA Mode — Voronoi Field V2
// Animated Voronoi cells with crystal growth, Delaunay,
// animated seeds, shatter, 3D extrusion, crack glow
// ============================================================

const VoronoiFieldMode = {
    name: 'Voronoi Field',
    mesh: null,
    material: null,
    time: 0,

    params: {
        cellCount: { type: 'range', min: 3, max: 30, default: 12, step: 1, label: 'Cell Count' },
        edgeWidth: { type: 'range', min: 0.01, max: 0.2, default: 0.05, step: 0.005, label: 'Edge Width' },
        distortion: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Distortion' },
        speed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Speed' },
        colorStyle: { type: 'select', options: ['cells', 'edges', 'distance', 'gradient', 'crystal', 'neon', 'heat'], default: 'cells', label: 'Color Style' },
        invert: { type: 'toggle', default: false, label: 'Invert' },
        dimension: { type: 'select', options: ['2d', '3d'], default: '2d', label: 'Dimension' },
        // V2 params
        cellStyle: { type: 'select', options: ['flat', 'raised', 'bubble', 'crystal', 'organic'], default: 'flat', label: '🔷 Cell Style' },
        delaunayDual: { type: 'toggle', default: false, label: '📐 Delaunay' },
        animateSeeds: { type: 'toggle', default: true, label: '🎵 Animate Seeds' },
        seedMotion: { type: 'select', options: ['random', 'orbital', 'attractor', 'repel', 'wave'], default: 'random', label: '🌀 Seed Motion' },
        crackWidth: { type: 'range', min: 0.005, max: 0.1, default: 0.02, step: 0.005, label: '💎 Crack Width' },
        crackGlow: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '✨ Crack Glow' },
        cellOpacity: { type: 'range', min: 0.1, max: 1, default: 0.5, step: 0.05, label: 'Cell Opacity' },
        heightExtrusion: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🧊 3D Height' },
        crystalGrowth: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '💎 Crystal Grow' },
        shatterOnBeat: { type: 'toggle', default: false, label: '💥 Beat Shatter' },
        beatSeedBurst: { type: 'toggle', default: false, label: '💥 Beat Burst' },
        dropExplode: { type: 'toggle', default: true, label: '🔥 Drop Explode' }
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
            uniform float uCellCount;
            uniform float uEdgeWidth;
            uniform float uDistortion;
            uniform float uSpeed;
            uniform float uBass;
            uniform float uMid;
            uniform float uTreble;
            uniform float uRMS;
            uniform float uBeatIntensity;
            uniform int uColorStyle;
            uniform bool uInvert;
            uniform int uCellStyle;
            uniform bool uDelaunay;
            uniform bool uAnimateSeeds;
            uniform int uSeedMotion;
            uniform float uCrackWidth;
            uniform float uCrackGlow;
            uniform float uCellOpacity;
            uniform float uHeightExt;
            uniform float uCrystalGrow;
            uniform bool uShatterBeat;
            uniform bool uBeatBurst;
            uniform bool uDropExplode;
            uniform float uDropDecay;
            varying vec2 vUv;

            #define PI 3.14159265359

            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            vec2 random2(vec2 st) {
                st = vec2(dot(st, vec2(127.1, 311.7)), dot(st, vec2(269.5, 183.3)));
                return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
            }

            void main() {
                vec2 uv = vUv * uCellCount;

                // Drop explode distortion
                if (uDropExplode && uDropDecay > 0.1) {
                    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float dist = length(vUv - 0.5);
                    uv += vec2(cos(angle), sin(angle)) * uDropDecay * 2.0;
                }

                // Audio distortion
                uv += vec2(
                    sin(uv.y * 2.0 + uTime * uSpeed) * uDistortion * uBass,
                    cos(uv.x * 2.0 + uTime * uSpeed * 0.7) * uDistortion * uMid
                ) * 0.3;

                // Shatter on beat
                if (uShatterBeat && uBeatIntensity > 0.3) {
                    uv += vec2(sin(uv.x * 20.0), cos(uv.y * 20.0)) * uBeatIntensity * 0.1;
                }

                vec2 i_st = floor(uv);
                vec2 f_st = fract(uv);

                float minDist = 10.0;
                float secondDist = 10.0;
                float thirdDist = 10.0;
                vec2 minPoint = vec2(0.0);
                vec2 minNeighbor = vec2(0.0);

                for (int y = -1; y <= 1; y++) {
                    for (int x = -1; x <= 1; x++) {
                        vec2 neighbor = vec2(float(x), float(y));
                        vec2 point = random2(i_st + neighbor);

                        // Seed animation
                        if (uAnimateSeeds) {
                            if (uSeedMotion == 0) { // random
                                point = 0.5 + 0.5 * sin(uTime * uSpeed * 0.5 + 6.2831 * point);
                            } else if (uSeedMotion == 1) { // orbital
                                float a = uTime * uSpeed * 0.3 + length(point) * PI * 2.0;
                                point = 0.5 + 0.3 * vec2(cos(a + point.x * PI), sin(a + point.y * PI));
                            } else if (uSeedMotion == 2) { // attractor
                                point = 0.5 + 0.4 * sin(uTime * uSpeed * 0.2 + point * PI * 4.0) * (1.0 + uBass);
                            } else if (uSeedMotion == 3) { // repel
                                point = 0.5 + 0.5 * sin(uTime * uSpeed * 0.5 + 6.2831 * point) * (1.0 + uBass * 0.5);
                                float repDist = length(point - 0.5);
                                point += normalize(point - 0.5 + 0.001) * uBass * 0.2;
                            } else { // wave
                                point = 0.5 + 0.4 * vec2(sin(uTime + point.x * 10.0), cos(uTime * 0.7 + point.y * 10.0));
                            }
                        } else {
                            point = 0.5 + 0.5 * sin(6.2831 * point);
                        }

                        // Beat burst
                        if (uBeatBurst && uBeatIntensity > 0.3) {
                            point += (random2(i_st + neighbor + 100.0) * 0.5) * uBeatIntensity * 0.2;
                        }

                        vec2 diff = neighbor + point - f_st;
                        float dist = length(diff);

                        if (dist < minDist) {
                            thirdDist = secondDist;
                            secondDist = minDist;
                            minDist = dist;
                            minPoint = point;
                            minNeighbor = neighbor;
                        } else if (dist < secondDist) {
                            thirdDist = secondDist;
                            secondDist = dist;
                        } else if (dist < thirdDist) {
                            thirdDist = dist;
                        }
                    }
                }

                float edge = secondDist - minDist;
                float crackEdge = 1.0 - smoothstep(0.0, uCrackWidth, edge);
                float edgeLine = 1.0 - smoothstep(0.0, uEdgeWidth, edge);

                // Cell style modifiers
                float cellVal = 0.0;
                if (uCellStyle == 1) { // raised
                    cellVal = 1.0 - minDist * 2.0;
                } else if (uCellStyle == 2) { // bubble
                    cellVal = pow(1.0 - minDist, 3.0);
                } else if (uCellStyle == 3) { // crystal
                    cellVal = 1.0 - step(0.3 + uCrystalGrow * 0.1 * uBass, minDist);
                } else if (uCellStyle == 4) { // organic
                    cellVal = sin(minDist * 10.0 + uTime) * 0.5 + 0.5;
                } else {
                    cellVal = 0.3 + minDist * 0.5;
                }

                vec3 color;
                if (uColorStyle == 0) { // cells
                    float hue = fract(dot(minPoint, vec2(1.0, 0.5)) + uTime * 0.05);
                    color = hsv2rgb(vec3(hue, 0.8, uCellOpacity * cellVal));
                    color += crackEdge * vec3(0.5, 0.3, 1.0) * uCrackGlow * (1.0 + uBeatIntensity);
                } else if (uColorStyle == 1) { // edges
                    color = edgeLine * hsv2rgb(vec3(uTime * 0.1 + minDist, 0.9, 1.0));
                    color += crackEdge * vec3(1.0, 0.5, 0.2) * uCrackGlow;
                } else if (uColorStyle == 2) { // distance
                    color = hsv2rgb(vec3(minDist * 2.0 + uTime * 0.1, 0.8, 0.5 + edge * 2.0));
                } else if (uColorStyle == 3) { // gradient
                    color = hsv2rgb(vec3(uv.x / uCellCount + uTime * 0.05, 0.7, 0.4 + edge * 3.0));
                    color += edgeLine * 0.5;
                } else if (uColorStyle == 4) { // crystal
                    float hue = fract(minDist * 3.0 + edge * 5.0 + uTime * 0.02);
                    color = hsv2rgb(vec3(hue, 0.6, cellVal));
                    color += crackEdge * vec3(0.8, 0.9, 1.0) * uCrackGlow * 2.0;
                } else if (uColorStyle == 5) { // neon
                    color = edgeLine * hsv2rgb(vec3(minPoint.x + uTime * 0.1, 1.0, 1.0)) * 2.0;
                    color += crackEdge * vec3(0.0, 1.0, 0.5) * uCrackGlow;
                } else { // heat
                    float heat = 1.0 - minDist;
                    color = hsv2rgb(vec3(heat * 0.15, 1.0, heat));
                    color += crackEdge * vec3(1.0, 0.2, 0.0) * uCrackGlow;
                }

                // Delaunay dual
                if (uDelaunay) {
                    float dualEdge = 1.0 - smoothstep(0.0, uEdgeWidth * 2.0, thirdDist - secondDist);
                    color += dualEdge * vec3(0.3, 0.6, 1.0) * 0.3;
                }

                // Height extrusion as brightness
                if (uHeightExt > 0.0) {
                    float height = cellVal * uHeightExt;
                    color *= (0.5 + height * 0.5);
                }

                color *= (0.5 + uRMS * 2.0);
                color += uBeatIntensity * 0.15;

                if (uInvert) color = 1.0 - color;

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            vertexShader: vertShader,
            fragmentShader: fragShader,
            uniforms: {
                uTime: { value: 0 }, uCellCount: { value: 12 }, uEdgeWidth: { value: 0.05 },
                uDistortion: { value: 1 }, uSpeed: { value: 1 }, uBass: { value: 0 },
                uMid: { value: 0 }, uTreble: { value: 0 }, uRMS: { value: 0 },
                uBeatIntensity: { value: 0 }, uColorStyle: { value: 0 }, uInvert: { value: false },
                uCellStyle: { value: 0 }, uDelaunay: { value: false }, uAnimateSeeds: { value: true },
                uSeedMotion: { value: 0 }, uCrackWidth: { value: 0.02 }, uCrackGlow: { value: 1 },
                uCellOpacity: { value: 0.5 }, uHeightExt: { value: 0 }, uCrystalGrow: { value: 0 },
                uShatterBeat: { value: false }, uBeatBurst: { value: false },
                uDropExplode: { value: true }, uDropDecay: { value: 0 }
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
        u.uCellCount.value = params.cellCount || 12;
        u.uEdgeWidth.value = params.edgeWidth || 0.05;
        u.uDistortion.value = params.distortion || 1;
        u.uSpeed.value = params.speed || 1;
        u.uBass.value = audio.smoothBands.bass * (params.reactivity || 1);
        u.uMid.value = audio.smoothBands.mid * (params.reactivity || 1);
        u.uTreble.value = audio.smoothBands.treble * (params.reactivity || 1);
        u.uRMS.value = audio.rms;
        u.uBeatIntensity.value = audio.beatIntensity;
        u.uInvert.value = params.invert || false;
        u.uDelaunay.value = params.delaunayDual || false;
        u.uAnimateSeeds.value = params.animateSeeds !== false;
        u.uCrackWidth.value = params.crackWidth || 0.02;
        u.uCrackGlow.value = params.crackGlow || 1;
        u.uCellOpacity.value = params.cellOpacity || 0.5;
        u.uHeightExt.value = params.heightExtrusion || 0;
        u.uCrystalGrow.value = params.crystalGrowth || 0;
        u.uShatterBeat.value = params.shatterOnBeat || false;
        u.uBeatBurst.value = params.beatSeedBurst || false;
        u.uDropExplode.value = params.dropExplode !== false;
        u.uDropDecay.value = audio.dropDecay || 0;

        const styles = ['cells', 'edges', 'distance', 'gradient', 'crystal', 'neon', 'heat'];
        u.uColorStyle.value = styles.indexOf(params.colorStyle || 'cells');

        const cellStyles = ['flat', 'raised', 'bubble', 'crystal', 'organic'];
        u.uCellStyle.value = cellStyles.indexOf(params.cellStyle || 'flat');

        const motions = ['random', 'orbital', 'attractor', 'repel', 'wave'];
        u.uSeedMotion.value = motions.indexOf(params.seedMotion || 'random');
    },

    destroy(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.material.dispose();
        }
    }
};
