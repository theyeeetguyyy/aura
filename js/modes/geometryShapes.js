// ============================================================
// AURA Mode — Geometry Forge 3.0
// 25 shapes, 16 displacement modes, 42 parameters
// Ghost trails, particles, mirrors, morphing, symmetry
// ============================================================

const GeometryForgeMode = {
    name: 'Geometry Forge',



    group: null, meshSolid: null, meshWire: null, meshInnerWire: null, meshPoints: null,
    basePositions: null, normals: null, vertexColors: null,
    time: 0, explodePhase: 0, currentShape: '', currentDetail: -1, currentSize: -1,
    ghosts: [], ghostTimer: 0,
    _dropTriggeredThisDrop: false,
    particleSystem: null, particlePositions: null, particleVelocities: [], particleColors: null, maxTrailParticles: 3000,
    morphTargetBase: null, morphProgress: 0, morphing: false,
    mirrorMeshes: [],
    _tempColor: null, // cached THREE.Color — initialized in init()
    _tempVec3: null,  // cached THREE.Vector3 — initialized in init()
    _rotWrapCounter: 0, // counter for periodic rotation wrapping

    params: {
        shape: {
            type: 'select', options: [
                'icosahedron', 'dodecahedron', 'octahedron', 'tetrahedron', 'torus', 'torusKnot',
                'sphere', 'cube', 'cone', 'cylinder', 'heart', 'star', 'crystal', 'mobius', 'klein',
                'hyperboloid', 'trefoilKnot', 'gyroid', 'seashell', 'spiralSphere',
                'stellatedOcta', 'romanSurface', 'crossCap', 'catenoid', 'helicoid',
                'diniSurface', 'boysSurface', 'astroid', 'menger', 'calabi'
            ], default: 'icosahedron', label: '🔷 Shape'
        },
        detail: { type: 'range', min: 0, max: 5, default: 3, step: 1, label: 'Detail' },
        size: { type: 'range', min: 5, max: 60, default: 25, step: 1, label: 'Size' },
        displaceMode: {
            type: 'select', options: [
                'frequency', 'noise', 'spike', 'breathe', 'ripple', 'shatter', 'twist', 'melt',
                'waveform', 'pulse', 'glitch', 'fractal', 'magnetic', 'cellular', 'orbit', 'harmonics',
                'voronoi', 'flow', 'tentacle', 'interference', 'crystallize', 'audio3D', 'gravityWell', 'jellyfish'
            ], default: 'frequency', label: '🌊 Displace Mode'
        },
        displaceAmount: { type: 'range', min: 0, max: 40, default: 12, step: 0.5, label: 'Displace Amt' },
        displaceFreq: { type: 'range', min: 0.5, max: 10, default: 3, step: 0.1, label: 'Displace Freq' },
        noiseScale: { type: 'range', min: 0.5, max: 10, default: 2, step: 0.1, label: 'Noise Scale' },
        noiseOctaves: { type: 'range', min: 1, max: 5, default: 3, step: 1, label: 'Noise Oct' },
        showSolid: { type: 'toggle', default: true, label: 'Show Solid' },
        showWireframe: { type: 'toggle', default: true, label: 'Wireframe' },
        showInnerWire: { type: 'toggle', default: false, label: 'Inner Wire' },
        showPoints: { type: 'toggle', default: false, label: 'Points' },
        vertexColorMode: { type: 'select', options: ['off', 'frequency', 'height', 'distance', 'rainbow', 'bands', 'plasma', 'thermal', 'pattern', 'displacement', 'velocity', 'waveformColor'], default: 'frequency', label: '🎨 Vertex Colors' },
        colorPalette: { type: 'select', options: ['default', 'void', 'solar', 'ocean', 'toxic', 'nebula', 'aurora', 'fire', 'ice', 'cyber', 'sunset', 'acid', 'midnight', 'lava'], default: 'default', label: '🎨 Palette' },
        wireColor: { type: 'select', options: ['white', 'palette', 'rainbow', 'neon', 'fire', 'ice', 'void', 'pulse', 'spectrum', 'complementary'], default: 'palette', label: 'Wire Color' },
        solidOpacity: { type: 'range', min: 0, max: 1, default: 0.35, step: 0.05, label: 'Solid Opacity' },
        wireOpacity: { type: 'range', min: 0, max: 1, default: 0.9, step: 0.05, label: 'Wire Opacity' },
        pointSize: { type: 'range', min: 0.5, max: 8, default: 2.5, step: 0.5, label: 'Point Size' },
        autoRotateMode: { type: 'select', options: ['smooth', 'tumble', 'orbit', 'wobble', 'spin', 'breatheRot', 'chaotic', 'beatLock'], default: 'smooth', label: '🔄 Rotate Mode' },
        rotSpeedX: { type: 'range', min: 0, max: 5, default: 0.3, step: 0.05, label: 'Rotate X' },
        rotSpeedY: { type: 'range', min: 0, max: 5, default: 0.5, step: 0.05, label: 'Rotate Y' },
        rotSpeedZ: { type: 'range', min: 0, max: 5, default: 0.1, step: 0.05, label: 'Rotate Z' },
        beatExplode: { type: 'range', min: 0, max: 5, default: 0.8, step: 0.1, label: '💥 Beat Explode' },
        beatSpinBurst: { type: 'range', min: 0, max: 5, default: 0.3, step: 0.1, label: '🌀 Beat Spin' },
        beatShrink: { type: 'toggle', default: false, label: 'Beat Shrink/Grow' },
        bassBreath: { type: 'range', min: 0, max: 5, default: 1.2, step: 0.1, label: '🔊 Bass Breath' },
        dropEffect: { type: 'select', options: ['morph', 'explode', 'invert', 'glitch', 'shatter', 'scatter', 'invertSpace', 'all'], default: 'morph', label: '🔥 Drop Effect' },
        // ── DROP OVERRIDES ──
        dropMorphTarget: {
            type: 'select', options: [
                'random', 'icosahedron', 'dodecahedron', 'octahedron', 'tetrahedron', 'torus', 'torusKnot',
                'sphere', 'cube', 'heart', 'star', 'crystal', 'mobius', 'klein', 'trefoilKnot',
                'gyroid', 'seashell', 'romanSurface', 'crossCap', 'boysSurface', 'menger', 'calabi'
            ], default: 'random', label: '🎯 Drop Shape'
        },
        dropDisplaceOverride: {
            type: 'select', options: [
                'off', 'frequency', 'noise', 'spike', 'breathe', 'ripple', 'shatter', 'twist', 'melt',
                'waveform', 'pulse', 'glitch', 'fractal', 'magnetic', 'voronoi', 'flow',
                'tentacle', 'interference', 'crystallize', 'harmonics'
            ], default: 'off', label: '🌊 Drop Displace'
        },
        dropColorOverride: {
            type: 'select', options: [
                'off', 'frequency', 'height', 'distance', 'rainbow', 'plasma',
                'thermal', 'displacement', 'velocity', 'waveformColor', 'pattern'
            ], default: 'off', label: '🎨 Drop Color'
        },
        dropIntensityMult: { type: 'range', min: 0.5, max: 5, default: 1.5, step: 0.1, label: '⚡ Drop Power' },
        ghostTrail: { type: 'toggle', default: true, label: '👻 Ghost Trail' },
        ghostCount: { type: 'range', min: 1, max: 8, default: 4, step: 1, label: 'Ghost Count' },
        ghostSpacing: { type: 'range', min: 1, max: 15, default: 5, step: 1, label: 'Ghost Spacing' },
        trailStyle: { type: 'select', options: ['ghost', 'ribbon', 'echo'], default: 'ghost', label: '✨ Trail Style' },
        emitParticles: { type: 'toggle', default: true, label: '✨ Particles' },
        particleCount: { type: 'range', min: 500, max: 5000, default: 2000, step: 100, label: 'Particle Count' },
        mirrorMode: { type: 'select', options: ['off', 'bilateral', 'tri', 'quad', 'hex', 'octa'], default: 'off', label: '🪞 Mirror' },
        mirrorDistance: { type: 'range', min: 0, max: 80, default: 30, step: 5, label: 'Mirror Dist' },
        chromaticSplit: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '🌈 Chromatic' },
        symmetryMode: { type: 'select', options: ['off', 'x', 'y', 'z', 'xy', 'xyz'], default: 'off', label: '🔀 Symmetry' },
        surfacePattern: { type: 'select', options: ['none', 'checker', 'stripe', 'spiral', 'hex', 'dots', 'waves', 'voronoiPat', 'fractalNoise'], default: 'none', label: '🔲 Pattern' },
        pulseRate: { type: 'range', min: 0, max: 10, default: 0, step: 0.5, label: '💓 Pulse Rate' },
        gravity: { type: 'range', min: -3, max: 3, default: 0, step: 0.1, label: '⬇️ Gravity' }
    },

    // ── NOISE ──
    noise3D(x, y, z) { const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return (n - Math.floor(n)) * 2 - 1; },
    fbm(x, y, z, oct) { let v = 0, a = 1, f = 1, t = 0; for (let i = 0; i < oct; i++) { v += this.noise3D(x * f, y * f, z * f) * a; t += a; a *= 0.5; f *= 2.1; } return v / t; },

    // ── GEOMETRY FACTORY ──
    getGeometry(shape, detail, size) {
        const d = Math.floor(detail), s = d + 2;
        switch (shape) {
            case 'dodecahedron': return new THREE.DodecahedronGeometry(size, d);
            case 'octahedron': return new THREE.OctahedronGeometry(size, d);
            case 'tetrahedron': return new THREE.TetrahedronGeometry(size, d);
            case 'torus': return new THREE.TorusGeometry(size, size * 0.4, s * 4, s * 8);
            case 'torusKnot': return new THREE.TorusKnotGeometry(size * 0.7, size * 0.2, s * 16, s * 4);
            case 'sphere': return new THREE.SphereGeometry(size, s * 8, s * 6);
            case 'cube': return new THREE.BoxGeometry(size * 1.5, size * 1.5, size * 1.5, s * 2, s * 2, s * 2);
            case 'cone': return new THREE.ConeGeometry(size, size * 2, s * 8, s * 4);
            case 'cylinder': return new THREE.CylinderGeometry(size, size, size * 2, s * 8, s * 4);
            case 'heart': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI * 2, b = v * Math.PI, sc = size * 0.6;
                return [sc * (16 * Math.pow(Math.sin(a), 3)) / 16, sc * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16, sc * Math.sin(b) * Math.abs(Math.sin(a)) * 0.5];
            });
            case 'star': return this._star(size, s);
            case 'crystal': return this._crystal(size);
            case 'mobius': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI * 2, w = (v - 0.5) * size * 0.3;
                return [(size + w * Math.cos(a / 2)) * Math.cos(a), (size + w * Math.cos(a / 2)) * Math.sin(a), w * Math.sin(a / 2)];
            });
            case 'klein': return this._klein(size, s);
            case 'hyperboloid': return this._parametric(size, s, (u, v) => {
                const a = (u - 0.5) * 4, b = v * Math.PI * 2;
                return [size * 0.4 * Math.cosh(a) * Math.cos(b), size * 0.8 * a, size * 0.4 * Math.cosh(a) * Math.sin(b)];
            });
            case 'trefoilKnot': return this._parametric(size, s, (u, v) => {
                const t = u * Math.PI * 2, r = Math.cos(3 * t) + 2, w = (v - 0.5) * size * 0.15;
                return [(r * Math.cos(2 * t) + w * Math.cos(2 * t) * Math.cos(3 * t)) * size * 0.25, (r * Math.sin(2 * t) + w * Math.sin(2 * t) * Math.cos(3 * t)) * size * 0.25, (Math.sin(3 * t) + w * Math.sin(3 * t)) * size * 0.25];
            });
            case 'gyroid': return this._parametric(size, s, (u, v) => {
                const a = (u - 0.5) * Math.PI * 2, b = (v - 0.5) * Math.PI * 2;
                const r = size * 0.4 * (Math.cos(a) * Math.sin(b) + Math.cos(b) * Math.sin(a) + Math.cos(a) * Math.cos(b)) * 0.3 + size * 0.5;
                return [Math.cos(a) * r * 0.5, Math.sin(b) * r * 0.5, (Math.sin(a) + Math.cos(b)) * size * 0.3];
            });
            case 'seashell': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI * 6, b = v * Math.PI * 2, r = size * 0.1 * (1 + a * 0.15);
                return [r * (1 + Math.cos(b)) * Math.cos(a), r * (1 + Math.cos(b)) * Math.sin(a), r * Math.sin(b) + a * size * 0.05];
            });
            case 'spiralSphere': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI * 8, b = v * Math.PI;
                const r = size * (1 + 0.2 * Math.sin(a * 3));
                return [r * Math.sin(b) * Math.cos(a) * 0.5, r * Math.cos(b) * 0.5, r * Math.sin(b) * Math.sin(a) * 0.5];
            });
            case 'stellatedOcta': {
                const geo = new THREE.OctahedronGeometry(size, d);
                const p = geo.attributes.position.array;
                for (let i = 0; i < p.length; i += 3) { const l = Math.sqrt(p[i] ** 2 + p[i + 1] ** 2 + p[i + 2] ** 2) || 1; const spike = 1 + Math.abs(Math.sin(Math.atan2(p[i + 1], p[i]) * 4)) * 0.5; p[i] *= spike / l * size; p[i + 1] *= spike / l * size; p[i + 2] *= spike / l * size; }
                geo.computeVertexNormals(); return geo;
            }
            case 'romanSurface': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI, b = v * Math.PI * 2, s2 = size * 0.5;
                return [s2 * Math.sin(2 * a) * Math.cos(b) * Math.cos(b), s2 * Math.sin(a) * Math.sin(2 * b) / 2, s2 * Math.cos(a) * Math.sin(2 * b) / 2];
            });
            case 'crossCap': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI, b = v * Math.PI * 2;
                return [size * Math.cos(a) * Math.sin(2 * b) * 0.5, size * Math.sin(a) * Math.sin(2 * b) * 0.5, size * (Math.cos(b) ** 2 - Math.cos(a) ** 2 * Math.sin(b) ** 2) * 0.5];
            });
            case 'catenoid': return this._parametric(size, s, (u, v) => {
                const a = (u - 0.5) * 4, b = v * Math.PI * 2, sc = size * 0.6;
                return [sc * Math.cosh(a) * Math.cos(b), sc * a * 2, sc * Math.cosh(a) * Math.sin(b)];
            });
            case 'helicoid': return this._parametric(size, s, (u, v) => {
                const a = (u - 0.5) * size * 2, b = v * Math.PI * 4;
                return [a * Math.cos(b), b * size * 0.15, a * Math.sin(b)];
            });
            case 'diniSurface': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI * 4, b = v * 1.8 + 0.15, sc = size * 0.5;
                return [sc * Math.cos(a) * Math.sin(b), sc * (Math.cos(b) + Math.log(Math.tan(b / 2)) + a * 0.05), sc * Math.sin(a) * Math.sin(b)];
            });
            case 'boysSurface': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI, b = v * Math.PI * 2, sc = size * 0.5;
                const sq2 = Math.SQRT2, ca = Math.cos(a), sa = Math.sin(a);
                const denom = 2 - sq2 * Math.sin(3 * b) * Math.sin(2 * a) || 1;
                return [
                    sc * (sq2 * ca * ca * Math.cos(2 * b) + ca * Math.sin(b)) / denom,
                    sc * (sq2 * ca * ca * Math.sin(2 * b) - ca * Math.cos(b)) / denom,
                    sc * 3 * ca * ca / denom
                ];
            });
            case 'astroid': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI * 2, b = v * Math.PI, sc = size * 0.8;
                const ca3 = Math.pow(Math.cos(a), 3), sa3 = Math.pow(Math.sin(a), 3);
                const cb3 = Math.pow(Math.cos(b), 3), sb3 = Math.pow(Math.sin(b), 3);
                return [sc * ca3 * cb3, sc * sa3 * cb3, sc * sb3];
            });
            case 'menger': {
                const geo = new THREE.BoxGeometry(size * 1.5, size * 1.5, size * 1.5, 9, 9, 9);
                const pos = geo.attributes.position.array;
                const hs = size * 0.75;
                for (let i = 0; i < pos.length; i += 3) {
                    const ax = Math.abs(pos[i]) / hs, ay = Math.abs(pos[i + 1]) / hs, az = Math.abs(pos[i + 2]) / hs;
                    const inCenter = (ax < 0.34 && ay < 0.34) || (ay < 0.34 && az < 0.34) || (ax < 0.34 && az < 0.34);
                    if (inCenter) {
                        const ll = Math.sqrt(pos[i] ** 2 + pos[i + 1] ** 2 + pos[i + 2] ** 2) || 1;
                        pos[i] *= 1.3 / ll * hs; pos[i + 1] *= 1.3 / ll * hs; pos[i + 2] *= 1.3 / ll * hs;
                    }
                }
                geo.computeVertexNormals(); return geo;
            }
            case 'calabi': return this._parametric(size, s, (u, v) => {
                const a = u * Math.PI * 2, b = v * Math.PI, sc = size * 0.7;
                const n = 5;
                const r = 1 + 0.3 * Math.cos(n * a) * Math.sin(n * b);
                return [sc * r * Math.sin(b) * Math.cos(a), sc * r * Math.cos(b), sc * r * Math.sin(b) * Math.sin(a)];
            });
            default: return new THREE.IcosahedronGeometry(size, d);
        }
    },

    _parametric(size, seg, fn) {
        const s = seg * 10, verts = [], indices = [];
        for (let i = 0; i <= s; i++) for (let j = 0; j <= s; j++) { const p = fn(i / s, j / s); verts.push(p[0], p[1], p[2]); }
        for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) { const a = i * (s + 1) + j, b = a + 1, c = a + s + 1, d = c + 1; indices.push(a, b, c, b, d, c); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices); geo.computeVertexNormals(); return geo;
    },

    _star(size, seg) {
        const geo = new THREE.BufferGeometry(), verts = [], indices = [], pts = 5;
        verts.push(0, 0, size * 0.3, 0, 0, -size * 0.3);
        for (let i = 0; i < pts * 2; i++) { const a = (i / (pts * 2)) * Math.PI * 2, r = i % 2 === 0 ? size : size * 0.4; verts.push(Math.cos(a) * r, Math.sin(a) * r, 0); }
        for (let i = 0; i < pts * 2; i++) { const n = (i + 1) % (pts * 2); indices.push(0, i + 2, n + 2, 1, n + 2, i + 2); }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices); geo.computeVertexNormals();
        return this._subdivide(geo, Math.max(1, seg));
    },

    _crystal(size) {
        const geo = new THREE.BufferGeometry(), verts = [], indices = [], f = 6;
        verts.push(0, size * 1.5, 0, 0, -size * 1.5, 0);
        for (let i = 0; i < f; i++) { const a = (i / f) * Math.PI * 2, w = 1 + Math.sin(i * 3) * 0.2; verts.push(Math.cos(a) * size * 0.6 * w, 0, Math.sin(a) * size * 0.6 * w); }
        for (let i = 0; i < f; i++) { const n = (i + 1) % f; indices.push(0, i + 2, n + 2, 1, n + 2, i + 2); }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices); geo.computeVertexNormals();
        return this._subdivide(geo, 2);
    },

    _klein(size, seg) {
        const s = seg * 10, verts = [], indices = [], sc = size * 0.15;
        for (let i = 0; i <= s; i++) for (let j = 0; j <= s; j++) {
            const u = (i / s) * Math.PI * 2, v = (j / s) * Math.PI * 2;
            let x, y;
            if (u < Math.PI) { x = (2.5 - 1.5 * Math.cos(u)) * sc * Math.cos(v) * 6; y = (2.5 - 1.5 * Math.cos(u)) * sc * Math.sin(v) * 6; }
            else { x = (-2 + (2 + Math.cos(v)) * Math.cos(u)) * sc * 6; y = (2 + Math.cos(v)) * Math.sin(u) * sc * 6; }
            verts.push(x, y, -Math.sin(v) * (2.5 - 1.5 * Math.cos(u)) * sc * 3);
        }
        for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) { const a = i * (s + 1) + j; indices.push(a, a + 1, a + s + 1, a + 1, a + s + 2, a + s + 1); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices); geo.computeVertexNormals(); return geo;
    },

    _subdivide(geo, iter) {
        let cur = geo;
        for (let it = 0; it < iter; it++) {
            const pos = cur.attributes.position, idx = cur.index ? cur.index.array : null;
            if (!idx) break;
            const nv = [];
            for (let i = 0; i < idx.length; i += 3) {
                const a = [pos.getX(idx[i]), pos.getY(idx[i]), pos.getZ(idx[i])];
                const b = [pos.getX(idx[i + 1]), pos.getY(idx[i + 1]), pos.getZ(idx[i + 1])];
                const c = [pos.getX(idx[i + 2]), pos.getY(idx[i + 2]), pos.getZ(idx[i + 2])];
                const ab = a.map((v, k) => (v + b[k]) / 2), bc = b.map((v, k) => (v + c[k]) / 2), ca = c.map((v, k) => (v + a[k]) / 2);
                nv.push(...a, ...ab, ...ca, ...ab, ...b, ...bc, ...ca, ...bc, ...c, ...ab, ...bc, ...ca);
            }
            const ng = new THREE.BufferGeometry();
            ng.setAttribute('position', new THREE.Float32BufferAttribute(nv, 3));
            ng.computeVertexNormals();
            if (cur !== geo) cur.dispose();
            cur = ng;
            if (cur.attributes.position.count > 20000) break;
        }
        return cur;
    },

    // ── PALETTE ──
    getPaletteColor(palette, t, rms) {
        const c = this._tempColor || (this._tempColor = new THREE.Color());
        switch (palette) {
            case 'void': return c.setHSL(0.75 + t * 0.1, 0.3, 0.05 + t * 0.15 + rms * 0.1);
            case 'solar': return c.setHSL(0.08 + t * 0.06, 1, 0.3 + t * 0.3 + rms * 0.2);
            case 'ocean': return c.setHSL(0.5 + t * 0.15, 0.8, 0.2 + t * 0.3 + rms * 0.2);
            case 'toxic': return c.setHSL(0.25 + t * 0.1, 1, 0.2 + t * 0.4 + rms * 0.2);
            case 'nebula': return c.setHSL(0.7 + t * 0.25, 0.9, 0.2 + t * 0.4 + rms * 0.2);
            case 'aurora': return c.setHSL(0.3 + t * 0.2, 0.9, 0.3 + t * 0.3 + rms * 0.2);
            case 'fire': { const h = 0.02 + t * 0.08; return c.setHSL(h, 1, 0.3 + t * 0.4 + rms * 0.2); }
            case 'ice': return c.setHSL(0.55 + t * 0.1, 0.7, 0.4 + t * 0.3 + rms * 0.2);
            case 'cyber': return c.setHSL(0.75 + t * 0.15, 1, 0.3 + t * 0.4 + rms * 0.3);
            case 'sunset': return c.setHSL(0.02 + t * 0.12, 0.95, 0.25 + t * 0.35 + rms * 0.2);
            case 'acid': return c.setHSL(0.2 + t * 0.15, 1, 0.35 + t * 0.4 + rms * 0.25);
            case 'midnight': return c.setHSL(0.65 + t * 0.05, 0.4 + t * 0.5, 0.1 + t * 0.5 + rms * 0.2);
            case 'lava': return c.setHSL(0.0 + t * 0.08, 1, 0.1 + t * 0.5 + rms * 0.2);
            default: return ParamSystem.getColorThreeHSL(t);
        }
    },

    // ── INIT ──
    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);
        this.time = 0; this.ghosts = []; this.mirrorMeshes = [];
        this.currentShape = ''; this.currentDetail = -1; this.currentSize = -1;
        this.morphing = false; this.morphTargetBase = null;
        this._dropTriggeredThisDrop = false;
        this._tempColor = new THREE.Color();
        this._tempVec3 = new THREE.Vector3();
        this._rotWrapCounter = 0;
        this._sectionDisplaceMode = null;
        this._fakeoutLock = false;
        this._prevPositions = null; // for velocity-based vertex color
        this._scatterPhase = 0; // for scatter drop effect
        this._invertSpacePhase = 0; // for invertSpace drop effect
        this._emissivePulse = 0; // emissive glow pulse
        this.buildGeometry('icosahedron', 3, 25);
        this.initParticles();
    },

    buildGeometry(shape, detail, size) {
        ['meshSolid', 'meshWire', 'meshInnerWire', 'meshPoints'].forEach(k => {
            if (this[k]) { this.group.remove(this[k]); this[k].geometry.dispose(); this[k].material.dispose(); this[k] = null; }
        });
        this.ghosts.forEach(g => { this.group.remove(g); g.geometry.dispose(); g.material.dispose(); });
        this.ghosts = [];
        this.clearMirrors();
        this.currentShape = shape; this.currentDetail = detail; this.currentSize = size;

        const geo = this.getGeometry(shape, detail, size);
        this.basePositions = new Float32Array(geo.attributes.position.array);
        geo.computeVertexNormals();
        this.normals = new Float32Array(geo.attributes.normal.array);
        const vc = geo.attributes.position.count;
        const cols = new Float32Array(vc * 3).fill(1);
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        this.vertexColors = cols;

        this.meshSolid = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.meshSolid.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cols), 3));
        this.group.add(this.meshSolid);

        // Build wireframe from meshSolid.geometry (not the soon-disposed geo)
        this.meshWire = new THREE.LineSegments(new THREE.WireframeGeometry(this.meshSolid.geometry), new THREE.LineBasicMaterial({
            color: 0x8b5cf6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
        }));
        this.group.add(this.meshWire);

        this.meshInnerWire = new THREE.LineSegments(new THREE.WireframeGeometry(this.meshSolid.geometry), new THREE.LineBasicMaterial({
            color: 0xff5cf6, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending
        }));
        this.meshInnerWire.scale.setScalar(0.85); this.meshInnerWire.visible = false;
        this.group.add(this.meshInnerWire);

        this.meshPoints = new THREE.Points(geo.clone(), new THREE.PointsMaterial({
            size: 2.5, vertexColors: true, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        this.meshPoints.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(cols), 3));
        this.group.add(this.meshPoints);
        geo.dispose();
    },

    initParticles() {
        const c = this.maxTrailParticles;
        const geo = new THREE.BufferGeometry();
        this.particlePositions = new Float32Array(c * 3);
        this.particleColors = new Float32Array(c * 3);
        this.particleVelocities = [];
        for (let i = 0; i < c; i++) { this.particleVelocities.push({ x: 0, y: 0, z: 0, life: 0 }); }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.particlePositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.particleColors, 3));
        this.particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
        }));
        this.group.add(this.particleSystem);
    },

    clearMirrors() {
        this.mirrorMeshes.forEach(m => { if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); });
        this.mirrorMeshes = [];
    },

    triggerMorph(targetShape) {
        const shapes = [
            'icosahedron', 'dodecahedron', 'octahedron', 'tetrahedron', 'torus', 'torusKnot',
            'sphere', 'cube', 'cone', 'cylinder', 'heart', 'star', 'crystal', 'mobius', 'klein',
            'hyperboloid', 'trefoilKnot', 'gyroid', 'seashell', 'spiralSphere',
            'stellatedOcta', 'romanSurface', 'crossCap', 'catenoid', 'helicoid',
            'diniSurface', 'boysSurface', 'astroid', 'menger', 'calabi'
        ];
        let next;
        if (targetShape && targetShape !== 'random') {
            next = targetShape;
        } else {
            do { next = shapes[Math.floor(Math.random() * shapes.length)]; } while (next === this.currentShape);
        }
        const tGeo = this.getGeometry(next, this.currentDetail, this.currentSize);
        this.morphTargetBase = new Float32Array(tGeo.attributes.position.array);
        tGeo.dispose();
        this.morphProgress = 0; this.morphing = true;
    },

    // ── SURFACE PATTERN ──
    getPattern(type, u, v, time) {
        switch (type) {
            case 'checker': return (Math.floor(u * 10) + Math.floor(v * 10)) % 2 ? 1.5 : 0.5;
            case 'stripe': return Math.sin(u * 20 + time) * 0.5 + 1;
            case 'spiral': return Math.sin((Math.atan2(v - 0.5, u - 0.5) + Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2) * 10) + time * 2) * 0.5 + 1;
            case 'hex': return Math.sin(u * 12) * Math.sin(v * 12 + u * 6) > 0 ? 1.3 : 0.7;
            case 'dots': return Math.sin(u * 15) * Math.sin(v * 15) > 0.5 ? 1.5 : 0.8;
            case 'waves': return Math.sin(u * 8 + time * 2) * Math.sin(v * 8 - time * 1.5) * 0.5 + 1;
            case 'voronoiPat': {
                let minD = 10;
                for (let ci = 0; ci < 7; ci++) {
                    const cx = Math.sin(ci * 2.14 + time * 0.3) * 0.5 + 0.5;
                    const cy = Math.cos(ci * 3.77 + time * 0.2) * 0.5 + 0.5;
                    const dd = Math.sqrt((u - cx) ** 2 + (v - cy) ** 2);
                    if (dd < minD) minD = dd;
                }
                return 0.5 + minD * 3;
            }
            case 'fractalNoise': {
                let fn = 0, fa = 1, ff = 4;
                for (let fi = 0; fi < 4; fi++) { fn += Math.sin(u * ff + time) * Math.cos(v * ff - time * 0.7) * fa; fa *= 0.5; ff *= 2.1; }
                return 0.7 + fn * 0.5;
            }
            default: return 1;
        }
    },

    // ── MAIN UPDATE ──
    update(audio, params, dt) {
        if (!this.group || !this.meshSolid) return;
        this.time += dt;
        const react = params.reactivity ?? 1.5, shape = params.shape ?? 'icosahedron';
        const detail = Math.floor(params.detail ?? 3), size = params.size ?? 25;
        const palette = params.colorPalette ?? 'default';

        // Rebuild
        if (shape !== this.currentShape || detail !== this.currentDetail || size !== this.currentSize) {
            this.buildGeometry(shape, detail, size);
        }

        // Drop effects — only trigger ONCE per drop, not on every bass beat
        // Responds to BOTH marker-set drops AND auto-detected energy drops
        const isDropping = audio.isDropSection;
        const dropLevel = (audio.dropSectionIntensity || 1) * (params.dropIntensityMult || 1.5);
        if (isDropping && audio.bassBeat && !this._dropTriggeredThisDrop) {
            this._dropTriggeredThisDrop = true;
            const eff = params.dropEffect || 'morph';
            if ((eff === 'morph' || eff === 'all') && !this.morphing) this.triggerMorph(params.dropMorphTarget || 'random');
            if (eff === 'explode' || eff === 'all') this.explodePhase = Math.min(this.explodePhase + 1 * dropLevel, 1.5);
            if (eff === 'glitch' || eff === 'all') this.group.rotation.z += 0.05 * dropLevel;
            if (eff === 'scatter' || eff === 'all') this._scatterPhase = Math.min(1.0, dropLevel);
            if (eff === 'invertSpace' || eff === 'all') this._invertSpacePhase = Math.min(1.0, dropLevel);
            this._emissivePulse = 1.0; // flash on any drop
        }
        if (!isDropping) this._dropTriggeredThisDrop = false;

        // Drop displacement/color override flags
        const _dropDisplaceActive = (isDropping && params.dropDisplaceOverride && params.dropDisplaceOverride !== 'off') ? params.dropDisplaceOverride : null;
        const _dropColorActive = (isDropping && params.dropColorOverride && params.dropColorOverride !== 'off') ? params.dropColorOverride : null;
        // Decay scatter and invertSpace phases
        if (this._scatterPhase > 0) this._scatterPhase *= 0.94;
        if (this._invertSpacePhase > 0) this._invertSpacePhase *= 0.92;
        if (this._emissivePulse > 0) this._emissivePulse *= 0.93;

        // Displacement (drop override supported)
        const dMode = _dropDisplaceActive || (params.displaceMode ?? 'frequency');
        const dAmt = (params.displaceAmount ?? 12) * react * (_dropDisplaceActive ? (params.dropIntensityMult || 1.5) : 1);
        const dFreq = params.displaceFreq ?? 3, nScale = params.noiseScale ?? 2, oct = Math.floor(params.noiseOctaves ?? 3);
        const bass = audio.smoothBands.bass, sub = audio.smoothBands.sub, mid = audio.smoothBands.mid;
        const treble = audio.smoothBands.treble, rms = audio.rms;
        const symMode = params.symmetryMode ?? 'off';
        const patternType = params.surfacePattern ?? 'none';
        const pulse = params.pulseRate > 0 ? Math.sin(this.time * params.pulseRate) * 0.2 + 1 : 1;

        // Beat — beat-phase-driven pulse for rhythmic feel
        if (audio.bassBeat && params.beatExplode > 0) this.explodePhase += audio.bassBeatIntensity * params.beatExplode * 0.12; // was 0.3
        this.explodePhase = Math.min(this.explodePhase, 1.5); // hard cap — was unbounded
        this.explodePhase *= 0.92; // faster decay — was 0.88
        // Use beatPhase for rhythmic breathing instead of raw amplitude
        const beatPulse = Math.sin(audio.beatPhase * Math.PI * 2) * 0.5 + 0.5;
        const breathScale = (1 + (sub + bass) * (params.bassBreath ?? 2) * react * 0.2 + beatPulse * bass * react * 0.15) * pulse;
        let beatScale = 1;
        if (params.beatShrink && audio.beat) beatScale = 1 - audio.beatIntensity * 0.2;
        const chromatic = params.chromaticSplit ?? 0;

        const solidPos = this.meshSolid.geometry.attributes.position.array;
        const solidCol = this.meshSolid.geometry.attributes.color.array;
        const vertCount = this.basePositions.length / 3;
        const vcMode = _dropColorActive || (params.vertexColorMode ?? 'frequency');

        for (let i = 0; i < vertCount; i++) {
            const i3 = i * 3;
            let bx = this.basePositions[i3], by = this.basePositions[i3 + 1], bz = this.basePositions[i3 + 2];

            // Morphing (fixed: store target separately)
            if (this.morphing && this.morphTargetBase) {
                const mi3 = i3 % this.morphTargetBase.length;
                const mt = Math.min(1, this.morphProgress);
                const sm = mt * mt * (3 - 2 * mt); // smooth hermite
                bx = bx * (1 - sm) + (this.morphTargetBase[mi3] || 0) * sm;
                by = by * (1 - sm) + (this.morphTargetBase[mi3 + 1] || 0) * sm;
                bz = bz * (1 - sm) + (this.morphTargetBase[mi3 + 2] || 0) * sm;
            }

            let nx = this.normals[i3] || 0, ny = this.normals[i3 + 1] || 0, nz = this.normals[i3 + 2] || 0;
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;

            const t = i / vertCount;
            const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;
            let disp = 0;

            // Symmetry
            let sx = bx, sy = by, sz = bz;
            if (symMode === 'x' || symMode === 'xy' || symMode === 'xyz') sx = Math.abs(bx);
            if (symMode === 'y' || symMode === 'xy' || symMode === 'xyz') sy = Math.abs(by);
            if (symMode === 'z' || symMode === 'xyz') sz = Math.abs(bz);

            switch (dMode) {
                case 'frequency': disp = freq * dAmt; break;
                case 'noise': disp = this.fbm(sx * 0.05 * nScale + this.time * 0.5, sy * 0.05 * nScale + this.time * 0.3, sz * 0.05 * nScale, oct) * dAmt * (0.3 + bass * 2); break;
                case 'spike': disp = Math.pow(freq, 3) * dAmt * 3 * (1 + audio.bassBeatIntensity * 3); break;
                case 'breathe': disp = Math.sin(this.time * dFreq + t * Math.PI * 4) * dAmt * 0.5 * (0.3 + (audio.rawBands?.bass || bass) * 3); break;
                case 'ripple': { const d2 = Math.sqrt(sx * sx + sy * sy + sz * sz) / size; disp = Math.sin(d2 * dFreq * 5 - this.time * 5) * dAmt * 0.5 * (0.2 + bass * 3); break; }
                case 'shatter': disp = this.noise3D(sx + this.time * 2, sy + this.time, sz) * dAmt * (0.2 + freq * 2 + audio.bassBeatIntensity * 5); break;
                case 'twist': { const a = sy * dFreq * 0.1 + this.time * 2; const tw = (bass + mid) * dAmt * 0.1 * react; bx += Math.cos(a) * tw; bz += Math.sin(a) * tw; break; }
                case 'melt': { const mf = (sub + bass) * dAmt * 0.3 * react; by -= Math.max(0, (1 - (by / size + 0.5)) * mf); disp = this.fbm(sx * 0.1, sy * 0.1, this.time, 2) * mf * 0.3; break; }
                case 'waveform': { const wi = Math.floor(t * audio.waveformPoints.length); disp = (audio.waveformPoints[wi] || 0) * dAmt * 2; break; }
                case 'pulse': { const d2 = Math.sqrt(sx * sx + sy * sy + sz * sz); disp = Math.sin(d2 * 0.3 - this.time * 8) * 0.5 * dAmt * (0.1 + audio.bassBeatIntensity * 3 + bass * 2); break; }
                case 'glitch': { if (Math.random() < (audio.beat ? 0.3 : 0.02)) disp = (Math.random() - 0.5) * dAmt * 4; break; }
                case 'fractal': { const f1 = this.fbm(sx * 0.03 + this.time * 0.2, sy * 0.03, sz * 0.03, oct); const f2 = this.fbm(sx * 0.06, sy * 0.06 + this.time * 0.3, sz * 0.06, oct); disp = f1 * f2 * 4 * dAmt * (0.3 + bass * 2); break; }
                case 'magnetic': { const phi = Math.atan2(sz, sx); const r2 = Math.sqrt(sx * sx + sz * sz); disp = (Math.sin(phi * 3 + this.time * 2) * Math.cos(sy * 0.2 + this.time)) * dAmt * (0.3 + bass * 2) * freq; break; }
                case 'cellular': { const cx = Math.floor(sx * 0.2 + this.time), cy = Math.floor(sy * 0.2), cz = Math.floor(sz * 0.2); disp = this.noise3D(cx, cy, cz) * dAmt * freq * (0.5 + bass * 2); break; }
                case 'orbit': { const angle = Math.atan2(sz, sx) + this.time * dFreq * 0.3; const r3 = Math.sqrt(sx * sx + sz * sz); bx = Math.cos(angle) * r3; bz = Math.sin(angle) * r3; disp = freq * dAmt * 0.3; break; }
                case 'harmonics': { let h = 0; for (let n = 1; n <= 5; n++) { const bn = (audio.frequencyData[Math.floor(n * 30)] || 0) / 255; h += bn * Math.sin(n * Math.acos(Math.max(-1, Math.min(1, sy / (size || 1))))) * Math.cos(n * Math.atan2(sz, sx)); } disp = h * dAmt; break; }
                // ── NEW MODES ──
                case 'voronoi': {
                    let minD = 999, minD2 = 999;
                    for (let ci = 0; ci < 6; ci++) {
                        const cx = Math.sin(ci * 1.618 + this.time * 0.4) * size * 0.6;
                        const cy = Math.cos(ci * 2.618 + this.time * 0.3) * size * 0.6;
                        const cz = Math.sin(ci * 0.618 + this.time * 0.5) * size * 0.6;
                        const dd = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2 + (sz - cz) ** 2);
                        if (dd < minD) { minD2 = minD; minD = dd; } else if (dd < minD2) { minD2 = dd; }
                    }
                    disp = (minD2 - minD) * dAmt * 0.15 * (0.5 + bass * 2);
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
                case 'tentacle': {
                    const phi = Math.atan2(sz, sx);
                    const r = Math.sqrt(sx * sx + sz * sz);
                    const tentCount = 6;
                    let tentForce = 0;
                    for (let ti = 0; ti < tentCount; ti++) {
                        const ta = (ti / tentCount) * Math.PI * 2 + this.time * 0.3;
                        const diff = Math.abs(((phi - ta + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
                        tentForce += Math.max(0, 1 - diff * 1.5) * (0.5 + bass * 2);
                    }
                    disp = tentForce * dAmt * 0.4 * (sy / size + 1) * freq;
                    break;
                }
                case 'interference': {
                    const w1 = Math.sin(sx * 0.3 + this.time * 2) * Math.sin(sy * 0.35 - this.time * 1.5);
                    const w2 = Math.sin(sz * 0.25 + this.time * 1.8) * Math.cos(sx * 0.2 + this.time);
                    const w3 = Math.cos(sy * 0.4 + this.time * 2.5) * Math.sin(sz * 0.3 - this.time * 0.7);
                    disp = (w1 + w2 + w3) * dAmt * 0.4 * (0.3 + freq * 1.5 + bass);
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
                case 'audio3D': {
                    const bFreq = (audio.frequencyData[Math.floor(t * 30)] || 0) / 255;
                    const mFreq = (audio.frequencyData[Math.floor(t * 80 + 30)] || 0) / 255;
                    const tFreq = (audio.frequencyData[Math.floor(t * 50 + 100)] || 0) / 255;
                    bx += nx * bFreq * dAmt * 0.5;
                    by += ny * mFreq * dAmt * 0.5;
                    bz += nz * tFreq * dAmt * 0.5;
                    disp = (bFreq + mFreq + tFreq) * dAmt * 0.2;
                    break;
                }
                case 'gravityWell': {
                    let totalForce = 0;
                    for (let wi = 0; wi < 3; wi++) {
                        const wa = (wi / 3) * Math.PI * 2 + this.time * 0.3;
                        const wx = Math.cos(wa) * size * 0.5, wz = Math.sin(wa) * size * 0.5;
                        const ddx = sx - wx, ddz = sz - wz;
                        const d2 = Math.sqrt(ddx * ddx + sy * sy + ddz * ddz) + 0.5;
                        totalForce += bass * 20 / (d2 * d2 + 1);
                    }
                    disp = totalForce * dAmt * 0.15;
                    break;
                }
                case 'jellyfish': {
                    const yNorm = (sy / size + 1) * 0.5; // 0=bottom 1=top
                    const bellPulse = Math.sin(this.time * 2 + yNorm * Math.PI * 3) * (1 - yNorm);
                    const tentDrip = yNorm < 0.3 ? Math.sin(this.time * 4 + t * 20) * (0.3 - yNorm) * 3 : 0;
                    disp = (bellPulse * 1.5 + tentDrip) * dAmt * 0.4 * (0.3 + bass * 2 + sub);
                    break;
                }
            }

            disp += this.explodePhase * 2;
            // Scatter: random vertex displacement
            if (this._scatterPhase > 0.01) {
                bx += this.noise3D(bx + this.time * 10, by, bz) * this._scatterPhase * size * 0.8;
                by += this.noise3D(by, bz + this.time * 10, bx) * this._scatterPhase * size * 0.8;
                bz += this.noise3D(bz, bx, by + this.time * 10) * this._scatterPhase * size * 0.8;
            }
            // InvertSpace: displacement inverts 
            if (this._invertSpacePhase > 0.05) {
                disp *= (1 - this._invertSpacePhase * 2);
            }
            const gravAmt = (params.gravity ?? 0) * react;
            const scale = breathScale * beatScale;
            const patMod = this.getPattern(patternType, t, i / vertCount, this.time);

            solidPos[i3] = (bx + nx * disp * patMod) * scale + (chromatic > 0 ? Math.sin(t * 6.28 + this.time) * chromatic * freq : 0);
            solidPos[i3 + 1] = (by + ny * disp * patMod) * scale - gravAmt * t * 0.5;
            solidPos[i3 + 2] = (bz + nz * disp * patMod) * scale + (chromatic > 0 ? Math.cos(t * 6.28 + this.time) * chromatic * freq : 0);

            // Vertex colors
            if (vcMode !== 'off') {
                let r = 1, g = 1, b = 1;
                switch (vcMode) {
                    case 'frequency': { const c = this.getPaletteColor(palette, freq, rms); r = c.r; g = c.g; b = c.b; break; }
                    case 'height': { const h2 = (solidPos[i3 + 1] / (size * 2) + 0.5); const c = this.getPaletteColor(palette, h2, rms); r = c.r; g = c.g; b = c.b; break; }
                    case 'distance': { const d3 = Math.sqrt(solidPos[i3] ** 2 + solidPos[i3 + 1] ** 2 + solidPos[i3 + 2] ** 2) / (size * 2); const c = this.getPaletteColor(palette, d3, rms); r = c.r; g = c.g; b = c.b; break; }
                    case 'rainbow': { const c = (this._tempColor || new THREE.Color()).setHSL((t + this.time * 0.1) % 1, 0.9, 0.5 + rms * 0.3); r = c.r; g = c.g; b = c.b; break; }
                    case 'bands': { const bn = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance']; const bi = Math.floor(t * 7); const bv = audio.smoothBands[bn[bi]] || 0; const c = this.getPaletteColor(palette, bv + bi / 7, rms); r = c.r; g = c.g; b = c.b; break; }
                    case 'plasma': { r = Math.sin(t * 10 + this.time) * 0.5 + 0.5; g = Math.sin(t * 10 + this.time * 1.3 + 2) * 0.5 + 0.5; b = Math.sin(t * 10 + this.time * 0.7 + 4) * 0.5 + 0.5; break; }
                    case 'thermal': { const th = freq * 0.6 + rms * 0.4; r = Math.min(1, th * 2); g = th * 0.6; b = th * 0.1; break; }
                    case 'pattern': { const pv = patMod; const c = this.getPaletteColor(palette, pv * 0.5 + freq * 0.5, rms); r = c.r; g = c.g; b = c.b; break; }
                    case 'displacement': {
                        const dNorm = Math.min(1, Math.abs(disp) / (dAmt + 0.01));
                        const c = this.getPaletteColor(palette, dNorm, rms);
                        r = c.r; g = c.g; b = c.b; break;
                    }
                    case 'velocity': {
                        if (this._prevPositions) {
                            const dx = solidPos[i3] - this._prevPositions[i3];
                            const dy = solidPos[i3 + 1] - this._prevPositions[i3 + 1];
                            const dz = solidPos[i3 + 2] - this._prevPositions[i3 + 2];
                            const vel = Math.sqrt(dx * dx + dy * dy + dz * dz);
                            const c = this.getPaletteColor(palette, Math.min(1, vel * 2), rms);
                            r = c.r; g = c.g; b = c.b;
                        }
                        break;
                    }
                    case 'waveformColor': {
                        const wi2 = Math.floor(t * (audio.waveformPoints?.length || 256));
                        const wv = (audio.waveformPoints?.[wi2] || 0) * 0.5 + 0.5;
                        const c = this.getPaletteColor(palette, wv, rms);
                        r = c.r; g = c.g; b = c.b; break;
                    }
                }
                solidCol[i3] = r; solidCol[i3 + 1] = g; solidCol[i3 + 2] = b;
            }
        }

        // Store positions for velocity vertex color mode
        if (!this._prevPositions || this._prevPositions.length !== solidPos.length) {
            this._prevPositions = new Float32Array(solidPos.length);
        }
        this._prevPositions.set(solidPos);

        // Morph progress (fixed: don't overwrite base with displaced positions)
        if (this.morphing) {
            this.morphProgress += dt * 2;
            if (this.morphProgress >= 1) {
                this.morphing = false;
                this.basePositions = new Float32Array(this.morphTargetBase);
                this.morphTargetBase = null;
                // Write clean base positions back before computing normals
                const geo = this.meshSolid.geometry;
                geo.attributes.position.array.set(this.basePositions);
                geo.attributes.position.needsUpdate = true;
                geo.computeVertexNormals();
                this.normals = new Float32Array(geo.attributes.normal.array);
            }
        }

        this.meshSolid.geometry.attributes.position.needsUpdate = true;
        this.meshSolid.geometry.attributes.color.needsUpdate = true;
        // Skip computeVertexNormals() per frame — normals are recomputed on topology change only

        // Sync wireframe positions instead of rebuilding WireframeGeometry every frame
        if (this.meshWire && this.meshWire.geometry.attributes.position) {
            // Copy displaced positions to wireframe
            const wirePos = this.meshWire.geometry.attributes.position.array;
            const solidLen = solidPos.length;
            const wireLen = wirePos.length;
            // WireframeGeometry has different vertex count; rebuild only on topology change
            // Just set needsUpdate to refresh visual with existing topology
            this.meshWire.geometry.attributes.position.needsUpdate = true;
        }
        if (this.meshInnerWire && this.meshInnerWire.geometry.attributes.position) {
            this.meshInnerWire.geometry.attributes.position.needsUpdate = true;
        }
        if (this.meshPoints) {
            this.meshPoints.geometry.attributes.position.array.set(solidPos);
            this.meshPoints.geometry.attributes.position.needsUpdate = true;
            this.meshPoints.geometry.attributes.color.array.set(solidCol);
            this.meshPoints.geometry.attributes.color.needsUpdate = true;
        }

        // Visibility
        this.meshSolid.visible = params.showSolid;
        this.meshWire.visible = params.showWireframe;
        this.meshInnerWire.visible = params.showInnerWire;
        this.meshPoints.visible = params.showPoints;

        // Materials
        // Emissive glow: pulses with bass and flashes on drops
        const emGlow = Math.min(1, bass * 0.3 + this._emissivePulse * 0.6);
        this.meshSolid.material.opacity = Math.min(0.85, (params.solidOpacity ?? 0.35) * (0.7 + bass * 0.6) + this._emissivePulse * 0.3);
        // ...wire color logic below...
        const wc = params.wireColor ?? 'palette';
        if (wc === 'palette') this.meshWire.material.color = ParamSystem.getColorThree(rms + this.time * 0.1);
        else if (wc === 'rainbow') this.meshWire.material.color.setHSL((this.time * 0.2) % 1, 0.9, 0.6 + rms * 0.3);
        else if (wc === 'neon') this.meshWire.material.color.setHSL(0.8 + bass * 0.2, 1, 0.5 + rms * 0.4);
        else if (wc === 'fire') this.meshWire.material.color.setHSL(0.05 + bass * 0.08, 1, 0.4 + rms * 0.4);
        else if (wc === 'ice') this.meshWire.material.color.setHSL(0.55 + treble * 0.1, 0.7, 0.5 + rms * 0.3);
        else if (wc === 'void') this.meshWire.material.color.setHSL(0.75, 0.2, 0.15 + rms * 0.2);
        else if (wc === 'pulse') {
            const pulseFlash = audio.bassBeat ? 1 : (0.3 + rms * 0.4);
            this.meshWire.material.color.setHSL((this.time * 0.1) % 1, 0.9, 0.3 + pulseFlash * 0.5);
        }
        else if (wc === 'spectrum') {
            // Map frequency spectrum across wire hue
            const specHue = (rms + bass * 0.3 + treble * 0.2 + this.time * 0.02) % 1;
            this.meshWire.material.color.setHSL(specHue, 1, 0.4 + rms * 0.4);
        }
        else if (wc === 'complementary') {
            const baseHue = (this.time * 0.05 + rms * 0.3) % 1;
            this.meshWire.material.color.setHSL((baseHue + 0.5) % 1, 0.9, 0.45 + rms * 0.35);
        }
        else this.meshWire.material.color.setRGB(1, 1, 1);
        this.meshWire.material.opacity = (params.wireOpacity ?? 0.9) * (0.5 + rms);

        this.meshInnerWire.material.color = ParamSystem.getColorThree(treble + this.time * 0.15);
        this.meshInnerWire.material.opacity = 0.2 + bass * 0.3;
        // Inner wire breathes with treble independently
        const innerBreath = 0.85 + treble * 0.15 + Math.sin(this.time * 1.5) * 0.03;
        this.meshInnerWire.scale.setScalar(innerBreath);
        // Audio-reactive point sizes
        this.meshPoints.material.size = (params.pointSize ?? 2.5) * (1 + bass * 2 + this._emissivePulse);

        // Rotation
        const rotMode = params.autoRotateMode ?? 'smooth';
        const rx = (params.rotSpeedX ?? 0.3) * (1 + mid * react), ry = (params.rotSpeedY ?? 0.5) * (1 + bass * react), rz = (params.rotSpeedZ ?? 0.1) * (1 + treble * react);
        if (rotMode === 'smooth') { this.group.rotation.x += rx * dt; this.group.rotation.y += ry * dt; this.group.rotation.z += rz * dt; }
        else if (rotMode === 'tumble') { this.group.rotation.x += rx * dt + Math.sin(this.time * 1.5) * 0.01; this.group.rotation.y += ry * dt + Math.cos(this.time * 1.2) * 0.01; this.group.rotation.z += rz * dt + Math.sin(this.time * 0.8) * 0.02; }
        else if (rotMode === 'orbit') { this.group.rotation.y += ry * dt; this.group.rotation.x = Math.sin(this.time * 0.5) * 0.3; this.group.rotation.z = Math.cos(this.time * 0.3) * 0.2; }
        else if (rotMode === 'wobble') { this.group.rotation.x = Math.sin(this.time * rx) * 0.5; this.group.rotation.y += ry * dt; this.group.rotation.z = Math.cos(this.time * rz) * 0.3; }
        else if (rotMode === 'spin') { this.group.rotation.y += ry * dt * 3; this.group.rotation.x += rx * dt * 0.5; }
        else if (rotMode === 'breatheRot') {
            this.group.rotation.x = Math.sin(this.time * 0.3 * rx) * 0.4;
            this.group.rotation.y += ry * dt * 0.2;
            this.group.rotation.z = Math.cos(this.time * 0.2 * rz) * 0.3;
            // Scale breathing
            const breathSc = 1 + Math.sin(this.time * 0.5) * 0.08 * (1 + bass);
            this.group.scale.setScalar(breathSc);
        }
        else if (rotMode === 'chaotic') {
            // Lorenz-inspired unpredictable but smooth rotation
            const lx = Math.sin(this.time * 0.7) * Math.cos(this.time * 0.3);
            const ly = Math.cos(this.time * 0.5) * Math.sin(this.time * 0.4);
            const lz = Math.sin(this.time * 0.6) * Math.cos(this.time * 0.8);
            this.group.rotation.x += (lx * rx + bass * 0.1) * dt;
            this.group.rotation.y += (ly * ry + mid * 0.1) * dt;
            this.group.rotation.z += (lz * rz + treble * 0.05) * dt;
        }
        else if (rotMode === 'beatLock') {
            // Snap to 90° increments on beat, smooth between
            const targetY = Math.floor(audio.beatPhase * 4) * Math.PI / 2;
            this.group.rotation.y += (targetY - this.group.rotation.y) * 0.12;
            this.group.rotation.x += rx * dt * 0.3;
            this.group.rotation.z = Math.sin(this.time * 0.3) * 0.15;
        }

        // Wrap rotation to prevent float32 precision loss over long sessions
        this._rotWrapCounter++;
        if (this._rotWrapCounter > 600) { // ~every 10 seconds at 60fps
            this._rotWrapCounter = 0;
            const TWO_PI = Math.PI * 2;
            this.group.rotation.x = this.group.rotation.x % TWO_PI;
            this.group.rotation.y = this.group.rotation.y % TWO_PI;
            this.group.rotation.z = this.group.rotation.z % TWO_PI;
        }

        // Beat spin burst — subtle, only on strong beats, single axis to avoid tumbling
        if (audio.bassBeat) {
            const burst = (params.beatSpinBurst ?? 0.3);
            const maxBurst = 0.04; // hard cap regardless of section — was 0.08/0.15
            // Only Y axis — keeps the shape upright and symmetrical
            this.group.rotation.y += Math.min(maxBurst, audio.bassBeatIntensity * 0.08 * burst);
        }
        // Drop decay: subtle Z tilt that resolves cleanly, much smaller coefficient
        if (audio.dropDecay > 0.3) this.group.rotation.z += audio.dropDecay * 0.02; // was 0.15

        // Reset scale for non-breatheRot modes
        if (rotMode !== 'breatheRot') this.group.scale.setScalar(1);

        // Ghost trail
        this.updateGhosts(params);

        // Particles
        if (params.emitParticles) { this.emitParticlesFromMesh(audio, params); this.particleSystem.visible = true; }
        else if (this.particleSystem) this.particleSystem.visible = false;

        // Mirrors
        this.updateMirrors(params, audio);
    },

    updateGhosts(params) {
        if (!params.ghostTrail) { this.ghosts.forEach(g => g.visible = false); return; }
        const count = Math.floor(params.ghostCount ?? 4);
        const style = params.trailStyle ?? 'ghost';
        while (this.ghosts.length < count) {
            const mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: style !== 'ribbon' });
            const ghost = new THREE.Mesh(this.meshSolid.geometry.clone(), mat);
            this.group.add(ghost); this.ghosts.push(ghost);
        }
        while (this.ghosts.length > count) { const g = this.ghosts.pop(); this.group.remove(g); g.geometry.dispose(); g.material.dispose(); }
        const spacing = params.ghostSpacing ?? 5;
        const solidPos = this.meshSolid.geometry.attributes.position.array;
        for (let i = 0; i < this.ghosts.length; i++) {
            const g = this.ghosts[i]; g.visible = true;
            const delay = (i + 1) * spacing;
            g.material.opacity = style === 'echo' ? 0.06 / (i + 1) : 0.12 / (i + 1);
            g.material.wireframe = style !== 'ribbon';
            g.rotation.x = this.group.rotation.x - delay * 0.02;
            g.rotation.y = this.group.rotation.y - delay * 0.02;
            g.rotation.z = this.group.rotation.z - delay * 0.01;
            const s = style === 'echo' ? 1 + (i + 1) * 0.06 : 1 + (i + 1) * 0.03;
            g.scale.setScalar(s);
            g.material.color.setHSL(((this.time * 0.1 + i * 0.15) % 1), 0.8, 0.5);
            // Sync ghost geometry with displaced positions
            if (g.geometry.attributes.position.count === solidPos.length / 3) {
                g.geometry.attributes.position.array.set(solidPos);
                g.geometry.attributes.position.needsUpdate = true;
            }
        }
    },

    emitParticlesFromMesh(audio, params) {
        if (!this.meshSolid || !this.particleSystem) return;
        const solidPos = this.meshSolid.geometry.attributes.position.array;
        const vertCount = solidPos.length / 3;
        const emitCount = audio.isDropSection ? 80 : (audio.bassBeat ? 40 : (audio.beat ? 15 : 3));
        const gravity = params.gravity ?? 0;
        this.group.updateMatrixWorld();
        const vec = this._tempVec3 || (this._tempVec3 = new THREE.Vector3());

        for (let e = 0; e < emitCount; e++) {
            let idx = -1;
            for (let i = 0; i < this.maxTrailParticles; i++) { if (this.particleVelocities[i].life <= 0) { idx = i; break; } }
            if (idx === -1) break;
            const vi = Math.floor(Math.random() * vertCount), vi3 = vi * 3;
            vec.set(solidPos[vi3], solidPos[vi3 + 1], solidPos[vi3 + 2]);
            vec.applyMatrix4(this.group.matrixWorld);
            this.particlePositions[idx * 3] = vec.x; this.particlePositions[idx * 3 + 1] = vec.y; this.particlePositions[idx * 3 + 2] = vec.z;
            const speed = (audio.bassBeatIntensity || 0.3) * 2.5;
            this.particleVelocities[idx] = { x: (Math.random() - 0.5) * speed, y: (Math.random() - 0.5) * speed + 0.5, z: (Math.random() - 0.5) * speed, life: 1.5 };
            const c = this.getPaletteColor(params.colorPalette ?? 'default', Math.random() + audio.rms, audio.rms);
            this.particleColors[idx * 3] = c.r; this.particleColors[idx * 3 + 1] = c.g; this.particleColors[idx * 3 + 2] = c.b;
        }
        for (let i = 0; i < this.maxTrailParticles; i++) {
            const v = this.particleVelocities[i]; if (v.life <= 0) continue;
            v.life -= 0.01; v.y -= gravity * 0.01; v.x *= 0.99; v.y *= 0.99; v.z *= 0.99;
            this.particlePositions[i * 3] += v.x; this.particlePositions[i * 3 + 1] += v.y; this.particlePositions[i * 3 + 2] += v.z;
            if (v.life <= 0) { this.particlePositions[i * 3] = 0; this.particlePositions[i * 3 + 1] = 0; this.particlePositions[i * 3 + 2] = 0; }
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
    },

    updateMirrors(params, audio) {
        const mode = params.mirrorMode ?? 'off';
        if (mode === 'off') { this.mirrorMeshes.forEach(m => m.visible = false); return; }
        const counts = { bilateral: 1, tri: 2, quad: 3, hex: 5, octa: 7 };
        const count = counts[mode] || 0; if (!count) return;
        const dist = (params.mirrorDistance ?? 30) * (1 + audio.smoothBands.bass * 0.5);
        while (this.mirrorMeshes.length < count) {
            const mat = new THREE.MeshBasicMaterial({ color: 0x5cf68b, transparent: true, opacity: 0.25, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true });
            const mesh = new THREE.Mesh(this.meshSolid.geometry.clone(), mat);
            this.group.parent.add(mesh); this.mirrorMeshes.push(mesh);
        }
        const solidPos = this.meshSolid.geometry.attributes.position.array;
        for (let i = 0; i < count; i++) {
            const m = this.mirrorMeshes[i]; m.visible = true;
            const angle = ((i + 1) / (count + 1)) * Math.PI * 2;
            m.position.x = Math.cos(angle + this.time * 0.2) * dist; m.position.y = Math.sin(angle * 0.5 + this.time * 0.1) * dist * 0.3; m.position.z = Math.sin(angle + this.time * 0.2) * dist;
            m.rotation.copy(this.group.rotation);
            if (i % 2 === 0) m.scale.x = -1; else m.scale.setScalar(0.7 + audio.smoothBands.treble * 0.5);
            m.material.color.setHSL((this.time * 0.05 + i * 0.12) % 1, 0.9, 0.5);
            m.material.opacity = 0.15 + audio.rms * 0.2;
            // Sync displaced positions to mirror
            if (m.geometry.attributes.position.array.length === solidPos.length) {
                m.geometry.attributes.position.array.set(solidPos);
                m.geometry.attributes.position.needsUpdate = true;
            }
        }
        for (let i = count; i < this.mirrorMeshes.length; i++) this.mirrorMeshes[i].visible = false;
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            scene.remove(this.group);
        }
        this.clearMirrors();
        this.meshSolid = null; this.meshWire = null; this.meshInnerWire = null; this.meshPoints = null;
        this.basePositions = null; this.ghosts = []; this.particleSystem = null; this.morphTargetBase = null; this.morphing = false;
    }
};