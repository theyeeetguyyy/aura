// ============================================================
// AURA Mode — HYPERFORGE 4.1
//
// Changes from 4.0:
//   BUGFIX-01  boysSurface denominator operator-precedence (|| 1 now guards whole expr)
//   BUGFIX-02  diniSurface log(tan(0)) = -Infinity — b2 clamped to (0.01, π-0.01)
//   BUGFIX-03  lorenzSurface index bounds — ring width is now a named constant (LORENZ_RING)
//              so vertex and index loops agree exactly
//   BUGFIX-04  getOuterGeo default case was a silent duplicate of superformula;
//              now logs a warning and delegates via sfSurface()
//   BUGFIX-05  buildInner('none') now nulls innerBasePos/innerNormals (stale buffer leak)
//   BUGFIX-06  updateTrails guards: skips when attractorPositions is null, attractorType
//              is 'none', or first position value is not finite (prevents NaN in ring buffer)
//   PERF-01   displaceSurface switch hoisted out of vertex loop via _buildDisplaceFn()
//              — function is built once per frame, not evaluated per vertex
//   PERF-02   _buildColorFn() same pattern for color switch
//   PERF-03   _colorResult (Float32Array(3)) pre-allocated; color fns write into it,
//              zero heap allocation per vertex for colors
//   PERF-04   _scratchColor / _scratchColor2 (THREE.Color) pre-allocated in init();
//              used across attractor, flow, and color fn closures — no per-frame Color news
//   PERF-05   sfKey string comparison replaced with delta-based rebuild guard
//              (_lastBuiltM/N1/N2/N3 tracked; rebuild only when Δ > SF_REBUILD_DELTA)
//              This prevents the near-continuous geometry rebuilds that occurred when
//              sfAudioMap was on (smoothed params drift every frame → key always changed)
//   PERF-06   stepAttractor switch → _attractorFns dispatch table (plain object lookup)
//   PERF-07   updateAttractor hoists hasSecond / invBlend out of inner loop
//   MATH-01   explodePhase decay uses Math.pow(EXPLODE_DECAY_RATE, dt*60) — frame-rate
//              independent (was a fixed *= 0.88 locked to 60 fps)
//   MATH-02   SF lerp coefficient corrected: Math.min(1, dt*60*SF_LERP_RATE)
//   REFACTOR  displaceSurface split into displaceSurface + _buildDisplaceFn + _buildColorFn
//   REFACTOR  All magic scalars extracted to named CONSTANTS block
//   REFACTOR  lorenzSurface uses LORENZ_RING constant; ring-closure vertex/index counts
//             expressed in terms of it so they can never diverge
// ============================================================

