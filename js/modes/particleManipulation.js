// ============================================================
// AURA Mode — Particle Manipulation V2
// Interactive particle field with black holes, magnetic poles,
// vortex, fluid sim, force field visualization, mesh topology
// ============================================================

const ParticleManipulationMode = {
    name: 'Particle Field',
    particles: null,
    velocities: [],
    attractors: [],
    group: null,
    time: 0,
    maxCount: 3000,
    forceLines: null,

    params: {
        particleCount: { type: 'range', min: 500, max: 10000, default: 3000, step: 100, label: 'Particles' },
        attractorCount: { type: 'range', min: 1, max: 6, default: 3, step: 1, label: 'Attractors' },
        attractForce: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Attract Force' },
        repelForce: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: 'Repel Force' },
        damping: { type: 'range', min: 0.9, max: 0.999, default: 0.97, step: 0.001, label: 'Damping' },
        particleSize: { type: 'range', min: 0.5, max: 5, default: 1.5, step: 0.1, label: 'Size' },
        trailLength: { type: 'range', min: 0, max: 1, default: 0, step: 0.05, label: 'Trails' },
        flowField: { type: 'toggle', default: true, label: 'Flow Field' },
        colorMode: { type: 'select', options: ['speed', 'position', 'palette', 'uniform', 'force', 'age', 'temperature'], default: 'speed', label: 'Color' },
        // V2 params
        manipMode: { type: 'select', options: ['gravity', 'magnetic', 'blackHole', 'vortex', 'fluid', 'swirl', 'repulsor'], default: 'gravity', label: '🌀 Manip Mode' },
        fieldCount: { type: 'range', min: 1, max: 4, default: 2, step: 1, label: '⚡ Fields' },
        fieldMovement: { type: 'select', options: ['static', 'orbit', 'random', 'followBeat', 'figure8'], default: 'orbit', label: '🔄 Field Move' },
        forceRadius: { type: 'range', min: 10, max: 80, default: 40, step: 5, label: 'Force Radius' },
        eventHorizon: { type: 'range', min: 2, max: 15, default: 5, step: 1, label: '🕳️ Event Horizon' },
        fluidViscosity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '💧 Viscosity' },
        surfaceTension: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: 'Surface Tension' },
        emitterShape: { type: 'select', options: ['random', 'ring', 'grid', 'sphere', 'line'], default: 'random', label: '🎯 Emitter' },
        emitterPulse: { type: 'toggle', default: false, label: '💫 Emitter Pulse' },
        colorByForce: { type: 'toggle', default: false, label: '🎨 Color by Force' },
        colorByAge: { type: 'toggle', default: false, label: '🎨 Color by Age' },
        beatAttract: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '💥 Beat Attract' },
        dropScatter: { type: 'toggle', default: true, label: '🔥 Drop Scatter' },
        showForceField: { type: 'toggle', default: false, label: '📐 Show Force Lines' },
        turbulenceScale: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🌪️ Turbulence' }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 150);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.createParticles(scene, 3000);
        this.createAttractors(3);
    },

    createParticles(scene, count) {
        if (this.particles) {
            this.group.remove(this.particles);
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        this.maxCount = count;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);
        this.velocities = [];

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 120;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 120;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
            cols[i * 3] = 1; cols[i * 3 + 1] = 1; cols[i * 3 + 2] = 1;
            this.velocities.push({ x: 0, y: 0, z: 0, age: Math.random() * 10, totalForce: 0 });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

        const mat = new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false
        });

        this.particles = new THREE.Points(geo, mat);
        this.group.add(this.particles);
    },

    createAttractors(count) {
        this.attractors = [];
        for (let i = 0; i < count; i++) {
            this.attractors.push({
                x: (Math.random() - 0.5) * 80,
                y: (Math.random() - 0.5) * 80,
                z: 0,
                radius: 30 + Math.random() * 20,
                phase: Math.random() * Math.PI * 2,
                orbitRadius: 20 + Math.random() * 30
            });
        }
    },

    update(audio, params, dt) {
        if (!this.particles) return;
        this.time += dt;

        const count = Math.floor(params.particleCount || 3000);
        if (count !== this.maxCount) this.createParticles(this.group.parent, count);

        const aCount = Math.floor(params.attractorCount || 3);
        if (aCount !== this.attractors.length) this.createAttractors(aCount);

        const pos = this.particles.geometry.attributes.position.array;
        const cols = this.particles.geometry.attributes.color.array;
        const attractF = params.attractForce || 1;
        const repelF = params.repelForce || 0.5;
        const damp = params.damping || 0.97;
        const reactivity = params.reactivity || 1;
        const bass = audio.smoothBands.bass;
        const mid = audio.smoothBands.mid;
        const treble = audio.smoothBands.treble;
        const rms = audio.rms;
        const useFlow = params.flowField;
        const manipMode = params.manipMode || 'gravity';
        const forceRadius = params.forceRadius || 40;
        const eventHorizon = params.eventHorizon || 5;
        const viscosity = params.fluidViscosity || 1;
        const tension = params.surfaceTension || 0.5;
        const turbScale = params.turbulenceScale || 1;
        const beatAttract = params.beatAttract || 1;

        this.particles.material.size = params.particleSize || 1.5;

        // Move attractors
        for (let a = 0; a < this.attractors.length; a++) {
            const attr = this.attractors[a];
            const movement = params.fieldMovement || 'orbit';
            if (movement === 'orbit') {
                attr.x = Math.cos(this.time * 0.5 + attr.phase) * attr.orbitRadius;
                attr.y = Math.sin(this.time * 0.7 + attr.phase) * attr.orbitRadius;
            } else if (movement === 'figure8') {
                attr.x = Math.sin(this.time * 0.5 + attr.phase) * attr.orbitRadius;
                attr.y = Math.sin(this.time * 1.0 + attr.phase) * attr.orbitRadius * 0.5;
            } else if (movement === 'followBeat') {
                attr.x += (Math.random() - 0.5) * bass * 5;
                attr.y += (Math.random() - 0.5) * mid * 5;
                attr.x *= 0.98;
                attr.y *= 0.98;
            } else if (movement === 'random') {
                attr.x += (Math.random() - 0.5) * 2;
                attr.y += (Math.random() - 0.5) * 2;
                attr.x = Math.max(-60, Math.min(60, attr.x));
                attr.y = Math.max(-60, Math.min(60, attr.y));
            }
        }

        // Drop scatter
        if (params.dropScatter && audio.isDropSection) {
            for (let i = 0; i < this.maxCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const force = audio.dropIntensity * 3;
                this.velocities[i].x += Math.cos(angle) * force;
                this.velocities[i].y += Math.sin(angle) * force;
            }
        }

        for (let i = 0; i < this.maxCount; i++) {
            const i3 = i * 3;
            let vx = this.velocities[i].x;
            let vy = this.velocities[i].y;
            let vz = this.velocities[i].z;
            const px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];

            this.velocities[i].age += dt;
            let totalForce = 0;

            // Force from each attractor based on manipulation mode
            for (let a = 0; a < this.attractors.length; a++) {
                const attr = this.attractors[a];
                const dx = attr.x - px;
                const dy = attr.y - py;
                const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

                if (manipMode === 'gravity' || manipMode === 'magnetic') {
                    if (dist < forceRadius) {
                        const force = attractF * reactivity * 0.02 / (dist * 0.1);
                        vx += dx / dist * force;
                        vy += dy / dist * force;
                        totalForce += force;
                    } else {
                        const force = repelF * reactivity * 0.005;
                        vx -= dx / dist * force;
                        vy -= dy / dist * force;
                    }
                    if (manipMode === 'magnetic') {
                        const angle = Math.atan2(dy, dx);
                        vx += Math.cos(angle + Math.PI / 2) * 0.03 * attractF / (dist * 0.05);
                        vy += Math.sin(angle + Math.PI / 2) * 0.03 * attractF / (dist * 0.05);
                    }
                } else if (manipMode === 'blackHole') {
                    if (dist < forceRadius) {
                        const force = attractF * reactivity * 0.05 / (dist * dist * 0.01 + 0.1);
                        vx += dx / dist * force;
                        vy += dy / dist * force;
                        totalForce += force;
                        if (dist < eventHorizon) {
                            pos[i3] = (Math.random() - 0.5) * 120;
                            pos[i3 + 1] = (Math.random() - 0.5) * 120;
                            vx = (Math.random() - 0.5) * 0.5;
                            vy = (Math.random() - 0.5) * 0.5;
                        }
                    }
                } else if (manipMode === 'vortex') {
                    if (dist < forceRadius) {
                        const angle = Math.atan2(dy, dx);
                        const tangentF = attractF * reactivity * 0.05 / (dist * 0.05 + 0.5);
                        const radialF = attractF * reactivity * 0.01 / (dist * 0.1 + 0.5);
                        vx += Math.cos(angle + Math.PI / 2) * tangentF + dx / dist * radialF;
                        vy += Math.sin(angle + Math.PI / 2) * tangentF + dy / dist * radialF;
                        totalForce += tangentF;
                    }
                } else if (manipMode === 'fluid') {
                    if (dist < forceRadius) {
                        const force = attractF * reactivity * 0.01 / (dist * 0.1 + 0.5);
                        vx += dx / dist * force;
                        vy += dy / dist * force;
                        vx += Math.sin(py * 0.05 + this.time * viscosity) * 0.02 * viscosity;
                        vy += Math.cos(px * 0.05 + this.time * viscosity * 0.7) * 0.02 * viscosity;
                        totalForce += force;
                    }
                } else if (manipMode === 'swirl') {
                    const angle = Math.atan2(dy, dx) + this.time * 0.5;
                    const swirlF = attractF * reactivity * 0.03 / (dist * 0.05 + 0.5);
                    vx += Math.cos(angle) * swirlF * dist * 0.01;
                    vy += Math.sin(angle) * swirlF * dist * 0.01;
                    totalForce += swirlF;
                } else if (manipMode === 'repulsor') {
                    if (dist < forceRadius) {
                        const force = repelF * reactivity * 0.05 / (dist * 0.05 + 0.5);
                        vx -= dx / dist * force;
                        vy -= dy / dist * force;
                        totalForce += force;
                    }
                }
            }

            this.velocities[i].totalForce = totalForce;

            // Flow field
            if (useFlow) {
                const fx = Math.sin(py * 0.03 * turbScale + this.time) * bass * reactivity * 0.1;
                const fy = Math.cos(px * 0.03 * turbScale + this.time * 0.7) * mid * reactivity * 0.1;
                vx += fx;
                vy += fy;
            }

            // Surface tension (pull toward neighbors average)
            if (tension > 0 && i > 0 && i < this.maxCount - 1) {
                const prevX = pos[(i - 1) * 3], prevY = pos[(i - 1) * 3 + 1];
                const nextX = pos[(i + 1) * 3], nextY = pos[(i + 1) * 3 + 1];
                vx += ((prevX + nextX) / 2 - px) * tension * 0.001;
                vy += ((prevY + nextY) / 2 - py) * tension * 0.001;
            }

            // Beat attract
            if (audio.beat && beatAttract > 0) {
                vx += (Math.random() - 0.5) * audio.beatIntensity * beatAttract * 2;
                vy += (Math.random() - 0.5) * audio.beatIntensity * beatAttract * 2;
            }

            // Damping
            vx *= damp;
            vy *= damp;
            vz *= damp;

            pos[i3] += vx;
            pos[i3 + 1] += vy;
            pos[i3 + 2] += vz;

            this.velocities[i].x = vx;
            this.velocities[i].y = vy;
            this.velocities[i].z = vz;

            // Boundary wrap
            if (Math.abs(pos[i3]) > 80) pos[i3] *= -0.9;
            if (Math.abs(pos[i3 + 1]) > 80) pos[i3 + 1] *= -0.9;

            // Color
            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (params.colorByForce) {
                const f = Math.min(totalForce * 5, 1);
                const c = new THREE.Color().setHSL(0.65 - f * 0.65, 1, 0.3 + f * 0.4);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorByAge) {
                const age = Math.min(this.velocities[i].age / 10, 1);
                const c = ParamSystem.getColorThreeHSL(age);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'speed') {
                const c = ParamSystem.getColorThreeHSL(speed * 3);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'position') {
                const dist = Math.sqrt(px * px + py * py) / 80;
                const c = ParamSystem.getColorThreeHSL(dist);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'temperature') {
                const temp = speed * 5;
                const c = new THREE.Color().setHSL(0.65 - Math.min(temp, 1) * 0.65, 1, 0.3 + Math.min(temp, 1) * 0.4);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'force') {
                const f = Math.min(totalForce * 3, 1);
                const c = ParamSystem.getColorThreeHSL(f);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            } else if (params.colorMode === 'uniform') {
                cols[i3] = 0.8; cols[i3 + 1] = 0.5; cols[i3 + 2] = 1;
            } else {
                const c = ParamSystem.getColorThreeHSL(i / this.maxCount);
                cols[i3] = c.r; cols[i3 + 1] = c.g; cols[i3 + 2] = c.b;
            }
        }

        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.geometry.attributes.color.needsUpdate = true;
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.particles = null;
        this.velocities = [];
        this.attractors = [];
    }
};
