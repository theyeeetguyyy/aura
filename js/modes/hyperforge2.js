// ============================================================
// AURA Mode — HYPERFORGE 4.0
// FIXED: wireframe no longer rebuilt every frame (was killing FPS).
// Shared geometry approach — position updates auto-propagate.
// Reorganized params with clear sections. Full sectionEffects
// integration from marker system.
// ============================================================

const HyperforgeMode2 = {
    name: 'Hyperforge web',
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

    // ── PARAMS ──
    params: {
        // ═══ OUTER SURFACE ═══
        outerSurface: {
            type: 'select', options: [
                'superformula', 'lorenzSurface', 'kleinBottle', 'catenoid', 'helicoid',
                'diniSurface', 'enneperSurface', 'crossCap', 'torusKnot', 'icosahedron', 'sphere',
                'boysSurface', 'romanSurface', 'seiferSurface', 'steinerian', 'trefoilKnot', 'algebraicHorn'
            ], default: 'superformula', label: '🔮 Outer Surface Shape'
        },
        outerDetail: { type: 'range', min: 10, max: 80, default: 40, step: 5, label: 'Outer Surface Resolution' },
        outerSize:   { type: 'range', min: 5, max: 50, default: 22, step: 1, label: 'Outer Surface Size' },

        // Superformula controls (visible when outerSurface = superformula)
        sfM:         { type: 'range', min: 1, max: 20, default: 6, step: 0.5, label: 'SF: m (rotational symmetry)' },
        sfN1:        { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: 'SF: n1 (overall shape)' },
        sfN2:        { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: 'SF: n2 (horizontal)' },
        sfN3:        { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: 'SF: n3 (vertical)' },
        sfAudioMap:  { type: 'toggle', default: true, label: '🎵 Audio Drives SF Shape' },

        // ═══ OUTER APPEARANCE ═══
        solidOpacity:    { type: 'range', min: 0, max: 0.8, default: 0.2,  step: 0.05, label: 'Solid Face Opacity' },
        wireOpacity:     { type: 'range', min: 0, max: 1,   default: 0.7,  step: 0.05, label: 'Wireframe Opacity' },
        colorMode: {
            type: 'select', options: [
                'reactionDiffusion', 'curvature', 'audioFreq', 'height', 'velocity',
                'rainbow', 'fire', 'ice', 'plasma', 'thermal', 'void', 'holographic'
            ], default: 'reactionDiffusion', label: '🎨 Outer Color Mode'
        },

        // ═══ INNER SURFACE ═══
        showInner:       { type: 'toggle', default: true, label: '🔵 Show Inner Surface' },
        innerSurface: {
            type: 'select', options: ['sphere', 'torusKnot', 'icosahedron', 'superformula', 'none'],
            default: 'icosahedron', label: 'Inner Surface Shape'
        },
        innerScale:      { type: 'range', min: 0.1, max: 0.9, default: 0.4, step: 0.05, label: 'Inner Surface Scale' },
        innerSolidOpacity: { type: 'range', min: 0, max: 0.6, default: 0.1, step: 0.05, label: 'Inner Solid Opacity' },
        innerWireOpacity:  { type: 'range', min: 0, max: 1,   default: 0.5, step: 0.05, label: 'Inner Wire Opacity' },
        dualWireColors:  { type: 'toggle', default: false, label: 'Dual Wire Color Mode' },

        // ═══ DISPLACEMENT ═══
        displaceMode: {
            type: 'select', options: [
                'fourier', 'forceField', 'vortex', 'magnetic', 'superposition', 'turbulence',
                'audioSculpt', 'reaction', 'gravitationalWell', 'stringTheory', 'fluidSim'
            ], default: 'fourier', label: '🌊 Displacement Mode'
        },
        displaceAmt:     { type: 'range', min: 0, max: 30, default: 8,   step: 0.5, label: 'Displacement Amount' },
        displaceSpeed:   { type: 'range', min: 0.1, max: 5, default: 1.5, step: 0.1, label: 'Displacement Speed' },
        symmetryAxis:    { type: 'select', options: ['off', 'x', 'y', 'z', 'xy', 'xz', 'yz', 'xyz'], default: 'off', label: '🔀 Symmetry Axis' },
        gravWellCount:   { type: 'range', min: 1, max: 5, default: 2, step: 1, label: '🕳️ Gravity Well Count' },

        // ═══ STRANGE ATTRACTOR ═══
        attractorType: {
            type: 'select', options: ['lorenz', 'rossler', 'aizawa', 'thomas', 'halvorsen', 'chen', 'dadras', 'sprott', 'none'],
            default: 'lorenz', label: '🌀 Attractor Type'
        },
        secondAttractor: {
            type: 'select', options: ['none', 'lorenz', 'rossler', 'aizawa', 'thomas', 'halvorsen', 'chen', 'dadras', 'sprott'],
            default: 'none', label: '🔗 Secondary Attractor'
        },
        attractorBlend:   { type: 'range', min: 0, max: 1, default: 0.5, step: 0.05, label: 'Attractor Blend Amount' },
        attractorCount:   { type: 'range', min: 500, max: 10000, default: 4000, step: 500, label: 'Attractor Point Count' },
        attractorSpeed:   { type: 'range', min: 0.1, max: 5, default: 1,   step: 0.1, label: 'Attractor Speed' },
        attractorScale:   { type: 'range', min: 0.2, max: 3, default: 1,   step: 0.1, label: 'Attractor Scale' },
        attractorAudioLink: {
            type: 'select', options: ['bass', 'mid', 'treble', 'rms', 'sub'],
            default: 'bass', label: '🔊 Attractor Audio Link Band'
        },
        particleJitter:   { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: 'Particle Jitter Amount' },
        pointGlow:        { type: 'range', min: 0.5, max: 6, default: 2.5, step: 0.5, label: '✨ Attractor Point Glow Size' },
        showTrails:       { type: 'toggle', default: true, label: '📈 Show Trails' },
        trailColorMode: {
            type: 'select', options: ['velocity', 'time', 'distance', 'palette'],
            default: 'velocity', label: 'Trail Color Mode'
        },

        // ═══ FLOW PARTICLES ═══
        flowEnabled:   { type: 'toggle', default: true, label: '💫 Flow Particles' },
        flowCount:     { type: 'range', min: 500, max: 8000, default: 3000, step: 500, label: 'Flow Particle Count' },
        flowSpeed:     { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: 'Flow Speed' },
        flowPattern: {
            type: 'select', options: ['orbit', 'spiral', 'helix', 'chaos', 'vortex'],
            default: 'orbit', label: '🌀 Flow Pattern'
        },

        // ═══ ANIMATION ═══
        rotSpeed:    { type: 'range', min: 0, max: 3, default: 0.4, step: 0.05, label: 'Rotation Speed' },
        bassBreath:  { type: 'range', min: 0, max: 5, default: 2.5, step: 0.1, label: '🔊 Bass Scale Breathing' },
        beatExplode: { type: 'range', min: 0, max: 5, default: 2,   step: 0.1, label: '💥 Beat Explode Force' },
        beatExplosionStyle: {
            type: 'select', options: ['radial', 'shatter', 'invert', 'twist'],
            default: 'radial', label: '💥 Explode Style'
        },

        // ═══ DROP / MORPH ═══
        morphEnabled:   { type: 'toggle', default: true, label: '🔄 Drop Triggers Morph' },
        morphSpeed:     { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: 'Morph Speed' },
        dropReaction: {
            type: 'select', options: ['shapeShift', 'colorStorm', 'particleBurst', 'invert', 'all'],
            default: 'all', label: '🔥 Drop Reaction Type'
        },
        dropMorphTarget: {
            type: 'select', options: [
                'random', 'superformula', 'lorenzSurface', 'kleinBottle', 'catenoid', 'helicoid',
                'diniSurface', 'enneperSurface', 'crossCap', 'boysSurface', 'trefoilKnot', 'algebraicHorn'
            ], default: 'random', label: '🎯 Drop Morph Target Shape'
        },
        dropDisplaceOverride: {
            type: 'select', options: [
                'off', 'fourier', 'forceField', 'vortex', 'magnetic', 'superposition',
                'turbulence', 'audioSculpt', 'reaction', 'gravitationalWell', 'stringTheory', 'fluidSim'
            ], default: 'off', label: '🌊 Drop Displacement Override'
        },
        dropColorOverride: {
            type: 'select', options: [
                'off', 'reactionDiffusion', 'curvature', 'audioFreq', 'rainbow',
                'fire', 'plasma', 'thermal', 'void', 'holographic'
            ], default: 'off', label: '🎨 Drop Color Override'
        },
        dropIntensityMult: { type: 'range', min: 0.5, max: 5, default: 1.5, step: 0.1, label: '⚡ Drop Intensity Multiplier' },
    },

    // ── NOISE ──
    noise3D(x, y, z) { const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return (n - Math.floor(n)) * 2 - 1; },
    fbm(x, y, z, oct) { let v = 0, a = 1, f = 1, t = 0; for (let i = 0; i < oct; i++) { v += this.noise3D(x * f, y * f, z * f) * a; t += a; a *= 0.5; f *= 2.1; } return v / t; },

    // ── SUPERFORMULA ──
    superformula(angle, m, n1, n2, n3) {
        const t1 = Math.abs(Math.cos(m * angle / 4)), t2 = Math.abs(Math.sin(m * angle / 4));
        const r = Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1);
        return isFinite(r) ? r : 0;
    },

    // ── SURFACE GRID HELPER ──
    _grid(seg, fn) {
        const verts = [], indices = [];
        for (let i = 0; i <= seg; i++) for (let j = 0; j <= seg; j++) { const p = fn(i / seg, j / seg); verts.push(p[0], p[1], p[2]); }
        for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j; indices.push(a, a + 1, a + seg + 1, a + 1, a + seg + 2, a + seg + 1); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices); geo.computeVertexNormals(); return geo;
    },

    // ── OUTER SURFACE GENERATORS ──
    getOuterGeo(shape, seg, size, m, n1, n2, n3) {
        switch (shape) {
            case 'superformula': return this._grid(seg, (u, v) => {
                const theta = u * Math.PI * 2 - Math.PI, phi = v * Math.PI - Math.PI / 2;
                const r1 = this.superformula(theta, m, n1, n2, n3), r2 = this.superformula(phi, m, n1, n2, n3);
                return [r1 * Math.cos(theta) * r2 * Math.cos(phi) * size, r1 * Math.sin(theta) * r2 * Math.cos(phi) * size, r2 * Math.sin(phi) * size];
            });
            case 'lorenzSurface': {
                const verts = [], indices = []; let x = 0.1, y = 0, z = 0; const dt2 = 0.005, pts = [];
                for (let i = 0; i < seg * 4; i++) { const dx = 10 * (y - x) * dt2, dy = (x * (28 - z) - y) * dt2, dz = (x * y - 2.666 * z) * dt2; x += dx; y += dy; z += dz; pts.push([x, y, z]); }
                const s = size * 0.4;
                for (let i = 0; i < pts.length; i++) { const p = pts[i]; for (let j = 0; j <= 6; j++) { const a = (j / 6) * Math.PI * 2, r = 0.5 + Math.sin(i * 0.05) * 0.3; verts.push(p[0] * s + Math.cos(a) * r, p[2] * s * 0.3 + Math.sin(a) * r, p[1] * s); } }
                for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 6; j++) { const a = i * 7 + j; indices.push(a, a + 1, a + 7, a + 1, a + 8, a + 7); }
                const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
            }
            case 'kleinBottle': return this._grid(seg, (u, v) => {
                const a = u * Math.PI * 2, b = v * Math.PI * 2, s2 = size * 0.15;
                let x2, y2;
                if (a < Math.PI) { x2 = (2.5 - 1.5 * Math.cos(a)) * s2 * Math.cos(b) * 6; y2 = (2.5 - 1.5 * Math.cos(a)) * s2 * Math.sin(b) * 6; }
                else { x2 = (-2 + (2 + Math.cos(b)) * Math.cos(a)) * s2 * 6; y2 = (2 + Math.cos(b)) * Math.sin(a) * s2 * 6; }
                return [x2, y2, -Math.sin(b) * (2.5 - 1.5 * Math.cos(a)) * s2 * 3];
            });
            case 'catenoid':     return this._grid(seg, (u, v) => { const a = (u - 0.5) * 4, b = v * Math.PI * 2, s2 = size * 0.6; return [s2 * Math.cosh(a) * Math.cos(b), s2 * a * 2, s2 * Math.cosh(a) * Math.sin(b)]; });
            case 'helicoid':     return this._grid(seg, (u, v) => { const a = (u - 0.5) * size * 2, b = v * Math.PI * 4; return [a * Math.cos(b), b * size * 0.15, a * Math.sin(b)]; });
            case 'diniSurface':  return this._grid(seg, (u, v) => { const a2 = u * Math.PI * 4, b2 = v * 2 + 0.01, s2 = size * 0.5; return [s2 * Math.cos(a2) * Math.sin(b2), s2 * (Math.cos(b2) + Math.log(Math.tan(b2 / 2)) + 0.2 * a2 * 0.1), s2 * Math.sin(a2) * Math.sin(b2)]; });
            case 'enneperSurface': return this._grid(seg, (u, v) => { const a2 = (u - 0.5) * 3, b2 = (v - 0.5) * 3, s2 = size * 0.3; return [s2 * (a2 - a2 ** 3 / 3 + a2 * b2 * b2), s2 * (b2 - b2 ** 3 / 3 + a2 * a2 * b2), s2 * (a2 * a2 - b2 * b2)]; });
            case 'crossCap':     return this._grid(seg, (u, v) => { const a2 = u * Math.PI, b2 = v * Math.PI * 2; return [size * Math.cos(a2) * Math.sin(2 * b2) * 0.5, size * Math.sin(a2) * Math.sin(2 * b2) * 0.5, size * (Math.cos(b2) ** 2 - Math.cos(a2) ** 2 * Math.sin(b2) ** 2) * 0.5]; });
            case 'boysSurface':  return this._grid(seg, (u, v) => {
                const a2 = u * Math.PI, b2 = v * Math.PI * 2, s2 = size * 0.5;
                const sq2 = Math.SQRT2, ca = Math.cos(a2), sa = Math.sin(a2);
                const denom = 2 - sq2 * Math.sin(3 * b2) * Math.sin(2 * a2) || 1;
                return [s2 * (sq2 * ca * ca * Math.cos(2 * b2) + ca * Math.sin(b2)) / denom, s2 * (sq2 * ca * ca * Math.sin(2 * b2) - ca * Math.cos(b2)) / denom, s2 * 3 * ca * ca / (2 - sq2 * Math.sin(3 * b2) * Math.sin(2 * a2) || 1)];
            });
            case 'romanSurface': return this._grid(seg, (u, v) => { const a2 = u * Math.PI, b2 = v * Math.PI * 2, s2 = size * 0.5; return [s2 * Math.sin(2 * a2) * Math.cos(b2) ** 2, s2 * Math.sin(a2) * Math.sin(2 * b2) / 2, s2 * Math.cos(a2) * Math.sin(2 * b2) / 2]; });
            case 'seiferSurface': return this._grid(seg, (u, v) => { const a2 = (u - 0.5) * 4, b2 = v * Math.PI * 2, s2 = size * 0.3; const r2 = 1 + a2 * a2 * 0.1; return [s2 * r2 * Math.cos(b2), s2 * r2 * Math.sin(b2), s2 * a2 * 3 + s2 * Math.sin(b2 * 2) * a2 * 0.5]; });
            case 'steinerian':   return this._grid(seg, (u, v) => { const a2 = (u - 0.5) * 2, b2 = (v - 0.5) * 2, s2 = size * 0.8; return [s2 * a2 * b2, s2 * a2 * (1 - b2 * b2), s2 * b2 * (1 - a2 * a2)]; });
            case 'trefoilKnot':  return this._grid(seg, (u, v) => { const t2 = u * Math.PI * 2, w2 = (v - 0.5) * size * 0.12, r2 = Math.cos(3 * t2) + 2; return [(r2 * Math.cos(2 * t2) + w2 * Math.cos(2 * t2) * Math.cos(3 * t2)) * size * 0.25, (r2 * Math.sin(2 * t2) + w2 * Math.sin(2 * t2) * Math.cos(3 * t2)) * size * 0.25, (Math.sin(3 * t2) + w2 * Math.sin(3 * t2)) * size * 0.25]; });
            case 'algebraicHorn': return this._grid(seg, (u, v) => { const a2 = u * Math.PI * 2, b2 = v * Math.PI * 2, s2 = size * 0.3; return [s2 * (2 + Math.cos(b2)) * Math.cos(a2) * (1 + u * 0.5), s2 * (2 + Math.cos(b2)) * Math.sin(a2) * (1 + u * 0.5), s2 * (Math.sin(b2) + u * 4)]; });
            case 'torusKnot':    return new THREE.TorusKnotGeometry(size * 0.7, size * 0.2, seg * 4, seg);
            case 'icosahedron':  return new THREE.IcosahedronGeometry(size, 3);
            case 'sphere':       return new THREE.SphereGeometry(size, seg, seg);
            default: return this._grid(seg, (u, v) => {
                const theta = u * Math.PI * 2 - Math.PI, phi = v * Math.PI - Math.PI / 2;
                const r1 = this.superformula(theta, m, n1, n2, n3), r2 = this.superformula(phi, m, n1, n2, n3);
                return [r1 * Math.cos(theta) * r2 * Math.cos(phi) * size, r1 * Math.sin(theta) * r2 * Math.cos(phi) * size, r2 * Math.sin(phi) * size];
            });
        }
    },

    // ── ATTRACTORS ──
    stepAttractor(type, x, y, z, dt2, am) {
        const m = 1 + am;
        switch (type) {
            case 'lorenz':    { const s = 10, rho = 28 * m, b = 2.666; return [s * (y - x) * dt2, (x * (rho - z) - y) * dt2, (x * y - b * z) * dt2]; }
            case 'rossler':   { const a = 0.2, b = 0.2, c = 5.7 * m; return [(-y - z) * dt2, (x + a * y) * dt2, (b + z * (x - c)) * dt2]; }
            case 'aizawa':    { const a = 0.95, b = 0.7, c = 0.6, d = 3.5 * m, e = 0.25, f = 0.1; return [((z - b) * x - d * y) * dt2, (d * x + (z - b) * y) * dt2, (c + a * z - z ** 3 / 3 - (x * x + y * y) * (1 + e * z) + f * z * x ** 3) * dt2]; }
            case 'thomas':    { const b = 0.208186 * m; return [(Math.sin(y) - b * x) * dt2, (Math.sin(z) - b * y) * dt2, (Math.sin(x) - b * z) * dt2]; }
            case 'halvorsen': { const a = 1.89 * m; return [(-a * x - 4 * y - 4 * z - y * y) * dt2, (-a * y - 4 * z - 4 * x - z * z) * dt2, (-a * z - 4 * x - 4 * y - x * x) * dt2]; }
            case 'chen':      { const a = 35 * m, b = 3, c = 28; return [(a * (y - x)) * dt2, ((c - a) * x - x * z + c * y) * dt2, (x * y - b * z) * dt2]; }
            case 'dadras':    { const a = 3, b = 2.7, c = 1.7, d = 2 * m, e = 9; return [(y - a * x + b * y * z) * dt2, (c * y - x * z + z) * dt2, (d * x * y - e * z) * dt2]; }
            case 'sprott':    { const a = 2.07 * m, b = 1.79; return [(y + a * x * y + x * z) * dt2, (1 - b * x * x + y * z) * dt2, (x - x * x - y * y) * dt2]; }
            default: return [0, 0, 0];
        }
    },

    // ── INIT ──
    init(scene, camera) {
        this.group = new THREE.Group(); scene.add(this.group);
        camera.position.set(0, 15, 60); camera.lookAt(0, 0, 0);
        this.time = 0; this.currentShape = ''; this.currentInner = ''; this.currentInnerSize = 0;
        this.morphing = false; this.morphTarget = null; this.lastSfParams = '';
        this._dropTriggeredThisDrop = false;
        this._dropDisplaceActive = null; this._dropColorActive = null;
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
        this.basePositions  = new Float32Array(geo.attributes.position.array);
        this.normals        = new Float32Array(geo.attributes.normal.array);
        this.vertexColors   = cols;

        // Shared geometry: both solid and wireframe reference the SAME buffer.
        this.mainMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.2,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
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

        let geo;
        if      (shape === 'superformula') geo = this._grid(20, (u, v) => { const t = u * Math.PI * 2 - Math.PI, p = v * Math.PI - Math.PI / 2; const r1 = this.superformula(t, 4, 1, 1, 1), r2 = this.superformula(p, 4, 1, 1, 1); return [r1 * Math.cos(t) * r2 * Math.cos(p) * size, r1 * Math.sin(t) * r2 * Math.cos(p) * size, r2 * Math.sin(p) * size]; });
        else if (shape === 'torusKnot')    geo = new THREE.TorusKnotGeometry(size * 0.7, size * 0.15, 64, 12);
        else if (shape === 'icosahedron')  geo = new THREE.IcosahedronGeometry(size, 2);
        else                               geo = new THREE.SphereGeometry(size, 20, 16);

        geo.computeVertexNormals();
        this.innerBasePos = new Float32Array(geo.attributes.position.array);
        this.innerNormals = new Float32Array(geo.attributes.normal.array);
        this.innerGeo = geo;

        // Shared inner geometry
        this.innerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0x22ccff, transparent: true, opacity: 0.1,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
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
        this.attractorColors    = new Float32Array(count * 3);
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
        geo.setAttribute('color',    new THREE.Float32BufferAttribute(this.attractorColors, 3));
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
        this.flowColors    = new Float32Array(count * 3);
        this.flowVelocities = [];
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 15;
            this.flowPositions[i * 3] = Math.cos(a) * r; this.flowPositions[i * 3 + 1] = (Math.random() - 0.5) * 20; this.flowPositions[i * 3 + 2] = Math.sin(a) * r;
            this.flowVelocities.push({ x: 0, y: 0, z: 0 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.flowPositions, 3));
        geo.setAttribute('color',    new THREE.Float32BufferAttribute(this.flowColors, 3));
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
        const mid  = audio.smoothBands.mid  || 0, treble = audio.smoothBands.treble || 0;
        const rms  = audio.rms || 0;

        // ── OUTER SURFACE REBUILD CHECK ──
        const shape = params.outerSurface || 'superformula';
        const seg = Math.floor(params.outerDetail || 40);
        const size = params.outerSize || 22;
        let m = params.sfM || 6, n1 = params.sfN1 || 1, n2 = params.sfN2 || 1, n3 = params.sfN3 || 1;

        // Smooth-lerp SF params when audio-mapped
        if (params.sfAudioMap && shape === 'superformula') {
            this.smoothSfM  += ((m  + bass * 4) - this.smoothSfM)  * 0.08;
            this.smoothSfN1 += ((n1 + sub * 3)  - this.smoothSfN1) * 0.08;
            this.smoothSfN2 += ((n2 + mid * 2)  - this.smoothSfN2) * 0.08;
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
        const innerSize  = size * (params.innerScale || 0.4);
        if (innerShape !== this.currentInner || Math.abs(innerSize - this.currentInnerSize) > 0.5) {
            this.buildInner(innerShape, innerSize);
        }

        // ── COUNT CHANGES ──
        if (Math.floor(params.attractorCount || 4000) !== this.maxAttractorParts) this.initAttractor(Math.floor(params.attractorCount || 4000));
        if (Math.floor(params.flowCount || 3000) !== this.maxFlowParts)           this.initFlow(Math.floor(params.flowCount || 3000));

        // ── DROP EFFECTS ──
        const isDropping = audio.isDropSection;
        const dropLevel  = (audio.dropSectionIntensity || 1) * (params.dropIntensityMult || 1.5);
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
        this._dropColorActive    = (isDropping && params.dropColorOverride    && params.dropColorOverride    !== 'off') ? params.dropColorOverride    : null;

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
        this.mainMesh.material.opacity = params.solidOpacity || 0.2;
        this.mainWire.material.opacity = (params.wireOpacity || 0.7) * (0.5 + rms);
        this.mainWire.material.color.copy(ParamSystem.getColorThree(rms + this.time * 0.1));

        if (this.attractorSystem) {
            this.attractorSystem.material.size = (params.pointGlow || 2.5) * (1 + bass * SE.bloomGlowMult);
            this.attractorSystem.visible = params.attractorType !== 'none';
        }
        if (this.innerMesh) {
            this.innerMesh.visible  = !!params.showInner;
            this.innerMesh.material.opacity = (params.innerSolidOpacity || 0.1) + bass * 0.15;
        }
        if (this.innerWire) {
            this.innerWire.visible  = !!params.showInner;
            this.innerWire.material.opacity = (params.innerWireOpacity || 0.5) + rms * 0.4;
            const hwColor = params.dualWireColors
                ? ParamSystem.getColorThree(treble + this.time * 0.15 + 0.5)
                : ParamSystem.getColorThree(treble + this.time * 0.15);
            this.innerWire.material.color.copy(hwColor);
        }

        // ── ROTATION (SE.rotationMultiplier scales with marker section) ──
        const rotMult = SE.rotationMultiplier ?? 1;
        const rot = (params.rotSpeed || 0.4) * (1 + mid * react * 0.6) * rotMult;
        this.group.rotation.x += rot * 0.3 * dt;
        this.group.rotation.y += rot * dt;
        this.group.rotation.z += rot * 0.1 * dt;
        if (audio.bassBeat) {
            this.group.rotation.y += Math.min(0.15, audio.bassBeatIntensity * 0.2) * rotMult;
        }

        // ── BEAT EXPLODE ──
        if (audio.bassBeat && params.beatExplode > 0) this.explodePhase += audio.bassBeatIntensity * params.beatExplode * 0.3;
        this.explodePhase = Math.min(this.explodePhase, 5);
        this.explodePhase *= 0.88;
    },

    // ── DISPLACE SURFACE ──
    // No wireframe rebuild here — mainWire shares outerGeo, auto-updated.
    displaceSurface(audio, params, dt, SE) {
        const mode  = this._dropDisplaceActive || params.displaceMode || 'fourier';
        const amt   = (params.displaceAmt || 8) * (params.reactivity || 1.5) * (SE.displacementScale ?? 1) * (this._dropDisplaceActive ? (params.dropIntensityMult || 1.5) : 1);
        const speed = (params.displaceSpeed || 1.5) * (SE.speed ?? 1);
        const bass  = audio.smoothBands.bass || 0, sub = audio.smoothBands.sub || 0;
        const mid   = audio.smoothBands.mid  || 0, rms = audio.rms || 0;
        const breathScale = 1 + (sub + bass) * (params.bassBreath || 2.5) * 0.2;
        const colorMode = this._dropColorActive || params.colorMode || 'reactionDiffusion';
        const sym  = params.symmetryAxis || 'off';
        const wells = Math.floor(params.gravWellCount || 2);
        const explStyle = params.beatExplosionStyle || 'radial';
        const size = params.outerSize || 22;

        const pos = this.outerGeo.attributes.position.array;
        const col = this.outerGeo.attributes.color.array;
        const count = this.basePositions.length / 3;

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

            let disp = 0;
            switch (mode) {
                case 'fourier':         { const h1 = Math.sin(sx * 0.3 + this.time * speed) * freq; const h2 = Math.sin(sy * 0.5 + this.time * speed * 0.7) * (mid || 0); const h3 = Math.sin(sz * 0.2 + this.time * speed * 1.3) * (audio.smoothBands.treble || 0); disp = (h1 + h2 + h3) * amt; break; }
                case 'forceField':      { const d2 = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; disp = (bass * 20) / (d2 * d2 + 1) * amt * 0.3 + this.fbm(sx * 0.1, sy * 0.1, sz * 0.1 + this.time, 3) * amt * 0.3; break; }
                case 'vortex':          { const a2 = Math.atan2(sz, sx) + this.time * speed; const r2 = Math.sqrt(sx * sx + sz * sz); disp = Math.sin(a2 * 3 + r2 * 0.2) * amt * freq; break; }
                case 'magnetic':        { disp = (Math.sin(sy * 0.3 + this.time) * nx + Math.cos(sx * 0.3 + this.time * 0.7) * nz) * amt * (0.5 + bass * 2); break; }
                case 'superposition':   { let w = 0; for (let h = 1; h <= 5; h++) { const bv = (audio.frequencyData[Math.floor(h * 20)] || 0) / 255; w += Math.sin(sx * h * 0.2 + sy * h * 0.15 + sz * h * 0.1 + this.time * speed * h * 0.5) * bv / h; } disp = w * amt * 2; break; }
                case 'turbulence':      { disp = Math.abs(this.fbm(sx * 0.08 + this.time * speed * 0.3, sy * 0.08 + this.time * speed * 0.2, sz * 0.08, 4)) * amt * (0.5 + bass * 3); break; }
                case 'audioSculpt':     { disp = freq * amt * 1.5 + (audio.waveformPoints[Math.floor(t * 256)] || 0) * amt; break; }
                case 'reaction':        { const rd = Math.sin(sx * 0.15 + this.time) * Math.cos(sy * 0.15 - this.time * 0.7) + Math.sin(sz * 0.1 + this.time * 1.3); disp = rd * amt * 0.3 * (0.3 + freq * 2 + bass * 2); break; }
                case 'gravitationalWell': {
                    let totalForce = 0;
                    for (let w = 0; w < wells; w++) { const wa = (w / wells) * Math.PI * 2 + this.time * 0.3; const wx = Math.cos(wa) * 10, wz = Math.sin(wa) * 10; const dx = sx - wx, dz = sz - wz, d2 = Math.sqrt(dx * dx + sy * sy + dz * dz) + 0.1; totalForce += bass * 15 / (d2 * d2 + 1); }
                    disp = totalForce * amt * 0.2; break;
                }
                case 'stringTheory':    { let h = 0; for (let n = 1; n <= 7; n++) { const bv = (audio.frequencyData[Math.floor(n * 15)] || 0) / 255; h += bv * Math.sin(n * Math.PI * t + this.time * speed * n * 0.3) / n; } disp = h * amt * 2; break; }
                case 'fluidSim':        { const vx = Math.sin(sy * 0.2 + this.time * speed); const vy = Math.cos(sx * 0.2 + this.time * speed * 0.7); const vz = Math.sin((sx + sz) * 0.15 + this.time * speed * 1.3); disp = (vx * nx + vy * ny + vz * nz) * amt * (0.3 + bass * 2 + freq); break; }
            }

            // Explode style
            if (this.explodePhase > 0.01) {
                if      (explStyle === 'radial')  disp += this.explodePhase * 3;
                else if (explStyle === 'shatter') disp += this.noise3D(bx + this.time, by, bz) * this.explodePhase * 5;
                else if (explStyle === 'invert')  disp -= this.explodePhase * 3;
                else if (explStyle === 'twist')   { const ta = by * 0.3 + this.time; bx += Math.cos(ta) * this.explodePhase * 2; bz += Math.sin(ta) * this.explodePhase * 2; }
            }

            pos[i3]     = (bx + nx * disp) * breathScale;
            pos[i3 + 1] = (by + ny * disp) * breathScale;
            pos[i3 + 2] = (bz + nz * disp) * breathScale;
            // Sub sustain rumble
            if (audio.hasSustainedBass) pos[i3 + 1] += (audio.subSustain || 0) * (audio.wobbleLFO || 0) * amt * 0.4;

            // Colors
            let r = 1, g = 1, b = 1;
            switch (colorMode) {
                case 'reactionDiffusion': { const rd = (Math.sin(pos[i3] * 0.2 + this.time) + Math.cos(pos[i3 + 1] * 0.15 + this.time * 0.8)) * 0.5 + 0.5; const c = ParamSystem.getColorThreeHSL(rd * 0.6 + freq * 0.4); r = c.r; g = c.g; b = c.b; break; }
                case 'curvature':         { const cv = Math.abs(disp) / (amt + 0.01); const c = ParamSystem.getColorThreeHSL(cv); r = c.r; g = c.g; b = c.b; break; }
                case 'audioFreq':         { const c = ParamSystem.getColorThreeHSL(freq + t * 0.2); r = c.r; g = c.g; b = c.b; break; }
                case 'height':            { const c = ParamSystem.getColorThreeHSL(pos[i3 + 1] / 30 + 0.5); r = c.r; g = c.g; b = c.b; break; }
                case 'velocity':          { const c = ParamSystem.getColorThreeHSL(Math.abs(disp) * 0.1 + this.time * 0.05); r = c.r; g = c.g; b = c.b; break; }
                case 'rainbow':           { const c = new THREE.Color().setHSL((t + this.time * 0.1) % 1, 0.9, 0.5 + rms * 0.3); r = c.r; g = c.g; b = c.b; break; }
                case 'fire':              { const hf = freq * 0.6 + rms * 0.4; r = Math.min(1, hf * 2); g = hf * 0.6; b = hf * 0.1; break; }
                case 'ice':               { const c2 = freq * 0.5 + 0.3; r = c2 * 0.3; g = c2 * 0.7; b = Math.min(1, c2 * 1.5); break; }
                case 'plasma':            { r = Math.sin(t * 10 + this.time) * 0.5 + 0.5; g = Math.sin(t * 10 + this.time * 1.3 + 2.1) * 0.5 + 0.5; b = Math.sin(t * 10 + this.time * 0.7 + 4.2) * 0.5 + 0.5; break; }
                case 'thermal':           { const th = freq * 0.7 + rms * 0.3; r = Math.min(1, th * 3); g = Math.max(0, th * 2 - 0.5); b = Math.max(0, th - 0.7); break; }
                case 'void':              { const edge = Math.abs(disp) / (amt + 0.01); r = edge * 0.3; g = edge * 0.1; b = edge * 0.5 + 0.05; break; }
                case 'holographic':       { const angle = Math.atan2(pos[i3 + 2], pos[i3]) / Math.PI; const c = new THREE.Color().setHSL((angle + t + this.time * 0.05) % 1, 0.9, 0.3 + freq * 0.4); r = c.r; g = c.g; b = c.b; break; }
            }
            col[i3] = r; col[i3 + 1] = g; col[i3 + 2] = b;
        }

        // Mark dirty — mainMesh and mainWire see this automatically (shared buffer)
        this.outerGeo.attributes.position.needsUpdate = true;
        this.outerGeo.attributes.color.needsUpdate = true;
        // Recompute normals so lighting stays correct after displacement
        this.outerGeo.computeVertexNormals();
        // Note: NO WireframeGeometry rebuild — that was the critical performance bug.
    },

    // ── ATTRACTOR UPDATE ──
    updateAttractor(audio, params, dt, SE) {
        if (!this.attractorSystem || params.attractorType === 'none') return;
        const type  = params.attractorType || 'lorenz';
        const type2 = params.secondAttractor || 'none';
        const blend = params.attractorBlend || 0.5;
        const speed = (params.attractorSpeed || 1) * dt * 15 * (SE.speed ?? 1) * (1 + (audio.sirenRising || 0) * 2);
        const scale = (params.attractorScale || 1) * 0.5;
        const jitter = params.particleJitter || 0;
        const audioLink = params.attractorAudioLink || 'bass';
        const audioMod  = audio.smoothBands[audioLink] || 0;

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
                case 'orbit':   { v.x += Math.cos(angle) * (15 - dist) * 0.01 * speed - Math.sin(angle) * (0.5 + bass) * speed * 2; v.y += Math.sin(this.time + i * 0.01) * mid * speed; v.z += Math.sin(angle) * (15 - dist) * 0.01 * speed + Math.cos(angle) * (0.5 + bass) * speed * 2; break; }
                case 'spiral':  { v.x += -Math.sin(angle) * (0.5 + bass) * speed * 2 + Math.cos(angle) * 0.02 * speed; v.y += Math.cos(this.time * 2 + i * 0.02) * speed * 0.5; v.z += Math.cos(angle) * (0.5 + bass) * speed * 2 + Math.sin(angle) * 0.02 * speed; break; }
                case 'helix':   { const ha = angle + this.time * speed * 2; v.x = Math.cos(ha) * speed * (1 + bass); v.z = Math.sin(ha) * speed * (1 + bass); v.y += Math.sin(this.time * 3 + i * 0.05) * speed * 0.5; break; }
                case 'chaos':   { v.x += (Math.random() - 0.5) * speed * bass * 3; v.y += (Math.random() - 0.5) * speed * mid * 3; v.z += (Math.random() - 0.5) * speed * bass * 3; break; }
                case 'vortex':  { const vDist = 15 - dist; v.x += -Math.sin(angle) * speed * 3 * (1 + bass) + Math.cos(angle) * vDist * 0.005; v.z += Math.cos(angle) * speed * 3 * (1 + bass) + Math.sin(angle) * vDist * 0.005; v.y += Math.sin(this.time + i * 0.01) * mid * speed * 0.5; break; }
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
        if      (tcm === 'time')    this.trailLine.material.color.setHSL((this.time * 0.1) % 1, 0.9, 0.5);
        else if (tcm === 'palette') this.trailLine.material.color.copy(ParamSystem.getColorThree(audio.rms + this.time * 0.05));
        else                        this.trailLine.material.color.setHex(0xff44aa);
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