// ============================================================
// AURA Mode — Math Mode V2
// Parametric equations with fractal zoom, animated morph,
// projection types, color by iteration, more attractors
// ============================================================

const MathModeMode = {
    name: 'Math Mode',
    group: null,
    points: null,
    time: 0,

    params: {
        equation: { type: 'select', options: ['rose', 'spirograph', 'lorenz', 'lissajous3d', 'butterfly', 'torus_knot', 'clifford', 'de_jong', 'ikeda', 'henon', 'mandelbrot', 'julia', 'aizawa', 'thomas'], default: 'rose', label: 'Equation' },
        resolution: { type: 'range', min: 100, max: 5000, default: 2000, step: 100, label: 'Resolution' },
        paramA: { type: 'range', min: 0.1, max: 10, default: 3, step: 0.1, label: 'Param A' },
        paramB: { type: 'range', min: 0.1, max: 10, default: 5, step: 0.1, label: 'Param B' },
        paramC: { type: 'range', min: 0.1, max: 10, default: 2, step: 0.1, label: 'Param C' },
        paramD: { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: 'Param D' },
        scale: { type: 'range', min: 1, max: 50, default: 20, step: 1, label: 'Scale' },
        speed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Speed' },
        lineWidth: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.5, label: 'Line Width' },
        renderAs: { type: 'select', options: ['line', 'points', 'tube'], default: 'line', label: 'Render' },
        audioMapA: { type: 'toggle', default: true, label: 'Map A to Bass' },
        audioMapB: { type: 'toggle', default: true, label: 'Map B to Mid' },
        rotSpeedY: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.1, label: 'Rotate Y' },
        // V2 params
        fractalZoom: { type: 'range', min: 0.1, max: 10, default: 1, step: 0.1, label: '🔍 Fractal Zoom' },
        fractalIterations: { type: 'range', min: 10, max: 200, default: 50, step: 5, label: '🔄 Iterations' },
        animateParams: { type: 'toggle', default: false, label: '🎬 Animate Params' },
        animateSpeed: { type: 'range', min: 0.1, max: 3, default: 0.5, step: 0.1, label: 'Anim Speed' },
        morph3D: { type: 'toggle', default: false, label: '🔮 3D Morph' },
        projectionType: { type: 'select', options: ['perspective', 'orthographic', 'stereographic'], default: 'perspective', label: '📐 Projection' },
        colorByIteration: { type: 'toggle', default: false, label: '🎨 Color by Iter' },
        colorBySpeed: { type: 'toggle', default: false, label: '🎨 Color by Speed' },
        dropMutate: { type: 'toggle', default: false, label: '🔥 Drop Mutate' },
        trailGhost: { type: 'range', min: 0, max: 5, default: 0, step: 1, label: '👻 Ghost Trails' },
        symmetry: { type: 'select', options: ['none', 'bilateral', 'radial4', 'radial6'], default: 'none', label: '🪞 Symmetry' },
        audioMapC: { type: 'toggle', default: false, label: 'Map C to Treble' }
    },

    computePoints(eq, a, b, c, d, res, scale, zoom, iterations) {
        const pts = [];
        switch (eq) {
            case 'rose':
                for (let i = 0; i < res; i++) {
                    const t = (i / res) * Math.PI * 2 * Math.floor(b);
                    const r = Math.cos(a * t) * scale;
                    pts.push(new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), Math.sin(c * t) * scale * 0.3));
                }
                break;
            case 'spirograph':
                for (let i = 0; i < res; i++) {
                    const t = (i / res) * Math.PI * 2 * 10;
                    const R = a * 3, rr = b * 2, dd = c * 2;
                    const x = (R - rr) * Math.cos(t) + dd * Math.cos((R - rr) / rr * t);
                    const y = (R - rr) * Math.sin(t) - dd * Math.sin((R - rr) / rr * t);
                    pts.push(new THREE.Vector3(x * scale * 0.3, y * scale * 0.3, Math.sin(t * d) * scale * 0.2));
                }
                break;
            case 'lorenz': {
                let x = 0.1, y = 0, z = 0;
                const dt = 0.005;
                const sigma = a * 3, rho = b * 5, beta = c * 0.5;
                for (let i = 0; i < res; i++) {
                    const dx = sigma * (y - x);
                    const dy = x * (rho - z) - y;
                    const dz = x * y - beta * z;
                    x += dx * dt; y += dy * dt; z += dz * dt;
                    pts.push(new THREE.Vector3(x * scale * 0.05, y * scale * 0.05, (z - 25) * scale * 0.05));
                }
                break;
            }
            case 'lissajous3d':
                for (let i = 0; i < res; i++) {
                    const t = (i / res) * Math.PI * 2 * 4;
                    pts.push(new THREE.Vector3(Math.sin(a * t) * scale, Math.sin(b * t + c) * scale, Math.sin(d * t) * scale * 0.5));
                }
                break;
            case 'butterfly':
                for (let i = 0; i < res; i++) {
                    const t = (i / res) * Math.PI * 12;
                    const r = Math.exp(Math.cos(t)) - 2 * Math.cos(a * t) - Math.pow(Math.sin(t / b), 5);
                    pts.push(new THREE.Vector3(Math.sin(t) * r * scale * 0.5, Math.cos(t) * r * scale * 0.5, Math.sin(t * c) * scale * 0.2));
                }
                break;
            case 'torus_knot':
                for (let i = 0; i < res; i++) {
                    const t = (i / res) * Math.PI * 2 * Math.floor(a);
                    const p = Math.floor(b), q = Math.floor(c);
                    const r = Math.cos(q * t) + 2;
                    pts.push(new THREE.Vector3(r * Math.cos(p * t) * scale * 0.3, r * Math.sin(p * t) * scale * 0.3, -Math.sin(q * t) * scale * 0.3));
                }
                break;
            case 'clifford': {
                let x = 0.1, y = 0.1;
                for (let i = 0; i < res; i++) {
                    const nx = Math.sin(a * y) + c * Math.cos(a * x);
                    const ny = Math.sin(b * x) + d * Math.cos(b * y);
                    x = nx; y = ny;
                    pts.push(new THREE.Vector3(x * scale * 0.5, y * scale * 0.5, Math.sin(i * 0.01) * scale * 0.1));
                }
                break;
            }
            case 'de_jong': {
                let x = 0.1, y = 0.1;
                for (let i = 0; i < res; i++) {
                    const nx = Math.sin(a * y) - Math.cos(b * x);
                    const ny = Math.sin(c * x) - Math.cos(d * y);
                    x = nx; y = ny;
                    pts.push(new THREE.Vector3(x * scale * 0.5, y * scale * 0.5, 0));
                }
                break;
            }
            case 'ikeda': {
                let x = 0.1, y = 0.1;
                const u = 0.918 * a * 0.3;
                for (let i = 0; i < res; i++) {
                    const t1 = 0.4 - 6 / (1 + x * x + y * y);
                    const nx = 1 + u * (x * Math.cos(t1) - y * Math.sin(t1));
                    const ny = u * (x * Math.sin(t1) + y * Math.cos(t1));
                    x = nx; y = ny;
                    pts.push(new THREE.Vector3(x * scale * 0.3, y * scale * 0.3, Math.sin(i * 0.005 * c) * scale * 0.1));
                }
                break;
            }
            case 'henon': {
                let x = 0.1, y = 0;
                for (let i = 0; i < res; i++) {
                    const nx = 1 - a * 0.14 * x * x + y;
                    const ny = b * 0.03 * x;
                    x = nx; y = ny;
                    pts.push(new THREE.Vector3(x * scale * 2, y * scale * 20, Math.sin(i * 0.01) * scale * 0.1));
                }
                break;
            }
            case 'mandelbrot': {
                const iters = Math.floor(iterations);
                const zoomF = zoom;
                const step = 3.0 / Math.sqrt(res) / zoomF;
                const centerX = -0.5, centerY = 0;
                for (let i = 0; i < res; i++) {
                    const px = (i % Math.sqrt(res)) * step - 1.5 / zoomF + centerX;
                    const py = Math.floor(i / Math.sqrt(res)) * step - 1.5 / zoomF + centerY;
                    let x = 0, y = 0, iter = 0;
                    while (x * x + y * y < 4 && iter < iters) {
                        const t = x * x - y * y + px;
                        y = 2 * x * y + py;
                        x = t;
                        iter++;
                    }
                    if (iter < iters) {
                        pts.push(new THREE.Vector3(px * scale * 10, py * scale * 10, (iter / iters) * scale * 0.5));
                        pts._iterData = pts._iterData || [];
                        pts._iterData.push(iter / iters);
                    }
                }
                break;
            }
            case 'julia': {
                const iters = Math.floor(iterations);
                const zoomF = zoom;
                const step = 3.0 / Math.sqrt(res) / zoomF;
                const cRe = -0.7 + a * 0.05, cIm = 0.27015 + b * 0.02;
                for (let i = 0; i < res; i++) {
                    let x = (i % Math.sqrt(res)) * step - 1.5 / zoomF;
                    let y = Math.floor(i / Math.sqrt(res)) * step - 1.5 / zoomF;
                    let iter = 0;
                    while (x * x + y * y < 4 && iter < iters) {
                        const t = x * x - y * y + cRe;
                        y = 2 * x * y + cIm;
                        x = t;
                        iter++;
                    }
                    if (iter < iters) {
                        pts.push(new THREE.Vector3((i % Math.sqrt(res)) * step * scale * 10 - scale * 15, Math.floor(i / Math.sqrt(res)) * step * scale * 10 - scale * 15, (iter / iters) * scale * 0.5));
                    }
                }
                break;
            }
            case 'aizawa': {
                let x = 0.1, y = 0, z = 0;
                const dt = 0.005;
                for (let i = 0; i < res; i++) {
                    const dx = (z - b * 0.1) * x - d * 0.5 * y;
                    const dy = d * 0.5 * x + (z - b * 0.1) * y;
                    const dz = c * 0.2 + a * 0.1 * z - (z * z * z) / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x;
                    x += dx * dt; y += dy * dt; z += dz * dt;
                    pts.push(new THREE.Vector3(x * scale, y * scale, z * scale));
                }
                break;
            }
            case 'thomas': {
                let x = 0.1, y = 0, z = 0;
                const dt = 0.03;
                const bb = 0.208186 * a * 0.3;
                for (let i = 0; i < res; i++) {
                    const dx = Math.sin(y) - bb * x;
                    const dy = Math.sin(z) - bb * y;
                    const dz = Math.sin(x) - bb * z;
                    x += dx * dt; y += dy * dt; z += dz * dt;
                    pts.push(new THREE.Vector3(x * scale * 0.5, y * scale * 0.5, z * scale * 0.5));
                }
                break;
            }
        }
        return pts;
    },

    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);
        this.time = 0;
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        // Clear
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }

        const reactivity = params.reactivity || 1;
        let a = params.paramA || 3;
        let b = params.paramB || 5;
        let c = params.paramC || 2;
        let d = params.paramD || 1;

        if (params.audioMapA) a += audio.smoothBands.bass * 3 * reactivity;
        if (params.audioMapB) b += audio.smoothBands.mid * 3 * reactivity;
        if (params.audioMapC) c += audio.smoothBands.treble * 2 * reactivity;
        c += audio.smoothBands.treble * reactivity * 0.5;

        // Animate params
        if (params.animateParams) {
            const animSpd = params.animateSpeed || 0.5;
            a += Math.sin(this.time * animSpd) * 1.5;
            b += Math.cos(this.time * animSpd * 0.7) * 1.5;
        }

        // Drop mutate
        if (params.dropMutate && audio.dropDecay > 0.1) {
            a += Math.sin(this.time * 10) * audio.dropDecay * 3;
            b += Math.cos(this.time * 8) * audio.dropDecay * 3;
        }

        const zoom = params.fractalZoom || 1;
        const iters = params.fractalIterations || 50;

        const pts = this.computePoints(
            params.equation || 'rose', a, b, c, d,
            Math.floor(params.resolution || 2000),
            params.scale || 20, zoom, iters
        );

        if (pts.length < 2) return;

        // Apply symmetry
        const allSets = [pts];
        if (params.symmetry === 'bilateral') {
            allSets.push(pts.map(p => new THREE.Vector3(-p.x, p.y, p.z)));
        } else if (params.symmetry === 'radial4') {
            for (let s = 1; s < 4; s++) {
                const angle = (s / 4) * Math.PI * 2;
                allSets.push(pts.map(p => new THREE.Vector3(
                    p.x * Math.cos(angle) - p.y * Math.sin(angle),
                    p.x * Math.sin(angle) + p.y * Math.cos(angle), p.z
                )));
            }
        } else if (params.symmetry === 'radial6') {
            for (let s = 1; s < 6; s++) {
                const angle = (s / 6) * Math.PI * 2;
                allSets.push(pts.map(p => new THREE.Vector3(
                    p.x * Math.cos(angle) - p.y * Math.sin(angle),
                    p.x * Math.sin(angle) + p.y * Math.cos(angle), p.z
                )));
            }
        }

        const renderAs = params.renderAs || 'line';

        for (let si = 0; si < allSets.length; si++) {
            const setPts = allSets[si];

            if (renderAs === 'points') {
                const geo = new THREE.BufferGeometry().setFromPoints(setPts);
                const colors = new Float32Array(setPts.length * 3);
                for (let i = 0; i < setPts.length; i++) {
                    const t = params.colorByIteration ? (setPts._iterData ? setPts._iterData[i] || 0 : i / setPts.length) : i / setPts.length;
                    const col = ParamSystem.getColorThreeHSL(t + si * 0.15);
                    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
                }
                geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                const mat = new THREE.PointsMaterial({
                    size: params.lineWidth || 2, vertexColors: true, transparent: true,
                    opacity: 0.8 / allSets.length, blending: THREE.AdditiveBlending, depthWrite: false
                });
                this.group.add(new THREE.Points(geo, mat));
            } else if (renderAs === 'tube' && setPts.length > 10) {
                try {
                    const subset = setPts.filter((_, i) => i % 4 === 0);
                    const curve = new THREE.CatmullRomCurve3(subset);
                    const tubeGeo = new THREE.TubeGeometry(curve, Math.min(subset.length, 500), params.lineWidth * 0.2, 6, false);
                    const mat = new THREE.MeshBasicMaterial({
                        color: ParamSystem.getColorThree(audio.rms + si * 0.2),
                        transparent: true, opacity: 0.6 / allSets.length, blending: THREE.AdditiveBlending
                    });
                    this.group.add(new THREE.Mesh(tubeGeo, mat));
                } catch (e) { }
            } else {
                const geo = new THREE.BufferGeometry().setFromPoints(setPts);
                const mat = new THREE.LineBasicMaterial({
                    color: ParamSystem.getColorThree(this.time * 0.1 + si * 0.2),
                    transparent: true, opacity: 0.7 / allSets.length, blending: THREE.AdditiveBlending
                });
                this.group.add(new THREE.Line(geo, mat));
            }
        }

        // 3D morph
        if (params.morph3D) {
            this.group.rotation.x = Math.sin(this.time * 0.3) * 0.5;
            this.group.rotation.z = Math.cos(this.time * 0.2) * 0.3;
        }

        this.group.rotation.y += (params.rotSpeedY || 0.3) * dt;
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(this.group);
            this.group = null;
        }
    }
};
