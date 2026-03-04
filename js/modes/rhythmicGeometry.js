// ============================================================
// AURA Mode — RHYTHMIC GEOMETRY
// Beat-locked controlled geometrical madness.
// Every visual effect is quantized to musical timing:
// BPM-synced rotation, beatPhase displacement, impact waves,
// synchronized particle bursts, section-aware intensity.
// ============================================================

const RhythmicGeometryMode = {
    name: 'Rhythmic Geometry',
    group: null,
    time: 0,

    // Core shape
    coreGroup: null,
    coreMesh: null,
    coreWire: null,
    coreBasePos: null,
    coreNormals: null,
    currentShape: '',
    currentDetail: -1,

    // Outer rings
    ringMeshes: [],
    ringCount: 3,

    // Satellite shapes
    satellites: [],
    satelliteCount: 6,

    // Impact wave system
    impactWaves: [],
    maxWaves: 8,

    // Beat-synced particles
    particleSystem: null,
    particlePositions: null,
    particleColors: null,
    particleVelocities: [],
    maxParticles: 4000,

    // State tracking
    lastBeatCount: 0,
    lastBassBeatTime: 0,
    shapeIndex: 0,
    colorShiftPhase: 0,
    sectionScale: 1,
    targetSectionScale: 1,

    params: {
        // ── Core Shape ──
        coreShape: {
            type: 'select', options: [
                'icosahedron', 'dodecahedron', 'octahedron', 'torusKnot',
                'torus', 'sphere', 'cube', 'crystal', 'star'
            ], default: 'icosahedron', label: '🔷 Core Shape'
        },
        coreDetail: { type: 'range', min: 1, max: 5, default: 3, step: 1, label: 'Detail' },
        coreSize: { type: 'range', min: 8, max: 40, default: 18, step: 1, label: 'Core Size' },

        // ── Rhythmic Controls ──
        bpmSync: { type: 'toggle', default: true, label: '🎵 BPM Sync' },
        beatPulseAmount: { type: 'range', min: 0, max: 5, default: 2.5, step: 0.1, label: '💓 Beat Pulse' },
        beatRotation: { type: 'range', min: 0, max: 3, default: 1.5, step: 0.1, label: '🔄 Beat Rotation' },
        impactIntensity: { type: 'range', min: 0, max: 5, default: 3, step: 0.1, label: '💥 Impact Waves' },
        rhythmicDisplace: { type: 'range', min: 0, max: 15, default: 6, step: 0.5, label: '🌊 Rhythmic Displace' },

        // ── Displacement Style ──
        displaceStyle: {
            type: 'select', options: [
                'pulse', 'ripple', 'spike', 'breathe', 'harmonic', 'shockwave'
            ], default: 'pulse', label: '🌊 Displace Style'
        },

        // ── Rings & Satellites ──
        showRings: { type: 'toggle', default: true, label: '⭕ Outer Rings' },
        ringStyle: { type: 'select', options: ['solid', 'dashed', 'pulsing'], default: 'pulsing', label: 'Ring Style' },
        showSatellites: { type: 'toggle', default: true, label: '🛰️ Satellites' },
        satelliteCount: { type: 'range', min: 2, max: 12, default: 6, step: 1, label: 'Satellite Count' },

        // ── Particles ──
        burstParticles: { type: 'toggle', default: true, label: '✨ Beat Bursts' },
        burstCount: { type: 'range', min: 10, max: 100, default: 40, step: 5, label: 'Burst Size' },
        particleTrail: { type: 'range', min: 0.9, max: 1, default: 0.97, step: 0.005, label: 'Trail Length' },

        // ── Visuals ──
        colorPalette: {
            type: 'select', options: [
                'neon', 'fire', 'ice', 'cosmic', 'void', 'rainbow', 'sunset', 'electric'
            ], default: 'neon', label: '🎨 Palette'
        },
        beatColorShift: { type: 'toggle', default: true, label: '🎨 Beat Color Shift' },
        wireOpacity: { type: 'range', min: 0, max: 1, default: 0.85, step: 0.05, label: 'Wire Opacity' },
        solidOpacity: { type: 'range', min: 0, max: 0.5, default: 0.2, step: 0.05, label: 'Solid Opacity' },
        glowIntensity: { type: 'range', min: 0, max: 3, default: 1.5, step: 0.1, label: '✨ Glow' },

        // ── Section Behavior ──
        sectionAware: { type: 'toggle', default: true, label: '📊 Section Aware' },
        dropExpansion: { type: 'range', min: 1, max: 3, default: 1.8, step: 0.1, label: '🔥 Drop Expansion' },
        calmTightness: { type: 'range', min: 0.3, max: 1, default: 0.6, step: 0.05, label: '🌙 Calm Scale' }
    },

    // ── NOISE ──
    noise3D(x, y, z) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    },

    // ── PALETTE ──
    getPaletteColor(palette, t, energy) {
        t = ((t % 1) + 1) % 1; // normalize 0-1
        switch (palette) {
            case 'fire': return new THREE.Color().setHSL(0.02 + t * 0.08, 1, 0.3 + t * 0.35 + energy * 0.15);
            case 'ice': return new THREE.Color().setHSL(0.55 + t * 0.12, 0.8, 0.35 + t * 0.3 + energy * 0.15);
            case 'cosmic': return new THREE.Color().setHSL(0.6 + t * 0.3, 0.9, 0.25 + t * 0.4 + energy * 0.15);
            case 'void': return new THREE.Color().setHSL(0.75 + t * 0.1, 0.3, 0.08 + t * 0.2 + energy * 0.1);
            case 'rainbow': return new THREE.Color().setHSL(t, 0.95, 0.5 + energy * 0.2);
            case 'sunset': return new THREE.Color().setHSL(0.95 + t * 0.12, 1, 0.35 + t * 0.3 + energy * 0.15);
            case 'electric': return new THREE.Color().setHSL(0.55 + t * 0.2, 1, 0.4 + t * 0.3 + energy * 0.2);
            default: // neon
                return new THREE.Color().setHSL(0.75 + t * 0.25, 1, 0.4 + t * 0.3 + energy * 0.2);
        }
    },

    // ── GEOMETRY FACTORY ──
    getCoreGeometry(shape, detail, size) {
        const d = Math.floor(detail), s = d + 2;
        switch (shape) {
            case 'dodecahedron': return new THREE.DodecahedronGeometry(size, d);
            case 'octahedron': return new THREE.OctahedronGeometry(size, d);
            case 'torusKnot': return new THREE.TorusKnotGeometry(size * 0.6, size * 0.2, s * 16, s * 4);
            case 'torus': return new THREE.TorusGeometry(size, size * 0.35, s * 4, s * 8);
            case 'sphere': return new THREE.SphereGeometry(size, s * 8, s * 6);
            case 'cube': return new THREE.BoxGeometry(size * 1.4, size * 1.4, size * 1.4, s * 2, s * 2, s * 2);
            case 'crystal': {
                const geo = new THREE.OctahedronGeometry(size, d);
                const p = geo.attributes.position.array;
                for (let i = 0; i < p.length; i += 3) {
                    p[i + 1] *= 1.8; // elongate Y
                }
                geo.computeVertexNormals();
                return geo;
            }
            case 'star': {
                const geo = new THREE.IcosahedronGeometry(size, d);
                const p = geo.attributes.position.array;
                for (let i = 0; i < p.length; i += 3) {
                    const len = Math.sqrt(p[i] ** 2 + p[i + 1] ** 2 + p[i + 2] ** 2) || 1;
                    const spikeFactor = 1 + Math.abs(Math.sin(Math.atan2(p[i + 1], p[i]) * 5)) * 0.4;
                    p[i] *= spikeFactor; p[i + 1] *= spikeFactor; p[i + 2] *= spikeFactor;
                }
                geo.computeVertexNormals();
                return geo;
            }
            default: return new THREE.IcosahedronGeometry(size, d);
        }
    },

    // ── INIT ──
    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 70);
        camera.lookAt(0, 0, 0);

        this.time = 0;
        this.lastBeatCount = 0;
        this.shapeIndex = 0;
        this.colorShiftPhase = 0;
        this.impactWaves = [];
        this.sectionScale = 1;
        this.targetSectionScale = 1;

        // Core shape group
        this.coreGroup = new THREE.Group();
        this.group.add(this.coreGroup);

        this.buildCore('icosahedron', 3, 18);
        this.buildRings(3);
        this.buildSatellites(6);
        this.initParticles();
        this.initImpactWaves();
    },

    buildCore(shape, detail, size) {
        if (this.coreMesh) {
            this.coreGroup.remove(this.coreMesh);
            this.coreMesh.geometry.dispose();
            this.coreMesh.material.dispose();
        }
        if (this.coreWire) {
            this.coreGroup.remove(this.coreWire);
            this.coreWire.geometry.dispose();
            this.coreWire.material.dispose();
        }
        this.currentShape = shape;
        this.currentDetail = detail;

        const geo = this.getCoreGeometry(shape, detail, size);
        this.coreBasePos = new Float32Array(geo.attributes.position.array);
        geo.computeVertexNormals();
        this.coreNormals = new Float32Array(geo.attributes.normal.array);

        // Vertex colors
        const vc = geo.attributes.position.count;
        const cols = new Float32Array(vc * 3).fill(1);
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));

        this.coreMesh = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.2,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.coreMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cols), 3));
        this.coreGroup.add(this.coreMesh);

        this.coreWire = new THREE.LineSegments(
            new THREE.WireframeGeometry(geo),
            new THREE.LineBasicMaterial({
                color: 0x8b5cf6, transparent: true, opacity: 0.85,
                blending: THREE.AdditiveBlending
            })
        );
        this.coreGroup.add(this.coreWire);
        geo.dispose();
    },

    buildRings(count) {
        this.ringMeshes.forEach(r => {
            this.group.remove(r);
            r.geometry.dispose();
            r.material.dispose();
        });
        this.ringMeshes = [];
        this.ringCount = count;

        for (let i = 0; i < count; i++) {
            const radius = 25 + i * 8;
            const geo = new THREE.TorusGeometry(radius, 0.15 + i * 0.05, 8, 128);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x8b5cf6, transparent: true, opacity: 0.4,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            const ring = new THREE.Mesh(geo, mat);
            ring.userData = { baseRadius: radius, index: i };
            this.group.add(ring);
            this.ringMeshes.push(ring);
        }
    },

    buildSatellites(count) {
        this.satellites.forEach(s => {
            this.group.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
            if (s.wire) {
                this.group.remove(s.wire);
                s.wire.geometry.dispose();
                s.wire.material.dispose();
            }
        });
        this.satellites = [];
        this.satelliteCount = count;

        const shapes = ['octahedron', 'tetrahedron', 'icosahedron', 'dodecahedron'];
        for (let i = 0; i < count; i++) {
            const size = 2 + Math.random() * 3;
            const geoType = shapes[i % shapes.length];
            let geo;
            switch (geoType) {
                case 'tetrahedron': geo = new THREE.TetrahedronGeometry(size, 1); break;
                case 'dodecahedron': geo = new THREE.DodecahedronGeometry(size, 0); break;
                case 'icosahedron': geo = new THREE.IcosahedronGeometry(size, 1); break;
                default: geo = new THREE.OctahedronGeometry(size, 1);
            }
            const mat = new THREE.MeshBasicMaterial({
                color: 0x5cf6f6, transparent: true, opacity: 0.3,
                blending: THREE.AdditiveBlending, depthWrite: false,
                wireframe: true
            });
            const mesh = new THREE.Mesh(geo, mat);

            const orbitRadius = 30 + Math.random() * 15;
            const orbitSpeed = 0.3 + Math.random() * 0.4;
            const orbitPhase = (i / count) * Math.PI * 2;
            const orbitTilt = (Math.random() - 0.5) * Math.PI * 0.5;

            mesh.userData = { orbitRadius, orbitSpeed, orbitPhase, orbitTilt, size };
            this.group.add(mesh);

            this.satellites.push({ mesh, wire: null });
        }
    },

    initParticles() {
        if (this.particleSystem) {
            this.group.remove(this.particleSystem);
            this.particleSystem.geometry.dispose();
            this.particleSystem.material.dispose();
        }
        const c = this.maxParticles;
        this.particlePositions = new Float32Array(c * 3);
        this.particleColors = new Float32Array(c * 3);
        this.particleVelocities = [];
        for (let i = 0; i < c; i++) {
            this.particleVelocities.push({ x: 0, y: 0, z: 0, life: 0 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.particlePositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.particleColors, 3));
        this.particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        this.group.add(this.particleSystem);
    },

    initImpactWaves() {
        this.impactWaves.forEach(w => {
            if (w.mesh) { this.group.remove(w.mesh); w.mesh.geometry.dispose(); w.mesh.material.dispose(); }
        });
        this.impactWaves = [];
        for (let i = 0; i < this.maxWaves; i++) {
            const geo = new THREE.TorusGeometry(1, 0.08, 8, 64);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.impactWaves.push({ mesh, radius: 0, life: 0, maxRadius: 60 });
        }
    },

    spawnImpactWave(intensity) {
        // Find inactive wave
        for (const wave of this.impactWaves) {
            if (wave.life <= 0) {
                wave.radius = 2;
                wave.life = 1;
                wave.maxRadius = 40 + intensity * 30;
                wave.mesh.visible = true;
                wave.mesh.material.opacity = 0.6 * intensity;
                break;
            }
        }
    },

    spawnBeatBurst(audio, params) {
        const count = Math.floor(params.burstCount || 40);
        const palette = params.colorPalette || 'neon';
        const beatPhase = audio.beatPhase || 0;

        for (let e = 0; e < count; e++) {
            let idx = -1;
            for (let i = 0; i < this.maxParticles; i++) {
                if (this.particleVelocities[i].life <= 0) { idx = i; break; }
            }
            if (idx === -1) break;

            // Spawn in a ring pattern for rhythmic feel
            const angle = (e / count) * Math.PI * 2 + beatPhase * Math.PI;
            const r = 5 + Math.random() * 10;
            const speed = 0.5 + audio.bassBeatIntensity * 2;

            this.particlePositions[idx * 3] = Math.cos(angle) * r;
            this.particlePositions[idx * 3 + 1] = (Math.random() - 0.5) * r * 0.5;
            this.particlePositions[idx * 3 + 2] = Math.sin(angle) * r;

            this.particleVelocities[idx] = {
                x: Math.cos(angle) * speed,
                y: (Math.random() - 0.5) * speed * 0.5,
                z: Math.sin(angle) * speed,
                life: 1
            };

            const c = this.getPaletteColor(palette, e / count + this.colorShiftPhase, audio.rms);
            this.particleColors[idx * 3] = c.r;
            this.particleColors[idx * 3 + 1] = c.g;
            this.particleColors[idx * 3 + 2] = c.b;
        }
    },

    // ── MAIN UPDATE ──
    update(audio, params, dt) {
        if (!this.group || !this.coreMesh) return;
        this.time += dt;

        const react = params.reactivity || 1.5;
        const bass = audio.smoothBands.bass || 0;
        const sub = audio.smoothBands.sub || 0;
        const mid = audio.smoothBands.mid || 0;
        const treble = audio.smoothBands.treble || 0;
        const rms = audio.rms || 0;
        const beatPhase = audio.beatPhase || 0;
        const bpm = audio.bpm || 140;
        const palette = params.colorPalette || 'neon';

        // Shape rebuild check
        const shape = params.coreShape || 'icosahedron';
        const detail = Math.floor(params.coreDetail || 3);
        if (shape !== this.currentShape || detail !== this.currentDetail) {
            this.buildCore(shape, detail, params.coreSize || 18);
        }

        // Satellite count check
        const satCount = Math.floor(params.satelliteCount || 6);
        if (satCount !== this.satelliteCount) {
            this.buildSatellites(satCount);
        }

        // ── SECTION AWARENESS ──
        if (params.sectionAware) {
            if (audio.isHighEnergy) {
                this.targetSectionScale = params.dropExpansion || 1.8;
            } else if (audio.isCalm) {
                this.targetSectionScale = params.calmTightness || 0.6;
            } else if (audio.isBuildingUp) {
                // Buildup: gradually increase
                this.targetSectionScale = 0.8 + (audio.sectionProgress || 0) * 0.8;
            } else {
                this.targetSectionScale = 1;
            }
        } else {
            this.targetSectionScale = 1;
        }
        this.sectionScale += (this.targetSectionScale - this.sectionScale) * 0.05;

        // ── BPM-SYNCED ROTATION ──
        const bpmRotRate = params.bpmSync ? (bpm / 60) * (params.beatRotation || 1.5) : (params.beatRotation || 1.5);
        // Smooth rotation locked to BPM
        const rotAngle = this.time * bpmRotRate * 0.5;
        this.coreGroup.rotation.y = rotAngle;
        this.coreGroup.rotation.x = Math.sin(rotAngle * 0.3) * 0.15;
        this.coreGroup.rotation.z = Math.cos(rotAngle * 0.2) * 0.1;

        // ── BEAT-PHASE DISPLACEMENT ──
        const beatPulse = Math.sin(beatPhase * Math.PI * 2); // -1 to 1
        const beatPulsePos = beatPulse * 0.5 + 0.5; // 0 to 1
        const displaceAmt = (params.rhythmicDisplace || 6) * react * this.sectionScale;
        const displaceStyle = params.displaceStyle || 'pulse';
        const coreSize = params.coreSize || 18;

        const pos = this.coreMesh.geometry.attributes.position.array;
        const col = this.coreMesh.geometry.attributes.color.array;
        const vertCount = this.coreBasePos.length / 3;

        for (let i = 0; i < vertCount; i++) {
            const i3 = i * 3;
            const bx = this.coreBasePos[i3], by = this.coreBasePos[i3 + 1], bz = this.coreBasePos[i3 + 2];
            let nx = this.coreNormals[i3] || 0, ny = this.coreNormals[i3 + 1] || 0, nz = this.coreNormals[i3 + 2] || 0;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;

            const t = i / vertCount;
            const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;

            let disp = 0;
            switch (displaceStyle) {
                case 'pulse':
                    // Clean beat-phase pulse — expands on beat, contracts between
                    disp = beatPulsePos * displaceAmt * (0.3 + bass * 2) + freq * displaceAmt * 0.2;
                    break;
                case 'ripple': {
                    const d2 = Math.sqrt(bx * bx + by * by + bz * bz) / coreSize;
                    disp = Math.sin(d2 * 6 - beatPhase * Math.PI * 2) * displaceAmt * 0.5 * (0.3 + bass * 2);
                    break;
                }
                case 'spike':
                    disp = Math.pow(beatPulsePos, 3) * displaceAmt * (0.5 + freq * 2) * (1 + audio.bassBeatIntensity * 2);
                    break;
                case 'breathe':
                    disp = beatPulsePos * displaceAmt * 0.6 * (0.5 + (sub + bass) * 2);
                    break;
                case 'harmonic': {
                    let h = 0;
                    for (let n = 1; n <= 4; n++) {
                        const bv = (audio.frequencyData[Math.floor(n * 25)] || 0) / 255;
                        h += bv * Math.sin(n * beatPhase * Math.PI * 2 + t * n * 3);
                    }
                    disp = h * displaceAmt * 0.4;
                    break;
                }
                case 'shockwave': {
                    // Shockwave expands from center on each beat
                    const d3 = Math.sqrt(bx * bx + by * by + bz * bz) / coreSize;
                    const wave = Math.sin((d3 * 5 - beatPhase * 2) * Math.PI);
                    disp = Math.max(0, wave) * displaceAmt * (0.3 + bass * 2.5) * beatPulsePos;
                    break;
                }
            }

            // Scale with section
            const scale = this.sectionScale;
            pos[i3] = (bx + nx * disp) * scale;
            pos[i3 + 1] = (by + ny * disp) * scale;
            pos[i3 + 2] = (bz + nz * disp) * scale;

            // Beat-locked color — shifts on beats
            const colorT = t + this.colorShiftPhase + freq * 0.3;
            const c = this.getPaletteColor(palette, colorT, rms);
            col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
        }

        this.coreMesh.geometry.attributes.position.needsUpdate = true;
        this.coreMesh.geometry.attributes.color.needsUpdate = true;
        this.coreMesh.geometry.computeVertexNormals();

        // Sync wireframe
        if (this.coreWire) {
            const wg = new THREE.WireframeGeometry(this.coreMesh.geometry);
            this.coreWire.geometry.dispose();
            this.coreWire.geometry = wg;
        }

        // Materials
        this.coreMesh.material.opacity = (params.solidOpacity || 0.2) * (0.5 + bass * 0.5);
        const wireColor = this.getPaletteColor(palette, this.colorShiftPhase + rms, rms);
        this.coreWire.material.color.copy(wireColor);
        this.coreWire.material.opacity = (params.wireOpacity || 0.85) * (0.5 + rms * 0.5 + beatPulsePos * 0.2);

        // ── BEAT-TRIGGERED EVENTS ──
        if (audio.beatCount > this.lastBeatCount) {
            this.lastBeatCount = audio.beatCount;

            // Color shift on beat
            if (params.beatColorShift) {
                this.colorShiftPhase += 0.08;
            }
        }

        // Bass beat events — impact waves & particle bursts
        if (audio.bassBeat) {
            // Impact wave
            if ((params.impactIntensity || 3) > 0) {
                this.spawnImpactWave(audio.bassBeatIntensity * (params.impactIntensity || 3) / 3);
            }

            // Particle burst
            if (params.burstParticles) {
                this.spawnBeatBurst(audio, params);
            }
        }

        // ── OUTER RINGS ──
        if (params.showRings) {
            for (let i = 0; i < this.ringMeshes.length; i++) {
                const ring = this.ringMeshes[i];
                ring.visible = true;
                const data = ring.userData;
                // Rings pulse with beat phase — each ring on a different phase
                const ringPulse = Math.sin(beatPhase * Math.PI * 2 + i * Math.PI / this.ringMeshes.length);
                const ringScale = this.sectionScale * (1 + ringPulse * 0.08 * (params.beatPulseAmount || 2.5));
                ring.scale.setScalar(ringScale);

                // Tilt rings rhythmically
                ring.rotation.x = Math.sin(this.time * 0.5 + i * 1.2) * 0.3 + Math.PI / 2;
                ring.rotation.y = Math.cos(this.time * 0.3 + i * 0.8) * 0.2;

                // Pulsing opacity
                const ringOpacity = params.ringStyle === 'pulsing'
                    ? 0.2 + beatPulsePos * 0.3 + bass * 0.2
                    : 0.4;
                ring.material.opacity = ringOpacity;
                ring.material.color.copy(this.getPaletteColor(palette, i / this.ringMeshes.length + this.colorShiftPhase, rms));
            }
        } else {
            this.ringMeshes.forEach(r => r.visible = false);
        }

        // ── SATELLITES ──
        if (params.showSatellites) {
            const bpmFactor = params.bpmSync ? bpm / 140 : 1;
            for (let i = 0; i < this.satellites.length; i++) {
                const sat = this.satellites[i];
                const d = sat.mesh.userData;
                sat.mesh.visible = true;

                // Orbit locked to BPM
                const orbitAngle = this.time * d.orbitSpeed * bpmFactor + d.orbitPhase;
                const orbitR = d.orbitRadius * this.sectionScale;
                sat.mesh.position.x = Math.cos(orbitAngle) * orbitR;
                sat.mesh.position.y = Math.sin(orbitAngle * 0.5 + d.orbitTilt) * orbitR * 0.3;
                sat.mesh.position.z = Math.sin(orbitAngle) * orbitR;

                // Scale pulse on beat
                const satPulse = 1 + beatPulsePos * 0.3 * bass;
                sat.mesh.scale.setScalar(satPulse);

                // Rotate
                sat.mesh.rotation.x += dt * 1.5;
                sat.mesh.rotation.y += dt * 2;

                // Color
                sat.mesh.material.color.copy(
                    this.getPaletteColor(palette, i / this.satellites.length + this.colorShiftPhase + 0.3, rms)
                );
                sat.mesh.material.opacity = 0.2 + bass * 0.2 + beatPulsePos * 0.1;
            }
        } else {
            this.satellites.forEach(s => s.mesh.visible = false);
        }

        // ── IMPACT WAVES ──
        for (const wave of this.impactWaves) {
            if (wave.life <= 0) { wave.mesh.visible = false; continue; }
            wave.mesh.visible = true;
            wave.life -= dt * 1.5;
            wave.radius += dt * 40 * (0.5 + wave.life); // Decelerating expansion

            wave.mesh.scale.setScalar(wave.radius);
            wave.mesh.material.opacity = wave.life * 0.5;
            wave.mesh.material.color.copy(this.getPaletteColor(palette, 1 - wave.life + this.colorShiftPhase, rms));

            // Random tilt for variety
            if (wave.life > 0.95) {
                wave.mesh.rotation.x = Math.random() * Math.PI;
                wave.mesh.rotation.y = Math.random() * Math.PI;
            }
        }

        // ── PARTICLES ──
        if (params.burstParticles) {
            const trail = params.particleTrail || 0.97;
            for (let i = 0; i < this.maxParticles; i++) {
                const v = this.particleVelocities[i];
                if (v.life <= 0) continue;
                v.life -= dt * 0.8;
                v.x *= trail; v.y *= trail; v.z *= trail;
                this.particlePositions[i * 3] += v.x;
                this.particlePositions[i * 3 + 1] += v.y;
                this.particlePositions[i * 3 + 2] += v.z;

                // Fade color
                this.particleColors[i * 3] *= trail;
                this.particleColors[i * 3 + 1] *= trail;
                this.particleColors[i * 3 + 2] *= trail;

                if (v.life <= 0) {
                    this.particlePositions[i * 3] = 0;
                    this.particlePositions[i * 3 + 1] = 0;
                    this.particlePositions[i * 3 + 2] = 0;
                }
            }
            this.particleSystem.geometry.attributes.position.needsUpdate = true;
            this.particleSystem.geometry.attributes.color.needsUpdate = true;
            this.particleSystem.material.size = (params.glowIntensity || 1.5) * (1 + bass);
            this.particleSystem.visible = true;
        } else if (this.particleSystem) {
            this.particleSystem.visible = false;
        }

        // ── DROP SPECIAL: bass beat rotation kick ──
        if (audio.bassBeat && audio.isHighEnergy) {
            // Controlled kick — not chaotic
            this.coreGroup.rotation.y += Math.min(0.1, audio.bassBeatIntensity * 0.08);
        }
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(this.group);
        }
        this.coreMesh = null;
        this.coreWire = null;
        this.ringMeshes = [];
        this.satellites = [];
        this.impactWaves = [];
        this.particleSystem = null;
    }
};
