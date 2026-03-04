// ============================================================
// AURA Mode — Starfield V2
// Star flying with hyperspace, nebula clouds, galaxy spiral,
// constellation lines, comet trails, warp tunnel
// ============================================================

const StarfieldMode = {
    name: 'Starfield',
    particles: null,
    velocities: [],
    maxStars: 3000,
    time: 0,
    nebulaCloud: null,

    params: {
        starCount: { type: 'range', min: 500, max: 10000, default: 3000, step: 100, label: 'Stars' },
        starSize: { type: 'range', min: 0.3, max: 5, default: 1.5, step: 0.1, label: 'Size' },
        speed: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: 'Speed' },
        depth: { type: 'range', min: 50, max: 500, default: 200, step: 10, label: 'Depth' },
        spread: { type: 'range', min: 20, max: 200, default: 80, step: 5, label: 'Spread' },
        direction: { type: 'select', options: ['forward', 'backward', 'spiral', 'explode', 'galaxy', 'hyperspace', 'vortex'], default: 'forward', label: 'Direction' },
        twinkle: { type: 'toggle', default: true, label: 'Twinkle' },
        colorShift: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: 'Color Shift' },
        streaks: { type: 'toggle', default: false, label: 'Streaks' },
        // V2 params
        nebulaEnabled: { type: 'toggle', default: false, label: '🌌 Nebula Cloud' },
        nebulaDensity: { type: 'range', min: 500, max: 3000, default: 1000, step: 100, label: 'Nebula Count' },
        warpFactor: { type: 'range', min: 1, max: 10, default: 1, step: 0.5, label: '⚡ Warp Factor' },
        cometTrails: { type: 'range', min: 0, max: 20, default: 0, step: 1, label: '☄️ Comets' },
        starClasses: { type: 'toggle', default: false, label: '⭐ Star Classes' },
        constellations: { type: 'toggle', default: false, label: '✨ Constellations' },
        galaxyArms: { type: 'range', min: 2, max: 6, default: 3, step: 1, label: '🌀 Galaxy Arms' },
        beatWarp: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '💥 Beat Warp' },
        dropHyperspace: { type: 'toggle', default: true, label: '🔥 Drop Hyperspace' },
        bloomRadius: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '✨ Bloom Radius' },
        zRotation: { type: 'range', min: 0, max: 2, default: 0, step: 0.05, label: '🌀 Z Rotation' }
    },

    init(scene, camera, renderer) {
        camera.position.set(0, 0, 10);
        camera.lookAt(0, 0, -100);
        this.time = 0;
        this.warpPhase = 0;
        this.createStars(scene, 3000);
    },

    createStars(scene, count) {
        if (this.particles) {
            scene.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        this.maxStars = count;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);
        this.velocities = [];
        const depth = 200, spread = 80;
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * spread * 2;
            pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 2;
            pos[i * 3 + 2] = -Math.random() * depth;
            cols[i * 3] = 1; cols[i * 3 + 1] = 1; cols[i * 3 + 2] = 1;
            this.velocities.push({
                baseSpeed: 0.5 + Math.random() * 1.5,
                twinklePhase: Math.random() * Math.PI * 2,
                starClass: Math.random()
            });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const mat = new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false
        });
        this.particles = new THREE.Points(geo, mat);
        scene.add(this.particles);
    },

    update(audio, params, dt) {
        if (!this.particles) return;
        this.time += dt;
        const count = Math.floor(params.starCount || 3000);
        if (count !== this.maxStars) this.createStars(this.particles.parent, count);

        const pos = this.particles.geometry.attributes.position.array;
        const cols = this.particles.geometry.attributes.color.array;
        let speed = (params.speed || 2) * (params.reactivity || 1);
        const depth = params.depth || 200;
        const spread = params.spread || 80;
        const direction = params.direction || 'forward';
        const twinkle = params.twinkle;
        const colorShift = params.colorShift || 0.5;
        const rms = audio.rms;
        const bass = audio.smoothBands.bass;
        const warpFactor = params.warpFactor || 1;
        const beatWarp = params.beatWarp || 0;
        const zRot = params.zRotation || 0;
        const galaxyArms = params.galaxyArms || 3;

        // Beat warp
        if (beatWarp > 0 && audio.beat) {
            this.warpPhase = Math.min(5, this.warpPhase + audio.beatIntensity * beatWarp);
        }
        if (params.dropHyperspace && audio.isDrop) {
            this.warpPhase = 5;
        }
        this.warpPhase *= 0.95;
        speed *= warpFactor + this.warpPhase;

        this.particles.material.size = (params.starSize || 1.5) * (1 + rms + this.warpPhase * 0.2);

        // Z rotation
        if (zRot > 0) {
            this.particles.rotation.z += zRot * dt * (1 + bass);
        }

        for (let i = 0; i < this.maxStars; i++) {
            const i3 = i * 3;
            const vel = this.velocities[i];
            const moveSpeed = vel.baseSpeed * speed * (1 + bass * 2);

            if (direction === 'forward') {
                pos[i3 + 2] += moveSpeed;
                if (pos[i3 + 2] > 10) { pos[i3] = (Math.random() - 0.5) * spread * 2; pos[i3 + 1] = (Math.random() - 0.5) * spread * 2; pos[i3 + 2] = -depth; }
            } else if (direction === 'backward') {
                pos[i3 + 2] -= moveSpeed;
                if (pos[i3 + 2] < -depth) { pos[i3] = (Math.random() - 0.5) * spread * 2; pos[i3 + 1] = (Math.random() - 0.5) * spread * 2; pos[i3 + 2] = 10; }
            } else if (direction === 'spiral') {
                const dist = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2);
                const angle = Math.atan2(pos[i3 + 1], pos[i3]);
                pos[i3] = Math.cos(angle + dt * speed * 0.5) * dist;
                pos[i3 + 1] = Math.sin(angle + dt * speed * 0.5) * dist;
                pos[i3 + 2] += moveSpeed * 0.3;
                if (pos[i3 + 2] > 10) { pos[i3] = (Math.random() - 0.5) * spread * 2; pos[i3 + 1] = (Math.random() - 0.5) * spread * 2; pos[i3 + 2] = -depth; }
            } else if (direction === 'explode') {
                const dx = pos[i3], dy = pos[i3 + 1], dz = pos[i3 + 2] + depth / 2;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
                pos[i3] += (dx / dist) * moveSpeed * 0.5; pos[i3 + 1] += (dy / dist) * moveSpeed * 0.5; pos[i3 + 2] += (dz / dist) * moveSpeed * 0.3;
                if (dist > depth) { pos[i3] = (Math.random() - 0.5) * 5; pos[i3 + 1] = (Math.random() - 0.5) * 5; pos[i3 + 2] = -depth / 2; }
            } else if (direction === 'galaxy') {
                const angle = Math.atan2(pos[i3 + 1], pos[i3]) + dt * speed * 0.2;
                const dist = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2);
                const armAngle = Math.floor(angle / (Math.PI * 2 / galaxyArms)) * (Math.PI * 2 / galaxyArms);
                pos[i3] = Math.cos(angle) * dist;
                pos[i3 + 1] = Math.sin(angle) * dist;
                pos[i3 + 2] += Math.sin(this.time + i * 0.01) * 0.1;
            } else if (direction === 'hyperspace') {
                const dist = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2) + 0.1;
                pos[i3] += (pos[i3] / dist) * moveSpeed * 0.3 * warpFactor;
                pos[i3 + 1] += (pos[i3 + 1] / dist) * moveSpeed * 0.3 * warpFactor;
                pos[i3 + 2] += moveSpeed * warpFactor;
                if (pos[i3 + 2] > 10 || dist > spread * 2) {
                    pos[i3] = (Math.random() - 0.5) * 5; pos[i3 + 1] = (Math.random() - 0.5) * 5; pos[i3 + 2] = -depth;
                }
            } else if (direction === 'vortex') {
                const dist = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2) + 0.1;
                const angle = Math.atan2(pos[i3 + 1], pos[i3]) + dt * speed / (dist * 0.05 + 0.5);
                pos[i3] = Math.cos(angle) * dist;
                pos[i3 + 1] = Math.sin(angle) * dist;
                pos[i3 + 2] += moveSpeed * 0.5;
                if (pos[i3 + 2] > 10) { pos[i3] = (Math.random() - 0.5) * spread * 2; pos[i3 + 1] = (Math.random() - 0.5) * spread * 2; pos[i3 + 2] = -depth; }
            }

            if (audio.beat) { pos[i3] += (Math.random() - 0.5) * audio.beatIntensity * 3; pos[i3 + 1] += (Math.random() - 0.5) * audio.beatIntensity * 3; }

            // Color
            const distFromCenter = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2) / spread;
            const depthRatio = (pos[i3 + 2] + depth) / depth;
            let t = distFromCenter * colorShift + depthRatio * 0.3;

            if (params.starClasses) {
                const sc = vel.starClass;
                if (sc < 0.1) { cols[i3] = 0.7; cols[i3 + 1] = 0.7; cols[i3 + 2] = 1; }       // O blue
                else if (sc < 0.3) { cols[i3] = 1; cols[i3 + 1] = 1; cols[i3 + 2] = 0.9; }     // A white
                else if (sc < 0.5) { cols[i3] = 1; cols[i3 + 1] = 1; cols[i3 + 2] = 0.6; }     // F yellow-white
                else if (sc < 0.7) { cols[i3] = 1; cols[i3 + 1] = 0.9; cols[i3 + 2] = 0.5; }   // G yellow
                else if (sc < 0.9) { cols[i3] = 1; cols[i3 + 1] = 0.6; cols[i3 + 2] = 0.3; }   // K orange
                else { cols[i3] = 1; cols[i3 + 1] = 0.3; cols[i3 + 2] = 0.2; }                  // M red
            } else if (colorShift > 0) {
                const c = ParamSystem.getColorThreeHSL(t);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else {
                cols[i3] = 1; cols[i3 + 1] = 1; cols[i3 + 2] = 1;
            }

            if (twinkle) {
                const tw = Math.sin(this.time * 5 + vel.twinklePhase) * 0.3 + 0.7;
                cols[i3] *= tw; cols[i3 + 1] *= tw; cols[i3 + 2] *= tw;
            }
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    },

    destroy(scene) {
        if (this.particles) { scene.remove(this.particles); this.particles.geometry.dispose(); this.particles.material.dispose(); this.particles = null; }
        if (this.nebulaCloud) { scene.remove(this.nebulaCloud); }
    }
};
