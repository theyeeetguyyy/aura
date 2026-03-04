// ============================================================
// AURA Mode — Waveform Scope V2
// Raw waveform as 3D tube/line with Lissajous, spiral,
// mirror, thickness, rainbow, frequency overlay, trails
// ============================================================

const WaveformScopeMode = {
    name: 'Waveform Scope',
    line: null,
    tube: null,
    group: null,
    trailGroup: null,
    trailHistory: [],
    time: 0,

    params: {
        style: { type: 'select', options: ['line', 'tube', 'ribbon', 'mirror', 'filled', 'dots'], default: 'line', label: 'Style' },
        lineWidth: { type: 'range', min: 1, max: 10, default: 3, step: 0.5, label: 'Width' },
        amplitude: { type: 'range', min: 5, max: 100, default: 40, step: 1, label: 'Amplitude' },
        spread: { type: 'range', min: 50, max: 300, default: 150, step: 5, label: 'Spread' },
        zDepth: { type: 'range', min: 0, max: 100, default: 0, step: 5, label: 'Z Depth' },
        layers: { type: 'range', min: 1, max: 10, default: 1, step: 1, label: 'Layers' },
        rotationSpeed: { type: 'range', min: 0, max: 2, default: 0, step: 0.05, label: 'Rotation' },
        glowIntensity: { type: 'range', min: 0, max: 2, default: 0.8, step: 0.1, label: 'Glow' },
        // V2 params
        displayMode: { type: 'select', options: ['standard', 'lissajous', 'spiral', 'radial', '3DTube', 'oscillograph'], default: 'standard', label: '🎨 Display Mode' },
        tubeRadius: { type: 'range', min: 0.1, max: 5, default: 1, step: 0.1, label: '🔵 Tube Radius' },
        spiralTurns: { type: 'range', min: 1, max: 10, default: 3, step: 0.5, label: '🌀 Spiral Turns' },
        mirrorCount: { type: 'range', min: 1, max: 8, default: 2, step: 1, label: '🪞 Mirror Count' },
        lineThickness: { type: 'range', min: 0.5, max: 5, default: 1, step: 0.1, label: 'Thickness' },
        rainbowPosition: { type: 'toggle', default: false, label: '🌈 Rainbow by Pos' },
        frequencyOverlay: { type: 'toggle', default: false, label: '🎵 Freq Overlay' },
        trailMode: { type: 'select', options: ['none', 'fade', 'ghost', 'ribbon'], default: 'none', label: '👻 Trail Mode' },
        trailLength: { type: 'range', min: 2, max: 20, default: 5, step: 1, label: 'Trail Length' },
        beatPulse: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '💥 Beat Pulse' },
        dropFreeze: { type: 'toggle', default: false, label: '🔥 Drop Freeze' },
        colorCycle: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🎨 Color Cycle' },
        smoothing: { type: 'range', min: 0, max: 1, default: 0.3, step: 0.05, label: 'Smoothing' },
        lissajousRatioA: { type: 'range', min: 1, max: 7, default: 3, step: 1, label: 'Lissajous A' },
        lissajousRatioB: { type: 'range', min: 1, max: 7, default: 2, step: 1, label: 'Lissajous B' }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        this.trailGroup = new THREE.Group();
        scene.add(this.group);
        scene.add(this.trailGroup);
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.trailHistory = [];
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        // Clear previous main geometry
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }

        const waveform = audio.waveformPoints;
        if (!waveform || waveform.length === 0) return;

        const amp = (params.amplitude || 40) * (params.reactivity || 1);
        const spread = params.spread || 150;
        const layers = Math.floor(params.layers || 1);
        const style = params.style || 'line';
        const zDepth = params.zDepth || 0;
        const rotSpeed = params.rotationSpeed || 0;
        const displayMode = params.displayMode || 'standard';
        const beatPulse = params.beatPulse || 0;
        const colorCycle = params.colorCycle || 0;
        const mirrorCount = Math.floor(params.mirrorCount || 2);

        // Beat pulse modifier
        let pulseMod = 1;
        if (beatPulse > 0 && audio.beat) {
            pulseMod = 1 + audio.beatIntensity * beatPulse;
        }

        // Drop freeze
        const frozen = params.dropFreeze && audio.dropDecay > 0.3;

        for (let l = 0; l < layers; l++) {
            const points = [];
            const layerOffset = (l - layers / 2) * 5;

            for (let i = 0; i < waveform.length; i++) {
                const t = i / waveform.length;
                let x, y, z;

                if (displayMode === 'lissajous') {
                    const ratioA = params.lissajousRatioA || 3;
                    const ratioB = params.lissajousRatioB || 2;
                    const phase = this.time * 0.5;
                    const waveVal = frozen ? 0 : waveform[i];
                    x = Math.sin(t * Math.PI * 2 * ratioA + phase) * spread * 0.3 * (1 + waveVal * amp * 0.01 * pulseMod);
                    y = Math.cos(t * Math.PI * 2 * ratioB + phase * 0.7) * spread * 0.3 * (1 + waveVal * amp * 0.01 * pulseMod);
                    z = layerOffset + Math.sin(t * Math.PI * 4) * zDepth * 0.2;
                } else if (displayMode === 'spiral') {
                    const turns = params.spiralTurns || 3;
                    const angle = t * Math.PI * 2 * turns + this.time * 0.3;
                    const radius = t * spread * 0.3 + (frozen ? 0 : waveform[i]) * amp * 0.3 * pulseMod;
                    x = Math.cos(angle) * radius;
                    z = Math.sin(angle) * radius;
                    y = (t - 0.5) * spread * 0.5 + layerOffset;
                } else if (displayMode === 'radial') {
                    const angle = t * Math.PI * 2;
                    const waveVal = frozen ? 0 : waveform[i];
                    const radius = spread * 0.2 + waveVal * amp * pulseMod;
                    x = Math.cos(angle) * radius;
                    y = Math.sin(angle) * radius;
                    z = layerOffset;
                } else if (displayMode === '3DTube') {
                    x = (t - 0.5) * spread;
                    y = (frozen ? 0 : waveform[i]) * amp * (1 + l * 0.2) * pulseMod;
                    z = layerOffset + Math.sin(t * Math.PI * 4 + this.time) * zDepth * 0.3;
                } else if (displayMode === 'oscillograph') {
                    x = (t - 0.5) * spread;
                    const waveVal = frozen ? 0 : waveform[i];
                    y = waveVal * amp * pulseMod;
                    z = layerOffset;
                    // Add phosphor glow decay feel
                } else {
                    x = (t - 0.5) * spread;
                    y = (frozen ? 0 : waveform[i]) * amp * (1 + l * 0.2) * pulseMod;
                    z = layerOffset + (zDepth > 0 ? Math.sin(t * Math.PI * 2 + this.time) * zDepth * 0.1 : 0);
                }

                points.push(new THREE.Vector3(x, y, z));
            }

            // Mirror copies
            const allPointSets = [points];
            if (style === 'mirror' || mirrorCount > 1) {
                for (let m = 1; m < mirrorCount; m++) {
                    const mirrorPoints = points.map(p => {
                        const angle = (m / mirrorCount) * Math.PI * 2;
                        return new THREE.Vector3(
                            p.x * Math.cos(angle) - p.y * Math.sin(angle),
                            p.x * Math.sin(angle) + p.y * Math.cos(angle),
                            p.z
                        );
                    });
                    allPointSets.push(mirrorPoints);
                }
            }

            allPointSets.forEach((pts, mi) => {
                const colorOffset = mi * 0.15 + l / layers;

                if ((style === 'tube' || displayMode === '3DTube') && pts.length > 3) {
                    try {
                        const curve = new THREE.CatmullRomCurve3(pts);
                        const radius = (params.tubeRadius || 1) * (params.lineThickness || 1) * 0.3;
                        const tubeGeo = new THREE.TubeGeometry(curve, Math.min(pts.length, 200), radius, 8, false);
                        const tubeMat = new THREE.MeshBasicMaterial({
                            color: ParamSystem.getColorThree(colorOffset + audio.rms + this.time * colorCycle * 0.05),
                            transparent: true,
                            opacity: 0.8 * (params.glowIntensity || 0.8),
                            blending: THREE.AdditiveBlending,
                            depthWrite: false
                        });
                        this.group.add(new THREE.Mesh(tubeGeo, tubeMat));
                    } catch (e) { /* fallback to line */ }
                }

                if (style === 'dots') {
                    const dotGeo = new THREE.BufferGeometry().setFromPoints(pts);
                    const dotMat = new THREE.PointsMaterial({
                        size: (params.lineThickness || 1) * 2,
                        color: ParamSystem.getColorThree(colorOffset + audio.rms),
                        transparent: true,
                        opacity: 0.8,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });
                    this.group.add(new THREE.Points(dotGeo, dotMat));
                } else if (style !== 'tube' && displayMode !== '3DTube') {
                    // Build colored line
                    const lineGeo = new THREE.BufferGeometry();
                    const positions = new Float32Array(pts.length * 3);
                    const colors = new Float32Array(pts.length * 3);
                    for (let p = 0; p < pts.length; p++) {
                        positions[p * 3] = pts[p].x;
                        positions[p * 3 + 1] = pts[p].y;
                        positions[p * 3 + 2] = pts[p].z;
                        const ct = params.rainbowPosition
                            ? p / pts.length + this.time * colorCycle * 0.05
                            : colorOffset + audio.rms * 0.5 + this.time * colorCycle * 0.05;
                        const c = ParamSystem.getColorThreeHSL(ct);
                        colors[p * 3] = c.r;
                        colors[p * 3 + 1] = c.g;
                        colors[p * 3 + 2] = c.b;
                    }
                    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                    const lineMat = new THREE.LineBasicMaterial({
                        vertexColors: true,
                        transparent: true,
                        opacity: (0.8 - l * 0.05) * (params.glowIntensity || 0.8),
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                    });
                    this.group.add(new THREE.Line(lineGeo, lineMat));
                }

                // Filled style
                if (style === 'filled' && pts.length > 2) {
                    const fillPts = [];
                    for (let p = 0; p < pts.length; p++) {
                        fillPts.push(pts[p]);
                        fillPts.push(new THREE.Vector3(pts[p].x, 0, pts[p].z));
                    }
                    const fillGeo = new THREE.BufferGeometry().setFromPoints(fillPts);
                    const indices = [];
                    for (let p = 0; p < pts.length - 1; p++) {
                        const a = p * 2, b = p * 2 + 1, c = p * 2 + 2, d = p * 2 + 3;
                        indices.push(a, b, c, b, d, c);
                    }
                    fillGeo.setIndex(indices);
                    const fillMat = new THREE.MeshBasicMaterial({
                        color: ParamSystem.getColorThree(colorOffset + audio.rms),
                        transparent: true, opacity: 0.3,
                        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
                    });
                    this.group.add(new THREE.Mesh(fillGeo, fillMat));
                }
            });
        }

        // Frequency overlay
        if (params.frequencyOverlay) {
            const freqPoints = [];
            const freqData = audio.frequencyData;
            for (let i = 0; i < freqData.length; i++) {
                const x = (i / freqData.length - 0.5) * spread;
                const y = (freqData[i] / 255) * amp * 0.5 - amp * 0.5;
                freqPoints.push(new THREE.Vector3(x, y, 3));
            }
            const freqGeo = new THREE.BufferGeometry().setFromPoints(freqPoints);
            const freqMat = new THREE.LineBasicMaterial({
                color: 0xff4488, transparent: true, opacity: 0.4,
                blending: THREE.AdditiveBlending
            });
            this.group.add(new THREE.Line(freqGeo, freqMat));
        }

        // Trail management
        const trailMode = params.trailMode || 'none';
        if (trailMode !== 'none') {
            const trailLen = Math.floor(params.trailLength || 5);
            // Clean old trails
            while (this.trailGroup.children.length > trailLen) {
                const old = this.trailGroup.children[0];
                this.trailGroup.remove(old);
                if (old.geometry) old.geometry.dispose();
                if (old.material) old.material.dispose();
            }
            // Fade existing trails
            this.trailGroup.children.forEach((child, idx) => {
                const fade = (idx + 1) / (this.trailGroup.children.length + 1);
                if (child.material) child.material.opacity = fade * 0.3;
            });
            // Clone current waveform as trail
            if (this.group.children.length > 0) {
                const first = this.group.children[0];
                try {
                    const clone = first.clone();
                    clone.material = first.material.clone();
                    clone.material.opacity = 0.3;
                    this.trailGroup.add(clone);
                } catch (e) { }
            }
        } else {
            while (this.trailGroup.children.length > 0) {
                const c = this.trailGroup.children[0];
                this.trailGroup.remove(c);
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            }
        }

        this.group.rotation.y += rotSpeed * dt;
        this.group.rotation.z = Math.sin(this.time * 0.5) * 0.05;
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        if (this.trailGroup) scene.remove(this.trailGroup);
        this.group = null;
        this.trailGroup = null;
        this.trailHistory = [];
    }
};
