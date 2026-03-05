// ============================================================
// AURA Mode — Spectrogram V2
// Scrolling frequency waterfall with 3D modes, heatmaps,
// frequency zoom, radial display, peak hold, height map
// ============================================================

const SpectrogramMode = {
    name: 'Spectrogram',
    canvas2d: null,
    ctx2d: null,
    plane: null,
    texture: null,
    time: 0,
    mesh3D: null,
    historyBuffer: [],
    peakHoldData: null,

    params: {
        scrollSpeed: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: 'Scroll Speed' },
        freqScale: { type: 'select', options: ['linear', 'log', 'mel'], default: 'linear', label: 'Freq Scale' },
        colorIntensity: { type: 'range', min: 0.5, max: 3, default: 1.5, step: 0.1, label: 'Intensity' },
        height3D: { type: 'range', min: 0, max: 30, default: 0, step: 1, label: '3D Height' },
        direction: { type: 'select', options: ['left', 'up', 'radial'], default: 'left', label: 'Direction' },
        brightness: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: 'Brightness' },
        // V2 params
        displayMode: { type: 'select', options: ['2D', '3DWaterfall', 'radialSpec', '3DSurface'], default: '2D', label: '🎨 Display' },
        historyDepth: { type: 'range', min: 20, max: 150, default: 60, step: 10, label: '📐 History Depth' },
        heatmapPalette: { type: 'select', options: ['default', 'inferno', 'viridis', 'magma', 'plasma', 'hot', 'cool'], default: 'default', label: '🌡️ Heatmap' },
        freqZoomMin: { type: 'range', min: 0, max: 0.8, default: 0, step: 0.05, label: '🔍 Freq Min' },
        freqZoomMax: { type: 'range', min: 0.2, max: 1, default: 1, step: 0.05, label: '🔍 Freq Max' },
        logFrequency: { type: 'toggle', default: false, label: '📊 Log Freq' },
        timeDirection: { type: 'select', options: ['left', 'right', 'up', 'down'], default: 'left', label: '⏩ Time Dir' },
        rotationSpeed: { type: 'range', min: 0, max: 2, default: 0, step: 0.05, label: '🌀 Rotation' },
        surfaceOpacity: { type: 'range', min: 0.1, max: 1, default: 0.7, step: 0.05, label: 'Surface Opacity' },
        wireframeOverlay: { type: 'toggle', default: false, label: '📐 Wireframe' },
        beatHighlight: { type: 'toggle', default: true, label: '💥 Beat Highlight' },
        dropFlash: { type: 'toggle', default: true, label: '🔥 Drop Flash' },
        heightScale: { type: 'range', min: 0, max: 50, default: 15, step: 1, label: '📏 Height Scale' },
        peakHold: { type: 'toggle', default: false, label: '📊 Peak Hold' },
        peakDecay: { type: 'range', min: 0.9, max: 0.999, default: 0.98, step: 0.001, label: 'Peak Decay' }
    },

    getHeatmapColor(val, palette) {
        const v = Math.max(0, Math.min(1, val));
        switch (palette) {
            case 'inferno': return `hsl(${v * 70}, ${80 + v * 20}%, ${v * 60}%)`;
            case 'viridis': return `hsl(${260 - v * 200}, ${60 + v * 30}%, ${15 + v * 55}%)`;
            case 'magma': return `hsl(${v * 60 + 270}, ${80 + v * 20}%, ${v * 65}%)`;
            case 'plasma': return `hsl(${v * 90 + 260}, ${90}%, ${20 + v * 50}%)`;
            case 'hot': return `hsl(${v * 60}, 100%, ${v * 55}%)`;
            case 'cool': return `hsl(${240 - v * 120}, 80%, ${30 + v * 40}%)`;
            default: return null;
        }
    },

    init(scene, camera, renderer) {
        camera.position.set(0, 0, 90);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.historyBuffer = [];

        // Create offscreen 2D canvas
        this.canvas2d = document.createElement('canvas');
        this.canvas2d.width = 1024;
        this.canvas2d.height = 512;
        this.ctx2d = this.canvas2d.getContext('2d');
        this.ctx2d.fillStyle = '#000';
        this.ctx2d.fillRect(0, 0, 1024, 512);

        this.texture = new THREE.CanvasTexture(this.canvas2d);
        this.texture.minFilter = THREE.LinearFilter;

        const geo = new THREE.PlaneGeometry(160, 80, 1, 1);
        const mat = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        this.plane = new THREE.Mesh(geo, mat);
        scene.add(this.plane);

        // 3D mesh for waterfall/surface modes
        this.peakHoldData = new Float32Array(512).fill(0);
    },

    build3DMesh(scene, historyDepth, freqBins) {
        if (this.mesh3D) {
            scene.remove(this.mesh3D);
            this.mesh3D.geometry.dispose();
            this.mesh3D.material.dispose();
        }
        const geo = new THREE.PlaneGeometry(160, 80, freqBins - 1, historyDepth - 1);
        geo.rotateX(-Math.PI * 0.3);
        const colors = new Float32Array(geo.attributes.position.count * 3);
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        this.mesh3D = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.7,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        scene.add(this.mesh3D);
    },

    update(audio, params, dt) {
        if (!this.ctx2d) return;
        this.time += dt;

        const ctx = this.ctx2d;
        const w = this.canvas2d.width;
        const h = this.canvas2d.height;
        const freqData = audio.frequencyData;
        const intensity = params.colorIntensity || 1.5;
        const brightness = params.brightness || 1;
        const scrollSpeed = Math.floor((params.scrollSpeed || 2) * 2);
        const palette = params.heatmapPalette || 'default';
        const freqMin = params.freqZoomMin || 0;
        const freqMax = params.freqZoomMax || 1;
        const logFreq = params.logFrequency;
        const displayMode = params.displayMode || '2D';
        const heightScale = params.heightScale || 15;

        // Peak hold
        if (params.peakHold) {
            for (let i = 0; i < freqData.length && i < this.peakHoldData.length; i++) {
                const val = freqData[i] / 255;
                if (val > this.peakHoldData[i]) {
                    this.peakHoldData[i] = val;
                } else {
                    this.peakHoldData[i] *= (params.peakDecay || 0.98);
                }
            }
        }

        // Store history for 3D modes
        const historyDepth = Math.floor(params.historyDepth || 60);
        const snapshot = new Float32Array(freqData.length);
        for (let i = 0; i < freqData.length; i++) snapshot[i] = freqData[i] / 255;
        this.historyBuffer.push(snapshot);
        while (this.historyBuffer.length > historyDepth) this.historyBuffer.shift();

        if (displayMode === '2D') {
            // Standard 2D spectrogram
            this.plane.visible = true;
            if (this.mesh3D) this.mesh3D.visible = false;

            const imageData = ctx.getImageData(scrollSpeed, 0, w - scrollSpeed, h);
            ctx.putImageData(imageData, 0, 0);

            const binCount = freqData.length;
            const columnWidth = scrollSpeed;

            for (let y = 0; y < h; y++) {
                let freqIndex;
                const normY = 1 - y / h;

                // Apply frequency zoom
                const zoomedY = freqMin + normY * (freqMax - freqMin);

                if (logFreq) {
                    freqIndex = Math.floor(Math.pow(zoomedY, 2) * binCount * 0.5);
                } else {
                    freqIndex = Math.floor(zoomedY * binCount * 0.5);
                }
                freqIndex = Math.max(0, Math.min(freqIndex, binCount - 1));

                const value = (freqData[freqIndex] || 0) / 255;
                const v = Math.pow(value, 1 / intensity) * brightness;

                // Beat highlight
                let beatMod = 1;
                if (params.beatHighlight && audio.beat) beatMod = 1.3;
                if (params.dropFlash && audio.isDropSection) beatMod = 2;

                const heatColor = this.getHeatmapColor(v * beatMod, palette);
                if (heatColor) {
                    ctx.fillStyle = heatColor;
                } else {
                    const hsl = ParamSystem.getColorHSL(value);
                    const lightness = v * 60 * beatMod;
                    ctx.fillStyle = `hsl(${hsl.h}, ${hsl.s * 100}%, ${Math.min(lightness, 100)}%)`;
                }
                ctx.fillRect(w - columnWidth, y, columnWidth, 1);

                // Peak hold line
                if (params.peakHold && freqIndex < this.peakHoldData.length) {
                    const peakVal = this.peakHoldData[freqIndex];
                    if (peakVal > value + 0.05) {
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.fillRect(w - columnWidth, y, columnWidth, 1);
                    }
                }
            }

            this.texture.needsUpdate = true;

            // Rotation
            if (params.rotationSpeed > 0) {
                this.plane.rotation.y += params.rotationSpeed * dt * 0.5;
            }

        } else if (displayMode === '3DWaterfall' || displayMode === '3DSurface') {
            this.plane.visible = false;
            const freqBins = Math.min(64, Math.floor(freqData.length * (freqMax - freqMin)));
            if (!this.mesh3D || this.mesh3D.geometry.attributes.position.count !== freqBins * historyDepth) {
                this.build3DMesh(this.plane.parent, historyDepth, freqBins);
            }
            if (this.mesh3D) {
                this.mesh3D.visible = true;
                this.mesh3D.material.wireframe = params.wireframeOverlay;
                this.mesh3D.material.opacity = params.surfaceOpacity || 0.7;
                const pos = this.mesh3D.geometry.attributes.position.array;
                const col = this.mesh3D.geometry.attributes.color.array;

                for (let t = 0; t < this.historyBuffer.length && t < historyDepth; t++) {
                    const row = this.historyBuffer[t];
                    for (let f = 0; f < freqBins; f++) {
                        const idx = t * freqBins + f;
                        const fIdx = Math.floor(freqMin * freqData.length + (f / freqBins) * (freqMax - freqMin) * freqData.length);
                        const val = (row && fIdx < row.length) ? row[Math.max(0, fIdx)] : 0;

                        if (idx * 3 + 1 < pos.length) {
                            pos[idx * 3 + 1] = val * heightScale;
                        }

                        if (idx * 3 + 2 < col.length) {
                            const c = ParamSystem.getColorThreeHSL(val);
                            col[idx * 3] = c.r * (0.3 + val * 0.7);
                            col[idx * 3 + 1] = c.g * (0.3 + val * 0.7);
                            col[idx * 3 + 2] = c.b * (0.3 + val * 0.7);
                        }
                    }
                }

                this.mesh3D.geometry.attributes.position.needsUpdate = true;
                this.mesh3D.geometry.attributes.color.needsUpdate = true;
                if (params.rotationSpeed > 0) {
                    this.mesh3D.rotation.y += params.rotationSpeed * dt * 0.5;
                }
            }
        }
    },

    destroy(scene) {
        if (this.plane) {
            scene.remove(this.plane);
            this.plane.geometry.dispose();
            this.plane.material.dispose();
        }
        if (this.mesh3D) {
            scene.remove(this.mesh3D);
            this.mesh3D.geometry.dispose();
            this.mesh3D.material.dispose();
        }
        if (this.texture) this.texture.dispose();
        this.canvas2d = null;
        this.ctx2d = null;
        this.historyBuffer = [];
    }
};
