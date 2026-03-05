// ============================================================
// AURA Mode — Frequency Bars V2
// Classic + circular bar visualizer with 3D perspective
// V2: depth layers, bar shapes, spring physics, per-band color,
//     beat scatter, drop shatter, symmetry, waveform overlay
// ============================================================

const FrequencyBarsMode = {
    name: 'Frequency Bars',
    group: null,
    bars: [],
    barCount: 64,
    mirrorBars: [],
    springVelocities: [],
    springPositions: [],
    shatterOffsets: [],
    shatterVelocities: [],
    isShattered: false,
    shatterTimer: 0,
    waveformLine: null,
    time: 0,

    params: {
        barCount: { type: 'range', min: 16, max: 256, default: 64, step: 1, label: 'Bar Count' },
        barWidth: { type: 'range', min: 0.1, max: 5, default: 1.2, step: 0.1, label: 'Bar Width' },
        maxHeight: { type: 'range', min: 10, max: 200, default: 80, step: 1, label: 'Max Height' },
        gap: { type: 'range', min: 0, max: 3, default: 0.3, step: 0.1, label: 'Gap' },
        layout: { type: 'select', options: ['linear', 'circular', 'spiral', 'dome', 'double', 'helix', 'wave3D'], default: 'linear', label: 'Layout' },
        mirrorY: { type: 'toggle', default: true, label: 'Mirror Y' },
        roundedTop: { type: 'toggle', default: true, label: 'Rounded Caps' },
        colorMode: { type: 'select', options: ['palette', 'rainbow', 'gradient', 'solid', 'perBand', 'fire', 'ice'], default: 'palette', label: 'Color Mode' },
        glowStrength: { type: 'range', min: 0, max: 2, default: 0.6, step: 0.1, label: 'Glow' },
        rotationSpeed: { type: 'range', min: 0, max: 2, default: 0, step: 0.05, label: 'Rotation' },
        // V2 params
        barShape: { type: 'select', options: ['box', 'cylinder', 'diamond', 'hexagon', 'octagon'], default: 'box', label: '🔷 Bar Shape' },
        depthLayers: { type: 'range', min: 1, max: 5, default: 1, step: 1, label: '📐 Depth Layers' },
        layerSpacing: { type: 'range', min: 3, max: 20, default: 8, step: 1, label: 'Layer Spacing' },
        layerOpacityFade: { type: 'range', min: 0, max: 0.5, default: 0.15, step: 0.05, label: 'Layer Fade' },
        barTaper: { type: 'range', min: 0, max: 1, default: 0, step: 0.05, label: '📐 Bar Taper' },
        physicsEnabled: { type: 'toggle', default: false, label: '🔧 Spring Physics' },
        springTension: { type: 'range', min: 0.01, max: 0.5, default: 0.15, step: 0.01, label: 'Spring Tension' },
        springDamping: { type: 'range', min: 0.5, max: 0.99, default: 0.85, step: 0.01, label: 'Spring Damping' },
        extrusion3D: { type: 'range', min: 0, max: 20, default: 0, step: 0.5, label: '🧊 3D Extrusion' },
        beatScatter: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '💥 Beat Scatter' },
        dropShatter: { type: 'toggle', default: false, label: '🔥 Drop Shatter' },
        symmetryMode: { type: 'select', options: ['none', 'bilateral', 'radial4', 'radial8'], default: 'none', label: '🪞 Symmetry' },
        bassResonance: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🔊 Bass Resonance' },
        trebleSparkle: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '✨ Treble Sparkle' },
        waveformOverlay: { type: 'toggle', default: false, label: '〰️ Waveform Overlay' },
        audioMapping: { type: 'select', options: ['full', 'bass', 'mid', 'treble', 'sub', 'brilliance'], default: 'full', label: '🎵 Audio Mapping' },
        glitchOnBeat: { type: 'toggle', default: false, label: '📺 Glitch on Beat' }
    },

    getBarGeometry(shape, width) {
        switch (shape) {
            case 'cylinder': return new THREE.CylinderGeometry(width * 0.5, width * 0.5, 1, 8);
            case 'diamond': return new THREE.CylinderGeometry(0, width * 0.7, 1, 4);
            case 'hexagon': return new THREE.CylinderGeometry(width * 0.5, width * 0.5, 1, 6);
            case 'octagon': return new THREE.CylinderGeometry(width * 0.5, width * 0.5, 1, 8);
            default: return new THREE.BoxGeometry(1, 1, 1);
        }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 30, 120);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.isShattered = false;
        this.shatterTimer = 0;
        this.buildBars(64);
    },

    buildBars(count) {
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }
        this.bars = [];
        this.mirrorBars = [];
        this.springVelocities = [];
        this.springPositions = [];
        this.shatterOffsets = [];
        this.shatterVelocities = [];
        this.barCount = count;

        for (let i = 0; i < count; i++) {
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x8b5cf6,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            this.group.add(mesh);
            this.bars.push(mesh);
            this.springVelocities.push(0);
            this.springPositions.push(0);
            this.shatterOffsets.push({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });
            this.shatterVelocities.push({
                x: (Math.random() - 0.5) * 2,
                y: Math.random() * 3 + 1,
                z: (Math.random() - 0.5) * 2,
                rx: (Math.random() - 0.5) * 5,
                ry: (Math.random() - 0.5) * 5,
                rz: (Math.random() - 0.5) * 5
            });
        }
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        const count = Math.floor(params.barCount || 64);
        if (count !== this.barCount) {
            this.buildBars(count);
        }

        const layout = params.layout || 'linear';
        const barWidth = params.barWidth || 1.2;
        const maxH = params.maxHeight || 80;
        const gap = params.gap || 0.3;
        const mirror = params.mirrorY;
        const reactivity = params.reactivity || 1;
        const glow = params.glowStrength || 0.6;
        const rotation = params.rotationSpeed || 0;
        const depthLayers = Math.floor(params.depthLayers || 1);
        const layerSpacing = params.layerSpacing || 8;
        const layerFade = params.layerOpacityFade || 0.15;
        const barShape = params.barShape || 'box';
        const taper = params.barTaper || 0;
        const physicsOn = params.physicsEnabled;
        const tension = params.springTension || 0.15;
        const damping = params.springDamping || 0.85;
        const extrusion = params.extrusion3D || 0;
        const beatScatter = params.beatScatter || 0;
        const bassRes = params.bassResonance || 0;
        const trebSpark = params.trebleSparkle || 0;

        const freqData = audio.frequencyData;
        const step = Math.max(1, Math.floor(freqData.length / count));

        // Drop shatter logic
        if (params.dropShatter && audio.isDropSection) {
            this.isShattered = true;
            this.shatterTimer = 2.0;
            for (let i = 0; i < count; i++) {
                this.shatterVelocities[i] = {
                    x: (Math.random() - 0.5) * 4 * audio.dropIntensity,
                    y: Math.random() * 5 * audio.dropIntensity + 2,
                    z: (Math.random() - 0.5) * 4 * audio.dropIntensity,
                    rx: (Math.random() - 0.5) * 8,
                    ry: (Math.random() - 0.5) * 8,
                    rz: (Math.random() - 0.5) * 8
                };
                this.shatterOffsets[i] = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
            }
        }
        if (this.isShattered) {
            this.shatterTimer -= dt;
            if (this.shatterTimer <= 0) {
                this.isShattered = false;
                for (let i = 0; i < count; i++) {
                    this.shatterOffsets[i] = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
                }
            } else {
                for (let i = 0; i < this.shatterOffsets.length && i < count; i++) {
                    const sv = this.shatterVelocities[i];
                    const so = this.shatterOffsets[i];
                    sv.y -= 15 * dt;
                    so.x += sv.x * dt * 20;
                    so.y += sv.y * dt * 20;
                    so.z += sv.z * dt * 20;
                    so.rx += sv.rx * dt;
                    so.ry += sv.ry * dt;
                    so.rz += sv.rz * dt;
                }
            }
        }

        const bass = audio.smoothBands.bass || 0;
        const treble = audio.smoothBands.treble || 0;

        for (let i = 0; i < this.bars.length; i++) {
            const bar = this.bars[i];
            let fIdx = Math.min(i * step, freqData.length - 1);

            // Audio mapping filter
            if (params.audioMapping === 'bass') fIdx = Math.min(i * step, freqData.length * 0.15);
            else if (params.audioMapping === 'mid') fIdx = freqData.length * 0.15 + (i / count) * freqData.length * 0.4;
            else if (params.audioMapping === 'treble') fIdx = freqData.length * 0.55 + (i / count) * freqData.length * 0.3;
            else if (params.audioMapping === 'sub') fIdx = Math.min(i * step, freqData.length * 0.08);
            else if (params.audioMapping === 'brilliance') fIdx = freqData.length * 0.85 + (i / count) * freqData.length * 0.15;
            fIdx = Math.floor(Math.max(0, Math.min(fIdx, freqData.length - 1)));

            const val = (freqData[fIdx] / 255) * reactivity;
            let h = Math.max(0.5, val * maxH);

            // Bass resonance
            if (bassRes > 0) {
                h += bass * bassRes * maxH * 0.3 * Math.sin(i * 0.3 + this.time * 3);
            }

            // Spring physics
            if (physicsOn) {
                const target = h;
                const current = this.springPositions[i] || 0;
                let vel = this.springVelocities[i] || 0;
                vel += (target - current) * tension;
                vel *= damping;
                this.springVelocities[i] = vel;
                this.springPositions[i] = current + vel;
                h = Math.max(0.5, this.springPositions[i]);
            }

            // Position based on layout
            const totalWidth = count * (barWidth + gap);

            if (layout === 'linear') {
                bar.position.x = (i - count / 2) * (barWidth + gap);
                bar.position.y = mirror ? 0 : h / 2;
                bar.position.z = 0;
                bar.rotation.set(0, 0, 0);
                const topScale = 1 - taper * val;
                bar.scale.set(barWidth * topScale, h, barWidth + extrusion);
            } else if (layout === 'circular') {
                const angle = (i / count) * Math.PI * 2;
                const radius = 40;
                bar.position.x = Math.cos(angle) * radius;
                bar.position.z = Math.sin(angle) * radius;
                bar.position.y = 0;
                bar.rotation.set(0, 0, 0);
                bar.rotation.y = -angle;
                bar.scale.set(barWidth, h, barWidth + extrusion);
                bar.position.x += Math.cos(angle) * h * 0.3;
                bar.position.z += Math.sin(angle) * h * 0.3;
            } else if (layout === 'spiral') {
                const angle = (i / count) * Math.PI * 6;
                const radius = 15 + (i / count) * 50;
                bar.position.x = Math.cos(angle) * radius;
                bar.position.z = Math.sin(angle) * radius;
                bar.position.y = (i / count - 0.5) * 40;
                bar.rotation.y = -angle;
                bar.scale.set(barWidth, h * 0.5, barWidth + extrusion);
            } else if (layout === 'dome') {
                const phi = (i / count) * Math.PI;
                const theta = (i / count) * Math.PI * 4;
                const radius = 50;
                bar.position.x = Math.sin(phi) * Math.cos(theta) * radius;
                bar.position.y = Math.cos(phi) * radius;
                bar.position.z = Math.sin(phi) * Math.sin(theta) * radius;
                bar.lookAt(0, 0, 0);
                bar.scale.set(barWidth, barWidth, h * 0.5 + extrusion);
            } else if (layout === 'double') {
                const half = Math.floor(count / 2);
                const idx = i < half ? i : i - half;
                const side = i < half ? -1 : 1;
                bar.position.x = (idx - half / 2) * (barWidth + gap);
                bar.position.y = side * h / 2;
                bar.position.z = side * 10;
                bar.rotation.set(0, 0, 0);
                bar.scale.set(barWidth, h, barWidth + extrusion);
            } else if (layout === 'helix') {
                const angle = (i / count) * Math.PI * 8;
                const radius = 25;
                const yPos = (i / count - 0.5) * 80;
                bar.position.x = Math.cos(angle) * radius;
                bar.position.z = Math.sin(angle) * radius;
                bar.position.y = yPos;
                bar.rotation.y = -angle;
                bar.scale.set(barWidth, h * 0.4, barWidth + extrusion);
            } else if (layout === 'wave3D') {
                bar.position.x = (i - count / 2) * (barWidth + gap);
                bar.position.z = Math.sin(i * 0.2 + this.time * 2) * 15;
                bar.position.y = mirror ? 0 : h / 2;
                bar.rotation.set(0, 0, 0);
                bar.scale.set(barWidth, h, barWidth + extrusion);
            }

            // Beat scatter
            if (beatScatter > 0 && audio.beat) {
                bar.position.x += (Math.random() - 0.5) * beatScatter * audio.beatIntensity * 5;
                bar.position.y += (Math.random() - 0.5) * beatScatter * audio.beatIntensity * 5;
                bar.position.z += (Math.random() - 0.5) * beatScatter * audio.beatIntensity * 5;
            }

            // Glitch on beat
            if (params.glitchOnBeat && audio.beat) {
                bar.position.x += (Math.random() - 0.5) * 3 * audio.beatIntensity;
                bar.position.y += (Math.random() - 0.5) * 2 * audio.beatIntensity;
            }

            // Shatter offset
            if (this.isShattered && i < this.shatterOffsets.length) {
                const so = this.shatterOffsets[i];
                bar.position.x += so.x;
                bar.position.y += so.y;
                bar.position.z += so.z;
                bar.rotation.x += so.rx;
                bar.rotation.y += so.ry;
                bar.rotation.z += so.rz;
            }

            // Color
            const t = i / count;
            if (params.colorMode === 'rainbow') {
                bar.material.color.setHSL(t, 0.85, 0.5 + val * 0.3);
            } else if (params.colorMode === 'gradient') {
                bar.material.color.setHSL(0.75 - val * 0.3, 0.9, 0.4 + val * 0.3);
            } else if (params.colorMode === 'solid') {
                bar.material.color.setHSL(0.75, 0.9, 0.4 + val * 0.4);
            } else if (params.colorMode === 'perBand') {
                const bandIdx = Math.floor(t * 7);
                const bandHues = [0.0, 0.08, 0.17, 0.33, 0.5, 0.67, 0.83];
                bar.material.color.setHSL(bandHues[bandIdx], 0.9, 0.4 + val * 0.4);
            } else if (params.colorMode === 'fire') {
                bar.material.color.setHSL(0.05 + val * 0.08, 1, 0.3 + val * 0.4);
            } else if (params.colorMode === 'ice') {
                bar.material.color.setHSL(0.55 + val * 0.1, 0.8, 0.3 + val * 0.5);
            } else {
                bar.material.color = ParamSystem.getColorThree(t);
            }

            // Treble sparkle
            if (trebSpark > 0 && t > 0.6) {
                const sparkle = treble * trebSpark * Math.sin(this.time * 20 + i * 7);
                bar.material.color.r = Math.min(1, bar.material.color.r + sparkle * 0.5);
                bar.material.color.g = Math.min(1, bar.material.color.g + sparkle * 0.5);
                bar.material.color.b = Math.min(1, bar.material.color.b + sparkle * 0.5);
            }

            // Opacity glow effect
            bar.material.transparent = true;
            bar.material.opacity = (0.5 + val * 0.5) * (1 - (this.isShattered ? 0.3 : 0));
        }

        // Rotation
        if (rotation > 0) {
            this.group.rotation.y += rotation * dt;
        }

        // Waveform overlay
        if (params.waveformOverlay && audio.waveformPoints) {
            if (this.waveformLine) {
                this.group.remove(this.waveformLine);
                this.waveformLine.geometry.dispose();
                this.waveformLine.material.dispose();
            }
            const wfPoints = [];
            const wf = audio.waveformPoints;
            for (let i = 0; i < wf.length; i++) {
                const x = (i / wf.length - 0.5) * (count * (barWidth + gap));
                const y = wf[i] * maxH * 0.5;
                wfPoints.push(new THREE.Vector3(x, y, 2));
            }
            const wfGeo = new THREE.BufferGeometry().setFromPoints(wfPoints);
            const wfMat = new THREE.LineBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.4,
                blending: THREE.AdditiveBlending
            });
            this.waveformLine = new THREE.Line(wfGeo, wfMat);
            this.group.add(this.waveformLine);
        }
    },

    destroy(scene) {
        if (this.group) {
            scene.remove(this.group);
        }
        this.bars = [];
        this.mirrorBars = [];
        this.waveformLine = null;
    }
};