const HyperforgeMode3 = {
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
    explodePhase: 0,
    lastRebuildTime: 0,
    smoothSfM: 6, smoothSfN1: 1, smoothSfN2: 1, smoothSfN3: 1,
    _lastBuiltM: 6, _lastBuiltN1: 1, _lastBuiltN2: 1, _lastBuiltN3: 1,
    morphing: false, morphTarget: null, morphProgress: 0,
    _dropTriggeredThisDrop: false,
    _dropDisplaceActive: null, _dropColorActive: null,
    _activeParams: null,

    // Scratch objects — pre-allocated, reused every frame to eliminate GC pressure
    _scratchColor: null,   // THREE.Color — used in attractor/flow color paths
    _scratchColor2: null,  // THREE.Color — spare; available to color fn closures
    _colorResult: null,    // Float32Array(3) — written by colorFn, avoids [r,g,b] alloc per vertex

    // ── CONSTANTS ──
    REBUILD_DEBOUNCE_MS:  200,   // minimum ms between superformula geometry rebuilds
    SF_REBUILD_DELTA:     0.3,   // minimum param change magnitude to trigger a rebuild
    SF_LERP_RATE:         0.08,  // per-60fps-frame lerp factor for smoothed SF params
    ATTRACTOR_SPEED_SCALE: 15,   // dt multiplier for attractor integration step
    EXPLODE_DECAY_RATE:   0.88,  // per-60fps-frame multiplier; corrected for dt in update()
    MAX_EXPLODE:          5,
    MAX_ATTRACTOR_RESET:  200,   // position magnitude that resets a particle to origin
    FLOW_RESET_DIST:      50,    // flow particle reset distance
    FLOW_ORBIT_RADIUS:    15,    // nominal orbit radius for orbit/vortex patterns
    LORENZ_RING:          7,     // vertices per cross-section ring in lorenzSurface

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
        outerDetail:  { type: 'range', min: 0, max: 100, default: 40,   step: 5,   label: '🔶 Resolution' },
        outerSize:    { type: 'range', min: 0, max: 60,  default: 22,   step: 1,   label: '📐 Size' },

        // ═══ SUPERFORMULA ═══
        sfM:          { type: 'range', min: 1,   max: 20,  default: 6,    step: 0.5, label: '🔢 SF Symmetry (m)' },
        sfN1:         { type: 'range', min: 0.1, max: 12,  default: 1,    step: 0.1, label: '🔷 SF Shape (n1)' },
        sfN2:         { type: 'range', min: 0.1, max: 12,  default: 1,    step: 0.1, label: '↔️ SF Horizontal (n2)' },
        sfN3:         { type: 'range', min: 0.1, max: 12,  default: 1,    step: 0.1, label: '↕️ SF Vertical (n3)' },
        sfAudioMap:   { type: 'toggle', default: true,                             label: '🎵 Audio Drives SF' },

        // ═══ DISPLACEMENT ═══
        displaceMode: {
            type: 'select', options: [
                'fourier', 'forceField', 'vortex', 'magnetic', 'superposition', 'turbulence',
                'audioSculpt', 'reaction', 'gravitationalWell', 'stringTheory', 'fluidSim'
            ], default: 'fourier', label: '🌊 Displace Mode'
        },
        displaceAmt:        { type: 'range', min: 0, max: 30, default: 8,    step: 0.5, label: '📊 Displace Amount' },
        displaceSpeed:      { type: 'range', min: 0, max: 5,  default: 1.5,  step: 0.1, label: '⏩ Displace Speed' },
        symmetryAxis:       { type: 'select', options: ['off', 'x', 'y', 'z', 'xy', 'xz', 'yz', 'xyz'], default: 'off', label: '🔀 Symmetry Axis' },
        gravWellCount:      { type: 'range', min: 0, max: 8,  default: 2,    step: 1,   label: '🕳️ Gravity Wells' },

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
        solidOpacity: { type: 'range', min: 0, max: 1,   default: 0.2,  step: 0.05, label: '🔳 Solid Opacity' },
        wireOpacity:  { type: 'range', min: 0, max: 1,   default: 0.7,  step: 0.05, label: '🕸️ Wire Opacity' },

        // ═══ INNER SURFACE ═══
        showInner:         { type: 'toggle', default: true,                              label: '🔵 Inner Surface' },
        innerSurface:      { type: 'select', options: ['sphere', 'torusKnot', 'icosahedron', 'superformula', 'none'], default: 'icosahedron', label: '🔷 Inner Shape' },
        innerScale:        { type: 'range', min: 0, max: 1,    default: 0.4,  step: 0.05, label: '📐 Inner Scale' },
        innerSolidOpacity: { type: 'range', min: 0, max: 0.8,  default: 0.1,  step: 0.05, label: '🔳 Inner Solid Opacity' },
        innerWireOpacity:  { type: 'range', min: 0, max: 1,    default: 0.5,  step: 0.05, label: '🕸️ Inner Wire Opacity' },
        dualWireColors:    { type: 'toggle', default: false,                              label: '🌈 Dual Wire Colors' },

        // ═══ ATTRACTOR ═══
        attractorType: {
            type: 'select', options: ['lorenz', 'rossler', 'aizawa', 'thomas', 'halvorsen', 'chen', 'dadras', 'sprott', 'none'],
            default: 'lorenz', label: '🌀 Attractor Type'
        },
        secondAttractor: {
            type: 'select', options: ['none', 'lorenz', 'rossler', 'aizawa', 'thomas', 'halvorsen', 'chen', 'dadras', 'sprott'],
            default: 'none', label: '🔗 Secondary Attractor'
        },
        attractorBlend:    { type: 'range', min: 0, max: 1,     default: 0.5,  step: 0.05, label: '🔀 Attractor Blend' },
        attractorCount:    { type: 'range', min: 0, max: 15000, default: 4000, step: 500,  label: '✨ Attractor Points' },
        attractorSpeed:    { type: 'range', min: 0, max: 8,     default: 1,    step: 0.1,  label: '⏩ Attractor Speed' },
        attractorScale:    { type: 'range', min: 0, max: 5,     default: 1,    step: 0.1,  label: '📐 Attractor Scale' },
        attractorAudioLink:{ type: 'select', options: ['bass', 'mid', 'treble', 'rms', 'sub'], default: 'bass', label: '🔊 Audio Link Band' },
        particleJitter:    { type: 'range', min: 0, max: 8,     default: 0,    step: 0.1,  label: '✨ Particle Jitter' },
        pointGlow:         { type: 'range', min: 0, max: 10,    default: 2.5,  step: 0.5,  label: '✨ Point Glow Size' },
        showTrails:        { type: 'toggle', default: true,                                 label: '📈 Show Trails' },
        trailColorMode:    { type: 'select', options: ['velocity', 'time', 'distance', 'palette'], default: 'velocity', label: '🎨 Trail Color' },

        // ═══ FLOW PARTICLES ═══
        flowEnabled: { type: 'toggle', default: true,                              label: '💫 Flow Particles' },
        flowCount:   { type: 'range', min: 0, max: 12000, default: 3000, step: 500, label: '💫 Flow Count' },
        flowSpeed:   { type: 'range', min: 0, max: 5,     default: 1,    step: 0.1, label: '⏩ Flow Speed' },
        flowPattern: { type: 'select', options: ['orbit', 'spiral', 'helix', 'chaos', 'vortex'], default: 'orbit', label: '🌀 Flow Pattern' },

        // ═══ ROTATION ═══
        rotSpeed:         { type: 'range', min: 0, max: 2.0, default: 0.4, step: 0.05, label: '🔄 Rotation Speed' },
        rotationEnabled:  { type: 'toggle', default: true,                              label: '🔄 Rotation On/Off' },

        // ═══ AUDIO REACTIVITY ═══
        reactivity:         { type: 'range', min: 0.1, max: 2.0, default: 1.0, step: 0.05, label: '⚡ Reactivity' },
        bassBreath:         { type: 'range', min: 0, max: 3.0, default: 1.5, step: 0.1, label: '🔊 Bass Breathing' },
        beatExplode:        { type: 'range', min: 0, max: 3.0, default: 2,   step: 0.1, label: '💥 Beat Explode' },
        beatExplosionStyle: { type: 'select', options: ['radial', 'shatter', 'invert', 'twist'], default: 'radial', label: '💥 Explode Style' },

        // ═══ DROP SECTION ═══
        morphEnabled:        { type: 'toggle', default: true,                                    label: '🔄 Drop Morph' },
        morphSpeed:          { type: 'range', min: 0, max: 8,   default: 2,   step: 0.1,         label: '⏩ Morph Speed' },
        dropReaction:        { type: 'select', options: ['shapeShift', 'colorStorm', 'particleBurst', 'invert', 'all'], default: 'all', label: '🔥 Drop Reaction' },
        dropMorphTarget:     {
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
        dropIntensityMult: { type: 'range', min: 0.5, max: 3.0, default: 1.5, step: 0.1, label: '⚡ Drop Intensity' },
    },

    // ── ATTRACTOR DISPATCH (shared via MathLib) ──
    _attractorFns: MathLib.attractors,

    // ── DISPLACEMENT FUNCTION BUILDER (shared via MathLib) ──
    _buildDisplaceFn(mode, audio, amt, speed) {
        const wells = Math.floor(this._activeParams?.gravWellCount ?? 2);
        return MathLib.buildDisplaceFn(mode, audio, amt, speed, this.time, wells);
    },

    // ── COLOR FUNCTION BUILDER (shared via ColorLib) ──
    _buildColorFn(colorMode, audio, amt) {
        return ColorLib.buildColorFn(colorMode, audio, amt, this.time, this._colorResult, this._scratchColor);
    },


    // ── MATH DELEGATES (shared via MathLib) ──
    noise3D(x, y, z) { return MathLib.noise3D(x, y, z); },
    fbm(x, y, z, oct) { return MathLib.fbm(x, y, z, oct); },
    superformula(a, m, n1, n2, n3) { return MathLib.superformula(a, m, n1, n2, n3); },
    _grid(seg, fn) { return MathLib.buildGrid(seg, fn); },

    // ── SURFACE GENERATORS (shared via MathLib) ──
    getOuterGeo(shape, seg, size, m, n1, n2, n3) {
        return MathLib.getOuterGeo(shape, seg, size, m, n1, n2, n3, this.LORENZ_RING);
    },

    // ── ATTRACTOR STEP (shared via MathLib) ──
    stepAttractor(type, x, y, z, dt, am) {
        return MathLib.stepAttractor(type, x, y, z, dt, am);
    },

    // ── INIT ──
    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 15, 60);
        camera.lookAt(0, 0, 0);

        this.time              = 0;
        this.currentShape      = '';
        this.currentInner      = '';
        this.currentInnerSize  = 0;
        this.morphing          = false;
        this.morphTarget       = null;
        this.lastRebuildTime   = 0;
        this.explodePhase      = 0;
        this._dropTriggeredThisDrop = false;
        this._dropDisplaceActive    = null;
        this._dropColorActive       = null;
        this._activeParams          = null;
        this.outerGeo          = null;
        this.innerGeo          = null;

        // Pre-allocate scratch objects — eliminates per-frame THREE.Color allocation
        this._scratchColor  = new THREE.Color();
        this._scratchColor2 = new THREE.Color();
        // Pre-allocate color result — eliminates per-vertex [r,g,b] array allocation
        this._colorResult   = new Float32Array(3);

        this.buildOuter('superformula', 40, 22, 6, 1, 1, 1);
        this.buildInner('icosahedron', 22 * 0.4);
        this.initAttractor(4000);
        this.initFlow(3000);
        this.initTrails();
    },

    // ── OUTER BUILD ──
    // mainMesh + mainWire share the SAME outerGeo buffer.
    // wireframe:true on a Mesh reuses the geometry — no WireframeGeometry rebuild ever.
    buildOuter(shape, seg, size, m, n1, n2, n3) {
        if (this.mainMesh) { this.group.remove(this.mainMesh); this.mainMesh.material.dispose(); this.mainMesh = null; }
        if (this.mainWire) { this.group.remove(this.mainWire); this.mainWire.material.dispose(); this.mainWire = null; }
        if (this.outerGeo) { this.outerGeo.dispose(); this.outerGeo = null; }

        const geo = this.getOuterGeo(shape, seg, size, m, n1, n2, n3);
        geo.computeVertexNormals();
        const vc   = geo.attributes.position.count;
        const cols = new Float32Array(vc * 3).fill(1);
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));

        this.outerGeo      = geo;
        this.basePositions = new Float32Array(geo.attributes.position.array);
        this.normals       = new Float32Array(geo.attributes.normal.array);
        this.vertexColors  = cols;

        this.mainMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.2,
            side: THREE.DoubleSide, blending: THREE.NormalBlending, depthWrite: false,
        }));
        this.mainWire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            wireframe: true, color: 0x8b5cf6, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        this.group.add(this.mainMesh, this.mainWire);
        this.currentShape   = shape;

        // Track built SF params for delta-based rebuild guard (PERF-05)
        this._lastBuiltM  = m;  this._lastBuiltN1 = n1;
        this._lastBuiltN2 = n2; this._lastBuiltN3 = n3;
    },

    // ── INNER BUILD ──
    buildInner(shape, size) {
        if (this.innerMesh) { this.group.remove(this.innerMesh); this.innerMesh.material.dispose(); this.innerMesh = null; }
        if (this.innerWire) { this.group.remove(this.innerWire); this.innerWire.material.dispose(); this.innerWire = null; }
        if (this.innerGeo)  { this.innerGeo.dispose(); this.innerGeo = null; }

        // BUGFIX-05: always clear stale buffers so they don't linger in memory
        this.innerBasePos  = null;
        this.innerNormals  = null;
        this.currentInner      = shape;
        this.currentInnerSize  = size;

        if (shape === 'none') return;

        let geo;
        if      (shape === 'superformula') {
            geo = this._grid(20, (u, v) => {
                const t_ = u * Math.PI * 2 - Math.PI, p = v * Math.PI - Math.PI / 2;
                const r1 = this.superformula(t_, 4, 1, 1, 1), r2 = this.superformula(p, 4, 1, 1, 1);
                return [r1 * Math.cos(t_) * r2 * Math.cos(p) * size,
                        r1 * Math.sin(t_) * r2 * Math.cos(p) * size,
                        r2 * Math.sin(p) * size];
            });
        } else if (shape === 'torusKnot')   { geo = new THREE.TorusKnotGeometry(size * 0.7, size * 0.15, 64, 12); }
        else if   (shape === 'icosahedron') { geo = new THREE.IcosahedronGeometry(size, 2); }
        else                                { geo = new THREE.SphereGeometry(size, 20, 16); }

        geo.computeVertexNormals();
        this.innerBasePos = new Float32Array(geo.attributes.position.array);
        this.innerNormals = new Float32Array(geo.attributes.normal.array);
        this.innerGeo     = geo;

        this.innerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0x22ccff, transparent: true, opacity: 0.1,
            side: THREE.DoubleSide, blending: THREE.NormalBlending, depthWrite: false,
        }));
        this.innerWire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            wireframe: true, color: 0x22ccff, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        this.group.add(this.innerMesh, this.innerWire);
    },

    // ── ATTRACTOR INIT ──
    initAttractor(count) {
        if (this.attractorSystem) {
            this.group.remove(this.attractorSystem);
            this.attractorSystem.geometry.dispose();
            this.attractorSystem.material.dispose();
        }
        this.maxAttractorParts   = count;
        this.attractorPositions  = new Float32Array(count * 3);
        this.attractorColors     = new Float32Array(count * 3);
        this.attractorVelocities = [];
        for (let i = 0; i < count; i++) {
            this.attractorPositions[i * 3]     = (Math.random() - 0.5) * 2;
            this.attractorPositions[i * 3 + 1] = (Math.random() - 0.5) * 2;
            this.attractorPositions[i * 3 + 2] = (Math.random() - 0.5) * 2;
            this.attractorColors[i * 3]     = 1;
            this.attractorColors[i * 3 + 1] = 0.5;
            this.attractorColors[i * 3 + 2] = 1;
            this.attractorVelocities.push({ x: 0, y: 0, z: 0 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.attractorPositions, 3));
        geo.setAttribute('color',    new THREE.Float32BufferAttribute(this.attractorColors, 3));
        this.attractorSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        }));
        this.group.add(this.attractorSystem);
    },

    // ── FLOW INIT ──
    initFlow(count) {
        if (this.flowSystem) {
            this.group.remove(this.flowSystem);
            this.flowSystem.geometry.dispose();
            this.flowSystem.material.dispose();
        }
        this.maxFlowParts  = count;
        this.flowPositions = new Float32Array(count * 3);
        this.flowColors    = new Float32Array(count * 3);
        this.flowVelocities = [];
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 15;
            this.flowPositions[i * 3]     = Math.cos(a) * r;
            this.flowPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
            this.flowPositions[i * 3 + 2] = Math.sin(a) * r;
            this.flowVelocities.push({ x: 0, y: 0, z: 0 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.flowPositions, 3));
        geo.setAttribute('color',    new THREE.Float32BufferAttribute(this.flowColors, 3));
        this.flowSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1, vertexColors: true, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        }));
        this.group.add(this.flowSystem);
    },

    // ── TRAILS INIT ──
    initTrails() {
        if (this.trailLine) {
            this.group.remove(this.trailLine);
            this.trailLine.geometry.dispose();
            this.trailLine.material.dispose();
        }
        this.trailBuffer = new Float32Array(this.trailMaxPoints * 3);
        this.trailHead = 0; this.trailCount = 0;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.trailBuffer, 3));
        geo.setDrawRange(0, 0);
        this.trailLine = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: 0xff44aa, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
        }));
        this.group.add(this.trailLine);
    },

    // ── MAIN UPDATE ──
    update(audio, params, dt) {
        if (!this.group || !this.mainMesh) return;
        this.time         += dt;
        this._activeParams = params;

        const SE    = audio.sectionEffects || { displacementScale: 1, speed: 1, rotationMultiplier: 1, particleEmissionRate: 1, bloomGlowMult: 1 };
        const react = Math.min(params.reactivity ?? 1.0, 2.0);
        const bass  = audio.smoothBands.bass   || 0;
        const sub   = audio.smoothBands.sub    || 0;
        const mid   = audio.smoothBands.mid    || 0;
        const treble= audio.smoothBands.treble || 0;
        const rms   = audio.rms || 0;

        // ── OUTER SURFACE REBUILD CHECK ──
        const shape = params.outerSurface || 'superformula';
        const seg   = Math.floor(params.outerDetail || 40);
        const size  = params.outerSize || 22;
        let m  = params.sfM  || 6;
        let n1 = params.sfN1 || 1;
        let n2 = params.sfN2 || 1;
        let n3 = params.sfN3 || 1;

        // MATH-02: dt-corrected lerp so smoothing behaves the same at any framerate
        const lerpAlpha = Math.min(1, dt * 60 * this.SF_LERP_RATE);
        if (params.sfAudioMap && shape === 'superformula') {
            // Audio contribution is additive but capped — prevents superformula geometry explosion
            // (m > 16 or n1 < 0.1 produce near-degenerate meshes)
            const tgtM  = Math.min(m  + bass   * 2,  16);
            const tgtN1 = Math.min(n1 + sub    * 1.5, 8);
            const tgtN2 = Math.min(n2 + mid    * 1.5, 8);
            const tgtN3 = Math.min(n3 + treble * 1.5, 8);
            this.smoothSfM  += (tgtM  - this.smoothSfM)  * lerpAlpha;
            this.smoothSfN1 += (tgtN1 - this.smoothSfN1) * lerpAlpha;
            this.smoothSfN2 += (tgtN2 - this.smoothSfN2) * lerpAlpha;
            this.smoothSfN3 += (tgtN3 - this.smoothSfN3) * lerpAlpha;
            // Hard floor: prevents near-zero division in superformula
            this.smoothSfM  = Math.max(1,   this.smoothSfM);
            this.smoothSfN1 = Math.max(0.1, this.smoothSfN1);
            m = this.smoothSfM; n1 = this.smoothSfN1; n2 = this.smoothSfN2; n3 = this.smoothSfN3;
        }

        const now = performance.now();
        if (shape !== this.currentShape) {
            this.buildOuter(shape, seg, size, m, n1, n2, n3);
            this.lastRebuildTime = now;
        } else if (shape === 'superformula' && (now - this.lastRebuildTime) > this.REBUILD_DEBOUNCE_MS) {
            // PERF-05: delta-based guard — avoids the continuous rebuilds caused by
            // string-key comparison when sfAudioMap is on (smoothed params drift every frame)
            const sfDirty =
                Math.abs(m  - this._lastBuiltM)  > this.SF_REBUILD_DELTA ||
                Math.abs(n1 - this._lastBuiltN1) > this.SF_REBUILD_DELTA ||
                Math.abs(n2 - this._lastBuiltN2) > this.SF_REBUILD_DELTA ||
                Math.abs(n3 - this._lastBuiltN3) > this.SF_REBUILD_DELTA;
            if (sfDirty) {
                this.buildOuter(shape, seg, size, m, n1, n2, n3);
                this.lastRebuildTime = now;
            }
        }

        // ── INNER SURFACE ──
        const innerShape = params.showInner ? (params.innerSurface || 'icosahedron') : 'none';
        const innerSize  = size * (params.innerScale || 0.4);
        if (innerShape !== this.currentInner || Math.abs(innerSize - this.currentInnerSize) > 0.5) {
            this.buildInner(innerShape, innerSize);
        }

        // ── COUNT CHANGES ──
        if (Math.floor(params.attractorCount || 4000) !== this.maxAttractorParts) {
            this.initAttractor(Math.floor(params.attractorCount || 4000));
        }
        if (Math.floor(params.flowCount || 3000) !== this.maxFlowParts) {
            this.initFlow(Math.floor(params.flowCount || 3000));
        }

        // ── DROP EFFECTS ──
        const isDropping = audio.isDropSection;
        const dropLevel  = (audio.dropSectionIntensity || 1) * (params.dropIntensityMult || 1.5);

        if (isDropping && audio.bassBeat && !this._dropTriggeredThisDrop) {
            // Edge trigger: fires once per drop entry, resets when drop ends (below)
            this._dropTriggeredThisDrop = true;
            const react2 = params.dropReaction || 'all';
            if ((react2 === 'shapeShift' || react2 === 'all') && params.morphEnabled !== false) {
                const target = params.dropMorphTarget || 'random';
                const shapes = ['superformula', 'catenoid', 'helicoid', 'enneperSurface',
                                 'crossCap', 'boysSurface', 'trefoilKnot', 'algebraicHorn'];
                const next   = (target === 'random') ? shapes[Math.floor(Math.random() * shapes.length)] : target;
                if (next !== this.currentShape) this.buildOuter(next, seg, size, m, n1, n2, n3);
            }
            if (react2 === 'particleBurst' || react2 === 'all') {
                this.explodePhase = Math.min(this.explodePhase + 2 * dropLevel, this.MAX_EXPLODE);
            }
        }
        if (!isDropping) this._dropTriggeredThisDrop = false;

        this._dropDisplaceActive = (isDropping && params.dropDisplaceOverride && params.dropDisplaceOverride !== 'off')
            ? params.dropDisplaceOverride : null;
        this._dropColorActive = (isDropping && params.dropColorOverride && params.dropColorOverride !== 'off')
            ? params.dropColorOverride : null;

        // ── DISPLACE SURFACE ──
        this.displaceSurface(audio, params, dt, SE);

        // ── INNER PULSE ──
        if (this.innerMesh) {
            const ip = 1 + (sub + bass) * 0.3;
            this.innerMesh.scale.setScalar(ip);
            if (this.innerWire) this.innerWire.scale.setScalar(ip);
        }

        // ── ATTRACTORS ──
        this.updateAttractor(audio, params, dt, SE);

        // ── FLOW ──
        if (params.flowEnabled) {
            this.updateFlow(audio, params, dt);
            if (this.flowSystem) this.flowSystem.visible = true;
        } else if (this.flowSystem) {
            this.flowSystem.visible = false;
        }

        // ── TRAILS ──
        if (params.showTrails) this.updateTrails(audio, params);
        if (this.trailLine) this.trailLine.visible = !!params.showTrails;

        // ── MATERIALS ──
        this.mainMesh.material.opacity = Math.min(0.8, params.solidOpacity || 0.2);
        this.mainWire.material.opacity = Math.min(0.95, (params.wireOpacity || 0.7) * (0.5 + rms * 0.5));
        this.mainWire.material.color.copy(ParamSystem.getColorThree(rms + this.time * 0.1));

        if (this.attractorSystem) {
            this.attractorSystem.material.size    = (params.pointGlow || 2.5) * (1 + bass * SE.bloomGlowMult);
            this.attractorSystem.visible          = params.attractorType !== 'none';
        }
        if (this.innerMesh) {
            this.innerMesh.visible         = !!params.showInner;
            this.innerMesh.material.opacity = (params.innerSolidOpacity || 0.1) + bass * 0.15;
        }
        if (this.innerWire) {
            this.innerWire.visible         = !!params.showInner;
            this.innerWire.material.opacity = (params.innerWireOpacity || 0.5) + rms * 0.4;
            const hwColor = params.dualWireColors
                ? ParamSystem.getColorThree(treble + this.time * 0.15 + 0.5)
                : ParamSystem.getColorThree(treble + this.time * 0.15);
            this.innerWire.material.color.copy(hwColor);
        }

        // ── ROTATION ──
        // rotSpeed is a clean "how fast" knob — no audio multiplication baked in.
        // Audio adds a small additive beat kick only, keeping the visual legible at any volume.
        if (params.rotationEnabled !== false) {
            const rotMult   = SE.rotationMultiplier ?? 1;
            const rot       = (params.rotSpeed ?? 0.4) * rotMult;
            const rotAudioX = mid    * 0.003 * Math.min(react, 2.0);
            const rotAudioY = bass   * 0.005 * Math.min(react, 2.0);
            const rotAudioZ = treble * 0.002 * Math.min(react, 2.0);
            const beatKick  = audio.bassBeat
                ? Math.min(0.08, audio.bassBeatIntensity * 0.1) * rotMult
                : 0;
            this.group.rotation.x += (rot * 0.3 + rotAudioX) * dt;
            this.group.rotation.y += (rot       + rotAudioY + beatKick) * dt;
            this.group.rotation.z += (rot * 0.1 + rotAudioZ) * dt;
        }

        // ── BEAT EXPLODE ──
        if (audio.bassBeat && params.beatExplode > 0) {
            this.explodePhase += audio.bassBeatIntensity * params.beatExplode * 0.3;
        }
        this.explodePhase  = Math.min(this.explodePhase, this.MAX_EXPLODE);
        // MATH-01: dt-corrected decay — frame-rate independent
        this.explodePhase *= Math.pow(this.EXPLODE_DECAY_RATE, dt * 60);
    },

    // ── DISPLACE SURFACE ──
    // Refactored: displacement and color functions are built once per frame
    // (switch hoisted out of the vertex loop), then applied inside a tight loop
    // with no branching or per-vertex allocations.
    displaceSurface(audio, params, dt, SE) {
        const mode      = this._dropDisplaceActive || params.displaceMode || 'fourier';
        const dropMult  = this._dropDisplaceActive ? (params.dropIntensityMult || 1.5) : 1;
        
        const react = Math.min(params.reactivity ?? 1.0, 2.0);
        // amt hard-capped — prevents vertices flying to infinity at high reactivity
        const amt   = Math.min(
            (params.displaceAmt ?? 8) * react * dropMult,
            50
        );
        
        const speed     = (params.displaceSpeed ?? 1.5) * (SE.speed ?? 1);
        const bass      = audio.smoothBands.bass || 0;
        const sub       = audio.smoothBands.sub  || 0;
        const rms       = audio.rms || 0;
        const colorMode = this._dropColorActive || params.colorMode || 'reactionDiffusion';
        const sym       = params.symmetryAxis || 'off';
        const explStyle = params.beatExplosionStyle || 'radial';
        // breathScale clamped — bass + sub can reach 2.0, bassBreath max 3.0, coeff 0.12 → max scale ≈1.72×
        const breath       = Math.min(params.bassBreath ?? 1.5, 3.0);
        const breathScale  = 1 + (sub + bass) * breath * 0.12;
        const hasSustained = audio.hasSustainedBass;
        const subSustain   = audio.subSustain || 0;
        const wobbleLFO    = audio.wobbleLFO  || 0;
        const freqData     = audio.frequencyData;
        const freqLen      = freqData.length;

        const pos   = this.outerGeo.attributes.position.array;
        const col   = this.outerGeo.attributes.color.array;
        const count = this.basePositions.length / 3;

        // PERF-01/02: build both functions once per frame (switch hoisted out of loop)
        const dispFn  = this._buildDisplaceFn(mode, audio, amt, speed);
        const colorFn = this._buildColorFn(colorMode, audio, amt);

        // Pre-compute symmetry flags
        const useSymX = sym.includes('x');
        const useSymY = sym.includes('y');
        const useSymZ = sym.includes('z');

        // Cache explode state for the inner loop
        const explodeActive = this.explodePhase > 0.01;
        const explodeVal    = this.explodePhase;
        const isTwist       = explStyle === 'twist';

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            let bx = this.basePositions[i3];
            let by = this.basePositions[i3 + 1];
            let bz = this.basePositions[i3 + 2];
            let nx = this.normals[i3]     || 0;
            let ny = this.normals[i3 + 1] || 0;
            let nz = this.normals[i3 + 2] || 0;

            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;

            const tNorm = i / count;
            const fIdx  = Math.floor(tNorm * freqLen * 0.5);
            const freq  = (freqData[fIdx] || 0) / 255;

            const sx = useSymX ? Math.abs(bx) : bx;
            const sy = useSymY ? Math.abs(by) : by;
            const sz = useSymZ ? Math.abs(bz) : bz;

            let disp = dispFn(sx, sy, sz, freq, i, count, nx, ny, nz);

            if (explodeActive) {
                switch (explStyle) {
                    case 'radial':  disp += explodeVal * 3; break;
                    case 'shatter': disp += this.noise3D(bx + this.time, by, bz) * explodeVal * 5; break;
                    case 'invert':  disp -= explodeVal * 3; break;
                    case 'twist': {
                        const ta = by * 0.3 + this.time;
                        bx += Math.cos(ta) * explodeVal * 2;
                        bz += Math.sin(ta) * explodeVal * 2;
                        break;
                    }
                }
            }

            const px = (bx + nx * disp) * breathScale;
            const py = (by + ny * disp) * breathScale
                     + (hasSustained ? subSustain * wobbleLFO * amt * 0.4 : 0);
            const pz = (bz + nz * disp) * breathScale;

            pos[i3]     = px;
            pos[i3 + 1] = py;
            pos[i3 + 2] = pz;

            // PERF-03: colorFn writes into _colorResult (pre-allocated Float32Array)
            const rgb = colorFn(px, py, pz, disp, freq, tNorm);
            col[i3]     = Math.min(rgb[0], 0.85);
            col[i3 + 1] = Math.min(rgb[1], 0.85);
            col[i3 + 2] = Math.min(rgb[2], 0.85);
        }

        // Mark dirty — mainMesh and mainWire see this automatically (shared buffer)
        this.outerGeo.attributes.position.needsUpdate = true;
        this.outerGeo.attributes.color.needsUpdate    = true;
        // No computeVertexNormals() — MeshBasicMaterial is unlit, normals unused
        // No WireframeGeometry rebuild — shared buffer auto-propagates to mainWire
    },

    // ── ATTRACTOR UPDATE ──
    updateAttractor(audio, params, dt, SE) {
        if (!this.attractorSystem || params.attractorType === 'none') return;

        const type       = params.attractorType     || 'lorenz';
        const type2      = params.secondAttractor   || 'none';
        const blend      = params.attractorBlend    || 0.5;
        const invBlend   = 1 - blend;                           // PERF-07: hoist from inner loop
        const hasSecond  = type2 !== 'none';                    // PERF-07: hoist from inner loop
        const speed      = (params.attractorSpeed || 1) * dt * this.ATTRACTOR_SPEED_SCALE
                         * (SE.speed ?? 1) * (1 + (audio.sirenRising || 0) * 2);
        const scale      = (params.attractorScale || 1) * 0.5;
        const jitter     = params.particleJitter || 0;
        const audioLink  = params.attractorAudioLink || 'bass';
        const audioMod   = audio.smoothBands[audioLink] || 0;
        const resetThresh = this.MAX_ATTRACTOR_RESET;
        const sc         = this._scratchColor;   // PERF-04: reuse, no per-particle allocation

        if (audio.gunShotDetected) {
            const si = (audio.gunShotIntensity || 0) * 8;
            for (let i = 0; i < this.attractorVelocities.length; i++) {
                const vel = this.attractorVelocities[i];
                vel.x *= (1 + si); vel.y *= (1 + si); vel.z *= (1 + si);
            }
        }

        for (let i = 0; i < this.maxAttractorParts; i++) {
            const i3 = i * 3;
            let x = this.attractorPositions[i3]     / scale;
            let y = this.attractorPositions[i3 + 1] / scale;
            let z = this.attractorPositions[i3 + 2] / scale;

            let [dx, dy, dz] = this.stepAttractor(type, x, y, z, speed, audioMod);

            if (hasSecond) {
                const [dx2, dy2, dz2] = this.stepAttractor(type2, x, y, z, speed, audioMod);
                dx = dx * invBlend + dx2 * blend;
                dy = dy * invBlend + dy2 * blend;
                dz = dz * invBlend + dz2 * blend;
            }

            x += dx; y += dy; z += dz;

            if (jitter > 0) {
                x += (Math.random() - 0.5) * jitter * 0.1;
                y += (Math.random() - 0.5) * jitter * 0.1;
                z += (Math.random() - 0.5) * jitter * 0.1;
            }

            if (!isFinite(x) || Math.abs(x) > resetThresh) {
                x = (Math.random() - 0.5) * 2;
                y = (Math.random() - 0.5) * 2;
                z = (Math.random() - 0.5) * 2;
            }

            this.attractorPositions[i3]     = x * scale;
            this.attractorPositions[i3 + 1] = y * scale;
            this.attractorPositions[i3 + 2] = z * scale;

            // PERF-04: write into sc, no new THREE.Color allocation
            const spd = Math.sqrt(dx * dx + dy * dy + dz * dz);
            ParamSystem.getColorThreeHSL(spd * 50 + this.time * 0.05, sc);
            this.attractorColors[i3]     = sc.r;
            this.attractorColors[i3 + 1] = sc.g;
            this.attractorColors[i3 + 2] = sc.b;
        }

        this.attractorSystem.geometry.attributes.position.needsUpdate = true;
        this.attractorSystem.geometry.attributes.color.needsUpdate    = true;
    },

    // ── FLOW UPDATE ──
    updateFlow(audio, params, dt) {
        if (!this.flowSystem) return;

        const speed   = (params.flowSpeed || 1) * dt;
        const bass    = audio.smoothBands.bass || 0;
        const mid     = audio.smoothBands.mid  || 0;
        const pattern = params.flowPattern || 'orbit';
        const R       = this.FLOW_ORBIT_RADIUS;
        const sc      = this._scratchColor;   // PERF-04: reuse
        const screechIntensity = audio.screechDetected ? (audio.screechIntensity || 0) * 0.4 : 0;

        for (let i = 0; i < this.maxFlowParts; i++) {
            const i3 = i * 3;
            let x = this.flowPositions[i3];
            let y = this.flowPositions[i3 + 1];
            let z = this.flowPositions[i3 + 2];
            const dist  = Math.sqrt(x * x + y * y + z * z) || 1;
            const angle = Math.atan2(z, x);
            const v     = this.flowVelocities[i];

            switch (pattern) {
                case 'orbit':
                    v.x += Math.cos(angle) * (R - dist) * 0.01 * speed - Math.sin(angle) * (0.5 + bass) * speed * 2;
                    v.y += Math.sin(this.time + i * 0.01) * mid * speed;
                    v.z += Math.sin(angle) * (R - dist) * 0.01 * speed + Math.cos(angle) * (0.5 + bass) * speed * 2;
                    break;
                case 'spiral':
                    v.x += -Math.sin(angle) * (0.5 + bass) * speed * 2 + Math.cos(angle) * 0.02 * speed;
                    v.y += Math.cos(this.time * 2 + i * 0.02) * speed * 0.5;
                    v.z +=  Math.cos(angle) * (0.5 + bass) * speed * 2 + Math.sin(angle) * 0.02 * speed;
                    break;
                case 'helix': {
                    const ha = angle + this.time * speed * 2;
                    v.x = Math.cos(ha) * speed * (1 + bass);
                    v.z = Math.sin(ha) * speed * (1 + bass);
                    v.y += Math.sin(this.time * 3 + i * 0.05) * speed * 0.5;
                    break;
                }
                case 'chaos':
                    v.x += (Math.random() - 0.5) * speed * bass * 2;
                    v.y += (Math.random() - 0.5) * speed * mid  * 2;
                    v.z += (Math.random() - 0.5) * speed * bass * 2;
                    // Clamp: chaos should feel energetic but particles must stay in view
                    v.x = Math.max(-1.5, Math.min(1.5, v.x));
                    v.y = Math.max(-1.5, Math.min(1.5, v.y));
                    v.z = Math.max(-1.5, Math.min(1.5, v.z));
                    break;
                case 'vortex': {
                    const vd = R - dist;
                    v.x += -Math.sin(angle) * speed * 3 * (1 + bass) + Math.cos(angle) * vd * 0.005;
                    v.z +=  Math.cos(angle) * speed * 3 * (1 + bass) + Math.sin(angle) * vd * 0.005;
                    v.y += Math.sin(this.time + i * 0.01) * mid * speed * 0.5;
                    break;
                }
            }

            v.x *= 0.98; v.y *= 0.98; v.z *= 0.98;
            x += v.x; y += v.y; z += v.z;

            if (dist > this.FLOW_RESET_DIST || !isFinite(x)) {
                const a2 = Math.random() * Math.PI * 2;
                x = Math.cos(a2) * R; y = (Math.random() - 0.5) * 10; z = Math.sin(a2) * R;
                v.x = 0; v.y = 0; v.z = 0;
            }

            this.flowPositions[i3]     = x;
            this.flowPositions[i3 + 1] = y;
            this.flowPositions[i3 + 2] = z;

            // PERF-04: reuse sc
            ParamSystem.getColorThreeHSL(dist / 30 + this.time * 0.05, sc);
            let cr = sc.r, cg = sc.g, cb = sc.b;
            if (screechIntensity > 0) {
                const si = screechIntensity;
                cr = cr * (1 - si) + si;
                cg = cg * (1 - si) + 0.95 * si;
                cb = cb * (1 - si) + 0.6  * si;
            }
            this.flowColors[i3]     = cr;
            this.flowColors[i3 + 1] = cg;
            this.flowColors[i3 + 2] = cb;
        }

        this.flowSystem.geometry.attributes.position.needsUpdate = true;
        this.flowSystem.geometry.attributes.color.needsUpdate    = true;
    },

    // ── TRAILS UPDATE (ring buffer) ──
    updateTrails(audio, params) {
        // BUGFIX-06: guard against null attractorPositions, attractorType === 'none',
        // or NaN position (all caused silent bugs in ring buffer and material color)
        if (!this.trailLine || !this.attractorPositions) return;
        if (params.attractorType === 'none') return;

        const x = this.attractorPositions[0];
        const y = this.attractorPositions[1];
        const z = this.attractorPositions[2];
        if (!isFinite(x)) return;

        const h3 = this.trailHead * 3;
        this.trailBuffer[h3]     = x;
        this.trailBuffer[h3 + 1] = y;
        this.trailBuffer[h3 + 2] = z;
        this.trailHead  = (this.trailHead + 1) % this.trailMaxPoints;
        if (this.trailCount < this.trailMaxPoints) this.trailCount++;

        const pos = this.trailLine.geometry.attributes.position.array;
        for (let i = 0; i < this.trailCount; i++) {
            const si = ((this.trailHead - this.trailCount + i + this.trailMaxPoints) % this.trailMaxPoints) * 3;
            pos[i * 3]     = this.trailBuffer[si];
            pos[i * 3 + 1] = this.trailBuffer[si + 1];
            pos[i * 3 + 2] = this.trailBuffer[si + 2];
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
        if (this.group) {
            this.group.traverse(c => { if (c.material) c.material.dispose(); });
            scene.remove(this.group);
        }
        if (this.outerGeo) { this.outerGeo.dispose(); this.outerGeo = null; }
        if (this.innerGeo) { this.innerGeo.dispose(); this.innerGeo = null; }
        this.mainMesh        = null;
        this.mainWire        = null;
        this.innerMesh       = null;
        this.innerWire       = null;
        this.attractorSystem = null;
        this.flowSystem      = null;
        this.trailLine       = null;
        this._scratchColor   = null;
        this._scratchColor2  = null;
        this._colorResult    = null;
        this._activeParams   = null;
    },
};