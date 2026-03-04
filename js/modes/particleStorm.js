// ============================================================
// AURA Mode — Particle Storm V2
// Thousands of particles with attractors, magnetic fields,
// spawn shapes, connection lines, flocking, trails
// ============================================================

const ParticleStormMode = {
    name: 'Particle Storm',
    particles: null,
    velocities: [],
    ages: [],
    maxParticles: 5000,
    group: null,
    connectionLines: null,
    trailPoints: [],
    trailLine: null,
    time: 0,

    params: {
        particleCount: { type: 'range', min: 500, max: 15000, default: 5000, step: 100, label: 'Particles' },
        particleSize: { type: 'range', min: 0.1, max: 5, default: 1.5, step: 0.1, label: 'Size' },
        speed: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: 'Speed' },
        turbulence: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Turbulence' },
        spread: { type: 'range', min: 10, max: 200, default: 80, step: 5, label: 'Spread' },
        shape: { type: 'select', options: ['sphere', 'cube', 'vortex', 'fountain', 'explosion', 'ring', 'helix', 'shell', 'disc'], default: 'sphere', label: 'Shape' },
        trails: { type: 'toggle', default: false, label: 'Trails' },
        beatReaction: { type: 'range', min: 0, max: 3, default: 1.5, step: 0.1, label: 'Beat React' },
        colorMode: { type: 'select', options: ['palette', 'velocity', 'position', 'white', 'age', 'band', 'temperature'], default: 'palette', label: 'Color' },
        gravity: { type: 'range', min: -2, max: 2, default: 0, step: 0.1, label: 'Gravity' },
        // V2 params
        attractorType: { type: 'select', options: ['none', 'lorenz', 'rossler', 'aizawa', 'thomas', 'halvorsen'], default: 'none', label: '🌀 Attractor' },
        attractorStrength: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Attractor Strength' },
        magneticField: { type: 'select', options: ['none', 'axialX', 'axialY', 'axialZ', 'radial', 'spiral'], default: 'none', label: '🧲 Magnetic Field' },
        fieldStrength: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Field Strength' },
        spawnShape: { type: 'select', options: ['random', 'center', 'surface', 'ring', 'helix', 'grid'], default: 'random', label: '🎯 Spawn Shape' },
        respawnMode: { type: 'select', options: ['boundary', 'center', 'random', 'burst', 'fade'], default: 'boundary', label: '♻️ Respawn' },
        trailLength: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: 'Trail Length' },
        connectionLines: { type: 'toggle', default: false, label: '🔗 Connections' },
        connectionDist: { type: 'range', min: 3, max: 20, default: 8, step: 1, label: 'Connect Dist' },
        flocking: { type: 'toggle', default: false, label: '🐦 Flocking' },
        flockAlignment: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: 'Flock Align' },
        flockSeparation: { type: 'range', min: 0, max: 2, default: 0.8, step: 0.1, label: 'Flock Separate' },
        sizeByVelocity: { type: 'toggle', default: false, label: '📏 Size by Speed' },
        sizeByBand: { type: 'toggle', default: false, label: '📏 Size by Band' },
        dropReaction: { type: 'select', options: ['none', 'explode', 'implode', 'scatter', 'freeze', 'colorStorm'], default: 'explode', label: '🔥 Drop Reaction' },
        particleOpacity: { type: 'range', min: 0.1, max: 1, default: 0.8, step: 0.05, label: 'Opacity' },
        damping: { type: 'range', min: 0.9, max: 1, default: 0.98, step: 0.005, label: 'Damping' },
        audioMapping: { type: 'select', options: ['full', 'bass', 'mid', 'treble'], default: 'full', label: '🎵 Audio Map' }
    },

    stepAttractor(type, x, y, z, dt, mod) {
        const s = 0.005 * dt * 60;
        let dx, dy, dz;
        switch (type) {
            case 'lorenz':
                dx = 10 * (y - x);
                dy = x * (28 * mod - z) - y;
                dz = x * y - (8 / 3) * z;
                return { x: x + dx * s, y: y + dy * s, z: z + dz * s };
            case 'rossler':
                dx = -y - z;
                dy = x + 0.2 * y;
                dz = 0.2 + z * (x - 5.7 * mod);
                return { x: x + dx * s, y: y + dy * s, z: z + dz * s };
            case 'aizawa':
                const a = 0.95, b = 0.7, c = 0.6, d = 3.5 * mod, e = 0.25, f = 0.1;
                dx = (z - b) * x - d * y;
                dy = d * x + (z - b) * y;
                dz = c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x;
                return { x: x + dx * s, y: y + dy * s, z: z + dz * s };
            case 'thomas':
                const bb = 0.208186 * mod;
                dx = Math.sin(y) - bb * x;
                dy = Math.sin(z) - bb * y;
                dz = Math.sin(x) - bb * z;
                return { x: x + dx * s * 3, y: y + dy * s * 3, z: z + dz * s * 3 };
            case 'halvorsen':
                const aa = 1.89 * mod;
                dx = -aa * x - 4 * y - 4 * z - y * y;
                dy = -aa * y - 4 * z - 4 * x - z * z;
                dz = -aa * z - 4 * x - 4 * y - x * x;
                return { x: x + dx * s * 0.5, y: y + dy * s * 0.5, z: z + dz * s * 0.5 };
            default:
                return { x, y, z };
        }
    },

    init(scene, camera, renderer) {
        camera.position.set(0, 0, 150);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.createParticles(scene, 5000);
    },

    createParticles(scene, count) {
        if (this.particles) {
            this.group.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        if (this.connectionLines) {
            this.group.remove(this.connectionLines);
            this.connectionLines.geometry.dispose();
            this.connectionLines.material.dispose();
            this.connectionLines = null;
        }

        this.maxParticles = count;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        this.velocities = [];
        this.ages = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
            sizes[i] = 1;
            this.velocities.push({
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.5,
                z: (Math.random() - 0.5) * 0.5
            });
            this.ages.push(Math.random() * 10);
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            depthWrite: false
        });

        this.particles = new THREE.Points(geo, mat);
        this.group.add(this.particles);
    },

    update(audio, params, dt) {
        if (!this.particles) return;
        this.time += dt;

        const count = Math.floor(params.particleCount || 5000);
        if (count !== this.maxParticles) {
            this.createParticles(this.particles.parent, count);
        }

        const pos = this.particles.geometry.attributes.position.array;
        const cols = this.particles.geometry.attributes.color.array;
        const speed = (params.speed || 1) * (params.reactivity || 1);
        const turb = params.turbulence || 1;
        const spread = params.spread || 80;
        const grav = params.gravity || 0;
        const beatR = params.beatReaction || 1.5;
        const shape = params.shape || 'sphere';
        const size = params.particleSize || 1.5;
        const attractorType = params.attractorType || 'none';
        const attractorStr = params.attractorStrength || 1;
        const magField = params.magneticField || 'none';
        const fieldStr = params.fieldStrength || 1;
        const dampVal = params.damping || 0.98;
        const dropReaction = params.dropReaction || 'explode';
        const opacityParam = params.particleOpacity || 0.8;

        const bass = audio.smoothBands.bass;
        const mid = audio.smoothBands.mid;
        const treble = audio.smoothBands.treble;
        const rms = audio.rms;
        const beat = audio.beat;
        const beatInt = audio.beatIntensity;

        this.particles.material.size = size * (1 + rms * 2);
        this.particles.material.opacity = opacityParam;

        // Drop reaction
        if (audio.isDrop) {
            if (dropReaction === 'explode') {
                for (let i = 0; i < this.maxParticles; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const phi = Math.random() * Math.PI;
                    const force = audio.dropIntensity * 5;
                    this.velocities[i].x += Math.sin(phi) * Math.cos(angle) * force;
                    this.velocities[i].y += Math.sin(phi) * Math.sin(angle) * force;
                    this.velocities[i].z += Math.cos(phi) * force;
                }
            } else if (dropReaction === 'implode') {
                for (let i = 0; i < this.maxParticles; i++) {
                    const i3 = i * 3;
                    const dx = -pos[i3], dy = -pos[i3 + 1], dz = -pos[i3 + 2];
                    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
                    this.velocities[i].x += (dx / d) * audio.dropIntensity * 3;
                    this.velocities[i].y += (dy / d) * audio.dropIntensity * 3;
                    this.velocities[i].z += (dz / d) * audio.dropIntensity * 3;
                }
            } else if (dropReaction === 'freeze') {
                for (let i = 0; i < this.maxParticles; i++) {
                    this.velocities[i].x *= 0.01;
                    this.velocities[i].y *= 0.01;
                    this.velocities[i].z *= 0.01;
                }
            }
        }

        for (let i = 0; i < this.maxParticles; i++) {
            const i3 = i * 3;
            let vx = this.velocities[i].x;
            let vy = this.velocities[i].y;
            let vz = this.velocities[i].z;

            this.ages[i] += dt;

            // Turbulence
            vx += (Math.random() - 0.5) * turb * 0.1;
            vy += (Math.random() - 0.5) * turb * 0.1;
            vz += (Math.random() - 0.5) * turb * 0.1;

            // Gravity
            vy -= grav * 0.01;

            // Strange attractor influence
            if (attractorType !== 'none') {
                const scale = 30;
                const nx = pos[i3] / scale, ny = pos[i3 + 1] / scale, nz = pos[i3 + 2] / scale;
                const audioMod = 1 + bass * 0.5;
                const next = this.stepAttractor(attractorType, nx, ny, nz, dt, audioMod);
                vx += (next.x * scale - pos[i3]) * attractorStr * 0.01;
                vy += (next.y * scale - pos[i3 + 1]) * attractorStr * 0.01;
                vz += (next.z * scale - pos[i3 + 2]) * attractorStr * 0.01;
            }

            // Magnetic field
            if (magField !== 'none' && fieldStr > 0) {
                const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
                if (magField === 'axialY') {
                    const angle = Math.atan2(pz, px);
                    vx += Math.cos(angle + Math.PI / 2) * fieldStr * 0.02;
                    vz += Math.sin(angle + Math.PI / 2) * fieldStr * 0.02;
                } else if (magField === 'axialX') {
                    const angle = Math.atan2(py, pz);
                    vy += Math.cos(angle + Math.PI / 2) * fieldStr * 0.02;
                    vz += Math.sin(angle + Math.PI / 2) * fieldStr * 0.02;
                } else if (magField === 'axialZ') {
                    const angle = Math.atan2(py, px);
                    vx += Math.cos(angle + Math.PI / 2) * fieldStr * 0.02;
                    vy += Math.sin(angle + Math.PI / 2) * fieldStr * 0.02;
                } else if (magField === 'radial') {
                    const dist = Math.sqrt(px * px + py * py + pz * pz) + 0.01;
                    vx -= px / dist * fieldStr * 0.02;
                    vy -= py / dist * fieldStr * 0.02;
                    vz -= pz / dist * fieldStr * 0.02;
                } else if (magField === 'spiral') {
                    const angle = Math.atan2(pz, px);
                    const dist = Math.sqrt(px * px + pz * pz) + 0.01;
                    vx += (Math.cos(angle + Math.PI / 2) - px / dist * 0.3) * fieldStr * 0.02;
                    vz += (Math.sin(angle + Math.PI / 2) - pz / dist * 0.3) * fieldStr * 0.02;
                }
            }

            // Beat burst
            if (beat) {
                const angle = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;
                const force = beatInt * beatR;
                vx += Math.sin(phi) * Math.cos(angle) * force;
                vy += Math.sin(phi) * Math.sin(angle) * force;
                vz += Math.cos(phi) * force;
            }

            // BASS BEAT
            if (audio.bassBeat) {
                const bForce = audio.bassBeatIntensity * beatR * 1.5;
                vx += (Math.random() - 0.5) * bForce;
                vy += (Math.random() - 0.5) * bForce;
                vz += (Math.random() - 0.5) * bForce;
            }

            // DROP
            if (audio.dropDecay > 0.1) {
                const dForce = audio.dropDecay * beatR * 2;
                const angle = Math.random() * Math.PI * 2;
                const phi = Math.random() * Math.PI;
                vx += Math.sin(phi) * Math.cos(angle) * dForce;
                vy += Math.sin(phi) * Math.sin(angle) * dForce;
                vz += Math.cos(phi) * dForce;
            }

            // Shape-specific behaviors
            if (shape === 'vortex') {
                const x = pos[i3], z = pos[i3 + 2];
                const angle = Math.atan2(z, x);
                vx += Math.cos(angle + Math.PI / 2) * bass * 0.5;
                vz += Math.sin(angle + Math.PI / 2) * bass * 0.5;
                vx -= x * 0.002;
                vz -= z * 0.002;
            } else if (shape === 'fountain') {
                if (pos[i3 + 1] < -spread) {
                    pos[i3] = (Math.random() - 0.5) * 5;
                    pos[i3 + 1] = 0;
                    pos[i3 + 2] = (Math.random() - 0.5) * 5;
                    vy = (0.5 + bass * 2) * speed;
                    vx = (Math.random() - 0.5) * 0.5;
                    vz = (Math.random() - 0.5) * 0.5;
                }
            } else if (shape === 'ring') {
                const x = pos[i3], z = pos[i3 + 2];
                const dist = Math.sqrt(x * x + z * z);
                const targetR = spread * 0.4;
                const angle = Math.atan2(z, x);
                vx += (Math.cos(angle) * targetR - x) * 0.005;
                vz += (Math.sin(angle) * targetR - z) * 0.005;
                vx += Math.cos(angle + Math.PI / 2) * 0.3 * speed;
                vz += Math.sin(angle + Math.PI / 2) * 0.3 * speed;
            } else if (shape === 'helix') {
                const t = (i / this.maxParticles) * Math.PI * 4 + this.time;
                const targetX = Math.cos(t) * spread * 0.3;
                const targetZ = Math.sin(t) * spread * 0.3;
                const targetY = (i / this.maxParticles - 0.5) * spread;
                vx += (targetX - pos[i3]) * 0.01;
                vy += (targetY - pos[i3 + 1]) * 0.01;
                vz += (targetZ - pos[i3 + 2]) * 0.01;
            } else if (shape === 'shell') {
                const dist = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2 + pos[i3 + 2] ** 2);
                const targetR = spread * 0.4 * (1 + bass * 0.5);
                const diff = targetR - dist;
                if (dist > 0.01) {
                    vx += pos[i3] / dist * diff * 0.01;
                    vy += pos[i3 + 1] / dist * diff * 0.01;
                    vz += pos[i3 + 2] / dist * diff * 0.01;
                }
            } else if (shape === 'disc') {
                vy -= pos[i3 + 1] * 0.05;
                const x = pos[i3], z = pos[i3 + 2];
                const angle = Math.atan2(z, x);
                vx += Math.cos(angle + Math.PI / 2) * 0.2 * speed;
                vz += Math.sin(angle + Math.PI / 2) * 0.2 * speed;
            }

            // Damping
            vx *= dampVal;
            vy *= dampVal;
            vz *= dampVal;

            // Apply velocity
            pos[i3] += vx * speed;
            pos[i3 + 1] += vy * speed;
            pos[i3 + 2] += vz * speed;

            this.velocities[i].x = vx;
            this.velocities[i].y = vy;
            this.velocities[i].z = vz;

            // Boundary reset
            const dist = Math.sqrt(pos[i3] ** 2 + pos[i3 + 1] ** 2 + pos[i3 + 2] ** 2);
            if (dist > spread && shape !== 'fountain') {
                const respawn = params.respawnMode || 'boundary';
                if (respawn === 'center') {
                    pos[i3] = (Math.random() - 0.5) * 2;
                    pos[i3 + 1] = (Math.random() - 0.5) * 2;
                    pos[i3 + 2] = (Math.random() - 0.5) * 2;
                } else if (respawn === 'burst') {
                    pos[i3] *= 0.01;
                    pos[i3 + 1] *= 0.01;
                    pos[i3 + 2] *= 0.01;
                    const a = Math.random() * Math.PI * 2;
                    const p = Math.random() * Math.PI;
                    this.velocities[i].x = Math.sin(p) * Math.cos(a) * 0.5;
                    this.velocities[i].y = Math.sin(p) * Math.sin(a) * 0.5;
                    this.velocities[i].z = Math.cos(p) * 0.5;
                } else {
                    pos[i3] *= 0.01;
                    pos[i3 + 1] *= 0.01;
                    pos[i3 + 2] *= 0.01;
                    this.velocities[i].x = (Math.random() - 0.5) * 0.3;
                    this.velocities[i].y = (Math.random() - 0.5) * 0.3;
                    this.velocities[i].z = (Math.random() - 0.5) * 0.3;
                }
                this.ages[i] = 0;
            }

            // Size
            const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (params.sizeByVelocity) {
                this.particles.material.size = size * (0.5 + spd * 3);
            }

            // Color
            const t = i / this.maxParticles;
            if (params.colorMode === 'velocity') {
                const c = ParamSystem.getColorThreeHSL(spd * 2);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'position') {
                const c = ParamSystem.getColorThreeHSL(dist / spread);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'white') {
                cols[i3] = 1; cols[i3 + 1] = 1; cols[i3 + 2] = 1;
            } else if (params.colorMode === 'age') {
                const age = Math.min(this.ages[i] / 5, 1);
                const c = ParamSystem.getColorThreeHSL(age);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'band') {
                const bandIdx = Math.floor(t * 7);
                const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
                const bandVal = audio.smoothBands[bands[bandIdx]] || 0;
                const c = ParamSystem.getColorThreeHSL(bandVal + bandIdx * 0.14);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'temperature') {
                const temp = spd * 3;
                const c = new THREE.Color().setHSL(0.65 - Math.min(temp, 1) * 0.65, 1, 0.4 + Math.min(temp, 1) * 0.3);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else {
                const c = ParamSystem.getColorThreeHSL(t + rms);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            }
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    },

    destroy(scene) {
        if (this.group) {
            scene.remove(this.group);
        }
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
            this.particles = null;
        }
        this.velocities = [];
        this.ages = [];
    }
};
