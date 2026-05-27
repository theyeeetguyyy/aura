// ============================================================
// AURA Mode — HYPERFORGE 4.0
// FIXED: wireframe no longer rebuilt every frame (was killing FPS).
// Shared geometry approach — position updates auto-propagate.
// Reorganized params with clear sections. Full sectionEffects
// integration from marker system.
// ============================================================

const HyperforgeMode2 = {
    name: 'Hyperforge',
    group: null, time: 0,

    // Outer mesh: mainMesh + mainWire share ONE geometry (outerGeo)
    outerGeo: null,
    mainMesh: null, mainWire: null,
    basePositions: null, normals: null, vertexColors: null,

    // Inner mesh: innerMesh + innerWire share ONE geometry (innerGeo)
    innerGeo: null,
    innerMesh: null, innerWire: null,
    innerBasePos: null, innerNormals: null,

    // Particles / attractors / flow
    attractorSystem: null, attractorPositions: null, attractorColors: null,
    attractorVelocities: [], maxAttractorParts: 8000,
    flowSystem: null, flowPositions: null, flowColors: null,
    flowVelocities: [], maxFlowParts: 5000,

    // Trails (ring buffer)
    trailLine: null, trailBuffer: null, trailHead: 0, trailCount: 0, trailMaxPoints: 2000,

    // Shape tracking
    currentShape: '', currentInner: '', currentInnerSize: 0,

    // State
    explodePhase: 0, superformulaPhase: 0,
    lastSfParams: '', lastRebuildTime: 0,
    smoothSfM: 6, smoothSfN1: 1, smoothSfN2: 1, smoothSfN3: 1,
    morphing: false, morphTarget: null, morphProgress: 0,
    _dropTriggeredThisDrop: false,
    _dropDisplaceActive: null, _dropColorActive: null,
    _tempColor: null, // BUG-22 fix: reusable scratch color for per-vertex coloring

    // ── PARAMS ──
    params: {
        // ═══ SURFACE ═══
        outerSurface: {
            type: 'select', options: [
                'superformula', 'lorenzSurface', 'kleinBottle', 'catenoid', 'helicoid',
                'diniSurface', 'enneperSurface', 'crossCap', 'torusKnot', 'icosahedron', 'sphere',
                'boysSurface', 'romanSurface', 'seiferSurface', 'steinerian', 'trefoilKnot', 'algebraicHorn'
            ], default: 'superformula', label: '🔮 Surface Shape'
        },
        outerDetail: { type: 'range', min: 0, max: 100, default: 40, step: 5, label: '🔶 Resolution' },
        outerSize: { type: 'range', min: 0, max: 60, default: 22, step: 1, label: '📐 Size' },

        // ═══ SUPERFORMULA ═══
        sfM: { type: 'range', min: 0, max: 30, default: 6, step: 0.5, label: '🔢 SF Symmetry (m)' },
        sfN1: { type: 'range', min: 0, max: 15, default: 1, step: 0.1, label: '🔷 SF Shape (n1)' },
        sfN2: { type: 'range', min: 0, max: 15, default: 1, step: 0.1, label: '↔️ SF Horizontal (n2)' },
        sfN3: { type: 'range', min: 0, max: 15, default: 1, step: 0.1, label: '↕️ SF Vertical (n3)' },
        sfAudioMap: { type: 'toggle', default: true, label: '🎵 Audio Drives SF' },

        // ═══ DISPLACEMENT ═══
        displaceMode: {
            type: 'select', options: [
                'fourier', 'forceField', 'vortex', 'magnetic', 'superposition', 'turbulence',
                'audioSculpt', 'reaction', 'gravitationalWell', 'stringTheory', 'fluidSim'
            ], default: 'fourier', label: '🌊 Displace Mode'
        },
        displaceAmt: { type: 'range', min: 0, max: 40, default: 8, step: 0.5, label: '📊 Displace Amount' },
        displaceSpeed: { type: 'range', min: 0, max: 8, default: 1.5, step: 0.1, label: '⏩ Displace Speed' },
        symmetryAxis: { type: 'select', options: ['off', 'x', 'y', 'z', 'xy', 'xz', 'yz', 'xyz'], default: 'off', label: '🔀 Symmetry Axis' },
        gravWellCount: { type: 'range', min: 0, max: 8, default: 2, step: 1, label: '🕳️ Gravity Wells' },

        // ═══ COLORS ═══
        colorMode: {
            type: 'select', options: [
                'reactionDiffusion', 'curvature', 'audioFreq', 'height', 'velocity',
                'rainbow', 'fire', 'ice', 'plasma', 'thermal', 'void', 'holographic'
            ], default: 'reactionDiffusion', label: '🎨 Color Mode'
        },
        customColor1: { type: 'color', default: '#8b5cf6', label: '🟣 Custom Color A' },
        customColor2: { type: 'color', default: '#22ccff', label: '🔵 Custom Color B' },

        // ═══ APPEARANCE ═══
        solidOpacity: { type: 'range', min: 0, max: 1, default: 0.2, step: 0.05, label: '🔳 Solid Opacity' },
        wireOpacity: { type: 'range', min: 0, max: 1, default: 0.7, step: 0.05, label: '🕸️ Wire Opacity' },

        // ═══ INNER SURFACE ═══
        showInner: { type: 'toggle', default: true, label: '🔵 Inner Surface' },
        innerSurface: {
            type: 'select', options: ['sphere', 'torusKnot', 'icosahedron', 'superformula', 'none'],
            default: 'icosahedron', label: '🔷 Inner Shape'
        },
        innerScale: { type: 'range', min: 0, max: 1, default: 0.4, step: 0.05, label: '📐 Inner Scale' },
        innerSolidOpacity: { type: 'range', min: 0, max: 0.8, default: 0.1, step: 0.05, label: '🔳 Inner Solid Opacity' },
        innerWireOpacity: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: '🕸️ Inner Wire Opacity' },
        dualWireColors: { type: 'toggle', default: false, label: '🌈 Dual Wire Colors' },

        // ═══ ATTRACTOR ═══
        attractorType: {
            type: 'select', options: ['lorenz', 'rossler', 'aizawa', 'thomas', 'halvorsen', 'chen', 'dadras', 'sprott', 'none'],
            default: 'lorenz', label: '🌀 Attractor Type'
        },
        secondAttractor: {
            type: 'select', options: ['none', 'lorenz', 'rossler', 'aizawa', 'thomas', 'halvorsen', 'chen', 'dadras', 'sprott'],
            default: 'none', label: '🔗 Secondary Attractor'
        },
        attractorBlend: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: '🔀 Attractor Blend' },
        attractorCount: { type: 'range', min: 0, max: 15000, default: 4000, step: 500, label: '✨ Attractor Points' },
        attractorSpeed: { type: 'range', min: 0, max: 8, default: 1, step: 0.1, label: '⏩ Attractor Speed' },
        attractorScale: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: '📐 Attractor Scale' },
        attractorAudioLink: {
            type: 'select', options: ['bass', 'mid', 'treble', 'rms', 'sub'],
            default: 'bass', label: '🔊 Audio Link Band'
        },
        particleJitter: { type: 'range', min: 0, max: 8, default: 0, step: 0.1, label: '✨ Particle Jitter' },
        pointGlow: { type: 'range', min: 0, max: 10, default: 2.5, step: 0.5, label: '✨ Point Glow Size' },
        showTrails: { type: 'toggle', default: true, label: '📈 Show Trails' },
        trailColorMode: {
            type: 'select', options: ['velocity', 'time', 'distance', 'palette'],
            default: 'velocity', label: '🎨 Trail Color'
        },

        // ═══ FLOW PARTICLES ═══
        flowEnabled: { type: 'toggle', default: true, label: '💫 Flow Particles' },
        flowCount: { type: 'range', min: 0, max: 12000, default: 3000, step: 500, label: '💫 Flow Count' },
        flowSpeed: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: '⏩ Flow Speed' },
        flowPattern: {
            type: 'select', options: ['orbit', 'spiral', 'helix', 'chaos', 'vortex'],
            default: 'orbit', label: '🌀 Flow Pattern'
        },

        // ═══ ROTATION ═══
        rotSpeed: { type: 'range', min: 0, max: 8, default: 0.4, step: 0.05, label: '🔄 Rotation Speed' },
        rotationEnabled: { type: 'toggle', default: true, label: '🔄 Rotation On/Off' },

        // ═══ AUDIO REACTIVITY ═══
        bassBreath: { type: 'range', min: 0, max: 8, default: 2.5, step: 0.1, label: '🔊 Bass Breathing' },
        beatExplode: { type: 'range', min: 0, max: 8, default: 2, step: 0.1, label: '💥 Beat Explode' },
        beatExplosionStyle: {
            type: 'select', options: ['radial', 'shatter', 'invert', 'twist'],
            default: 'radial', label: '💥 Explode Style'
        },

        // ═══ DROP SECTION ═══
        morphEnabled: { type: 'toggle', default: true, label: '🔄 Drop Morph' },
        morphSpeed: { type: 'range', min: 0, max: 8, default: 2, step: 0.1, label: '⏩ Morph Speed' },
        dropReaction: {
            type: 'select', options: ['shapeShift', 'colorStorm', 'particleBurst', 'invert', 'all'],
            default: 'all', label: '🔥 Drop Reaction'
        },
        dropMorphTarget: {
            type: 'select', options: [
                'random', 'superformula', 'lorenzSurface', 'kleinBottle', 'catenoid', 'helicoid',
                'diniSurface', 'enneperSurface', 'crossCap', 'boysSurface', 'trefoilKnot', 'algebraicHorn'
            ], default: 'random', label: '🎯 Drop Morph Shape'
        },
        dropDisplaceOverride: {
            type: 'select', options: [
                'off', 'fourier', 'forceField', 'vortex', 'magnetic', 'superposition',
                'turbulence', 'audioSculpt', 'reaction', 'gravitationalWell', 'stringTheory', 'fluidSim'
            ], default: 'off', label: '🌊 Drop Displace Override'
        },
        dropColorOverride: {
            type: 'select', options: [
                'off', 'reactionDiffusion', 'curvature', 'audioFreq', 'rainbow',
                'fire', 'plasma', 'thermal', 'void', 'holographic'
            ], default: 'off', label: '🎨 Drop Color Override'
        },
        dropIntensityMult: { type: 'range', min: 0, max: 8, default: 1.5, step: 0.1, label: '⚡ Drop Intensity' },
    },

    // ── NOISE ──
    noise3D(x, y, z) { return MathLib.noise3D(x, y, z); },
    fbm(x, y, z, oct) { return MathLib.fbm(x, y, z, oct); },

    // ── SUPERFORMULA ──
    superformula(angle, m, n1, n2, n3) { return MathLib.superformula(angle, m, n1, n2, n3); },

    // ── SURFACE GRID HELPER ──
    _grid(seg, fn) { return MathLib.buildGrid(seg, fn); },

    _buildDisplaceFn(mode, audio, amt, speed, wells) {
        return MathLib.buildDisplaceFn(mode, audio, amt, speed, this.time, wells);
    },

    _buildColorFn(colorMode, audio, amt) {
        return ColorLib.buildColorFn(colorMode, audio, amt, this.time, this._colorResult, this._tempColor);
    },

    // ── OUTER SURFACE GENERATORS ──
    getOuterGeo(shape, seg, size, m, n1, n2, n3) {
        return MathLib.getOuterGeo(shape, seg, size, m, n1, n2, n3);
    },

    // ── ATTRACTORS ──
    stepAttractor(type, x, y, z, dt2, am) {
        return MathLib.stepAttractor(type, x, y, z, dt2, am);
    },

    // ── INIT ──
    init(scene, camera) {
        this.group = new THREE.Group(); scene.add(this.group);
        camera.position.set(0, 15, 60); camera.lookAt(0, 0, 0);
        this.time = 0; this.currentShape = ''; this.currentInner = ''; this.currentInnerSize = 0;
        this.morphing = false; this.morphTarget = null; this.lastSfParams = '';
        this._dropTriggeredThisDrop = false;
        this._dropDisplaceActive = null; this._dropColorActive = null;
        this._tempColor = new THREE.Color();
        this._colorResult = new Float32Array(3);
        this.outerGeo = null; this.innerGeo = null;
        this.buildOuter('superformula', 40, 22, 6, 1, 1, 1);
        this.buildInner('icosahedron', 22 * 0.4);
        this.initAttractor(4000);
        this.initFlow(3000);
        this.initTrails();
    },

    // ── OUTER BUILD ──
    // mainMesh + mainWire share the SAME outerGeo buffer.
    // NO more per-frame WireframeGeometry rebuild — that was destroying performance.
    buildOuter(shape, seg, size, m, n1, n2, n3) {
        if (this.mainMesh) { this.group.remove(this.mainMesh); this.mainMesh.material.dispose(); this.mainMesh = null; }
        if (this.mainWire) { this.group.remove(this.mainWire); this.mainWire.material.dispose(); this.mainWire = null; }
        if (this.outerGeo) { this.outerGeo.dispose(); this.outerGeo = null; }

        const geo = this.getOuterGeo(shape, seg, size, m, n1, n2, n3);
        geo.computeVertexNormals();
        const vc = geo.attributes.position.count;
        const cols = new Float32Array(vc * 3).fill(1);
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        this.outerGeo = geo;
        this.basePositions = new Float32Array(geo.attributes.position.array);
        this.normals = new Float32Array(geo.attributes.normal.array);
        this.vertexColors = cols;

        // Shared geometry: both solid and wireframe reference the SAME buffer.
        this.mainMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.2,
            side: THREE.DoubleSide, blending: THREE.NormalBlending, depthWrite: false
        }));
        // wireframe: true on a Mesh uses the same geometry buffer — no rebuild needed, ever.
        this.mainWire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            wireframe: true, color: 0x8b5cf6, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.mainMesh, this.mainWire);
        this.currentShape = shape;
    },

    // ── INNER BUILD ──
    buildInner(shape, size) {
        if (this.innerMesh) { this.group.remove(this.innerMesh); this.innerMesh.material.dispose(); this.innerMesh = null; }
        if (this.innerWire) { this.group.remove(this.innerWire); this.innerWire.material.dispose(); this.innerWire = null; }
        if (this.innerGeo) { this.innerGeo.dispose(); this.innerGeo = null; }
        this.currentInner = shape; this.currentInnerSize = size;

        if (shape === 'none') return;

        const geo = MathLib.getInnerGeo(shape, size);

        geo.computeVertexNormals();
        this.innerBasePos = new Float32Array(geo.attributes.position.array);
        this.innerNormals = new Float32Array(geo.attributes.normal.array);
        this.innerGeo = geo;

        // Shared inner geometry
        this.innerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0x22ccff, transparent: true, opacity: 0.1,
            side: THREE.DoubleSide, blending: THREE.NormalBlending, depthWrite: false
        }));
        this.innerWire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            wireframe: true, color: 0x22ccff, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.innerMesh, this.innerWire);
    },

    // ── ATTRACTOR INIT ──
    initAttractor(count) {
        if (this.attractorSystem) { this.group.remove(this.attractorSystem); this.attractorSystem.geometry.dispose(); this.attractorSystem.material.dispose(); }
        this.maxAttractorParts = count;
        this.attractorPositions = new Float32Array(count * 3);
        this.attractorColors = new Float32Array(count * 3);
        this.attractorVelocities = [];
        for (let i = 0; i < count; i++) {
            this.attractorPositions[i * 3] = (Math.random() - 0.5) * 2;
            this.attractorPositions[i * 3 + 1] = (Math.random() - 0.5) * 2;
            this.attractorPositions[i * 3 + 2] = (Math.random() - 0.5) * 2;
            this.attractorColors[i * 3] = 1; this.attractorColors[i * 3 + 1] = 0.5; this.attractorColors[i * 3 + 2] = 1;
            this.attractorVelocities.push({ x: 0, y: 0, z: 0 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.attractorPositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.attractorColors, 3));
        this.attractorSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        this.group.add(this.attractorSystem);
    },

    // ── FLOW INIT ──
    initFlow(count) {
        if (this.flowSystem) { this.group.remove(this.flowSystem); this.flowSystem.geometry.dispose(); this.flowSystem.material.dispose(); }
        this.maxFlowParts = count;
        this.flowPositions = new Float32Array(count * 3);
        this.flowColors = new Float32Array(count * 3);
        this.flowVelocities = [];
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 15;
            this.flowPositions[i * 3] = Math.cos(a) * r; this.flowPositions[i * 3 + 1] = (Math.random() - 0.5) * 20; this.flowPositions[i * 3 + 2] = Math.sin(a) * r;
            this.flowVelocities.push({ x: 0, y: 0, z: 0 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.flowPositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.flowColors, 3));
        this.flowSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1, vertexColors: true, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        this.group.add(this.flowSystem);
    },

    // ── TRAILS INIT ──
    initTrails() {
        if (this.trailLine) { this.group.remove(this.trailLine); this.trailLine.geometry.dispose(); this.trailLine.material.dispose(); }
        this.trailBuffer = new Float32Array(this.trailMaxPoints * 3);
        this.trailHead = 0; this.trailCount = 0;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.trailBuffer, 3));
        geo.setDrawRange(0, 0);
        this.trailLine = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: 0xff44aa, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending
        }));
        this.group.add(this.trailLine);
    },

    // ── MAIN UPDATE ──
    update(audio, params, dt) {
        if (!this.group || !this.mainMesh) return;
        this.time += dt;

        // Section effects from marker system
        const SE = audio.sectionEffects || { displacementScale: 1, speed: 1, rotationMultiplier: 1, particleEmissionRate: 1, bloomGlowMult: 1 };

        const react = params.reactivity || 1.5;
        const bass = audio.smoothBands.bass || 0, sub = audio.smoothBands.sub || 0;
        const mid = audio.smoothBands.mid || 0, treble = audio.smoothBands.treble || 0;
        const rms = audio.rms || 0;

        // ── OUTER SURFACE REBUILD CHECK ──
        const shape = params.outerSurface || 'superformula';
        const seg = Math.floor(params.outerDetail || 40);
        const size = params.outerSize || 22;
        let m = params.sfM || 6, n1 = params.sfN1 || 1, n2 = params.sfN2 || 1, n3 = params.sfN3 || 1;

        // Smooth-lerp SF params when audio-mapped
        if (params.sfAudioMap && shape === 'superformula') {
            this.smoothSfM += ((m + bass * 4) - this.smoothSfM) * 0.08;
            this.smoothSfN1 += ((n1 + sub * 3) - this.smoothSfN1) * 0.08;
            this.smoothSfN2 += ((n2 + mid * 2) - this.smoothSfN2) * 0.08;
            this.smoothSfN3 += ((n3 + treble * 2) - this.smoothSfN3) * 0.08;
            m = this.smoothSfM; n1 = this.smoothSfN1; n2 = this.smoothSfN2; n3 = this.smoothSfN3;
        }

        const sfKey = `${shape}_${seg}_${size}_${m.toFixed(1)}_${n1.toFixed(1)}_${n2.toFixed(1)}_${n3.toFixed(1)}`;
        const now = performance.now();
        if (shape !== this.currentShape) {
            this.buildOuter(shape, seg, size, m, n1, n2, n3);
            this.lastSfParams = sfKey; this.lastRebuildTime = now;
        } else if (shape === 'superformula' && sfKey !== this.lastSfParams && (now - this.lastRebuildTime) > 200) {
            this.buildOuter(shape, seg, size, m, n1, n2, n3);
            this.lastSfParams = sfKey; this.lastRebuildTime = now;
        }

        // ── INNER SURFACE ──
        const innerShape = params.showInner ? (params.innerSurface || 'icosahedron') : 'none';
        const innerSize = size * (params.innerScale || 0.4);
        if (innerShape !== this.currentInner || Math.abs(innerSize - this.currentInnerSize) > 0.5) {
            this.buildInner(innerShape, innerSize);
        }

        // ── COUNT CHANGES ──
        if (Math.floor(params.attractorCount || 4000) !== this.maxAttractorParts) this.initAttractor(Math.floor(params.attractorCount || 4000));
        if (Math.floor(params.flowCount || 3000) !== this.maxFlowParts) this.initFlow(Math.floor(params.flowCount || 3000));

        // ── DROP EFFECTS ──
        const isDropping = audio.isDropSection;
        const dropLevel = (audio.dropSectionIntensity || 1) * (params.dropIntensityMult || 1.5);
        if (isDropping && audio.bassBeat && !this._dropTriggeredThisDrop) {
            this._dropTriggeredThisDrop = true;
            const react2 = params.dropReaction || 'all';
            if ((react2 === 'shapeShift' || react2 === 'all') && params.morphEnabled !== false) {
                const target = params.dropMorphTarget || 'random';
                const shapes = ['superformula', 'catenoid', 'helicoid', 'enneperSurface', 'crossCap', 'boysSurface', 'trefoilKnot', 'algebraicHorn'];
                const next = (target === 'random') ? shapes[Math.floor(Math.random() * shapes.length)] : target;
                if (next !== this.currentShape) this.buildOuter(next, seg, size, m, n1, n2, n3);
            }
            if (react2 === 'particleBurst' || react2 === 'all') this.explodePhase = Math.min(this.explodePhase + 2 * dropLevel, 5);
        }
        if (!isDropping) this._dropTriggeredThisDrop = false;

        // Drop overrides
        this._dropDisplaceActive = (isDropping && params.dropDisplaceOverride && params.dropDisplaceOverride !== 'off') ? params.dropDisplaceOverride : null;
        this._dropColorActive = (isDropping && params.dropColorOverride && params.dropColorOverride !== 'off') ? params.dropColorOverride : null;

        // ── DISPLACE SURFACE ──
        this.displaceSurface(audio, params, dt, SE);

        // ── INNER PULSE ──
        if (this.innerMesh) {
            // innerScale controls the BUILD size; pulse is a multiplicative scale on top
            const ip = 1 + (sub + bass) * 0.3;
            this.innerMesh.scale.setScalar(ip);
            if (this.innerWire) this.innerWire.scale.setScalar(ip);
        }

        // ── ATTRACTORS ──
        this.updateAttractor(audio, params, dt, SE);

        // ── FLOW ──
        if (params.flowEnabled) { this.updateFlow(audio, params, dt); this.flowSystem.visible = true; }
        else if (this.flowSystem) this.flowSystem.visible = false;

        // ── TRAILS ──
        if (params.showTrails) this.updateTrails(audio, params);
        if (this.trailLine) this.trailLine.visible = !!params.showTrails;

        // ── MATERIALS ──
        this.mainMesh.material.opacity = Math.min(0.8, params.solidOpacity || 0.2);
        this.mainWire.material.opacity = Math.min(0.95, (params.wireOpacity || 0.7) * (0.5 + rms * 0.5));
        this.mainWire.material.color.copy(ParamSystem.getColorThree(rms + this.time * 0.1));

        if (this.attractorSystem) {
            this.attractorSystem.material.size = (params.pointGlow || 2.5) * (1 + bass * SE.bloomGlowMult);
            this.attractorSystem.visible = params.attractorType !== 'none';
        }
        if (this.innerMesh) {
            this.innerMesh.visible = !!params.showInner;
            this.innerMesh.material.opacity = (params.innerSolidOpacity || 0.1) + bass * 0.15;
        }
        if (this.innerWire) {
            this.innerWire.visible = !!params.showInner;
            this.innerWire.material.opacity = (params.innerWireOpacity || 0.5) + rms * 0.4;
            const hwColor = params.dualWireColors
                ? ParamSystem.getColorThree(treble + this.time * 0.15 + 0.5)
                : ParamSystem.getColorThree(treble + this.time * 0.15);
            this.innerWire.material.color.copy(hwColor);
        }

        // ── ROTATION (with on/off toggle) ──
        if (params.rotationEnabled !== false) {
            const rotMult = SE.rotationMultiplier ?? 1;
            const rot = (params.rotSpeed || 0.4) * (1 + mid * react * 0.6) * rotMult;
            this.group.rotation.x += rot * 0.3 * dt;
            this.group.rotation.y += rot * dt;
            this.group.rotation.z += rot * 0.1 * dt;
            if (audio.bassBeat) {
                this.group.rotation.y += Math.min(0.15, audio.bassBeatIntensity * 0.2) * rotMult;
            }
        }

        // ── BEAT EXPLODE ──
        if (audio.bassBeat && params.beatExplode > 0) this.explodePhase += audio.bassBeatIntensity * params.beatExplode * 0.3;
        this.explodePhase = Math.min(this.explodePhase, 5);
        this.explodePhase *= 0.88;
    },

    // ── DISPLACE SURFACE ──
    // No wireframe rebuild here — mainWire shares outerGeo, auto-updated.
    displaceSurface(audio, params, dt, SE) {
        const mode = this._dropDisplaceActive || params.displaceMode || 'fourier';
        const amt = (params.displaceAmt || 8) * (params.reactivity || 1.5) * (SE.displacementScale ?? 1) * (this._dropDisplaceActive ? (params.dropIntensityMult || 1.5) : 1);
        const speed = (params.displaceSpeed || 1.5) * (SE.speed ?? 1);
        const bass = audio.smoothBands.bass || 0, sub = audio.smoothBands.sub || 0;
        const mid = audio.smoothBands.mid || 0, rms = audio.rms || 0;
        const breathScale = 1 + (sub + bass) * (params.bassBreath || 2.5) * 0.2;
        const colorMode = this._dropColorActive || params.colorMode || 'reactionDiffusion';
        const sym = params.symmetryAxis || 'off';
        const wells = Math.floor(params.gravWellCount || 2);
        const explStyle = params.beatExplosionStyle || 'radial';

        const pos = this.outerGeo.attributes.position.array;
        const col = this.outerGeo.attributes.color.array;
        const count = this.basePositions.length / 3;
        const dispFn = this._buildDisplaceFn(mode, audio, amt, speed, wells);
        const colorFn = this._buildColorFn(colorMode, audio, amt);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let bx = this.basePositions[i3], by = this.basePositions[i3 + 1], bz = this.basePositions[i3 + 2];
            let nx = this.normals[i3] || 0, ny = this.normals[i3 + 1] || 0, nz = this.normals[i3 + 2] || 0;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1; nx /= nl; ny /= nl; nz /= nl;
            const t = i / count;
            const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;

            // Symmetry
            let sx = bx, sy = by, sz = bz;
            if (sym.includes('x')) sx = Math.abs(bx);
            if (sym.includes('y')) sy = Math.abs(by);
            if (sym.includes('z')) sz = Math.abs(bz);

            let disp = dispFn(sx, sy, sz, freq, i, count, nx, ny, nz);

            // Explode style
            if (this.explodePhase > 0.01) {
                if (explStyle === 'radial') disp += this.explodePhase * 3;
                else if (explStyle === 'shatter') disp += this.noise3D(bx + this.time, by, bz) * this.explodePhase * 5;
                else if (explStyle === 'invert') disp -= this.explodePhase * 3;
                else if (explStyle === 'twist') { const ta = by * 0.3 + this.time; bx += Math.cos(ta) * this.explodePhase * 2; bz += Math.sin(ta) * this.explodePhase * 2; }
            }

            pos[i3] = (bx + nx * disp) * breathScale;
            pos[i3 + 1] = (by + ny * disp) * breathScale;
            pos[i3 + 2] = (bz + nz * disp) * breathScale;
            // Sub sustain rumble
            if (audio.hasSustainedBass) pos[i3 + 1] += (audio.subSustain || 0) * (audio.wobbleLFO || 0) * amt * 0.4;

            // Colors — clamped to prevent white-out
            const rgb = colorFn(pos[i3], pos[i3 + 1], pos[i3 + 2], disp, freq, t);
            col[i3] = rgb[0]; col[i3 + 1] = rgb[1]; col[i3 + 2] = rgb[2];
        }

        // Mark dirty — mainMesh and mainWire see this automatically (shared buffer)
        this.outerGeo.attributes.position.needsUpdate = true;
        this.outerGeo.attributes.color.needsUpdate = true;
        // BUG-08 fix: Removed computeVertexNormals() — MeshBasicMaterial is unlit, never uses normals
        // Note: NO WireframeGeometry rebuild — that was the critical performance bug.
    },

    // ── ATTRACTOR UPDATE ──
    updateAttractor(audio, params, dt, SE) {
        if (!this.attractorSystem || params.attractorType === 'none') return;
        const type = params.attractorType || 'lorenz';
        const type2 = params.secondAttractor || 'none';
        const blend = params.attractorBlend || 0.5;
        const speed = (params.attractorSpeed || 1) * dt * 15 * (SE.speed ?? 1) * (1 + (audio.sirenRising || 0) * 2);
        const scale = (params.attractorScale || 1) * 0.5;
        const jitter = params.particleJitter || 0;
        const audioLink = params.attractorAudioLink || 'bass';
        const audioMod = audio.smoothBands[audioLink] || 0;

        // Gunshot burst
        if (audio.gunShotDetected) {
            for (let i = 0; i < this.attractorVelocities.length; i++) {
                const vel = this.attractorVelocities[i];
                const si = (audio.gunShotIntensity || 0) * 8;
                vel.x *= (1 + si); vel.y *= (1 + si); vel.z *= (1 + si);
            }
        }

        for (let i = 0; i < this.maxAttractorParts; i++) {
            const i3 = i * 3;
            let x = this.attractorPositions[i3] / scale, y = this.attractorPositions[i3 + 1] / scale, z = this.attractorPositions[i3 + 2] / scale;
            let [dx, dy, dz] = this.stepAttractor(type, x, y, z, speed, audioMod);
            if (type2 !== 'none') {
                const [dx2, dy2, dz2] = this.stepAttractor(type2, x, y, z, speed, audioMod);
                dx = dx * (1 - blend) + dx2 * blend;
                dy = dy * (1 - blend) + dy2 * blend;
                dz = dz * (1 - blend) + dz2 * blend;
            }
            x += dx; y += dy; z += dz;
            if (jitter > 0) { x += (Math.random() - 0.5) * jitter * 0.1; y += (Math.random() - 0.5) * jitter * 0.1; z += (Math.random() - 0.5) * jitter * 0.1; }
            if (!isFinite(x) || Math.abs(x) > 200) { x = (Math.random() - 0.5) * 2; y = (Math.random() - 0.5) * 2; z = (Math.random() - 0.5) * 2; }
            this.attractorPositions[i3] = x * scale; this.attractorPositions[i3 + 1] = y * scale; this.attractorPositions[i3 + 2] = z * scale;
            const spd = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const c = ParamSystem.getColorThreeHSL(spd * 50 + this.time * 0.05);
            this.attractorColors[i3] = c.r; this.attractorColors[i3 + 1] = c.g; this.attractorColors[i3 + 2] = c.b;
        }
        this.attractorSystem.geometry.attributes.position.needsUpdate = true;
        this.attractorSystem.geometry.attributes.color.needsUpdate = true;
    },

    // ── FLOW UPDATE ──
    updateFlow(audio, params, dt) {
        if (!this.flowSystem) return;
        const speed = (params.flowSpeed || 1) * dt;
        const bass = audio.smoothBands.bass || 0, mid = audio.smoothBands.mid || 0;
        const pattern = params.flowPattern || 'orbit';

        for (let i = 0; i < this.maxFlowParts; i++) {
            const i3 = i * 3;
            let x = this.flowPositions[i3], y = this.flowPositions[i3 + 1], z = this.flowPositions[i3 + 2];
            const dist = Math.sqrt(x * x + y * y + z * z) || 1;
            const angle = Math.atan2(z, x);
            const v = this.flowVelocities[i];

            switch (pattern) {
                case 'orbit': { v.x += Math.cos(angle) * (15 - dist) * 0.01 * speed - Math.sin(angle) * (0.5 + bass) * speed * 2; v.y += Math.sin(this.time + i * 0.01) * mid * speed; v.z += Math.sin(angle) * (15 - dist) * 0.01 * speed + Math.cos(angle) * (0.5 + bass) * speed * 2; break; }
                case 'spiral': { v.x += -Math.sin(angle) * (0.5 + bass) * speed * 2 + Math.cos(angle) * 0.02 * speed; v.y += Math.cos(this.time * 2 + i * 0.02) * speed * 0.5; v.z += Math.cos(angle) * (0.5 + bass) * speed * 2 + Math.sin(angle) * 0.02 * speed; break; }
                case 'helix': { const ha = angle + this.time * speed * 2; v.x = Math.cos(ha) * speed * (1 + bass); v.z = Math.sin(ha) * speed * (1 + bass); v.y += Math.sin(this.time * 3 + i * 0.05) * speed * 0.5; break; }
                case 'chaos': { v.x += (Math.random() - 0.5) * speed * bass * 3; v.y += (Math.random() - 0.5) * speed * mid * 3; v.z += (Math.random() - 0.5) * speed * bass * 3; break; }
                case 'vortex': { const vDist = 15 - dist; v.x += -Math.sin(angle) * speed * 3 * (1 + bass) + Math.cos(angle) * vDist * 0.005; v.z += Math.cos(angle) * speed * 3 * (1 + bass) + Math.sin(angle) * vDist * 0.005; v.y += Math.sin(this.time + i * 0.01) * mid * speed * 0.5; break; }
            }
            v.x *= 0.98; v.y *= 0.98; v.z *= 0.98;
            x += v.x; y += v.y; z += v.z;
            if (dist > 50 || !isFinite(x)) { const a2 = Math.random() * Math.PI * 2; x = Math.cos(a2) * 15; y = (Math.random() - 0.5) * 10; z = Math.sin(a2) * 15; v.x = 0; v.y = 0; v.z = 0; }
            this.flowPositions[i3] = x; this.flowPositions[i3 + 1] = y; this.flowPositions[i3 + 2] = z;
            const c = ParamSystem.getColorThreeHSL(dist / 30 + this.time * 0.05);
            let cr = c.r, cg = c.g, cb = c.b;
            if (audio.screechDetected) { const si = (audio.screechIntensity || 0) * 0.4; cr = cr * (1 - si) + 1.0 * si; cg = cg * (1 - si) + 0.95 * si; cb = cb * (1 - si) + 0.6 * si; }
            this.flowColors[i3] = cr; this.flowColors[i3 + 1] = cg; this.flowColors[i3 + 2] = cb;
        }
        this.flowSystem.geometry.attributes.position.needsUpdate = true;
        this.flowSystem.geometry.attributes.color.needsUpdate = true;
    },

    // ── TRAILS UPDATE (ring buffer) ──
    updateTrails(audio, params) {
        if (!this.trailLine || !this.attractorSystem) return;
        const x = this.attractorPositions[0], y = this.attractorPositions[1], z = this.attractorPositions[2];
        const h3 = this.trailHead * 3;
        this.trailBuffer[h3] = x; this.trailBuffer[h3 + 1] = y; this.trailBuffer[h3 + 2] = z;
        this.trailHead = (this.trailHead + 1) % this.trailMaxPoints;
        if (this.trailCount < this.trailMaxPoints) this.trailCount++;
        const pos = this.trailLine.geometry.attributes.position.array;
        for (let i = 0; i < this.trailCount; i++) {
            const si = ((this.trailHead - this.trailCount + i + this.trailMaxPoints) % this.trailMaxPoints) * 3;
            pos[i * 3] = this.trailBuffer[si]; pos[i * 3 + 1] = this.trailBuffer[si + 1]; pos[i * 3 + 2] = this.trailBuffer[si + 2];
        }
        this.trailLine.geometry.attributes.position.needsUpdate = true;
        this.trailLine.geometry.setDrawRange(0, this.trailCount);
        const tcm = params.trailColorMode || 'velocity';
        if (tcm === 'time') this.trailLine.material.color.setHSL((this.time * 0.1) % 1, 0.9, 0.5);
        else if (tcm === 'palette') this.trailLine.material.color.copy(ParamSystem.getColorThree(audio.rms + this.time * 0.05));
        else this.trailLine.material.color.setHex(0xff44aa);
    },

    // ── DESTROY ──
    destroy(scene) {
        if (this.group) { this.group.traverse(c => { if (c.material) c.material.dispose(); }); scene.remove(this.group); }
        if (this.outerGeo) { this.outerGeo.dispose(); this.outerGeo = null; }
        if (this.innerGeo) { this.innerGeo.dispose(); this.innerGeo = null; }
        this.mainMesh = null; this.mainWire = null; this.innerMesh = null; this.innerWire = null;
        this.attractorSystem = null; this.flowSystem = null; this.trailLine = null;
    }
};
