// ============================================================
// AURA Mode — DNA Helix V3
// BUG-03 FIX: No more per-frame geometry rebuild.
// Uses persistent buffer geometries with needsUpdate flags.
// Double/triple helix with base pair colors, unwind,
// radiation glow, enzyme particles, mutations
// ============================================================

const DnaHelixMode = {
    name: 'DNA Helix',
    group: null,
    time: 0,
    unwindPhase: 0,

    // Persistent objects — initialized once, updated per-frame via buffer writes
    _helices: [],         // array of { line, points } for each helix strand
    _bridges: [],         // array of Line objects for bridges
    _glowMesh: null,
    _enzymeSystem: null,
    _particleSystem: null,
    _lastParamKey: '',    // rebuild only when static params change
    _tempColor: new THREE.Color(),

    params: {
        helixCount: { type: 'range', min: 1, max: 4, default: 2, step: 1, label: 'Helix Count' },
        coils: { type: 'range', min: 2, max: 20, default: 8, step: 1, label: 'Coils' },
        radius: { type: 'range', min: 5, max: 40, default: 15, step: 1, label: 'Radius' },
        height: { type: 'range', min: 30, max: 200, default: 100, step: 5, label: 'Height' },
        resolution: { type: 'range', min: 100, max: 1000, default: 400, step: 50, label: 'Resolution' },
        renderMode: { type: 'select', options: ['line', 'tube', 'points'], default: 'line', label: 'Render' },
        showBridges: { type: 'toggle', default: true, label: 'Bridges' },
        bridgeCount: { type: 'range', min: 5, max: 50, default: 20, step: 1, label: 'Bridge Count' },
        rotSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: 'Rotation' },
        twistReact: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Twist React' },
        particleDensity: { type: 'range', min: 0, max: 500, default: 100, step: 10, label: 'Particles' },
        // V2 params
        basePairColors: { type: 'toggle', default: true, label: '🧬 Base Pair Colors' },
        unwindOnBeat: { type: 'toggle', default: false, label: '💥 Unwind on Beat' },
        unwindSpeed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Unwind Speed' },
        radiationGlow: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '☢️ Radiation' },
        enzymes: { type: 'toggle', default: false, label: '🔬 Enzyme Particles' },
        enzymeCount: { type: 'range', min: 10, max: 100, default: 30, step: 5, label: 'Enzyme Count' },
        mutationChance: { type: 'range', min: 0, max: 0.5, default: 0, step: 0.05, label: '🧪 Mutation' },
        helixSpacing: { type: 'range', min: 0, max: 5, default: 0, step: 0.5, label: 'Helix Spacing' },
        majorGroove: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: '📐 Groove Width' },
        dropUnzip: { type: 'toggle', default: true, label: '🔥 Drop Unzip' },
        phosphorescence: { type: 'toggle', default: false, label: '✨ Phosphorescence' },
        backbone: { type: 'select', options: ['line', 'tube', 'ribbon', 'dotted'], default: 'line', label: '🦴 Backbone' }
    },

    // Static base pair colors — cached once, never reallocated
    _basePairColors: [
        null, null, null, null // initialized in init()
    ],

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 120);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.unwindPhase = 0;
        this._lastParamKey = '';
        this._helices = [];
        this._bridges = [];
        this._glowMesh = null;
        this._enzymeSystem = null;
        this._particleSystem = null;

        // Cache base pair colors
        this._basePairColors = [
            new THREE.Color(0.8, 0.2, 0.2), // A - red
            new THREE.Color(0.2, 0.2, 0.8), // T - blue
            new THREE.Color(0.2, 0.8, 0.2), // G - green
            new THREE.Color(0.8, 0.8, 0.2)  // C - yellow
        ];
    },

    // Build persistent helix line objects with pre-allocated buffers
    _buildHelices(helixCount, res) {
        // Dispose old
        for (const h of this._helices) {
            this.group.remove(h.line);
            h.line.geometry.dispose();
            h.line.material.dispose();
        }
        this._helices = [];

        for (let i = 0; i < helixCount; i++) {
            const positions = new Float32Array(res * 3);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });
            const line = new THREE.Line(geo, mat);
            this.group.add(line);
            this._helices.push({ line, positions });
        }
    },

    // Build persistent bridge lines
    _buildBridges(bridgeCount) {
        for (const b of this._bridges) {
            this.group.remove(b);
            b.geometry.dispose();
            b.material.dispose();
        }
        this._bridges = [];

        for (let i = 0; i < bridgeCount; i++) {
            const positions = new Float32Array(6); // 2 points × 3 components
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending
            });
            const line = new THREE.Line(geo, mat);
            this.group.add(line);
            this._bridges.push(line);
        }
    },

    // Build persistent glow sphere
    _buildGlow(radius) {
        if (this._glowMesh) {
            this.group.remove(this._glowMesh);
            this._glowMesh.geometry.dispose();
            this._glowMesh.material.dispose();
        }
        const geo = new THREE.SphereGeometry(radius * 1.5, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.2, 0.8, 0.3),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        this._glowMesh = new THREE.Mesh(geo, mat);
        this.group.add(this._glowMesh);
    },

    // Build persistent enzyme particle system
    _buildEnzymes(count) {
        if (this._enzymeSystem) {
            this.group.remove(this._enzymeSystem);
            this._enzymeSystem.geometry.dispose();
            this._enzymeSystem.material.dispose();
        }
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this._enzymeSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this._enzymeSystem);
    },

    // Build persistent floating particle system
    _buildParticles(count) {
        if (this._particleSystem) {
            this.group.remove(this._particleSystem);
            this._particleSystem.geometry.dispose();
            this._particleSystem.material.dispose();
        }
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this._particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.8, vertexColors: true, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this._particleSystem);
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        const helixCount = Math.floor(params.helixCount || 2);
        const coils = params.coils || 8;
        const baseRadius = params.radius || 15;
        const height = params.height || 100;
        const res = Math.floor(params.resolution || 400);
        const rotSpeed = params.rotSpeed || 0.5;
        const reactivity = params.reactivity || 1;
        const radiationGlow = params.radiationGlow || 0.5;
        const grooveWidth = params.majorGroove || 1;
        const helixSpacing = params.helixSpacing || 0;
        const bridgeCount = Math.floor(params.bridgeCount || 20);
        const enzymeCount = Math.floor(params.enzymeCount || 30);
        const particleCount = Math.floor(params.particleDensity || 0);

        // Only rebuild mesh objects when structural params change
        const paramKey = `${helixCount}_${res}_${bridgeCount}_${enzymeCount}_${particleCount}_${params.backbone}`;
        if (paramKey !== this._lastParamKey) {
            this._lastParamKey = paramKey;
            this._buildHelices(helixCount, res);
            this._buildBridges(bridgeCount);
            this._buildGlow(baseRadius);
            if (params.enzymes) this._buildEnzymes(enzymeCount);
            if (particleCount > 0) this._buildParticles(particleCount);
        }

        // Audio-reactive radius (updates per frame cheaply via math, not geometry rebuild)
        const audioRadius = baseRadius * (1 + audio.smoothBands.bass * (params.twistReact || 1) * reactivity * 0.3);

        // Unwind
        if (params.unwindOnBeat && audio.beat) {
            this.unwindPhase = Math.min(3, this.unwindPhase + audio.beatIntensity * (params.unwindSpeed || 1));
        }
        if (params.dropUnzip && audio.isDropSection) {
            this.unwindPhase = 3;
        }
        this.unwindPhase *= 0.97;

        // ── UPDATE HELIX POSITIONS (buffer writes only, no allocation) ──
        const strand1 = []; // lightweight — just indices for bridge lookup
        const strand2 = [];

        for (let h = 0; h < this._helices.length; h++) {
            const helix = this._helices[h];
            const pos = helix.positions;
            const phaseOffset = (h / helixCount) * Math.PI * 2;
            const radius = audioRadius + h * helixSpacing;

            for (let i = 0; i < res; i++) {
                const t = i / res;
                const unwindOffset = this.unwindPhase * Math.sin(t * Math.PI) * 5 * (h % 2 === 0 ? 1 : -1);
                const angle = t * Math.PI * 2 * coils * grooveWidth + phaseOffset + this.time * rotSpeed;
                const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
                const freq = (audio.frequencyData[fIdx] || 0) / 255;

                const mutation = params.mutationChance > 0 && Math.random() < params.mutationChance ?
                    (Math.random() - 0.5) * 5 : 0;

                const r = radius * (1 + freq * 0.3 * reactivity) + unwindOffset;
                const i3 = i * 3;
                pos[i3] = Math.cos(angle) * r + mutation;
                pos[i3 + 1] = (t - 0.5) * height;
                pos[i3 + 2] = Math.sin(angle) * r;

                // Store strand endpoints for bridges (only first two helices)
                if (h === 0) strand1.push(i3);
                if (h === 1) strand2.push(i3);
            }

            helix.line.geometry.attributes.position.needsUpdate = true;

            // Update color — BUG-02 fix: use .copy() not direct assign
            helix.line.material.color.copy(
                ParamSystem.getColorThree(h / helixCount + audio.rms * 0.3)
            );
            helix.line.material.opacity = 0.8 + radiationGlow * 0.1;
        }

        // ── UPDATE BRIDGES (buffer writes only) ──
        if (params.showBridges && helixCount >= 2 && this._helices.length >= 2) {
            const s1Pos = this._helices[0].positions;
            const s2Pos = this._helices[1].positions;
            const step = Math.floor(res / bridgeCount);

            for (let i = 0; i < this._bridges.length; i++) {
                const bridge = this._bridges[i];
                const idx = i * step;
                if (idx >= res) { bridge.visible = false; continue; }
                bridge.visible = true;

                const i3 = idx * 3;
                const bPos = bridge.geometry.attributes.position.array;
                bPos[0] = s1Pos[i3]; bPos[1] = s1Pos[i3 + 1]; bPos[2] = s1Pos[i3 + 2];
                bPos[3] = s2Pos[i3]; bPos[4] = s2Pos[i3 + 1]; bPos[5] = s2Pos[i3 + 2];
                bridge.geometry.attributes.position.needsUpdate = true;

                const freq = (audio.frequencyData[Math.floor(i / bridgeCount * 256)] || 0) / 255;
                if (params.basePairColors) {
                    bridge.material.color.copy(this._basePairColors[Math.floor((i * 4.7) % 4)]);
                } else {
                    bridge.material.color.copy(ParamSystem.getColorThree(i / bridgeCount));
                }
                bridge.material.opacity = 0.3 + freq * 0.5;
            }
        } else {
            for (const b of this._bridges) b.visible = false;
        }

        // ── GLOW UPDATE (material only) ──
        if (this._glowMesh) {
            if (params.phosphorescence && radiationGlow > 0) {
                this._glowMesh.visible = true;
                this._glowMesh.material.opacity = 0.05 * radiationGlow * audio.smoothBands.bass;
            } else {
                this._glowMesh.visible = false;
            }
        }

        // ── ENZYME PARTICLES UPDATE (buffer writes) ──
        if (this._enzymeSystem && params.enzymes) {
            this._enzymeSystem.visible = true;
            const ePos = this._enzymeSystem.geometry.attributes.position.array;
            const eCols = this._enzymeSystem.geometry.attributes.color.array;
            const eCount = ePos.length / 3;
            for (let i = 0; i < eCount; i++) {
                const t = i / eCount;
                const angle = t * Math.PI * 2 * coils + this.time * rotSpeed * 1.5 + Math.sin(i) * 2;
                const r = audioRadius * 1.3;
                const i3 = i * 3;
                ePos[i3] = Math.cos(angle) * r + Math.sin(this.time * 3 + i) * 3;
                ePos[i3 + 1] = (t - 0.5) * height;
                ePos[i3 + 2] = Math.sin(angle) * r + Math.cos(this.time * 2 + i) * 3;
                eCols[i3] = 0.9; eCols[i3 + 1] = 0.6; eCols[i3 + 2] = 0.1;
            }
            this._enzymeSystem.geometry.attributes.position.needsUpdate = true;
            this._enzymeSystem.geometry.attributes.color.needsUpdate = true;
        } else if (this._enzymeSystem) {
            this._enzymeSystem.visible = false;
        }

        // ── FLOATING PARTICLES UPDATE (buffer writes) ──
        if (this._particleSystem && particleCount > 0) {
            this._particleSystem.visible = true;
            const pPos = this._particleSystem.geometry.attributes.position.array;
            const pCols = this._particleSystem.geometry.attributes.color.array;
            const pCount = pPos.length / 3;
            for (let i = 0; i < pCount; i++) {
                const t = i / pCount;
                const angle = t * Math.PI * 2 * coils + this.time * rotSpeed;
                const r = audioRadius * (1.5 + Math.sin(this.time * 3 + i) * 0.5);
                const i3 = i * 3;
                // Use deterministic pseudo-random based on index instead of Math.random()
                const pr1 = Math.sin(i * 127.1) * 0.5;
                const pr2 = Math.cos(i * 311.7) * 0.5;
                pPos[i3] = Math.cos(angle + pr1) * r * (0.5 + Math.abs(pr2));
                pPos[i3 + 1] = (t - 0.5) * height + pr1 * 5;
                pPos[i3 + 2] = Math.sin(angle + pr1) * r * (0.5 + Math.abs(pr2));
                const c = ParamSystem.getColorThreeHSL(t);
                pCols[i3] = c.r; pCols[i3 + 1] = c.g; pCols[i3 + 2] = c.b;
            }
            this._particleSystem.geometry.attributes.position.needsUpdate = true;
            this._particleSystem.geometry.attributes.color.needsUpdate = true;
        } else if (this._particleSystem) {
            this._particleSystem.visible = false;
        }

        this.group.rotation.y += rotSpeed * dt * 0.3;
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(this.group);
        }
        this._helices = [];
        this._bridges = [];
        this._glowMesh = null;
        this._enzymeSystem = null;
        this._particleSystem = null;
    }
};
