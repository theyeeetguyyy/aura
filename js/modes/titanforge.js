// ============================================================
// AURA Mode — TITANFORGE
// Three-Layer Composition: Core → Orbitals → Web
// GPU-Instanced rendering, proximity plexus, shockwaves, debris
// Per-band audio isolation — built for tearout dubstep
// ============================================================

const TitanforgeMode = {
    name: 'Titanforge',

    // ── STATE ──
    group: null, time: 0, explodePhase: 0,
    _tempColor: null, _tempVec3: null, _tempMatrix: null, _tempQuat: null, _tempScale: null, _tempPos: null,

    // Core
    coreGeo: null, coreMesh: null, coreWire: null,
    coreBasePos: null, coreNormals: null,
    currentCoreShape: '', lastSfParams: '', lastRebuildTime: 0,
    smoothSfM: 6, smoothSfN1: 1, smoothSfN2: 1, smoothSfN3: 1,

    // Orbitals (InstancedMesh)
    orbitalMesh: null, orbitalInstanceColors: null,
    orbPositionFlat: null, // Float32Array — current positions in group-local space
    maxOrbitalCount: 1500, currentOrbitalCount: 0, currentOrbitalShape: '',
    orbScatterOffsets: null, orbScatterPhase: 0,

    // Web (LineSegments)
    webLine: null, webPositions: null, webColors: null, maxWebSegments: 5000,

    // Shockwaves (pooled ring/sphere meshes)
    shockwaves: [], shockRingGeo: null, shockSphereGeo: null, maxShockwaves: 8,

    // Debris (Points)
    debrisSystem: null, debrisPositions: null, debrisVelocities: [], debrisColors: null, maxDebris: 5000,

    // Drop state
    _dropTriggeredThisDrop: false, _emissivePulse: 0,

    // ── PARAMS (42 total, zero redundancy) ──
    params: {
        // ═══ CORE ═══
        coreShape: {
            type: 'select', options: [
                'superformula', 'icosahedron', 'dodecahedron', 'torusKnot',
                'kleinBottle', 'enneperSurface', 'boysSurface', 'trefoilKnot', 'catenoid', 'sphere'
            ], default: 'superformula', label: '🔮 Core Shape'
        },
        coreDetail: { type: 'range', min: 10, max: 80, default: 40, step: 5, label: '🔶 Core Resolution' },
        coreSize: { type: 'range', min: 5, max: 50, default: 20, step: 1, label: '📐 Core Size' },
        coreDisplaceMode: {
            type: 'select', options: [
                'fourier', 'forceField', 'vortex', 'turbulence',
                'reaction', 'audioSculpt', 'stringTheory', 'fluidSim'
            ], default: 'fourier', label: '🌊 Core Displace'
        },
        coreDisplaceAmt: { type: 'range', min: 0, max: 30, default: 8, step: 0.5, label: '📊 Core Displace Amt' },
        coreDisplaceSpeed: { type: 'range', min: 0, max: 5, default: 1.5, step: 0.1, label: '⏩ Core Displace Speed' },
        coreSolidOpacity: { type: 'range', min: 0, max: 0.6, default: 0.15, step: 0.05, label: '🔳 Core Solid' },
        coreWireOpacity: { type: 'range', min: 0, max: 1, default: 0.8, step: 0.05, label: '🕸️ Core Wire' },
        coreColorMode: {
            type: 'select', options: [
                'reactionDiffusion', 'audioFreq', 'curvature', 'fire', 'ice', 'plasma', 'void', 'holographic'
            ], default: 'reactionDiffusion', label: '🎨 Core Color'
        },

        // ═══ SUPERFORMULA ═══
        sfM: { type: 'range', min: 1, max: 20, default: 6, step: 0.5, label: '🔢 SF Symmetry (m)' },
        sfN1: { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: '🔷 SF n1' },
        sfN2: { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: '↔️ SF n2' },
        sfN3: { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: '↕️ SF n3' },
        sfAudioMap: { type: 'toggle', default: true, label: '🎵 Audio → SF' },

        // ═══ ORBITALS ═══
        orbitalShape: {
            type: 'select', options: ['icosahedron', 'octahedron', 'tetrahedron', 'cube', 'sphere', 'dodecahedron'],
            default: 'icosahedron', label: '🔹 Orbital Shape'
        },
        orbitalCount: { type: 'range', min: 50, max: 1500, default: 400, step: 50, label: '✨ Orbital Count' },
        orbitalSize: { type: 'range', min: 0.3, max: 4, default: 1.2, step: 0.1, label: '📐 Orbital Size' },
        orbitalPath: {
            type: 'select', options: ['lissajous', 'orbit', 'spiral', 'sphere', 'vortex', 'chaos'],
            default: 'lissajous', label: '🌀 Orbital Path'
        },
        orbitalSpread: { type: 'range', min: 10, max: 80, default: 35, step: 1, label: '↔️ Orbital Spread' },
        orbitalSpeed: { type: 'range', min: 0.1, max: 5, default: 1, step: 0.1, label: '⏩ Orbital Speed' },
        orbitalScalePulse: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '💓 Orbital Pulse' },
        orbitalWireframe: { type: 'toggle', default: true, label: '🕸️ Orbital Wireframe' },
        orbitalOpacity: { type: 'range', min: 0, max: 1, default: 0.7, step: 0.05, label: '🔳 Orbital Opacity' },

        // ═══ WEB / PLEXUS ═══
        webEnabled: { type: 'toggle', default: true, label: '🕸️ Web / Plexus' },
        webDistance: { type: 'range', min: 5, max: 50, default: 20, step: 1, label: '↔️ Web Range' },
        webMaxLines: { type: 'range', min: 500, max: 5000, default: 2000, step: 500, label: '🔗 Max Connections' },
        webOpacity: { type: 'range', min: 0, max: 1, default: 0.4, step: 0.05, label: '🔳 Web Opacity' },
        webPulseOnset: { type: 'toggle', default: true, label: '⚡ Onset Pulse' },

        // ═══ SHOCKWAVE ═══
        shockwaveEnabled: { type: 'toggle', default: true, label: '💥 Shockwaves' },
        shockwaveStyle: { type: 'select', options: ['ring', 'sphere', 'ripple'], default: 'ring', label: '💫 Shockwave Style' },
        shockwaveSpeed: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: '⏩ Shockwave Speed' },
        shockwaveIntensity: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '💥 Shockwave Power' },

        // ═══ DEBRIS ═══
        debrisEnabled: { type: 'toggle', default: true, label: '💎 Debris' },
        debrisCount: { type: 'range', min: 500, max: 5000, default: 2000, step: 500, label: '💎 Debris Count' },
        debrisGravity: { type: 'range', min: -3, max: 3, default: 0.5, step: 0.1, label: '⬇️ Debris Gravity' },

        // ═══ AUDIO & BEHAVIOUR ═══
        bassBreath: { type: 'range', min: 0, max: 8, default: 2.5, step: 0.1, label: '🔊 Bass Breathing' },
        beatExplode: { type: 'range', min: 0, max: 8, default: 2, step: 0.1, label: '💥 Beat Explode' },
        rotSpeed: { type: 'range', min: 0, max: 5, default: 0.4, step: 0.05, label: '🔄 Rotation Speed' },
        rotationEnabled: { type: 'toggle', default: true, label: '🔄 Rotation' },

        // ═══ DROP SECTION ═══
        dropReaction: {
            type: 'select', options: ['scatter', 'shapeShift', 'overdriveAll', 'colorStorm'],
            default: 'overdriveAll', label: '🔥 Drop Reaction'
        },
        dropIntensityMult: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: '⚡ Drop Power' },
        dropOrbitalScatter: { type: 'range', min: 0, max: 5, default: 3, step: 0.1, label: '💥 Drop Scatter' },
    },

    // ── NOISE ──
    noise3D(x, y, z) { return MathLib.noise3D(x, y, z); },
    fbm(x, y, z, oct) { return MathLib.fbm(x, y, z, oct); },

    // ── SUPERFORMULA ──
    superformula(angle, m, n1, n2, n3) { return MathLib.superformula(angle, m, n1, n2, n3); },

    // ── GRID HELPER (parametric surface) ──
    _grid(seg, fn) { return MathLib.buildGrid(seg, fn); },

    _buildDisplaceFn(mode, audio, amt, speed) {
        return MathLib.buildDisplaceFn(mode, audio, amt, speed, this.time, 0);
    },

    _buildColorFn(colorMode, audio, amt) {
        return ColorLib.buildColorFn(colorMode, audio, amt, this.time, this._colorResult, this._tempColor);
    },

    // ── CORE SURFACE GENERATOR (10 shapes) ──
    getCoreSurface(shape, seg, size, m, n1, n2, n3) {
        if (shape === 'dodecahedron') return new THREE.DodecahedronGeometry(size, 3);
        return MathLib.getOuterGeo(shape, seg, size, m, n1, n2, n3);
    },

    // ── BUILD: CORE ──
    buildCore(shape, seg, size, m, n1, n2, n3) {
        if (this.coreMesh) { this.group.remove(this.coreMesh); this.coreMesh.material.dispose(); this.coreMesh = null; }
        if (this.coreWire) { this.group.remove(this.coreWire); this.coreWire.material.dispose(); this.coreWire = null; }
        if (this.coreGeo) { this.coreGeo.dispose(); this.coreGeo = null; }

        const geo = this.getCoreSurface(shape, seg, size, m, n1, n2, n3);
        geo.computeVertexNormals();
        const vc = geo.attributes.position.count;
        geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(vc * 3).fill(1), 3));
        this.coreGeo = geo;
        this.coreBasePos = new Float32Array(geo.attributes.position.array);
        this.coreNormals = new Float32Array(geo.attributes.normal.array);

        // Shared geometry — both solid and wireframe reference the SAME buffer
        this.coreMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, blending: THREE.NormalBlending, depthWrite: false
        }));
        this.coreWire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            wireframe: true, color: 0x8b5cf6, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.coreMesh, this.coreWire);
        this.currentCoreShape = shape;
    },

    // ── BUILD: ORBITALS (GPU Instanced) ──
    buildOrbitals(count, shape) {
        if (this.orbitalMesh) {
            this.group.remove(this.orbitalMesh);
            this.orbitalMesh.geometry.dispose();
            this.orbitalMesh.material.dispose();
            this.orbitalMesh = null;
        }

        this.currentOrbitalCount = count;
        this.currentOrbitalShape = shape;
        this.orbPositionFlat = new Float32Array(count * 3);
        this.orbScatterOffsets = new Float32Array(count * 3);

        // Select base geometry for all instances
        let geo;
        switch (shape) {
            case 'cube': geo = new THREE.BoxGeometry(1, 1, 1); break;
            case 'tetrahedron': geo = new THREE.TetrahedronGeometry(1, 0); break;
            case 'octahedron': geo = new THREE.OctahedronGeometry(1, 0); break;
            case 'sphere': geo = new THREE.SphereGeometry(1, 6, 4); break;
            case 'dodecahedron': geo = new THREE.DodecahedronGeometry(1, 0); break;
            default: geo = new THREE.IcosahedronGeometry(1, 0); break;
        }

        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff, wireframe: true,
            transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false
        });

        this.orbitalMesh = new THREE.InstancedMesh(geo, mat, count);
        this.orbitalMesh.frustumCulled = false; // instances span the whole scene

        // Per-instance colors
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) colors[i] = 1;
        this.orbitalMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        this.orbitalInstanceColors = colors;

        this.group.add(this.orbitalMesh);
    },

    // ── BUILD: WEB (proximity plexus) ──
    buildWeb(maxLines) {
        if (this.webLine) { this.group.remove(this.webLine); this.webLine.geometry.dispose(); this.webLine.material.dispose(); }
        this.maxWebSegments = maxLines;
        this.webPositions = new Float32Array(maxLines * 6); // 2 verts × 3 floats per line
        this.webColors = new Float32Array(maxLines * 6);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.webPositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.webColors, 3));
        geo.setDrawRange(0, 0);
        this.webLine = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.webLine);
    },

    // ── BUILD: SHOCKWAVES (pooled) ──
    initShockwaves() {
        this.shockRingGeo = new THREE.RingGeometry(0.85, 1, 64);
        this.shockSphereGeo = new THREE.IcosahedronGeometry(1, 1);
        this.shockwaves = [];
        for (let i = 0; i < this.maxShockwaves; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0,
                blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
            });
            const mesh = new THREE.Mesh(this.shockRingGeo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.shockwaves.push({ mesh, active: false, age: 0 });
        }
    },

    // ── BUILD: DEBRIS (particles) ──
    initDebris(count) {
        if (this.debrisSystem) { this.group.remove(this.debrisSystem); this.debrisSystem.geometry.dispose(); this.debrisSystem.material.dispose(); }
        this.maxDebris = count;
        this.debrisPositions = new Float32Array(count * 3);
        this.debrisColors = new Float32Array(count * 3);
        this.debrisVelocities = [];
        for (let i = 0; i < count; i++) this.debrisVelocities.push({ x: 0, y: 0, z: 0, life: 0 });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.debrisPositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.debrisColors, 3));
        this.debrisSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        this.group.add(this.debrisSystem);
    },

    // ── ORBITAL PATHS (6 parametric systems) ──
    getOrbitalPosition(index, count, time, path, spread, speed) {
        const golden = index * 2.39996323; // golden angle
        const norm = index / Math.max(1, count - 1);
        const t = time * speed;

        switch (path) {
            case 'lissajous': {
                const phase = golden;
                return [
                    Math.sin(3 * t * 0.3 + phase) * spread,
                    Math.sin(2 * t * 0.3 + phase * 1.3 + 0.785) * spread * 0.7,
                    Math.sin(5 * t * 0.2 + phase * 0.7 + 1.571) * spread
                ];
            }
            case 'orbit': {
                const radius = (0.4 + norm * 0.6) * spread;
                const inclination = golden * 0.5;
                const angle = t * 0.5 + golden;
                return [
                    Math.cos(angle) * radius,
                    Math.sin(angle * 0.3 + inclination) * radius * 0.4,
                    Math.sin(angle) * radius
                ];
            }
            case 'spiral': {
                const r = (0.2 + norm * 0.8) * spread;
                const angle = golden + t * (1 - norm) * 0.5;
                const height = Math.sin(t * 0.5 + norm * Math.PI * 4) * spread * 0.4;
                return [Math.cos(angle) * r, height, Math.sin(angle) * r];
            }
            case 'sphere': {
                const y = 1 - norm * 2;
                const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
                const theta = golden + t * 0.2;
                const breath = 1 + Math.sin(t * 0.5 + norm * Math.PI) * 0.2;
                const r = spread * breath;
                return [Math.cos(theta) * radiusAtY * r, y * r, Math.sin(theta) * radiusAtY * r];
            }
            case 'vortex': {
                const angle = golden + t * (2 - norm * 1.5);
                const r = norm * spread * (1 + Math.sin(t + norm * 10) * 0.15);
                const height = (norm - 0.5) * spread * 1.5 + Math.sin(t * 0.5 + golden) * spread * 0.1;
                return [Math.cos(angle) * r, height, Math.sin(angle) * r];
            }
            case 'chaos': {
                return [
                    Math.sin(t * 0.7 + golden) * Math.cos(t * 0.3 + golden * 1.7) * spread,
                    Math.sin(t * 0.5 + golden * 0.3) * Math.sin(t * 0.4 + golden * 2.1) * spread * 0.6,
                    Math.cos(t * 0.6 + golden * 1.1) * Math.sin(t * 0.8 + golden * 0.5) * spread
                ];
            }
            default: return [0, 0, 0];
        }
    },

    // ── SHOCKWAVE SPAWNER ──
    spawnShockwave(style, intensity) {
        const ringsToSpawn = style === 'ripple' ? 3 : 1;
        const isRing = style !== 'sphere';
        for (let k = 0; k < ringsToSpawn; k++) {
            let found = -1;
            for (let i = 0; i < this.shockwaves.length; i++) { if (!this.shockwaves[i].active) { found = i; break; } }
            if (found === -1) break;
            const sw = this.shockwaves[found];
            sw.active = true;
            sw.age = -k * 0.08; // stagger for ripple effect
            sw.mesh.visible = true;
            sw.mesh.scale.setScalar(0.01);
            sw.mesh.material.opacity = intensity * 0.6;
            sw.mesh.geometry = isRing ? this.shockRingGeo : this.shockSphereGeo;
            const c = ParamSystem.getColorThree(this.time * 0.1 + found * 0.2);
            sw.mesh.material.color.copy(c);
            sw.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * 0.5);
        }
    },

    // ── DROP HANDLER ──
    handleDrop(reaction, dropLevel, params, audio) {
        const scatterAmt = params.dropOrbitalScatter || 3;

        if (reaction === 'scatter' || reaction === 'overdriveAll') {
            // Scatter orbitals outward
            for (let i = 0; i < this.currentOrbitalCount * 3; i++) {
                this.orbScatterOffsets[i] = (Math.random() - 0.5) * 2;
            }
            this.orbScatterPhase = scatterAmt * dropLevel;
        }
        if (reaction === 'shapeShift' || reaction === 'overdriveAll') {
            // Morph core to random shape
            const shapes = ['superformula', 'icosahedron', 'dodecahedron', 'torusKnot', 'kleinBottle', 'boysSurface', 'trefoilKnot', 'catenoid'];
            let next;
            do { next = shapes[Math.floor(Math.random() * shapes.length)]; } while (next === this.currentCoreShape);
            const seg = Math.floor(params.coreDetail || 40), size = params.coreSize || 20;
            this.buildCore(next, seg, size, params.sfM || 6, params.sfN1 || 1, params.sfN2 || 1, params.sfN3 || 1);
        }
        if (reaction === 'overdriveAll') {
            this.explodePhase = Math.min(this.explodePhase + 2 * dropLevel, 5);
            // Trigger shockwave burst
            this.spawnShockwave(params.shockwaveStyle || 'ring', dropLevel * 1.5);
        }
        if (reaction === 'colorStorm') {
            // Handled in updateOrbitals — sets rapid color cycling flag
            this._colorStormPhase = 1.0;
        }
    },

    // ── INIT ──
    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 20, 80);
        camera.lookAt(0, 0, 0);

        // Pre-allocate scratch objects
        this.time = 0; this.explodePhase = 0;
        this._tempColor = new THREE.Color();
        this._tempVec3 = new THREE.Vector3();
        this._tempMatrix = new THREE.Matrix4();
        this._tempQuat = new THREE.Quaternion();
        this._tempScale = new THREE.Vector3();
        this._tempPos = new THREE.Vector3();
        this._colorResult = new Float32Array(3);
        this.currentCoreShape = ''; this.currentOrbitalCount = 0; this.currentOrbitalShape = '';
        this._dropTriggeredThisDrop = false; this._emissivePulse = 0;
        this._colorStormPhase = 0;
        this.orbScatterPhase = 0;
        this.smoothSfM = 6; this.smoothSfN1 = 1; this.smoothSfN2 = 1; this.smoothSfN3 = 1;
        this.lastSfParams = ''; this.lastRebuildTime = 0;

        // Build all layers
        this.buildCore('superformula', 40, 20, 6, 1, 1, 1);
        this.buildOrbitals(400, 'icosahedron');
        this.buildWeb(2000);
        this.initShockwaves();
        this.initDebris(2000);
    },

    // ── UPDATE: CORE (displacement + vertex colors) ──
    updateCore(audio, params, dt, SE) {
        if (!this.coreGeo || !this.coreBasePos) return;
        const mode = params.coreDisplaceMode || 'fourier';
        const amt = (params.coreDisplaceAmt || 8) * (params.reactivity || 1.5) * (SE.displacementScale || 1);
        const speed = (params.coreDisplaceSpeed || 1.5) * (SE.speed || 1);
        const bass = audio.smoothBands.bass || 0, sub = audio.smoothBands.sub || 0;
        const breathScale = 1 + (sub + bass) * (params.bassBreath || 2.5) * 0.2;
        const colorMode = params.coreColorMode || 'reactionDiffusion';

        const pos = this.coreGeo.attributes.position.array;
        const col = this.coreGeo.attributes.color.array;
        const count = this.coreBasePos.length / 3;
        const dispFn = this._buildDisplaceFn(mode, audio, amt, speed);
        const colorFn = this._buildColorFn(colorMode, audio, amt);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let bx = this.coreBasePos[i3], by = this.coreBasePos[i3 + 1], bz = this.coreBasePos[i3 + 2];
            let nx = this.coreNormals[i3] || 0, ny = this.coreNormals[i3 + 1] || 0, nz = this.coreNormals[i3 + 2] || 0;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
            const t = i / count;
            const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;

            let disp = dispFn(bx, by, bz, freq, i, count, nx, ny, nz);

            // Beat explode
            if (this.explodePhase > 0.01) disp += this.explodePhase * 3;

            // Sub sustain rumble
            const subRumble = audio.hasSustainedBass ? (audio.subSustain || 0) * (audio.wobbleLFO || 0) * amt * 0.4 : 0;

            pos[i3] = (bx + nx * disp) * breathScale;
            pos[i3 + 1] = (by + ny * disp) * breathScale + subRumble;
            pos[i3 + 2] = (bz + nz * disp) * breathScale;

            // ── VERTEX COLORS ──
            const rgb = colorFn(pos[i3], pos[i3 + 1], pos[i3 + 2], disp, freq, t);
            col[i3] = rgb[0]; col[i3 + 1] = rgb[1]; col[i3 + 2] = rgb[2];
        }

        this.coreGeo.attributes.position.needsUpdate = true;
        this.coreGeo.attributes.color.needsUpdate = true;
    },

    // ── UPDATE: ORBITALS (GPU-instanced) ──
    updateOrbitals(audio, params, dt) {
        if (!this.orbitalMesh) return;
        const count = this.currentOrbitalCount;
        const path = params.orbitalPath || 'lissajous';
        const spread = params.orbitalSpread || 35;
        const speed = params.orbitalSpeed || 1;
        const baseSize = params.orbitalSize || 1.2;
        const pulseAmt = params.orbitalScalePulse || 2;
        const mid = audio.smoothBands.mid || 0;
        const highMid = audio.smoothBands.highMid || mid;
        const rms = audio.rms || 0;
        const colorStorm = this._colorStormPhase || 0;
        if (this._colorStormPhase > 0) this._colorStormPhase *= 0.95;

        const matrix = this._tempMatrix;
        const pos = this._tempPos;
        const quat = this._tempQuat;
        const scale = this._tempScale;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const golden = i * 2.39996323;

            // Position from path
            let [px, py, pz] = this.getOrbitalPosition(i, count, this.time, path, spread, speed);

            // Apply scatter offset (from drop)
            if (this.orbScatterPhase > 0.01) {
                px += this.orbScatterOffsets[i3] * this.orbScatterPhase * spread;
                py += this.orbScatterOffsets[i3 + 1] * this.orbScatterPhase * spread;
                pz += this.orbScatterOffsets[i3 + 2] * this.orbScatterPhase * spread;
            }

            this.orbPositionFlat[i3] = px;
            this.orbPositionFlat[i3 + 1] = py;
            this.orbPositionFlat[i3 + 2] = pz;

            // Per-orbital frequency mapping for scale pulse
            const fIdx = Math.floor((i / count) * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;
            const s = baseSize * (1 + freq * pulseAmt * 0.3 + mid * pulseAmt * 0.2);

            // Rotation — each orbital spins on a unique axis
            const rotAngle = this.time * 2 + golden;
            this._tempVec3.set(Math.sin(golden), Math.cos(golden * 0.7), Math.sin(golden * 1.3)).normalize();
            quat.setFromAxisAngle(this._tempVec3, rotAngle);

            pos.set(px, py, pz);
            scale.set(s, s, s);
            matrix.compose(pos, quat, scale);
            this.orbitalMesh.setMatrixAt(i, matrix);

            // Per-instance color — frequency-mapped, brighter when active
            const hue = colorStorm > 0.1
                ? (this.time * 5 + i * 0.01) % 1  // rapid cycling during colorStorm
                : (freq * 0.5 + this.time * 0.05 + i / count * 0.3) % 1;
            const c = ParamSystem.getColorThreeHSL(hue);
            const intensity = Math.min(1, 0.3 + freq * 0.7 + highMid * 0.3);
            this.orbitalInstanceColors[i3] = c.r * intensity;
            this.orbitalInstanceColors[i3 + 1] = c.g * intensity;
            this.orbitalInstanceColors[i3 + 2] = c.b * intensity;
        }

        this.orbitalMesh.instanceMatrix.needsUpdate = true;
        if (this.orbitalMesh.instanceColor) this.orbitalMesh.instanceColor.needsUpdate = true;
        this.orbitalMesh.count = count;
    },

    // ── UPDATE: WEB / PLEXUS ──
    updateWeb(audio, params, dt) {
        if (!params.webEnabled || !this.webLine) { if (this.webLine) this.webLine.visible = false; return; }
        this.webLine.visible = true;

        const treble = audio.smoothBands.treble || 0;
        const onset = audio.onsetStrength || 0;
        const maxDist = (params.webDistance || 20) * (1 + treble * 1.5);
        const maxDist2 = maxDist * maxDist; // squared for fast check
        const maxLines = this.maxWebSegments;
        const count = this.currentOrbitalCount;
        const positions = this.orbPositionFlat;
        const wPos = this.webPositions;
        const wCol = this.webColors;
        let lineIdx = 0;

        const pulseAmt = params.webPulseOnset ? (1 + onset * 3) : 1;

        // Limit search to cap O(n²) — 300 orbitals = ~45K distance checks max
        const searchCount = Math.min(count, 300);

        for (let i = 0; i < searchCount && lineIdx < maxLines; i++) {
            const ix = positions[i * 3], iy = positions[i * 3 + 1], iz = positions[i * 3 + 2];
            for (let j = i + 1; j < searchCount && lineIdx < maxLines; j++) {
                const jx = positions[j * 3], jy = positions[j * 3 + 1], jz = positions[j * 3 + 2];
                const dx = ix - jx, dy = iy - jy, dz = iz - jz;
                const dist2 = dx * dx + dy * dy + dz * dz;
                if (dist2 < maxDist2) {
                    const dist = Math.sqrt(dist2);
                    const fade = (1 - dist / maxDist) * pulseAmt;
                    const li = lineIdx * 6;
                    wPos[li] = ix; wPos[li + 1] = iy; wPos[li + 2] = iz;
                    wPos[li + 3] = jx; wPos[li + 4] = jy; wPos[li + 5] = jz;

                    // Color from palette, faded by distance
                    const c = ParamSystem.getColorThreeHSL((dist / maxDist) * 0.5 + this.time * 0.05);
                    const clampFade = Math.min(1, fade);
                    wCol[li] = c.r * clampFade; wCol[li + 1] = c.g * clampFade; wCol[li + 2] = c.b * clampFade;
                    wCol[li + 3] = c.r * clampFade; wCol[li + 4] = c.g * clampFade; wCol[li + 5] = c.b * clampFade;

                    lineIdx++;
                }
            }
        }

        this.webLine.geometry.setDrawRange(0, lineIdx * 2);
        this.webLine.geometry.attributes.position.needsUpdate = true;
        this.webLine.geometry.attributes.color.needsUpdate = true;
        this.webLine.material.opacity = (params.webOpacity || 0.4) * (0.5 + treble * pulseAmt);
    },

    // ── UPDATE: SHOCKWAVES ──
    updateShockwaves(audio, params, dt) {
        if (!params.shockwaveEnabled) {
            this.shockwaves.forEach(sw => { sw.active = false; sw.mesh.visible = false; });
            return;
        }

        const speed = params.shockwaveSpeed || 2;
        const intensity = params.shockwaveIntensity || 2;
        const spread = params.orbitalSpread || 35;

        // Trigger on bass beat
        if (audio.bassBeat) {
            this.spawnShockwave(params.shockwaveStyle || 'ring', audio.bassBeatIntensity * intensity);
        }

        for (let i = 0; i < this.shockwaves.length; i++) {
            const sw = this.shockwaves[i];
            if (!sw.active) continue;
            sw.age += dt * speed;
            if (sw.age < 0) { sw.mesh.scale.setScalar(0.01); continue; } // staggered start for ripple
            const maxAge = 1.5;
            if (sw.age >= maxAge) { sw.active = false; sw.mesh.visible = false; continue; }
            const t = sw.age / maxAge;
            const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
            sw.mesh.scale.setScalar(eased * spread * 2.5);
            sw.mesh.material.opacity = Math.min(0.7, (1 - t * t) * 0.6);
            // Pulse color toward palette
            const c = ParamSystem.getColorThree(t + this.time * 0.1);
            sw.mesh.material.color.lerp(c, 0.1);
        }
    },

    // ── UPDATE: DEBRIS ──
    updateDebris(audio, params, dt) {
        if (!params.debrisEnabled || !this.debrisSystem) { if (this.debrisSystem) this.debrisSystem.visible = false; return; }
        this.debrisSystem.visible = true;

        const gravity = params.debrisGravity || 0.5;
        const bass = audio.smoothBands.bass || 0;

        // Emit from core vertices on beat
        if (this.coreGeo && audio.bassBeat) {
            const corePos = this.coreGeo.attributes.position.array;
            const vertCount = corePos.length / 3;
            const emitCount = audio.isDropSection ? 60 : (audio.bassBeat ? 30 : 5);

            this.group.updateMatrixWorld();
            const vec = this._tempVec3;

            for (let e = 0; e < emitCount; e++) {
                let idx = -1;
                for (let i = 0; i < this.maxDebris; i++) { if (this.debrisVelocities[i].life <= 0) { idx = i; break; } }
                if (idx === -1) break;
                const vi = Math.floor(Math.random() * vertCount) * 3;
                vec.set(corePos[vi], corePos[vi + 1], corePos[vi + 2]);
                vec.applyMatrix4(this.group.matrixWorld);
                this.debrisPositions[idx * 3] = vec.x;
                this.debrisPositions[idx * 3 + 1] = vec.y;
                this.debrisPositions[idx * 3 + 2] = vec.z;
                const spd = (audio.bassBeatIntensity || 0.3) * 3;
                this.debrisVelocities[idx] = {
                    x: (Math.random() - 0.5) * spd,
                    y: (Math.random() - 0.5) * spd + 0.5,
                    z: (Math.random() - 0.5) * spd,
                    life: 2.0
                };
                const c = ParamSystem.getColorThreeHSL(Math.random() + audio.rms);
                this.debrisColors[idx * 3] = c.r; this.debrisColors[idx * 3 + 1] = c.g; this.debrisColors[idx * 3 + 2] = c.b;
            }
        }

        // Physics step
        for (let i = 0; i < this.maxDebris; i++) {
            const v = this.debrisVelocities[i]; if (v.life <= 0) continue;
            v.life -= dt * 0.5; v.y -= gravity * dt;
            v.x *= 0.995; v.y *= 0.995; v.z *= 0.995;
            this.debrisPositions[i * 3] += v.x;
            this.debrisPositions[i * 3 + 1] += v.y;
            this.debrisPositions[i * 3 + 2] += v.z;
            if (v.life <= 0) { this.debrisPositions[i * 3] = 0; this.debrisPositions[i * 3 + 1] = 0; this.debrisPositions[i * 3 + 2] = 0; }
        }
        this.debrisSystem.geometry.attributes.position.needsUpdate = true;
        this.debrisSystem.geometry.attributes.color.needsUpdate = true;
        this.debrisSystem.material.size = 1.5 * (1 + bass * 2 + this._emissivePulse);
    },

    // ══════════════════════════════════════════════════════════
    // ── MAIN UPDATE ──
    // ══════════════════════════════════════════════════════════
    update(audio, params, dt) {
        if (!this.group || !this.coreMesh) return;
        this.time += dt;

        const SE = audio.sectionEffects || { displacementScale: 1, speed: 1, rotationMultiplier: 1 };
        const react = params.reactivity || 1.5;
        const bass = audio.smoothBands.bass || 0, sub = audio.smoothBands.sub || 0;
        const mid = audio.smoothBands.mid || 0, treble = audio.smoothBands.treble || 0;
        const rms = audio.rms || 0;

        // ── CORE REBUILD CHECK (throttled superformula) ──
        const shape = params.coreShape || 'superformula';
        const seg = Math.floor(params.coreDetail || 40), size = params.coreSize || 20;
        let m = params.sfM || 6, n1 = params.sfN1 || 1, n2 = params.sfN2 || 1, n3 = params.sfN3 || 1;
        if (params.sfAudioMap && shape === 'superformula') {
            this.smoothSfM += ((m + bass * 4) - this.smoothSfM) * 0.08;
            this.smoothSfN1 += ((n1 + sub * 3) - this.smoothSfN1) * 0.08;
            this.smoothSfN2 += ((n2 + mid * 2) - this.smoothSfN2) * 0.08;
            this.smoothSfN3 += ((n3 + treble * 2) - this.smoothSfN3) * 0.08;
            m = this.smoothSfM; n1 = this.smoothSfN1; n2 = this.smoothSfN2; n3 = this.smoothSfN3;
        }
        const sfKey = `${shape}_${seg}_${size}_${m.toFixed(1)}_${n1.toFixed(1)}_${n2.toFixed(1)}_${n3.toFixed(1)}`;
        const now = performance.now();
        if (shape !== this.currentCoreShape) {
            this.buildCore(shape, seg, size, m, n1, n2, n3);
            this.lastSfParams = sfKey; this.lastRebuildTime = now;
        } else if (shape === 'superformula' && sfKey !== this.lastSfParams && (now - this.lastRebuildTime) > 200) {
            this.buildCore(shape, seg, size, m, n1, n2, n3);
            this.lastSfParams = sfKey; this.lastRebuildTime = now;
        }

        // ── ORBITAL REBUILD CHECK ──
        const orbCount = Math.floor(params.orbitalCount || 400);
        const orbShape = params.orbitalShape || 'icosahedron';
        if (orbCount !== this.currentOrbitalCount || orbShape !== this.currentOrbitalShape) {
            this.buildOrbitals(orbCount, orbShape);
        }

        // ── WEB REBUILD CHECK ──
        const webMax = Math.floor(params.webMaxLines || 2000);
        if (webMax !== this.maxWebSegments) this.buildWeb(webMax);

        // ── DEBRIS REBUILD CHECK ──
        const debrisCount = Math.floor(params.debrisCount || 2000);
        if (debrisCount !== this.maxDebris) this.initDebris(debrisCount);

        // ── DROP EFFECTS ──
        const isDropping = audio.isDropSection;
        const dropLevel = (audio.dropSectionIntensity || 1) * (params.dropIntensityMult || 2);
        if (isDropping && audio.bassBeat && !this._dropTriggeredThisDrop) {
            this._dropTriggeredThisDrop = true;
            this.handleDrop(params.dropReaction || 'overdriveAll', dropLevel, params, audio);
            this._emissivePulse = 1.0;
        }
        if (!isDropping) this._dropTriggeredThisDrop = false;
        if (this._emissivePulse > 0) this._emissivePulse *= 0.93;

        // ── BEAT EXPLODE ──
        if (audio.bassBeat && params.beatExplode > 0) {
            this.explodePhase += audio.bassBeatIntensity * params.beatExplode * 0.3;
        }
        this.explodePhase = Math.min(this.explodePhase, 5);
        this.explodePhase *= 0.88;

        // ── SCATTER DECAY ──
        if (this.orbScatterPhase > 0.01) this.orbScatterPhase *= 0.97;
        else this.orbScatterPhase = 0;

        // ── UPDATE ALL LAYERS ──
        this.updateCore(audio, params, dt, SE);
        this.updateOrbitals(audio, params, dt);
        this.updateWeb(audio, params, dt);
        this.updateShockwaves(audio, params, dt);
        this.updateDebris(audio, params, dt);

        // ── ROTATION ──
        if (params.rotationEnabled !== false) {
            const rotMult = SE.rotationMultiplier || 1;
            const rot = (params.rotSpeed || 0.4) * (1 + mid * react * 0.6) * rotMult;
            this.group.rotation.x += rot * 0.3 * dt;
            this.group.rotation.y += rot * dt;
            this.group.rotation.z += rot * 0.1 * dt;
            if (audio.bassBeat) {
                this.group.rotation.y += Math.min(0.15, audio.bassBeatIntensity * 0.2) * rotMult;
            }
        }

        // ── MATERIALS ──
        this.coreMesh.material.opacity = Math.min(0.6, (params.coreSolidOpacity || 0.15) + this._emissivePulse * 0.3);
        this.coreWire.material.opacity = Math.min(0.95, (params.coreWireOpacity || 0.8) * (0.5 + rms * 0.5));
        this.coreWire.material.color.copy(ParamSystem.getColorThree(rms + this.time * 0.1));

        if (this.orbitalMesh) {
            this.orbitalMesh.material.wireframe = params.orbitalWireframe !== false;
            this.orbitalMesh.material.opacity = Math.min(0.9, (params.orbitalOpacity || 0.7) * (0.5 + mid * 0.5));
        }

        // Gunshot reaction — scatter orbitals + boost shockwave
        if (audio.gunShotDetected) {
            const gi = (audio.gunShotIntensity || 0);
            if (gi > 0.3) {
                for (let i = 0; i < this.currentOrbitalCount * 3; i++) {
                    this.orbScatterOffsets[i] = (Math.random() - 0.5) * 2;
                }
                this.orbScatterPhase = Math.max(this.orbScatterPhase, gi * 2);
                this.spawnShockwave(params.shockwaveStyle || 'ring', gi * 3);
            }
        }

        // Screech reaction — boost web opacity and color intensity
        if (audio.screechDetected && this.webLine) {
            this.webLine.material.opacity = Math.min(1, this.webLine.material.opacity + (audio.screechIntensity || 0) * 0.5);
        }
    },

    // ── DESTROY ──
    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.material) {
                    if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                    else c.material.dispose();
                }
            });
            scene.remove(this.group);
        }
        if (this.coreGeo) { this.coreGeo.dispose(); this.coreGeo = null; }
        if (this.orbitalMesh) { this.orbitalMesh.geometry.dispose(); }
        if (this.shockRingGeo) { this.shockRingGeo.dispose(); this.shockRingGeo = null; }
        if (this.shockSphereGeo) { this.shockSphereGeo.dispose(); this.shockSphereGeo = null; }
        this.coreMesh = null; this.coreWire = null;
        this.orbitalMesh = null; this.webLine = null;
        this.debrisSystem = null; this.shockwaves = [];
        this.orbPositionFlat = null; this.orbScatterOffsets = null;
        this.debrisPositions = null; this.debrisVelocities = [];
    }
};
