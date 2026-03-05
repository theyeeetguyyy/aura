// ============================================================
// AURA Mode — Lissajous V2
// Parametric Lissajous figures with 3D, harmonics, tube,
// ribbon, rainbow, phase animation, beat phase shift
// ============================================================

const LissajousMode = {
    name: 'Lissajous',
    group: null,
    time: 0,

    params: {
        freqA: { type: 'range', min: 1, max: 12, default: 3, step: 1, label: 'Freq A' },
        freqB: { type: 'range', min: 1, max: 12, default: 5, step: 1, label: 'Freq B' },
        freqC: { type: 'range', min: 1, max: 12, default: 7, step: 1, label: 'Freq C' },
        phase: { type: 'range', min: 0, max: 6.28, default: 1.57, step: 0.1, label: 'Phase' },
        scale: { type: 'range', min: 10, max: 80, default: 40, step: 1, label: 'Scale' },
        resolution: { type: 'range', min: 200, max: 3000, default: 1000, step: 100, label: 'Resolution' },
        renderMode: { type: 'select', options: ['line', 'points', 'tube', 'ribbon'], default: 'line', label: 'Render' },
        thickness: { type: 'range', min: 0.1, max: 3, default: 0.5, step: 0.1, label: 'Thickness' },
        rotSpeed: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.05, label: 'Rotation' },
        audioFreqMap: { type: 'toggle', default: true, label: 'Audio Map Freqs' },
        trailFade: { type: 'range', min: 0, max: 1, default: 0, step: 0.1, label: 'Trail Fade' },
        layers: { type: 'range', min: 1, max: 5, default: 1, step: 1, label: 'Layers' },
        // V2 params
        display3D: { type: 'toggle', default: true, label: '🧊 Full 3D' },
        harmonicCount: { type: 'range', min: 1, max: 5, default: 1, step: 1, label: '🎵 Harmonics' },
        harmonicDecay: { type: 'range', min: 0.3, max: 0.9, default: 0.5, step: 0.05, label: 'Harmonic Decay' },
        phaseAnimSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '🌀 Phase Anim' },
        tubeRadius: { type: 'range', min: 0.1, max: 3, default: 0.5, step: 0.1, label: '🔵 Tube Radius' },
        ribbonMode: { type: 'toggle', default: false, label: '🎀 Ribbon' },
        rainbowLength: { type: 'toggle', default: false, label: '🌈 Rainbow' },
        beatPhaseShift: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '💥 Beat Phase' },
        dropReset: { type: 'toggle', default: false, label: '🔥 Drop Reset' },
        symmetry: { type: 'select', options: ['none', 'mirror', 'radial3', 'radial4'], default: 'none', label: '🪞 Symmetry' },
        colorCycle: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🎨 Color Cycle' },
        glowIntensity: { type: 'range', min: 0.5, max: 3, default: 1, step: 0.1, label: '✨ Glow' }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }

        const reactivity = params.reactivity || 1;
        let fA = params.freqA || 3;
        let fB = params.freqB || 5;
        let fC = params.freqC || 7;
        let phase = params.phase || 1.57;
        const scale = params.scale || 40;
        const res = Math.floor(params.resolution || 1000);
        const layers = Math.floor(params.layers || 1);
        const harmonics = Math.floor(params.harmonicCount || 1);
        const harmDecay = params.harmonicDecay || 0.5;
        const phaseAnim = params.phaseAnimSpeed || 0.5;
        const use3D = params.display3D;
        const beatPhase = params.beatPhaseShift || 0;
        const colorCycle = params.colorCycle || 0;
        const glowInt = params.glowIntensity || 1;

        if (params.audioFreqMap) {
            fA += audio.smoothBands.bass * 3 * reactivity;
            fB += audio.smoothBands.mid * 3 * reactivity;
            fC += audio.smoothBands.treble * 2 * reactivity;
        }

        // Animated phase
        phase += this.time * phaseAnim;

        // Beat phase shift
        if (beatPhase > 0 && audio.beat) {
            phase += audio.beatIntensity * beatPhase;
        }

        // Drop reset
        if (params.dropReset && audio.isDropSection) {
            phase = 0;
        }

        const symmetry = params.symmetry || 'none';
        const symCopies = symmetry === 'mirror' ? 2 : symmetry === 'radial3' ? 3 : symmetry === 'radial4' ? 4 : 1;

        for (let l = 0; l < layers; l++) {
            for (let s = 0; s < symCopies; s++) {
                const layerPhase = l * Math.PI / layers;
                const symAngle = (s / symCopies) * Math.PI * 2;

                const points = [];
                for (let i = 0; i < res; i++) {
                    const t = (i / res) * Math.PI * 2 * 4;

                    // Base curve with harmonics
                    let x = 0, y = 0, z = 0;
                    for (let h = 0; h < harmonics; h++) {
                        const amp = Math.pow(harmDecay, h);
                        const freqMult = h + 1;
                        x += Math.sin(fA * freqMult * t + phase + layerPhase) * amp;
                        y += Math.sin(fB * freqMult * t + this.time * 0.5 + layerPhase) * amp;
                        if (use3D) {
                            z += Math.sin(fC * freqMult * t + phase * 2 + layerPhase) * amp * 0.5;
                        }
                    }

                    x *= scale;
                    y *= scale;
                    z *= scale;

                    // Symmetry transform
                    if (s > 0) {
                        const rx = x * Math.cos(symAngle) - y * Math.sin(symAngle);
                        const ry = x * Math.sin(symAngle) + y * Math.cos(symAngle);
                        x = rx;
                        y = ry;
                    }

                    points.push(new THREE.Vector3(x, y, z));
                }

                const renderMode = params.renderMode || 'line';
                const colorOffset = l / layers + s * 0.15 + this.time * colorCycle * 0.02;

                if (renderMode === 'points') {
                    const geo = new THREE.BufferGeometry().setFromPoints(points);
                    const colors = new Float32Array(points.length * 3);
                    for (let i = 0; i < points.length; i++) {
                        const ct = params.rainbowLength ? (i / points.length + colorOffset) : (colorOffset + audio.rms * 0.5);
                        const col = ParamSystem.getColorThreeHSL(ct);
                        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
                    }
                    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    const mat = new THREE.PointsMaterial({
                        size: params.thickness || 0.5, vertexColors: true, transparent: true,
                        opacity: (0.7 / layers / symCopies) * glowInt,
                        blending: THREE.AdditiveBlending, depthWrite: false
                    });
                    this.group.add(new THREE.Points(geo, mat));
                } else if ((renderMode === 'tube' || params.ribbonMode) && points.length > 10) {
                    try {
                        const subset = points.filter((_, i) => i % 3 === 0);
                        const curve = new THREE.CatmullRomCurve3(subset);
                        const tubeR = params.tubeRadius || 0.5;
                        const tubeGeo = new THREE.TubeGeometry(curve, Math.min(subset.length, 400), tubeR, params.ribbonMode ? 2 : 6, false);
                        const mat = new THREE.MeshBasicMaterial({
                            color: ParamSystem.getColorThree(colorOffset + audio.rms),
                            transparent: true, opacity: (0.6 / layers / symCopies) * glowInt,
                            blending: THREE.AdditiveBlending, side: THREE.DoubleSide
                        });
                        this.group.add(new THREE.Mesh(tubeGeo, mat));
                    } catch (e) { }
                } else {
                    const geo = new THREE.BufferGeometry();
                    const positions = new Float32Array(points.length * 3);
                    const colors = new Float32Array(points.length * 3);
                    for (let i = 0; i < points.length; i++) {
                        positions[i * 3] = points[i].x;
                        positions[i * 3 + 1] = points[i].y;
                        positions[i * 3 + 2] = points[i].z;
                        const ct = params.rainbowLength ? (i / points.length + colorOffset) : (colorOffset + audio.rms * 0.3);
                        const col = ParamSystem.getColorThreeHSL(ct);
                        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
                    }
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                    const mat = new THREE.LineBasicMaterial({
                        vertexColors: true, transparent: true,
                        opacity: (0.7 / layers / symCopies) * glowInt,
                        blending: THREE.AdditiveBlending
                    });
                    this.group.add(new THREE.Line(geo, mat));
                }
            }
        }

        this.group.rotation.y += (params.rotSpeed || 0.3) * dt;
        this.group.rotation.x = Math.sin(this.time * 0.2) * 0.3;
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
    }
};
