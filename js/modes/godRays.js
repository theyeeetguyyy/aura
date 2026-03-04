// ============================================================
// AURA Mode — God Rays V2
// Volumetric light cones with prismatic split, dual source,
// pulsation wave, particle dust, atmospheric scatter
// ============================================================

const GodRaysMode = {
    name: 'God Rays',
    mesh: null,
    material: null,
    rays: [],
    group: null,
    time: 0,
    dustParticles: null,
    secondOrb: null,

    params: {
        rayCount: { type: 'range', min: 3, max: 30, default: 12, step: 1, label: 'Ray Count' },
        rayLength: { type: 'range', min: 20, max: 200, default: 100, step: 5, label: 'Length' },
        rayWidth: { type: 'range', min: 0.5, max: 10, default: 3, step: 0.5, label: 'Width' },
        spread: { type: 'range', min: 0, max: 2, default: 1, step: 0.1, label: 'Spread' },
        rotationSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: 'Rotation' },
        pulseIntensity: { type: 'range', min: 0, max: 3, default: 1.5, step: 0.1, label: 'Pulse' },
        centerGlow: { type: 'range', min: 0, max: 2, default: 1, step: 0.1, label: 'Center Glow' },
        style: { type: 'select', options: ['beams', 'cones', 'lasers', 'halos'], default: 'beams', label: 'Style' },
        oscillate: { type: 'toggle', default: true, label: 'Oscillate' },
        // V2 params
        rayMode: { type: 'select', options: ['standard', 'prismatic', 'volumetric', 'laser', 'aurora', 'radiance'], default: 'standard', label: '🔆 Ray Mode' },
        dualSource: { type: 'toggle', default: false, label: '⚡ Dual Source' },
        dualDistance: { type: 'range', min: 5, max: 40, default: 15, step: 1, label: 'Dual Distance' },
        prismaticSplit: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌈 Prismatic' },
        godRayFlicker: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '💫 Flicker' },
        rayTaper: { type: 'range', min: 0, max: 1, default: 0.3, step: 0.05, label: '📐 Taper' },
        innerRimGlow: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '✨ Rim Glow' },
        particleDust: { type: 'toggle', default: false, label: '🌟 Dust Particles' },
        dustDensity: { type: 'range', min: 500, max: 5000, default: 2000, step: 250, label: 'Dust Count' },
        pulsationWave: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌊 Pulse Wave' },
        colorPerRay: { type: 'toggle', default: false, label: '🎨 Color per Ray' },
        beatFlare: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '💥 Beat Flare' },
        dropBurst: { type: 'toggle', default: true, label: '🔥 Drop Burst' },
        raySpiral: { type: 'range', min: 0, max: 2, default: 0, step: 0.1, label: '🌀 Spiral' },
        atmosphericScatter: { type: 'range', min: 0, max: 2, default: 0, step: 0.1, label: '🌫️ Scatter' }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 120);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.buildRays(12);
    },

    buildRays(count) {
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }
        this.rays = [];
        this.dustParticles = null;
        this.secondOrb = null;

        // Center orb
        const orbGeo = new THREE.SphereGeometry(3, 16, 16);
        const orbMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.name = 'orb';
        this.group.add(orb);

        // Second orb for dual source
        const orb2Geo = new THREE.SphereGeometry(2.5, 16, 16);
        const orb2Mat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending
        });
        this.secondOrb = new THREE.Mesh(orb2Geo, orb2Mat);
        this.secondOrb.name = 'orb2';
        this.group.add(this.secondOrb);

        // Inner rim glow
        const rimGeo = new THREE.RingGeometry(4, 8, 32);
        const rimMat = new THREE.MeshBasicMaterial({
            color: 0x8b5cf6, transparent: true, opacity: 0.2,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.name = 'rim';
        this.group.add(rim);

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const geo = new THREE.BufferGeometry();
            const vertices = new Float32Array([
                0, 0, 0,
                -1, 80, 0,
                1, 80, 0
            ]);
            geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

            const mat = new THREE.MeshBasicMaterial({
                color: 0x8b5cf6, transparent: true, opacity: 0.4,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.z = angle;
            this.group.add(mesh);
            this.rays.push({ mesh, baseAngle: angle, flickerPhase: Math.random() * Math.PI * 2 });
        }
    },

    buildDust(count) {
        if (this.dustParticles) {
            this.group.remove(this.dustParticles);
            this.dustParticles.geometry.dispose();
            this.dustParticles.material.dispose();
        }
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 100;
            pos[i * 3] = Math.cos(angle) * r;
            pos[i * 3 + 1] = Math.sin(angle) * r;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
            cols[i * 3] = 1; cols[i * 3 + 1] = 0.8; cols[i * 3 + 2] = 0.6;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        this.dustParticles = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.8, vertexColors: true, transparent: true, opacity: 0.3,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.dustParticles);
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        const count = Math.floor(params.rayCount || 12);
        if (count !== this.rays.length) this.buildRays(count);

        const rayLen = params.rayLength || 100;
        const rayW = params.rayWidth || 3;
        const pulseInt = params.pulseIntensity || 1.5;
        const rotSpeed = params.rotationSpeed || 0.5;
        const reactivity = params.reactivity || 1;
        const oscillate = params.oscillate;
        const centerGlow = params.centerGlow || 1;
        const rayMode = params.rayMode || 'standard';
        const prismatic = params.prismaticSplit || 0;
        const flicker = params.godRayFlicker || 0;
        const taper = params.rayTaper || 0.3;
        const rimGlow = params.innerRimGlow || 0.5;
        const pulsationWave = params.pulsationWave || 0;
        const beatFlare = params.beatFlare || 1;
        const raySpiral = params.raySpiral || 0;
        const scatter = params.atmosphericScatter || 0;

        const bass = audio.smoothBands.bass;
        const mid = audio.smoothBands.mid;
        const treble = audio.smoothBands.treble;
        const rms = audio.rms;
        const beat = audio.beat;
        const beatInt = audio.beatIntensity;

        // Update center orb
        const orb = this.group.getObjectByName('orb');
        if (orb) {
            const orbScale = 3 + bass * 5 * centerGlow * reactivity;
            orb.scale.set(orbScale, orbScale, orbScale);
            orb.material.opacity = 0.3 + rms * centerGlow;
            orb.material.color = ParamSystem.getColorThree(bass + this.time * 0.05);
        }

        // Dual source
        if (this.secondOrb) {
            const dual = params.dualSource;
            const dualDist = params.dualDistance || 15;
            this.secondOrb.visible = dual;
            if (dual) {
                this.secondOrb.position.set(
                    Math.cos(this.time * 0.5) * dualDist,
                    Math.sin(this.time * 0.5) * dualDist, 0
                );
                this.secondOrb.material.opacity = 0.5 + rms * 0.3;
                this.secondOrb.material.color = ParamSystem.getColorThree(mid + this.time * 0.08);
                const s2 = 2 + mid * 3 * centerGlow;
                this.secondOrb.scale.setScalar(s2);
            }
        }

        // Rim glow
        const rim = this.group.getObjectByName('rim');
        if (rim) {
            const rimScale = 1 + bass * rimGlow * 2;
            rim.scale.setScalar(rimScale);
            rim.material.opacity = 0.1 + rms * rimGlow * 0.3;
            rim.rotation.z = this.time * 0.3;
        }

        // Update rays
        for (let i = 0; i < this.rays.length; i++) {
            const ray = this.rays[i];
            const t = i / this.rays.length;
            const freqIdx = Math.floor(t * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[freqIdx] || 0) / 255;

            // Dynamic length with pulsation wave
            let len = rayLen * (0.3 + freq * pulseInt * reactivity);
            if (pulsationWave > 0) {
                len *= 1 + Math.sin(t * Math.PI * 2 * 3 + this.time * pulsationWave * 2) * 0.3;
            }

            // Flicker
            if (flicker > 0) {
                len *= 1 + Math.sin(this.time * 15 + ray.flickerPhase) * flicker * 0.1;
            }

            // Oscillation  
            const osc = oscillate ? Math.sin(this.time * 2 + i * 0.5) * 0.3 : 0;

            // Spiral
            if (raySpiral > 0) {
                ray.mesh.rotation.z = ray.baseAngle + Math.sin(this.time * raySpiral + t * Math.PI * 4) * 0.2;
            }

            // Update geometry
            const pos = ray.mesh.geometry.attributes.position.array;
            const width = rayW * (1 + freq * reactivity);
            const tipWidth = width * (1 - taper);
            pos[3] = -tipWidth; pos[4] = len * (1 + osc); pos[5] = 0;
            pos[6] = tipWidth; pos[7] = len * (1 + osc); pos[8] = 0;
            ray.mesh.geometry.attributes.position.needsUpdate = true;

            // Color
            let color;
            if (params.colorPerRay) {
                color = ParamSystem.getColorThree(t + this.time * 0.02);
            } else if (rayMode === 'prismatic' && prismatic > 0) {
                color = new THREE.Color().setHSL(t + prismatic * 0.1, 1, 0.5 + rms * 0.3);
            } else {
                color = ParamSystem.getColorThree(t + rms);
            }
            ray.mesh.material.color = color;

            // Opacity
            let opacity = 0.15 + freq * 0.5;
            if (scatter > 0) opacity += scatter * 0.1 * Math.exp(-t * scatter);
            ray.mesh.material.opacity = opacity;

            // Beat flare
            if (beat && beatFlare > 0) {
                ray.mesh.material.opacity = Math.min(1, opacity + beatInt * beatFlare * 0.3);
            }

            // Drop burst
            if (params.dropBurst && audio.isDrop) {
                ray.mesh.material.opacity = Math.min(1, opacity + audio.dropIntensity * 0.5);
            }
        }

        // Dust particles
        if (params.particleDust) {
            const dustCount = Math.floor(params.dustDensity || 2000);
            if (!this.dustParticles) this.buildDust(dustCount);
            if (this.dustParticles) {
                this.dustParticles.visible = true;
                this.dustParticles.rotation.z += 0.002 * (1 + bass);
                this.dustParticles.material.opacity = 0.1 + rms * 0.2;
                const dPos = this.dustParticles.geometry.attributes.position.array;
                const dCol = this.dustParticles.geometry.attributes.color.array;
                const dCount = dPos.length / 3;
                for (let i = 0; i < dCount; i++) {
                    const i3 = i * 3;
                    const dist = Math.sqrt(dPos[i3] ** 2 + dPos[i3 + 1] ** 2);
                    dPos[i3] += Math.sin(this.time + i * 0.01) * 0.02;
                    dPos[i3 + 1] += Math.cos(this.time * 0.7 + i * 0.01) * 0.02;
                    const c = ParamSystem.getColorThreeHSL(dist / 100 + this.time * 0.02);
                    dCol[i3] = c.r; dCol[i3 + 1] = c.g; dCol[i3 + 2] = c.b;
                }
                this.dustParticles.geometry.attributes.position.needsUpdate = true;
                this.dustParticles.geometry.attributes.color.needsUpdate = true;
            }
        } else if (this.dustParticles) {
            this.dustParticles.visible = false;
        }

        // Rotate group
        this.group.rotation.z += rotSpeed * dt * (1 + bass * reactivity);
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(this.group);
        }
        this.rays = [];
        this.dustParticles = null;
        this.secondOrb = null;
    }
};
