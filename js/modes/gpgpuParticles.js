// ============================================================
// AURA Mode — GPGPU Particles
// Ping-pong render-target particle simulation.
// Positions & velocities in RGBA float textures, updated by
// fragment shaders, rendered with a point-cloud vertex shader.
// ============================================================

const GPGPUParticlesMode = {
    name: 'GPGPU Particles',
    time: 0,
    particleMesh: null,
    simMaterial: null,
    renderMaterial: null,
    posRT: null,      // [A, B] ping-pong render targets for position
    velRT: null,      // [A, B] ping-pong render targets for velocity
    simScene: null,
    simCamera: null,
    simQuad: null,
    frame: 0,
    texSize: 256,     // 256×256 = 65,536 particles
    _renderer: null,

    params: {
        particleCount: { type: 'select', options: ['64', '128', '256', '512'], default: '256', label: '🔢 Grid Size' },
        gravity: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '🌍 Gravity' },
        vortexStrength: { type: 'range', min: 0, max: 5, default: 1.5, step: 0.1, label: '🌪️ Vortex' },
        turbulence: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🌊 Turbulence' },
        damping: { type: 'range', min: 0.9, max: 1, default: 0.98, step: 0.005, label: '🛑 Damping' },
        pointSize: { type: 'range', min: 1, max: 10, default: 3, step: 0.5, label: '⬤ Point Size' },
        colorMode: { type: 'select', options: ['velocity', 'position', 'age', 'frequency', 'white'], default: 'velocity', label: '🎨 Color' },
        emitterShape: { type: 'select', options: ['sphere', 'ring', 'cube', 'disc', 'line', 'spiral'], default: 'sphere', label: '📍 Emitter' },
        burstOnBeat: { type: 'toggle', default: true, label: '💥 Burst on Beat' },
        attractorCount: { type: 'range', min: 0, max: 4, default: 2, step: 1, label: '🧲 Attractors' },
        noiseScale: { type: 'range', min: 0.1, max: 5, default: 1.5, step: 0.1, label: '🔬 Noise Scale' },
        returnForce: { type: 'range', min: 0, max: 1, default: 0.05, step: 0.01, label: '🔄 Return' },
        bassExplosion: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '🔊 Bass Boom' },
        trailLength: { type: 'range', min: 0, max: 0.5, default: 0.1, step: 0.01, label: '💫 Trails' },
        rotationSpeed: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.05, label: '🔄 Rotation' }
    },

    createRenderTarget(size) {
        return new THREE.WebGLRenderTarget(size, size, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        });
    },

    createDataTexture(size, initFn) {
        const data = new Float32Array(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            const vals = initFn(i, size);
            data[i * 4] = vals[0];
            data[i * 4 + 1] = vals[1];
            data[i * 4 + 2] = vals[2];
            data[i * 4 + 3] = vals[3];
        }
        const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
        tex.needsUpdate = true;
        return tex;
    },

    init(scene, camera, renderer) {
        this._renderer = renderer;
        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);

        const size = this.texSize;

        // Create ping-pong render targets
        this.posRT = [this.createRenderTarget(size), this.createRenderTarget(size)];
        this.velRT = [this.createRenderTarget(size), this.createRenderTarget(size)];

        // Initial position texture — particles on a sphere
        const initPosTex = this.createDataTexture(size, (i, s) => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 5 + Math.random() * 15;
            return [
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi),
                1.0  // age/life
            ];
        });

        // Initial velocity texture — small random velocities
        const initVelTex = this.createDataTexture(size, () => {
            return [
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                0.0
            ];
        });

        // Initialize render targets with data
        this.initRT(renderer, this.posRT[0], initPosTex);
        this.initRT(renderer, this.posRT[1], initPosTex);
        this.initRT(renderer, this.velRT[0], initVelTex);
        this.initRT(renderer, this.velRT[1], initVelTex);

        // Simulation scene (offscreen)
        this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.simScene = new THREE.Scene();

        // Simulation material — updates positions and velocities
        this.simMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;

                uniform sampler2D uPositions;
                uniform sampler2D uVelocities;
                uniform float uTime;
                uniform float uDT;
                uniform float uGravity;
                uniform float uVortex;
                uniform float uTurbulence;
                uniform float uDamping;
                uniform float uNoiseScale;
                uniform float uReturn;
                uniform float uBassExplosion;
                uniform int uAttractorCount;
                uniform bool uBurst;
                uniform int uMode; // 0 = update positions, 1 = update velocities

                uniform float uBass;
                uniform float uMid;
                uniform float uTreble;
                uniform float uRMS;
                uniform float uBeatIntensity;
                uniform float uDropDecay;
                uniform float uWobbleLFO;

                varying vec2 vUv;

                // Simple 3D noise
                vec3 hash3(vec3 p) {
                    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                             dot(p, vec3(269.5, 183.3, 246.1)),
                             dot(p, vec3(113.5, 271.9, 124.6)));
                    return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
                }

                vec3 curlNoise(vec3 p) {
                    float e = 0.1;
                    vec3 dx = vec3(e, 0.0, 0.0);
                    vec3 dy = vec3(0.0, e, 0.0);
                    vec3 dz = vec3(0.0, 0.0, e);

                    float n1 = dot(hash3(p + dy), vec3(1.0)) - dot(hash3(p - dy), vec3(1.0));
                    float n2 = dot(hash3(p + dz), vec3(1.0)) - dot(hash3(p - dz), vec3(1.0));
                    float n3 = dot(hash3(p + dx), vec3(1.0)) - dot(hash3(p - dx), vec3(1.0));
                    float n4 = dot(hash3(p + dz), vec3(1.0)) - dot(hash3(p - dz), vec3(1.0));
                    float n5 = dot(hash3(p + dx), vec3(1.0)) - dot(hash3(p - dx), vec3(1.0));
                    float n6 = dot(hash3(p + dy), vec3(1.0)) - dot(hash3(p - dy), vec3(1.0));

                    return vec3(n1 - n2, n3 - n4, n5 - n6) / (2.0 * e);
                }

                void main() {
                    vec4 pos = texture2D(uPositions, vUv);
                    vec4 vel = texture2D(uVelocities, vUv);

                    if (uMode == 1) {
                        // === UPDATE VELOCITIES ===
                        vec3 force = vec3(0.0);

                        // Gravity toward center
                        float dist = length(pos.xyz);
                        if (dist > 0.01) {
                            force -= normalize(pos.xyz) * uGravity * 0.1;
                        }

                        // Return force (spring back to origin region)
                        force -= pos.xyz * uReturn * 0.01;

                        // Vortex
                        if (uVortex > 0.01) {
                            vec3 tangent = normalize(cross(pos.xyz, vec3(0.0, 1.0, 0.0)));
                            if (length(tangent) < 0.01) tangent = vec3(1.0, 0.0, 0.0);
                            force += tangent * uVortex * 0.5 / (dist + 1.0);

                            // Audio-modulated vortex axis wobble
                            vec3 tangent2 = normalize(cross(pos.xyz, vec3(uWobbleLFO, 1.0, uMid)));
                            force += tangent2 * uVortex * 0.2 * uMid;
                        }

                        // Curl noise turbulence
                        if (uTurbulence > 0.01) {
                            vec3 noisePos = pos.xyz * uNoiseScale * 0.1 + uTime * 0.3;
                            vec3 curl = curlNoise(noisePos);
                            force += curl * uTurbulence * (1.0 + uTreble * 3.0);
                        }

                        // Attractors
                        for (int a = 0; a < 4; a++) {
                            if (a >= uAttractorCount) break;
                            float angle = float(a) * 1.5708 + uTime * 0.5;
                            float attrR = 15.0 + sin(uTime * 0.3 + float(a)) * 5.0;
                            vec3 attractor = vec3(cos(angle) * attrR, sin(angle * 0.7) * 5.0, sin(angle) * attrR);
                            vec3 toAttr = attractor - pos.xyz;
                            float attrDist = length(toAttr);
                            force += normalize(toAttr) * 2.0 / (attrDist * attrDist + 1.0) * uBass;
                        }

                        // Bass explosion
                        if (uBassExplosion > 0.01 && uBeatIntensity > 0.1) {
                            vec3 explodeDir = normalize(pos.xyz + vec3(0.001));
                            force += explodeDir * uBeatIntensity * uBassExplosion * 3.0;
                        }

                        // Drop explosion
                        if (uDropDecay > 0.1) {
                            vec3 explodeDir = normalize(pos.xyz + vec3(0.001));
                            force += explodeDir * uDropDecay * 5.0;
                        }

                        // Apply force
                        vel.xyz += force * uDT;

                        // Damping
                        vel.xyz *= uDamping;

                        // Speed limit
                        float speed = length(vel.xyz);
                        if (speed > 50.0) vel.xyz = vel.xyz / speed * 50.0;

                        gl_FragColor = vel;
                    } else {
                        // === UPDATE POSITIONS ===
                        pos.xyz += vel.xyz * uDT;

                        // Age
                        pos.w += uDT * 0.1;

                        // Beat burst — respawn some particles
                        if (uBurst && uBeatIntensity > 0.3) {
                            float id = vUv.x * 256.0 + vUv.y * 256.0 * 256.0;
                            float threshold = uBeatIntensity * 0.15;
                            if (fract(sin(id * 12.9898 + uTime) * 43758.5453) < threshold) {
                                // Respawn near center
                                float theta = fract(sin(id * 78.233) * 43758.5453) * 6.2832;
                                float phi = acos(2.0 * fract(sin(id * 12.989) * 43758.0) - 1.0);
                                float r = 2.0 + fract(sin(id * 45.164) * 43758.0) * 3.0;
                                pos.xyz = vec3(r * sin(phi) * cos(theta), r * sin(phi) * sin(theta), r * cos(phi));
                                pos.w = 0.0; // reset age
                            }
                        }

                        // Boundary wrap
                        float bounds = 60.0;
                        if (abs(pos.x) > bounds) pos.x = -sign(pos.x) * bounds * 0.9;
                        if (abs(pos.y) > bounds) pos.y = -sign(pos.y) * bounds * 0.9;
                        if (abs(pos.z) > bounds) pos.z = -sign(pos.z) * bounds * 0.9;

                        gl_FragColor = pos;
                    }
                }
            `,
            uniforms: {
                uPositions: { value: null },
                uVelocities: { value: null },
                uTime: { value: 0 }, uDT: { value: 0.016 },
                uGravity: { value: 0.5 }, uVortex: { value: 1.5 },
                uTurbulence: { value: 1.0 }, uDamping: { value: 0.98 },
                uNoiseScale: { value: 1.5 }, uReturn: { value: 0.05 },
                uBassExplosion: { value: 2.0 },
                uAttractorCount: { value: 2 }, uBurst: { value: true },
                uMode: { value: 0 },
                uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
                uRMS: { value: 0 }, uBeatIntensity: { value: 0 },
                uDropDecay: { value: 0 }, uWobbleLFO: { value: 0 }
            }
        });

        const simGeo = new THREE.PlaneGeometry(2, 2);
        this.simQuad = new THREE.Mesh(simGeo, this.simMaterial);
        this.simScene.add(this.simQuad);

        // Particle render mesh — point cloud that reads from position texture
        const particleCount = size * size;
        const references = new Float32Array(particleCount * 2);
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const idx = (i * size + j) * 2;
                references[idx] = j / size + 0.5 / size;  // u
                references[idx + 1] = i / size + 0.5 / size;  // v
            }
        }

        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(particleCount * 3), 3));
        pGeo.setAttribute('reference', new THREE.Float32BufferAttribute(references, 2));

        this.renderMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                uniform sampler2D uPositionTexture;
                uniform sampler2D uVelocityTexture;
                uniform float uPointSize;
                uniform int uColorMode;
                uniform float uTime;
                uniform float uBass;
                uniform float uRMS;
                attribute vec2 reference;
                varying vec3 vColor;
                varying float vAlpha;

                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                void main() {
                    vec4 pos = texture2D(uPositionTexture, reference);
                    vec4 vel = texture2D(uVelocityTexture, reference);

                    vec4 mvPos = modelViewMatrix * vec4(pos.xyz, 1.0);
                    gl_Position = projectionMatrix * mvPos;

                    float speed = length(vel.xyz);
                    float dist = -mvPos.z;
                    gl_PointSize = uPointSize * (80.0 / max(dist, 1.0)) * (0.5 + speed * 0.1);

                    // Coloring
                    if (uColorMode == 0) { // velocity
                        float hue = speed * 0.1 + uTime * 0.1;
                        vColor = hsv2rgb(vec3(hue, 0.8, 0.7 + speed * 0.1));
                    } else if (uColorMode == 1) { // position
                        vColor = normalize(abs(pos.xyz)) * 0.8 + 0.2;
                    } else if (uColorMode == 2) { // age
                        float age = pos.w;
                        float hue = fract(age * 0.3);
                        vColor = hsv2rgb(vec3(hue, 0.7, 0.8));
                    } else if (uColorMode == 3) { // frequency
                        float hue = uBass * 0.3 + speed * 0.05;
                        float sat = 0.6 + uRMS * 0.4;
                        vColor = hsv2rgb(vec3(hue, sat, 0.8));
                    } else { // white
                        vColor = vec3(0.8 + speed * 0.05);
                    }

                    vAlpha = clamp(0.3 + speed * 0.15, 0.1, 0.9);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    float r = length(gl_PointCoord - 0.5);
                    if (r > 0.5) discard;

                    float alpha = vAlpha * smoothstep(0.5, 0.1, r);
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            uniforms: {
                uPositionTexture: { value: null },
                uVelocityTexture: { value: null },
                uPointSize: { value: 3.0 },
                uColorMode: { value: 0 },
                uTime: { value: 0 },
                uBass: { value: 0 },
                uRMS: { value: 0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleMesh = new THREE.Points(pGeo, this.renderMaterial);
        scene.add(this.particleMesh);

        this.frame = 0;
    },

    initRT(renderer, rt, dataTex) {
        const tempScene = new THREE.Scene();
        const tempCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const mat = new THREE.MeshBasicMaterial({ map: dataTex });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
        tempScene.add(quad);
        renderer.setRenderTarget(rt);
        renderer.render(tempScene, tempCam);
        renderer.setRenderTarget(null);
        mat.dispose();
        quad.geometry.dispose();
    },

    update(audio, params, dt) {
        if (!this.simMaterial || !this._renderer) return;
        this.time += dt;
        const renderer = this._renderer;
        const u = this.simMaterial.uniforms;

        const readIdx = this.frame % 2;
        const writeIdx = 1 - readIdx;

        // Audio uniforms
        u.uBass.value = (audio.smoothBands?.bass || 0) * (params.reactivity || 1);
        u.uMid.value = (audio.smoothBands?.mid || 0) * (params.reactivity || 1);
        u.uTreble.value = (audio.smoothBands?.treble || 0) * (params.reactivity || 1);
        u.uRMS.value = audio.rms || 0;
        u.uBeatIntensity.value = audio.beatIntensity || 0;
        u.uDropDecay.value = audio.dropDecay || 0;
        u.uWobbleLFO.value = audio.wobbleLFO || 0;

        u.uTime.value = this.time;
        u.uDT.value = Math.min(dt, 0.05);
        u.uGravity.value = params.gravity ?? 0.5;
        u.uVortex.value = params.vortexStrength ?? 1.5;
        u.uTurbulence.value = params.turbulence ?? 1.0;
        u.uDamping.value = params.damping ?? 0.98;
        u.uNoiseScale.value = params.noiseScale ?? 1.5;
        u.uReturn.value = params.returnForce ?? 0.05;
        u.uBassExplosion.value = params.bassExplosion ?? 2.0;
        u.uAttractorCount.value = params.attractorCount ?? 2;
        u.uBurst.value = params.burstOnBeat !== false;

        // Step 1: Update velocities
        u.uPositions.value = this.posRT[readIdx].texture;
        u.uVelocities.value = this.velRT[readIdx].texture;
        u.uMode.value = 1;
        renderer.setRenderTarget(this.velRT[writeIdx]);
        renderer.render(this.simScene, this.simCamera);

        // Step 2: Update positions
        u.uPositions.value = this.posRT[readIdx].texture;
        u.uVelocities.value = this.velRT[writeIdx].texture;
        u.uMode.value = 0;
        renderer.setRenderTarget(this.posRT[writeIdx]);
        renderer.render(this.simScene, this.simCamera);

        renderer.setRenderTarget(null);

        // Update render material
        const ru = this.renderMaterial.uniforms;
        ru.uPositionTexture.value = this.posRT[writeIdx].texture;
        ru.uVelocityTexture.value = this.velRT[writeIdx].texture;
        ru.uPointSize.value = params.pointSize ?? 3.0;
        const colorModes = ['velocity', 'position', 'age', 'frequency', 'white'];
        ru.uColorMode.value = colorModes.indexOf(params.colorMode || 'velocity');
        ru.uTime.value = this.time;
        ru.uBass.value = audio.smoothBands?.bass || 0;
        ru.uRMS.value = audio.rms || 0;

        // Rotate particle system
        if (this.particleMesh) {
            this.particleMesh.rotation.y += (params.rotationSpeed ?? 0.3) * dt * (1 + (audio.rms || 0));
        }

        this.frame++;
    },

    destroy(scene) {
        if (this.particleMesh) {
            scene.remove(this.particleMesh);
            this.particleMesh.geometry.dispose();
            this.renderMaterial.dispose();
        }
        if (this.simQuad) {
            this.simQuad.geometry.dispose();
            this.simMaterial.dispose();
        }
        if (this.posRT) {
            this.posRT[0].dispose();
            this.posRT[1].dispose();
        }
        if (this.velRT) {
            this.velRT[0].dispose();
            this.velRT[1].dispose();
        }
        this.particleMesh = null;
        this.simMaterial = null;
        this.renderMaterial = null;
        this.posRT = null;
        this.velRT = null;
        this.simScene = null;
        this.simQuad = null;
    }
};
