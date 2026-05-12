// ============================================================
// AURA — MathLib (v1)
// Shared mathematical primitives for all visual modes.
// Extracted from hyperforge/titanforge to eliminate ~8000 LOC
// of copy-paste duplication across 4+ mode files.
//
// All functions are static, stateless, and allocation-free.
// ============================================================

const MathLib = (() => {

    // ── NOISE ──
    // Fast pseudo-random hash-based 3D noise (non-Perlin, deterministic)
    function noise3D(x, y, z) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    }

    // ── FBM (Fractal Brownian Motion) ──
    function fbm(x, y, z, oct) {
        let v = 0, a = 1, f = 1, total = 0;
        for (let i = 0; i < oct; i++) {
            v     += noise3D(x * f, y * f, z * f) * a;
            total += a;
            a     *= 0.5;
            f     *= 2.1;
        }
        return v / total;
    }

    // ── SUPERFORMULA ──
    // Johan Gielis' Superformula — parametric shape generator
    function superformula(angle, m, n1, n2, n3) {
        const t1 = Math.abs(Math.cos(m * angle / 4));
        const t2 = Math.abs(Math.sin(m * angle / 4));
        const r  = Math.pow(Math.pow(t1, n2) + Math.pow(t2, n3), -1 / n1);
        return isFinite(r) ? r : 0;
    }

    // ── SURFACE GRID HELPER ──
    // Generates a parametric surface mesh from a UV mapping function.
    // fn(u, v) → [x, y, z]  where u,v ∈ [0,1]
    function buildGrid(seg, fn) {
        const verts = [], indices = [];
        for (let i = 0; i <= seg; i++) {
            for (let j = 0; j <= seg; j++) {
                const p = fn(i / seg, j / seg);
                verts.push(p[0], p[1], p[2]);
            }
        }
        for (let i = 0; i < seg; i++) {
            for (let j = 0; j < seg; j++) {
                const a = i * (seg + 1) + j;
                indices.push(a, a + 1, a + seg + 1, a + 1, a + seg + 2, a + seg + 1);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

    // ── OUTER SURFACE GENERATORS ──
    // Returns a THREE.BufferGeometry for the named parametric surface.
    // Consolidated from hyperforge/hyperforge2/hyperforge3/titanforge.
    function getOuterGeo(shape, seg, size, m, n1, n2, n3) {
        const sfSurface = () => buildGrid(seg, (u, v) => {
            const theta = u * Math.PI * 2 - Math.PI;
            const phi   = v * Math.PI - Math.PI / 2;
            const r1    = superformula(theta, m, n1, n2, n3);
            const r2    = superformula(phi,   m, n1, n2, n3);
            return [
                r1 * Math.cos(theta) * r2 * Math.cos(phi) * size,
                r1 * Math.sin(theta) * r2 * Math.cos(phi) * size,
                r2 * Math.sin(phi) * size,
            ];
        });

        switch (shape) {
            case 'superformula': return sfSurface();

            case 'lorenzSurface': {
                const RING = 7; // vertices per cross-section ring
                const verts = [], indices = [];
                let lx = 0.1, ly = 0, lz = 0;
                const dt2 = 0.005, pts = [];
                for (let i = 0; i < seg * 4; i++) {
                    const dx = 10 * (ly - lx) * dt2;
                    const dy = (lx * (28 - lz) - ly) * dt2;
                    const dz = (lx * ly - 2.666 * lz) * dt2;
                    lx += dx; ly += dy; lz += dz;
                    pts.push([lx, ly, lz]);
                }
                const s = size * 0.4;
                for (let i = 0; i < pts.length; i++) {
                    const p = pts[i];
                    for (let j = 0; j < RING; j++) {
                        const a = (j / RING) * Math.PI * 2;
                        const r = 0.5 + Math.sin(i * 0.05) * 0.3;
                        verts.push(p[0] * s + Math.cos(a) * r, p[2] * s * 0.3 + Math.sin(a) * r, p[1] * s);
                    }
                }
                for (let i = 0; i < pts.length - 1; i++) {
                    for (let j = 0; j < RING; j++) {
                        const a = i * RING + j;
                        const b = i * RING + (j + 1) % RING;
                        indices.push(a, b, a + RING, b, b + RING, a + RING);
                    }
                }
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
                geo.setIndex(indices);
                geo.computeVertexNormals();
                return geo;
            }

            case 'kleinBottle': return buildGrid(seg, (u, v) => {
                const a = u * Math.PI * 2, b = v * Math.PI * 2, s2 = size * 0.15;
                let x2, y2;
                if (a < Math.PI) {
                    x2 = (2.5 - 1.5 * Math.cos(a)) * s2 * Math.cos(b) * 6;
                    y2 = (2.5 - 1.5 * Math.cos(a)) * s2 * Math.sin(b) * 6;
                } else {
                    x2 = (-2 + (2 + Math.cos(b)) * Math.cos(a)) * s2 * 6;
                    y2 = (2 + Math.cos(b)) * Math.sin(a) * s2 * 6;
                }
                return [x2, y2, -Math.sin(b) * (2.5 - 1.5 * Math.cos(a)) * s2 * 3];
            });

            case 'catenoid': return buildGrid(seg, (u, v) => {
                const a = (u - 0.5) * 4, b = v * Math.PI * 2, s2 = size * 0.6;
                return [s2 * Math.cosh(a) * Math.cos(b), s2 * a * 2, s2 * Math.cosh(a) * Math.sin(b)];
            });

            case 'helicoid': return buildGrid(seg, (u, v) => {
                const a = (u - 0.5) * size * 2, b = v * Math.PI * 4;
                return [a * Math.cos(b), b * size * 0.15, a * Math.sin(b)];
            });

            case 'diniSurface': return buildGrid(seg, (u, v) => {
                const a2 = u * Math.PI * 4;
                // Clamp b2 away from 0 and π to prevent log(tan(0)) = -Infinity
                const b2 = Math.max(0.01, Math.min(Math.PI - 0.01, v * Math.PI));
                const s2 = size * 0.5;
                return [
                    s2 * Math.cos(a2) * Math.sin(b2),
                    s2 * (Math.cos(b2) + Math.log(Math.tan(b2 / 2)) + 0.2 * a2 * 0.1),
                    s2 * Math.sin(a2) * Math.sin(b2),
                ];
            });

            case 'enneperSurface': return buildGrid(seg, (u, v) => {
                const a2 = (u - 0.5) * 3, b2 = (v - 0.5) * 3, s2 = size * 0.3;
                return [
                    s2 * (a2 - a2 ** 3 / 3 + a2 * b2 * b2),
                    s2 * (b2 - b2 ** 3 / 3 + a2 * a2 * b2),
                    s2 * (a2 * a2 - b2 * b2),
                ];
            });

            case 'crossCap': return buildGrid(seg, (u, v) => {
                const a2 = u * Math.PI, b2 = v * Math.PI * 2;
                return [
                    size * Math.cos(a2) * Math.sin(2 * b2) * 0.5,
                    size * Math.sin(a2) * Math.sin(2 * b2) * 0.5,
                    size * (Math.cos(b2) ** 2 - Math.cos(a2) ** 2 * Math.sin(b2) ** 2) * 0.5,
                ];
            });

            case 'boysSurface': return buildGrid(seg, (u, v) => {
                const a2 = u * Math.PI, b2 = v * Math.PI * 2, s2 = size * 0.5;
                const sq2 = Math.SQRT2, ca = Math.cos(a2);
                const denom = (2 - sq2 * Math.sin(3 * b2) * Math.sin(2 * a2)) || 1;
                return [
                    s2 * (sq2 * ca * ca * Math.cos(2 * b2) + ca * Math.sin(b2)) / denom,
                    s2 * (sq2 * ca * ca * Math.sin(2 * b2) - ca * Math.cos(b2)) / denom,
                    s2 * 3 * ca * ca / denom,
                ];
            });

            case 'romanSurface': return buildGrid(seg, (u, v) => {
                const a2 = u * Math.PI, b2 = v * Math.PI * 2, s2 = size * 0.5;
                return [
                    s2 * Math.sin(2 * a2) * Math.cos(b2) ** 2,
                    s2 * Math.sin(a2) * Math.sin(2 * b2) / 2,
                    s2 * Math.cos(a2) * Math.sin(2 * b2) / 2,
                ];
            });

            case 'seiferSurface': return buildGrid(seg, (u, v) => {
                const a2 = (u - 0.5) * 4, b2 = v * Math.PI * 2, s2 = size * 0.3;
                const r2 = 1 + a2 * a2 * 0.1;
                return [s2 * r2 * Math.cos(b2), s2 * r2 * Math.sin(b2), s2 * a2 * 3 + s2 * Math.sin(b2 * 2) * a2 * 0.5];
            });

            case 'steinerian': return buildGrid(seg, (u, v) => {
                const a2 = (u - 0.5) * 2, b2 = (v - 0.5) * 2, s2 = size * 0.8;
                return [s2 * a2 * b2, s2 * a2 * (1 - b2 * b2), s2 * b2 * (1 - a2 * a2)];
            });

            case 'trefoilKnot': return buildGrid(seg, (u, v) => {
                const t2 = u * Math.PI * 2, w2 = (v - 0.5) * size * 0.12;
                const r2 = Math.cos(3 * t2) + 2;
                return [
                    (r2 * Math.cos(2 * t2) + w2 * Math.cos(2 * t2) * Math.cos(3 * t2)) * size * 0.25,
                    (r2 * Math.sin(2 * t2) + w2 * Math.sin(2 * t2) * Math.cos(3 * t2)) * size * 0.25,
                    (Math.sin(3 * t2) + w2 * Math.sin(3 * t2)) * size * 0.25,
                ];
            });

            case 'algebraicHorn': return buildGrid(seg, (u, v) => {
                const a2 = u * Math.PI * 2, b2 = v * Math.PI * 2, s2 = size * 0.3;
                return [
                    s2 * (2 + Math.cos(b2)) * Math.cos(a2) * (1 + u * 0.5),
                    s2 * (2 + Math.cos(b2)) * Math.sin(a2) * (1 + u * 0.5),
                    s2 * (Math.sin(b2) + u * 4),
                ];
            });

            case 'torusKnot':   return new THREE.TorusKnotGeometry(size * 0.7, size * 0.2, seg * 4, seg);
            case 'icosahedron': return new THREE.IcosahedronGeometry(size, 3);
            case 'sphere':      return new THREE.SphereGeometry(size, seg, seg);

            default:
                console.warn(`MathLib.getOuterGeo: unknown shape "${shape}", using superformula`);
                return sfSurface();
        }
    }

    // ── INNER SURFACE GENERATOR ──
    // Simplified surface for inner core meshes (lower detail)
    function getInnerGeo(shape, size) {
        if (shape === 'none') return null;
        if (shape === 'superformula') {
            return buildGrid(20, (u, v) => {
                const t = u * Math.PI * 2 - Math.PI, p = v * Math.PI - Math.PI / 2;
                const r1 = superformula(t, 4, 1, 1, 1), r2 = superformula(p, 4, 1, 1, 1);
                return [
                    r1 * Math.cos(t) * r2 * Math.cos(p) * size,
                    r1 * Math.sin(t) * r2 * Math.cos(p) * size,
                    r2 * Math.sin(p) * size,
                ];
            });
        }
        if (shape === 'torusKnot')   return new THREE.TorusKnotGeometry(size * 0.7, size * 0.15, 64, 12);
        if (shape === 'icosahedron') return new THREE.IcosahedronGeometry(size, 2);
        return new THREE.SphereGeometry(size, 20, 16);
    }

    // ── ATTRACTOR STEPPING FUNCTIONS ──
    // Dispatch table for strange attractor integration.
    // Each function: (x, y, z, dt, audioMod) → [dx, dy, dz]
    const attractors = {
        lorenz(x, y, z, dt, am) {
            const s = 10, rho = 28 * (1 + am), b = 2.666;
            return [s * (y - x) * dt, (x * (rho - z) - y) * dt, (x * y - b * z) * dt];
        },
        rossler(x, y, z, dt, am) {
            const a = 0.2, b = 0.2, c = 5.7 * (1 + am);
            return [(-y - z) * dt, (x + a * y) * dt, (b + z * (x - c)) * dt];
        },
        aizawa(x, y, z, dt, am) {
            const a = 0.95, b = 0.7, c = 0.6, d = 3.5 * (1 + am), e = 0.25, f = 0.1;
            return [
                ((z - b) * x - d * y) * dt,
                (d * x + (z - b) * y) * dt,
                (c + a * z - z ** 3 / 3 - (x * x + y * y) * (1 + e * z) + f * z * x ** 3) * dt,
            ];
        },
        thomas(x, y, z, dt, am) {
            const b = 0.208186 * (1 + am);
            return [(Math.sin(y) - b * x) * dt, (Math.sin(z) - b * y) * dt, (Math.sin(x) - b * z) * dt];
        },
        halvorsen(x, y, z, dt, am) {
            const a = 1.89 * (1 + am);
            return [
                (-a * x - 4 * y - 4 * z - y * y) * dt,
                (-a * y - 4 * z - 4 * x - z * z) * dt,
                (-a * z - 4 * x - 4 * y - x * x) * dt,
            ];
        },
        chen(x, y, z, dt, am) {
            const a = 35 * (1 + am), b = 3, c = 28;
            return [(a * (y - x)) * dt, ((c - a) * x - x * z + c * y) * dt, (x * y - b * z) * dt];
        },
        dadras(x, y, z, dt, am) {
            const a = 3, b = 2.7, c = 1.7, d = 2 * (1 + am), e = 9;
            return [(y - a * x + b * y * z) * dt, (c * y - x * z + z) * dt, (d * x * y - e * z) * dt];
        },
        sprott(x, y, z, dt, am) {
            const a = 2.07 * (1 + am), b = 1.79;
            return [(y + a * x * y + x * z) * dt, (1 - b * x * x + y * z) * dt, (x - x * x - y * y) * dt];
        },
    };

    // Unified step function with fallback
    function stepAttractor(type, x, y, z, dt, audioMod) {
        const fn = attractors[type];
        if (!fn) return [0, 0, 0];
        return fn(x, y, z, dt, audioMod);
    }

    // ── DISPLACEMENT FUNCTION BUILDER ──
    // Called ONCE per frame, returns a closure invoked per vertex.
    // Moving the switch outside the hot loop eliminates repeated branch evaluation.
    //
    // Returned fn signature:
    //   (sx, sy, sz, freq, vertIdx, vertCount, nx, ny, nz) => number
    function buildDisplaceFn(mode, audio, amt, speed, time, gravWellCount) {
        const bass     = audio.smoothBands.bass   || 0;
        const mid      = audio.smoothBands.mid    || 0;
        const treble   = audio.smoothBands.treble || 0;
        const freqData = audio.frequencyData;
        const waveform = audio.waveformPoints;
        const wells    = Math.floor(gravWellCount || 2);
        const t        = time;

        switch (mode) {
            case 'fourier':
                return (sx, sy, sz, freq) => {
                    const h1 = Math.sin(sx * 0.3 + t * speed) * freq;
                    const h2 = Math.sin(sy * 0.5 + t * speed * 0.7) * mid;
                    const h3 = Math.sin(sz * 0.2 + t * speed * 1.3) * treble;
                    return (h1 + h2 + h3) * amt;
                };
            case 'forceField':
                return (sx, sy, sz) => {
                    const d2 = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
                    return (bass * 20) / (d2 * d2 + 1) * amt * 0.3
                         + fbm(sx * 0.1, sy * 0.1, sz * 0.1 + t, 3) * amt * 0.3;
                };
            case 'vortex':
                return (sx, sy, sz, freq) => {
                    const a2 = Math.atan2(sz, sx) + t * speed;
                    const r2 = Math.sqrt(sx * sx + sz * sz);
                    return Math.sin(a2 * 3 + r2 * 0.2) * amt * freq;
                };
            case 'magnetic':
                return (sx, sy, sz, freq, _vi, _vc, nx, ny, nz) => {
                    return (Math.sin(sy * 0.3 + t) * nx + Math.cos(sx * 0.3 + t * 0.7) * nz) * amt * (0.5 + bass * 2);
                };
            case 'superposition':
                return (sx, sy, sz) => {
                    let w = 0;
                    for (let h = 1; h <= 5; h++) {
                        const bv = (freqData[Math.floor(h * 20)] || 0) / 255;
                        w += Math.sin(sx * h * 0.2 + sy * h * 0.15 + sz * h * 0.1 + t * speed * h * 0.5) * bv / h;
                    }
                    return w * amt * 2;
                };
            case 'turbulence':
                return (sx, sy, sz) =>
                    Math.abs(fbm(sx * 0.08 + t * speed * 0.3, sy * 0.08 + t * speed * 0.2, sz * 0.08, 4))
                    * amt * (0.5 + bass * 3);
            case 'audioSculpt':
                return (sx, sy, sz, freq, vi, vc) => {
                    const tNorm = vi / vc;
                    return freq * amt * 1.5 + (waveform[Math.floor(tNorm * 256)] || 0) * amt;
                };
            case 'reaction':
                return (sx, sy, sz, freq) => {
                    const rd = Math.sin(sx * 0.15 + t) * Math.cos(sy * 0.15 - t * 0.7)
                             + Math.sin(sz * 0.1 + t * 1.3);
                    return rd * amt * 0.3 * (0.3 + freq * 2 + bass * 2);
                };
            case 'gravitationalWell':
                return (sx, sy, sz) => {
                    let force = 0;
                    for (let w = 0; w < wells; w++) {
                        const wa = (w / wells) * Math.PI * 2 + t * 0.3;
                        const wx = Math.cos(wa) * 10, wz = Math.sin(wa) * 10;
                        const dx = sx - wx, dz = sz - wz;
                        const d2 = Math.sqrt(dx * dx + sy * sy + dz * dz) + 0.1;
                        force += bass * 15 / (d2 * d2 + 1);
                    }
                    return force * amt * 0.2;
                };
            case 'stringTheory':
                return (sx, sy, sz, freq, vi, vc) => {
                    const tNorm = vi / vc;
                    let h = 0;
                    for (let n = 1; n <= 7; n++) {
                        const bv = (freqData[Math.floor(n * 15)] || 0) / 255;
                        h += bv * Math.sin(n * Math.PI * tNorm + t * speed * n * 0.3) / n;
                    }
                    return h * amt * 2;
                };
            case 'fluidSim':
                return (sx, sy, sz, freq, vi, vc, nx, ny, nz) => {
                    const vx = Math.sin(sy * 0.2 + t * speed);
                    const vy = Math.cos(sx * 0.2 + t * speed * 0.7);
                    const vz = Math.sin((sx + sz) * 0.15 + t * speed * 1.3);
                    return (vx * nx + vy * ny + vz * nz) * amt * (0.3 + bass * 2 + freq);
                };
            default:
                // Fallback to fourier
                return (sx, sy, sz, freq) => {
                    const h1 = Math.sin(sx * 0.3 + t * speed) * freq;
                    const h2 = Math.sin(sy * 0.5 + t * speed * 0.7) * mid;
                    const h3 = Math.sin(sz * 0.2 + t * speed * 1.3) * treble;
                    return (h1 + h2 + h3) * amt;
                };
        }
    }

    return {
        // Primitives
        noise3D,
        fbm,
        superformula,

        // Geometry
        buildGrid,
        getOuterGeo,
        getInnerGeo,

        // Attractors
        attractors,
        stepAttractor,

        // Displacement
        buildDisplaceFn,
    };
})();
