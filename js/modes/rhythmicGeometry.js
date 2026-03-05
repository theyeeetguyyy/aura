// ============================================================
// AURA Mode — RHYTHMIC GEOMETRY
// Pure geometry manipulation chaos.
// Beat-locked shape morphing, extreme vertex displacement,
// kaleidoscopic copies, fractal folding, geometry explosions.
// No particles, no rings, no satellites — ONLY geometry.
// ============================================================

const RhythmicGeometryMode = {
    name: 'Rhythmic Geometry',
    group: null,
    time: 0,

    // Core shape
    coreGroup: null,
    coreMesh: null,
    coreWire: null,
    corePoints: null,
    coreBasePos: null,
    coreNormals: null,
    currentShape: '',
    currentDetail: -1,

    // Morphing state
    morphing: false,
    morphTargetBase: null,
    morphProgress: 0,
    lastMorphShape: '',

    // Mirror copies
    mirrorCopies: [],

    // Effect phases
    explodePhase: 0,
    crumplePhase: 0,
    twistPhase: 0,
    invertPhase: 0,
    foldPhase: 0,
    shatterPhase: 0,
    colorShiftPhase: 0,

    // State
    sectionScale: 1,
    targetSectionScale: 1,
    _rotWrapCounter: 0,

    params: {
        // ── Core Shape ──
        coreShape: {
            type: 'select', options: [
                'icosahedron', 'dodecahedron', 'octahedron', 'tetrahedron',
                'torusKnot', 'torus', 'sphere', 'cube',
                'superformula', 'trefoilKnot', 'kleinBottle', 'gyroid',
                'mobiusStrip', 'romanSurface', 'boysSurface', 'crystal'
            ], default: 'icosahedron', label: '🔷 Core Shape'
        },
        coreDetail: { type: 'range', min: 1, max: 5, default: 3, step: 1, label: 'Detail' },
        coreSize: { type: 'range', min: 8, max: 40, default: 20, step: 1, label: 'Core Size' },

        // ── Displacement ──
        displaceMode: {
            type: 'select', options: [
                'beatPulse', 'fractal', 'vortex', 'magnetic', 'crystallize',
                'shatter', 'tentacle', 'interference', 'harmonics', 'voronoi',
                'gravitational', 'twist', 'melt', 'glitch', 'flow'
            ], default: 'beatPulse', label: '🌊 Displace Mode'
        },
        displaceAmount: { type: 'range', min: 0, max: 25, default: 10, step: 0.5, label: 'Displace Amt' },
        displaceFreq: { type: 'range', min: 0.5, max: 10, default: 3, step: 0.1, label: 'Displace Freq' },

        // ── Geometry Manipulation ──
        beatMorph: { type: 'toggle', default: true, label: '🔄 Beat Morph' },
        morphSpeed: { type: 'range', min: 0.5, max: 5, default: 2.5, step: 0.1, label: 'Morph Speed' },
        beatExplode: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '💥 Beat Explode' },
        symmetryMode: { type: 'select', options: ['off', 'x', 'y', 'z', 'xy', 'xyz'], default: 'off', label: '🔀 Symmetry' },

        // ── Mirror/Kaleidoscope ──
        mirrorCount: { type: 'range', min: 0, max: 8, default: 0, step: 1, label: '🪞 Mirror Copies' },
        mirrorSpacing: { type: 'range', min: 1, max: 3, default: 1.5, step: 0.1, label: 'Mirror Spread' },

        // ── Rotation ──
        rotMode: {
            type: 'select', options: [
                'smooth', 'beatLock', 'tumble', 'chaotic', 'orbit', 'wobble'
            ], default: 'smooth', label: '🔄 Rotation'
        },
        rotSpeed: { type: 'range', min: 0, max: 3, default: 0.6, step: 0.05, label: 'Rot Speed' },
        beatSpinBurst: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.05, label: '🔄 Beat Spin' },

        // ── Drop Reactions ──
        dropReaction: {
            type: 'select', options: [
                'morph', 'explode', 'shatter', 'invert', 'crumple', 'fold', 'all'
            ], default: 'all', label: '🔥 Drop React'
        },
        dropMorphTarget: {
            type: 'select', options: [
                'random', 'icosahedron', 'dodecahedron', 'octahedron', 'tetrahedron',
                'torusKnot', 'torus', 'sphere', 'cube', 'superformula', 'trefoilKnot',
                'kleinBottle', 'gyroid', 'mobiusStrip', 'romanSurface', 'boysSurface', 'crystal'
            ], default: 'random', label: '🎯 Drop Shape'
        },
        dropDisplaceOverride: {
            type: 'select', options: [
                'off', 'beatPulse', 'fractal', 'vortex', 'magnetic', 'crystallize',
                'shatter', 'tentacle', 'interference', 'harmonics', 'voronoi',
                'gravitational', 'twist', 'melt', 'glitch', 'flow'
            ], default: 'off', label: '🌊 Drop Displace'
        },
        dropColorOverride: {
            type: 'select', options: [
                'off', 'frequency', 'displacement', 'height', 'rainbow', 'velocity',
                'plasma', 'thermal', 'void', 'holographic'
            ], default: 'off', label: '🎨 Drop Color'
        },
        dropIntensityMult: { type: 'range', min: 0.5, max: 5, default: 1.5, step: 0.1, label: '⚡ Drop Power' },

        // ── Visuals ──
        colorMode: {
            type: 'select', options: [
                'frequency', 'displacement', 'height', 'rainbow', 'velocity',
                'plasma', 'thermal', 'void', 'holographic'
            ], default: 'frequency', label: '🎨 Color Mode'
        },
        wireOpacity: { type: 'range', min: 0, max: 1, default: 0.85, step: 0.05, label: 'Wire Opacity' },
        solidOpacity: { type: 'range', min: 0, max: 0.5, default: 0.15, step: 0.05, label: 'Solid Opacity' },
        showPoints: { type: 'toggle', default: true, label: '✨ Vertex Points' },
        pointSize: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.5, label: 'Point Size' },

        // ── Section Behavior ──
        sectionAware: { type: 'toggle', default: true, label: '📊 Section Aware' },
        dropExpansion: { type: 'range', min: 1, max: 3, default: 1.8, step: 0.1, label: '🔥 Drop Scale' },
        bassBreath: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '🔊 Bass Breath' }
    },

    // ── NOISE ──
    noise3D(x, y, z) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    },
    fbm(x, y, z, oct) {
        let v = 0, a = 1, f = 1, t = 0;
        for (let i = 0; i < oct; i++) { v += this.noise3D(x * f, y * f, z * f) * a; t += a; a *= 0.5; f *= 2.1; }
        return v / t;
    },

    // ── SUPERFORMULA ──
    superformula(angle, m, n1, n2, n3) {
        const t1 = Math.abs(Math.cos(m * angle / 4)), t2 = Math.abs(Math.sin(m * angle / 4));
        const r = Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1);
        return isFinite(r) ? r : 0;
    },

    // ── GEOMETRY FACTORY ──
    getCoreGeometry(shape, detail, size) {
        const d = Math.floor(detail), s = d + 2;
        switch (shape) {
            case 'dodecahedron': return new THREE.DodecahedronGeometry(size, d);
            case 'octahedron': return new THREE.OctahedronGeometry(size, d);
            case 'tetrahedron': return new THREE.TetrahedronGeometry(size, d);
            case 'torusKnot': return new THREE.TorusKnotGeometry(size * 0.6, size * 0.2, s * 16, s * 4);
            case 'torus': return new THREE.TorusGeometry(size, size * 0.35, s * 4, s * 8);
            case 'sphere': return new THREE.SphereGeometry(size, s * 8, s * 6);
            case 'cube': return new THREE.BoxGeometry(size * 1.4, size * 1.4, size * 1.4, s * 2, s * 2, s * 2);
            case 'superformula': return this._grid(s * 10, (u, v) => {
                const theta = u * Math.PI * 2 - Math.PI, phi = v * Math.PI - Math.PI / 2;
                const m = 6 + Math.sin(this.time * 0.3) * 2;
                const r1 = this.superformula(theta, m, 1, 1, 1), r2 = this.superformula(phi, m, 1, 1, 1);
                return [r1 * Math.cos(theta) * r2 * Math.cos(phi) * size, r1 * Math.sin(theta) * r2 * Math.cos(phi) * size, r2 * Math.sin(phi) * size];
            });
            case 'trefoilKnot': return this._grid(s * 10, (u, v) => {
                const t2 = u * Math.PI * 2, w2 = (v - 0.5) * size * 0.12, r2 = Math.cos(3 * t2) + 2;
                return [(r2 * Math.cos(2 * t2) + w2 * Math.cos(2 * t2) * Math.cos(3 * t2)) * size * 0.25,
                (r2 * Math.sin(2 * t2) + w2 * Math.sin(2 * t2) * Math.cos(3 * t2)) * size * 0.25,
                (Math.sin(3 * t2) + w2 * Math.sin(3 * t2)) * size * 0.25];
            });
            case 'kleinBottle': return this._grid(s * 10, (u, v) => {
                const a = u * Math.PI * 2, b = v * Math.PI * 2, sc = size * 0.15;
                let x, y;
                if (a < Math.PI) { x = (2.5 - 1.5 * Math.cos(a)) * sc * Math.cos(b) * 6; y = (2.5 - 1.5 * Math.cos(a)) * sc * Math.sin(b) * 6; }
                else { x = (-2 + (2 + Math.cos(b)) * Math.cos(a)) * sc * 6; y = (2 + Math.cos(b)) * Math.sin(a) * sc * 6; }
                return [x, y, -Math.sin(b) * (2.5 - 1.5 * Math.cos(a)) * sc * 3];
            });
            case 'gyroid': return this._grid(s * 10, (u, v) => {
                const a = (u - 0.5) * Math.PI * 2, b = (v - 0.5) * Math.PI * 2;
                const r = size * 0.4 * (Math.cos(a) * Math.sin(b) + Math.cos(b) * Math.sin(a) + Math.cos(a) * Math.cos(b)) * 0.3 + size * 0.5;
                return [Math.cos(a) * r * 0.5, Math.sin(b) * r * 0.5, (Math.sin(a) + Math.cos(b)) * size * 0.3];
            });
            case 'mobiusStrip': return this._grid(s * 10, (u, v) => {
                const a = u * Math.PI * 2, w = (v - 0.5) * size * 0.3;
                return [(size + w * Math.cos(a / 2)) * Math.cos(a), (size + w * Math.cos(a / 2)) * Math.sin(a), w * Math.sin(a / 2)];
            });
            case 'romanSurface': return this._grid(s * 10, (u, v) => {
                const a = u * Math.PI, b = v * Math.PI * 2, sc = size * 0.5;
                return [sc * Math.sin(2 * a) * Math.cos(b) ** 2, sc * Math.sin(a) * Math.sin(2 * b) / 2, sc * Math.cos(a) * Math.sin(2 * b) / 2];
            });
            case 'boysSurface': return this._grid(s * 10, (u, v) => {
                const a = u * Math.PI, b = v * Math.PI * 2, sc = size * 0.5;
                const sq2 = Math.SQRT2, ca = Math.cos(a);
                const denom = 2 - sq2 * Math.sin(3 * b) * Math.sin(2 * a) || 1;
                return [sc * (sq2 * ca * ca * Math.cos(2 * b) + ca * Math.sin(b)) / denom,
                sc * (sq2 * ca * ca * Math.sin(2 * b) - ca * Math.cos(b)) / denom,
                sc * 3 * ca * ca / denom];
            });
            case 'crystal': {
                const geo = new THREE.OctahedronGeometry(size, d);
                const p = geo.attributes.position.array;
                for (let i = 0; i < p.length; i += 3) p[i + 1] *= 1.8;
                geo.computeVertexNormals(); return geo;
            }
            default: return new THREE.IcosahedronGeometry(size, d);
        }
    },

    _grid(seg, fn) {
        const verts = [], indices = [];
        for (let i = 0; i <= seg; i++) for (let j = 0; j <= seg; j++) { const p = fn(i / seg, j / seg); verts.push(p[0], p[1], p[2]); }
        for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j; indices.push(a, a + 1, a + seg + 1, a + 1, a + seg + 2, a + seg + 1); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices); geo.computeVertexNormals(); return geo;
    },

    // ── INIT ──
    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 70);
        camera.lookAt(0, 0, 0);

        this.time = 0;
        this.colorShiftPhase = 0;
        this.sectionScale = 1;
        this.targetSectionScale = 1;
        this.morphing = false;
        this.morphTargetBase = null;
        this.explodePhase = 0;
        this.crumplePhase = 0;
        this.twistPhase = 0;
        this.invertPhase = 0;
        this.foldPhase = 0;
        this.shatterPhase = 0;
        this.mirrorCopies = [];
        this._rotWrapCounter = 0;
        this._prevPositions = null;

        this.coreGroup = new THREE.Group();
        this.group.add(this.coreGroup);

        this.buildCore('icosahedron', 3, 20);
    },

    buildCore(shape, detail, size) {
        if (this.coreMesh) { this.coreGroup.remove(this.coreMesh); this.coreMesh.geometry.dispose(); this.coreMesh.material.dispose(); }
        if (this.coreWire) { this.coreGroup.remove(this.coreWire); this.coreWire.geometry.dispose(); this.coreWire.material.dispose(); }
        if (this.corePoints) { this.coreGroup.remove(this.corePoints); this.corePoints.geometry.dispose(); this.corePoints.material.dispose(); }

        this.currentShape = shape;
        this.currentDetail = detail;

        const geo = this.getCoreGeometry(shape, detail, size);
        this.coreBasePos = new Float32Array(geo.attributes.position.array);
        geo.computeVertexNormals();
        this.coreNormals = new Float32Array(geo.attributes.normal.array);

        const vc = geo.attributes.position.count;
        const cols = new Float32Array(vc * 3).fill(1);
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));

        this.coreMesh = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.coreMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cols), 3));
        this.coreGroup.add(this.coreMesh);

        this.coreWire = new THREE.LineSegments(
            new THREE.WireframeGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })
        );
        this.coreGroup.add(this.coreWire);

        this.corePoints = new THREE.Points(geo.clone(), new THREE.PointsMaterial({
            size: 2, vertexColors: true, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        this.corePoints.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cols), 3));
        this.coreGroup.add(this.corePoints);

        geo.dispose();
    },

    // ── MORPH ──
    triggerMorph(targetShape) {
        const shapes = [
            'icosahedron', 'dodecahedron', 'octahedron', 'tetrahedron', 'torusKnot',
            'torus', 'sphere', 'cube', 'superformula', 'trefoilKnot', 'kleinBottle',
            'gyroid', 'mobiusStrip', 'romanSurface', 'boysSurface', 'crystal'
        ];
        let next;
        if (targetShape && targetShape !== 'random') {
            next = targetShape;
        } else {
            do { next = shapes[Math.floor(Math.random() * shapes.length)]; } while (next === this.currentShape);
        }
        const tGeo = this.getCoreGeometry(next, this.currentDetail, 20);
        this.morphTargetBase = new Float32Array(tGeo.attributes.position.array);
        tGeo.dispose();
        this.morphProgress = 0;
        this.morphing = true;
        this.lastMorphShape = next;
    },

    // ── MIRROR SYSTEM ──
    updateMirrors(count, spacing) {
        // Clean excess
        while (this.mirrorCopies.length > count) {
            const m = this.mirrorCopies.pop();
            this.group.remove(m);
            m.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        }
        // Add missing
        while (this.mirrorCopies.length < count) {
            const copy = new THREE.Group();
            const wireMat = new THREE.LineBasicMaterial({ color: 0x5cf6f6, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
            const wireCopy = new THREE.LineSegments(this.coreWire.geometry.clone(), wireMat);
            copy.add(wireCopy);
            this.group.add(copy);
            this.mirrorCopies.push(copy);
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
        const coreSize = params.coreSize || 20;

        // Rebuild shape
        const shape = params.coreShape || 'icosahedron';
        const detail = Math.floor(params.coreDetail || 3);
        if (shape !== this.currentShape || detail !== this.currentDetail) {
            this.buildCore(shape, detail, coreSize);
        }

        // ── SECTION AWARENESS ──
        if (params.sectionAware) {
            if (audio.isHighEnergy) this.targetSectionScale = params.dropExpansion || 1.8;
            else if (audio.isCalm) this.targetSectionScale = 0.6;
            else if (audio.isBuildingUp) this.targetSectionScale = 0.8 + (audio.sectionProgress || 0) * 0.8;
            else this.targetSectionScale = 1;
        } else {
            this.targetSectionScale = 1;
        }
        this.sectionScale += (this.targetSectionScale - this.sectionScale) * 0.05;

        // ── DROP REACTIONS ──
        const isDropping = audio.isDropSection || audio.isDrop;
        const dropLevel = (audio.dropSectionIntensity || 1) * (params.dropIntensityMult || 1.5);
        if (isDropping && audio.bassBeat) {
            const rx = params.dropReaction || 'all';
            if ((rx === 'morph' || rx === 'all') && params.beatMorph && !this.morphing) this.triggerMorph(params.dropMorphTarget || 'random');
            if (rx === 'explode' || rx === 'all') this.explodePhase = Math.min(this.explodePhase + 1.5 * dropLevel, 3);
            if (rx === 'shatter' || rx === 'all') this.shatterPhase = Math.min(1.5, dropLevel);
            if (rx === 'invert' || rx === 'all') this.invertPhase = Math.min(1.0, dropLevel);
            if (rx === 'crumple' || rx === 'all') this.crumplePhase = Math.min(1.5, dropLevel);
            if (rx === 'fold' || rx === 'all') this.foldPhase = Math.min(1.0, dropLevel);
        }

        // Drop displacement/color override flags
        const _dropDisplaceActive = (isDropping && params.dropDisplaceOverride && params.dropDisplaceOverride !== 'off') ? params.dropDisplaceOverride : null;
        const _dropColorActive = (isDropping && params.dropColorOverride && params.dropColorOverride !== 'off') ? params.dropColorOverride : null;

        // Beat morph (non-drop)
        if (params.beatMorph && audio.bassBeat && !this.morphing && !isDropping && Math.random() < 0.1) {
            this.triggerMorph(params.dropMorphTarget || 'random');
        }

        // Beat explode
        if (audio.bassBeat && params.beatExplode > 0) {
            this.explodePhase += audio.bassBeatIntensity * params.beatExplode * 0.15;
        }
        // Decay all effect phases
        this.explodePhase = Math.min(this.explodePhase, 3);
        this.explodePhase *= 0.90;
        this.crumplePhase *= 0.92;
        this.twistPhase *= 0.93;
        this.invertPhase *= 0.90;
        this.foldPhase *= 0.92;
        this.shatterPhase *= 0.90;

        // Color shift on beat
        if (audio.beat) this.colorShiftPhase += 0.06;

        // ── VERTEX DISPLACEMENT ──
        const dMode = _dropDisplaceActive || (params.displaceMode || 'beatPulse');
        const dAmt = (params.displaceAmount || 10) * react * this.sectionScale * (_dropDisplaceActive ? (params.dropIntensityMult || 1.5) : 1);
        const dFreq = params.displaceFreq || 3;
        const beatPulse = Math.sin(beatPhase * Math.PI * 2) * 0.5 + 0.5;
        const breathScale = 1 + (sub + bass) * (params.bassBreath || 2) * 0.2;
        const sym = params.symmetryMode || 'off';

        const pos = this.coreMesh.geometry.attributes.position.array;
        const col = this.coreMesh.geometry.attributes.color.array;
        const vertCount = this.coreBasePos.length / 3;
        const colorMode = _dropColorActive || (params.colorMode || 'frequency');

        for (let i = 0; i < vertCount; i++) {
            const i3 = i * 3;
            let bx = this.coreBasePos[i3], by = this.coreBasePos[i3 + 1], bz = this.coreBasePos[i3 + 2];

            // Morphing
            if (this.morphing && this.morphTargetBase) {
                const mi3 = i3 % this.morphTargetBase.length;
                const mt = Math.min(1, this.morphProgress);
                const sm = mt * mt * (3 - 2 * mt); // hermite smoothstep
                bx = bx * (1 - sm) + (this.morphTargetBase[mi3] || 0) * sm;
                by = by * (1 - sm) + (this.morphTargetBase[mi3 + 1] || 0) * sm;
                bz = bz * (1 - sm) + (this.morphTargetBase[mi3 + 2] || 0) * sm;
            }

            let nx = this.coreNormals[i3] || 0, ny = this.coreNormals[i3 + 1] || 0, nz = this.coreNormals[i3 + 2] || 0;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;

            const t = i / vertCount;
            const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;

            // Symmetry
            let sx = bx, sy = by, sz = bz;
            if (sym.includes('x')) sx = Math.abs(bx);
            if (sym.includes('y')) sy = Math.abs(by);
            if (sym.includes('z')) sz = Math.abs(bz);

            let disp = 0;
            switch (dMode) {
                case 'beatPulse':
                    disp = beatPulse * dAmt * (0.3 + bass * 2) + freq * dAmt * 0.2;
                    break;
                case 'fractal': {
                    const f1 = this.fbm(sx * 0.03 + this.time * 0.2, sy * 0.03, sz * 0.03, 4);
                    const f2 = this.fbm(sx * 0.06, sy * 0.06 + this.time * 0.3, sz * 0.06, 3);
                    disp = f1 * f2 * 4 * dAmt * (0.3 + bass * 2);
                    break;
                }
                case 'vortex': {
                    const a = Math.atan2(sz, sx) + this.time * dFreq * 0.5;
                    const r = Math.sqrt(sx * sx + sz * sz);
                    disp = Math.sin(a * 3 + r * 0.2) * dAmt * freq;
                    break;
                }
                case 'magnetic': {
                    disp = (Math.sin(sy * 0.3 + this.time) * nx + Math.cos(sx * 0.3 + this.time * 0.7) * nz) * dAmt * (0.5 + bass * 2);
                    break;
                }
                case 'crystallize': {
                    const cs = 5;
                    const fx = Math.round(sx / cs) * cs, fy = Math.round(sy / cs) * cs, fz = Math.round(sz / cs) * cs;
                    const facetDist = Math.sqrt((sx - fx) ** 2 + (sy - fy) ** 2 + (sz - fz) ** 2);
                    disp = facetDist * dAmt * 0.3 * (1 + bass * 3 + audio.bassBeatIntensity * 4);
                    bx = bx * 0.7 + fx * 0.3;
                    by = by * 0.7 + fy * 0.3;
                    bz = bz * 0.7 + fz * 0.3;
                    break;
                }
                case 'shatter':
                    disp = this.noise3D(sx + this.time * 2, sy + this.time, sz) * dAmt * (0.2 + freq * 2 + audio.bassBeatIntensity * 5);
                    break;
                case 'tentacle': {
                    const phi = Math.atan2(sz, sx);
                    let tentForce = 0;
                    for (let ti = 0; ti < 6; ti++) {
                        const ta = (ti / 6) * Math.PI * 2 + this.time * 0.3;
                        const diff = Math.abs(((phi - ta + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                        tentForce += Math.max(0, 1 - diff * 1.5) * (0.5 + bass * 2);
                    }
                    disp = tentForce * dAmt * 0.4 * (sy / coreSize + 1) * freq;
                    break;
                }
                case 'interference': {
                    const w1 = Math.sin(sx * 0.3 + this.time * 2) * Math.sin(sy * 0.35 - this.time * 1.5);
                    const w2 = Math.sin(sz * 0.25 + this.time * 1.8) * Math.cos(sx * 0.2 + this.time);
                    const w3 = Math.cos(sy * 0.4 + this.time * 2.5) * Math.sin(sz * 0.3 - this.time * 0.7);
                    disp = (w1 + w2 + w3) * dAmt * 0.4 * (0.3 + freq * 1.5 + bass);
                    break;
                }
                case 'harmonics': {
                    let h = 0;
                    for (let n = 1; n <= 5; n++) {
                        const bv = (audio.frequencyData[Math.floor(n * 25)] || 0) / 255;
                        h += bv * Math.sin(n * beatPhase * Math.PI * 2 + t * n * 3);
                    }
                    disp = h * dAmt * 0.4;
                    break;
                }
                case 'voronoi': {
                    let minD = 999, minD2 = 999;
                    for (let ci = 0; ci < 6; ci++) {
                        const cx = Math.sin(ci * 1.618 + this.time * 0.4) * coreSize * 0.6;
                        const cy = Math.cos(ci * 2.618 + this.time * 0.3) * coreSize * 0.6;
                        const cz = Math.sin(ci * 0.618 + this.time * 0.5) * coreSize * 0.6;
                        const dd = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2 + (sz - cz) ** 2);
                        if (dd < minD) { minD2 = minD; minD = dd; } else if (dd < minD2) { minD2 = dd; }
                    }
                    disp = (minD2 - minD) * dAmt * 0.15 * (0.5 + bass * 2);
                    break;
                }
                case 'gravitational': {
                    let totalForce = 0;
                    for (let wi = 0; wi < 3; wi++) {
                        const wa = (wi / 3) * Math.PI * 2 + this.time * 0.3;
                        const wx = Math.cos(wa) * coreSize * 0.5, wz = Math.sin(wa) * coreSize * 0.5;
                        const dx = sx - wx, dz = sz - wz;
                        const d2 = Math.sqrt(dx * dx + sy * sy + dz * dz) + 0.5;
                        totalForce += bass * 20 / (d2 * d2 + 1);
                    }
                    disp = totalForce * dAmt * 0.15;
                    break;
                }
                case 'twist': {
                    const a = sy * dFreq * 0.1 + this.time * 2;
                    const tw = (bass + mid) * dAmt * 0.1 * react;
                    bx += Math.cos(a) * tw;
                    bz += Math.sin(a) * tw;
                    break;
                }
                case 'melt': {
                    const mf = (sub + bass) * dAmt * 0.3 * react;
                    by -= Math.max(0, (1 - (by / coreSize + 0.5)) * mf);
                    disp = this.fbm(sx * 0.1, sy * 0.1, this.time, 2) * mf * 0.3;
                    break;
                }
                case 'glitch': {
                    if (Math.random() < (audio.beat ? 0.3 : 0.02)) disp = (Math.random() - 0.5) * dAmt * 4;
                    break;
                }
                case 'flow': {
                    const curl_x = this.fbm(sy * 0.08, sz * 0.08 + this.time * 0.5, sx * 0.08, 3);
                    const curl_y = this.fbm(sz * 0.08 + this.time * 0.3, sx * 0.08, sy * 0.08, 3);
                    const curl_z = this.fbm(sx * 0.08 + this.time * 0.4, sy * 0.08, sz * 0.08, 3);
                    bx += curl_x * dAmt * 0.15 * (0.5 + mid * 2);
                    by += curl_y * dAmt * 0.15 * (0.5 + mid * 2);
                    bz += curl_z * dAmt * 0.15 * (0.5 + mid * 2);
                    disp = freq * dAmt * 0.3;
                    break;
                }
            }

            // === GEOMETRY EFFECT PHASES ===
            // Explode
            if (this.explodePhase > 0.01) disp += this.explodePhase * 3;

            // Shatter: chaotic per-vertex jitter
            if (this.shatterPhase > 0.01) {
                const sh = this.shatterPhase;
                bx += this.noise3D(bx + this.time * 10, by, bz) * sh * coreSize * 0.6;
                by += this.noise3D(by, bz + this.time * 10, bx) * sh * coreSize * 0.6;
                bz += this.noise3D(bz, bx, by + this.time * 10) * sh * coreSize * 0.6;
            }

            // Invert: displacement direction flips
            if (this.invertPhase > 0.05) disp *= (1 - this.invertPhase * 2);

            // Crumple: vertices collapse toward center
            if (this.crumplePhase > 0.01) {
                const cp = this.crumplePhase;
                bx *= 1 - cp * 0.6;
                by *= 1 - cp * 0.6;
                bz *= 1 - cp * 0.6;
                disp += this.noise3D(bx * 3, by * 3, bz * 3 + this.time) * cp * coreSize * 0.3;
            }

            // Fold: vertex mirroring along axes
            if (this.foldPhase > 0.01) {
                const fp = this.foldPhase;
                bx = bx * (1 - fp) + Math.abs(bx) * fp * Math.sign(Math.sin(this.time * 3));
                by = by * (1 - fp) + Math.abs(by) * fp * Math.sign(Math.cos(this.time * 2.3));
            }

            const scale = breathScale * this.sectionScale;
            pos[i3] = (bx + nx * disp) * scale;
            pos[i3 + 1] = (by + ny * disp) * scale;
            pos[i3 + 2] = (bz + nz * disp) * scale;

            // ── VERTEX COLORS ──
            let cr = 1, cg = 1, cb = 1;
            switch (colorMode) {
                case 'frequency': {
                    const c = ParamSystem.getColorThreeHSL(freq + t * 0.2 + this.colorShiftPhase);
                    cr = c.r; cg = c.g; cb = c.b; break;
                }
                case 'displacement': {
                    const dn = Math.min(1, Math.abs(disp) / (dAmt + 0.01));
                    const c = ParamSystem.getColorThreeHSL(dn + this.colorShiftPhase);
                    cr = c.r; cg = c.g; cb = c.b; break;
                }
                case 'height': {
                    const h = (pos[i3 + 1] / (coreSize * 2) + 0.5);
                    const c = ParamSystem.getColorThreeHSL(h + this.colorShiftPhase);
                    cr = c.r; cg = c.g; cb = c.b; break;
                }
                case 'rainbow': {
                    const hue = (t + this.time * 0.1 + this.colorShiftPhase) % 1;
                    cr = Math.sin(hue * 6.28) * 0.5 + 0.5;
                    cg = Math.sin(hue * 6.28 + 2.09) * 0.5 + 0.5;
                    cb = Math.sin(hue * 6.28 + 4.19) * 0.5 + 0.5;
                    break;
                }
                case 'velocity': {
                    if (this._prevPositions) {
                        const dx = pos[i3] - this._prevPositions[i3];
                        const dy = pos[i3 + 1] - this._prevPositions[i3 + 1];
                        const dz = pos[i3 + 2] - this._prevPositions[i3 + 2];
                        const vel = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        const c = ParamSystem.getColorThreeHSL(Math.min(1, vel * 2));
                        cr = c.r; cg = c.g; cb = c.b;
                    }
                    break;
                }
                case 'plasma': {
                    cr = Math.sin(t * 10 + this.time) * 0.5 + 0.5;
                    cg = Math.sin(t * 10 + this.time * 1.3 + 2.1) * 0.5 + 0.5;
                    cb = Math.sin(t * 10 + this.time * 0.7 + 4.2) * 0.5 + 0.5;
                    break;
                }
                case 'thermal': {
                    const th = freq * 0.6 + rms * 0.4;
                    cr = Math.min(1, th * 2); cg = th * 0.6; cb = th * 0.1;
                    break;
                }
                case 'void': {
                    const edge = Math.abs(disp) / (dAmt + 0.01);
                    cr = edge * 0.3; cg = edge * 0.1; cb = edge * 0.5 + 0.05;
                    break;
                }
                case 'holographic': {
                    const angle = Math.atan2(pos[i3 + 2], pos[i3]) / Math.PI;
                    const hue2 = (angle + t + this.time * 0.05 + this.colorShiftPhase) % 1;
                    cr = Math.sin(hue2 * 6.28) * 0.4 + 0.5;
                    cg = Math.sin(hue2 * 6.28 + 2.09) * 0.4 + 0.5;
                    cb = Math.sin(hue2 * 6.28 + 4.19) * 0.4 + 0.5;
                    break;
                }
            }
            col[i3] = cr; col[i3 + 1] = cg; col[i3 + 2] = cb;
        }

        // Store for velocity color
        if (!this._prevPositions || this._prevPositions.length !== pos.length) {
            this._prevPositions = new Float32Array(pos.length);
        }
        this._prevPositions.set(pos);

        // Morph progress
        if (this.morphing) {
            this.morphProgress += dt * (params.morphSpeed || 2.5);
            if (this.morphProgress >= 1) {
                this.morphing = false;
                this.basePositions = new Float32Array(this.morphTargetBase);
                this.coreBasePos = new Float32Array(this.morphTargetBase);
                this.morphTargetBase = null;
                const geo = this.coreMesh.geometry;
                geo.attributes.position.array.set(this.coreBasePos);
                geo.attributes.position.needsUpdate = true;
                geo.computeVertexNormals();
                this.coreNormals = new Float32Array(geo.attributes.normal.array);
            }
        }

        // Update GPU buffers
        this.coreMesh.geometry.attributes.position.needsUpdate = true;
        this.coreMesh.geometry.attributes.color.needsUpdate = true;

        // Sync wireframe
        if (this.coreWire) {
            const wg = new THREE.WireframeGeometry(this.coreMesh.geometry);
            this.coreWire.geometry.dispose();
            this.coreWire.geometry = wg;
        }

        // Sync points
        if (this.corePoints) {
            this.corePoints.geometry.attributes.position.array.set(pos);
            this.corePoints.geometry.attributes.position.needsUpdate = true;
            this.corePoints.geometry.attributes.color.array.set(col);
            this.corePoints.geometry.attributes.color.needsUpdate = true;
            this.corePoints.visible = params.showPoints;
            this.corePoints.material.size = (params.pointSize || 2) * (1 + bass * 2);
        }

        // Materials
        this.coreMesh.material.opacity = (params.solidOpacity || 0.15) * (0.5 + bass * 0.5);
        this.coreWire.material.color = ParamSystem.getColorThree(rms + this.time * 0.1 + this.colorShiftPhase);
        this.coreWire.material.opacity = (params.wireOpacity || 0.85) * (0.5 + rms * 0.5 + beatPulse * 0.2);

        // ── ROTATION ──
        const rotMode = params.rotMode || 'smooth';
        const rotSpeed = (params.rotSpeed || 0.6) * (1 + mid * react * 0.3);
        switch (rotMode) {
            case 'smooth':
                this.coreGroup.rotation.x += rotSpeed * 0.3 * dt;
                this.coreGroup.rotation.y += rotSpeed * dt;
                this.coreGroup.rotation.z += rotSpeed * 0.1 * dt;
                break;
            case 'beatLock': {
                const targetY = Math.floor(beatPhase * 4) * Math.PI / 2;
                this.coreGroup.rotation.y += (targetY - this.coreGroup.rotation.y) * 0.12;
                this.coreGroup.rotation.x += rotSpeed * dt * 0.3;
                this.coreGroup.rotation.z = Math.sin(this.time * 0.3) * 0.15;
                break;
            }
            case 'tumble':
                this.coreGroup.rotation.x += rotSpeed * dt + Math.sin(this.time * 1.5) * 0.01;
                this.coreGroup.rotation.y += rotSpeed * dt + Math.cos(this.time * 1.2) * 0.01;
                this.coreGroup.rotation.z += rotSpeed * 0.5 * dt + Math.sin(this.time * 0.8) * 0.02;
                break;
            case 'chaotic': {
                const lx = Math.sin(this.time * 0.7) * Math.cos(this.time * 0.3);
                const ly = Math.cos(this.time * 0.5) * Math.sin(this.time * 0.4);
                const lz = Math.sin(this.time * 0.6) * Math.cos(this.time * 0.8);
                this.coreGroup.rotation.x += (lx * rotSpeed + bass * 0.1) * dt;
                this.coreGroup.rotation.y += (ly * rotSpeed + mid * 0.1) * dt;
                this.coreGroup.rotation.z += (lz * rotSpeed * 0.5 + treble * 0.05) * dt;
                break;
            }
            case 'orbit':
                this.coreGroup.rotation.y += rotSpeed * dt;
                this.coreGroup.rotation.x = Math.sin(this.time * 0.5) * 0.3;
                this.coreGroup.rotation.z = Math.cos(this.time * 0.3) * 0.2;
                break;
            case 'wobble':
                this.coreGroup.rotation.x = Math.sin(this.time * rotSpeed) * 0.5;
                this.coreGroup.rotation.y += rotSpeed * dt;
                this.coreGroup.rotation.z = Math.cos(this.time * rotSpeed * 0.5) * 0.3;
                break;
        }

        // Beat spin burst
        if (audio.bassBeat && params.beatSpinBurst > 0) {
            this.coreGroup.rotation.y += Math.min(0.08, audio.bassBeatIntensity * 0.1 * params.beatSpinBurst);
        }

        // Wrap rotations
        this._rotWrapCounter++;
        if (this._rotWrapCounter > 600) {
            this._rotWrapCounter = 0;
            const TWO_PI = Math.PI * 2;
            this.coreGroup.rotation.x %= TWO_PI;
            this.coreGroup.rotation.y %= TWO_PI;
            this.coreGroup.rotation.z %= TWO_PI;
        }

        // ── MIRROR COPIES ──
        const mirrorCount = Math.floor(params.mirrorCount || 0);
        const mirrorSpacing = params.mirrorSpacing || 1.5;
        this.updateMirrors(mirrorCount, mirrorSpacing);

        for (let i = 0; i < this.mirrorCopies.length; i++) {
            const copy = this.mirrorCopies[i];
            const angle = ((i + 1) / (mirrorCount + 1)) * Math.PI * 2;
            copy.rotation.y = angle;
            copy.scale.setScalar(mirrorSpacing * 0.8);
            copy.position.x = Math.cos(angle) * coreSize * mirrorSpacing * 0.3;
            copy.position.z = Math.sin(angle) * coreSize * mirrorSpacing * 0.3;

            // Update mirror wireframe geometry
            const wireChild = copy.children[0];
            if (wireChild && this.coreWire) {
                wireChild.geometry.dispose();
                wireChild.geometry = this.coreWire.geometry.clone();
                wireChild.material.opacity = 0.2 + bass * 0.15;
                wireChild.material.color = ParamSystem.getColorThree(rms + this.time * 0.1 + i * 0.15);
            }
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
        this.corePoints = null;
        this.mirrorCopies = [];
    }
};
