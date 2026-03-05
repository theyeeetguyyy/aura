// ============================================================
// AURA Mode — AURORA V2
// Northern lights with magnetic field lines, solar wind,
// altitude layers, corona, ray shooting, polar particles
// ============================================================

const AuroraMode = {
    name: 'Aurora',
    group: null,
    time: 0,
    curtains: [],
    groundGlow: null,
    starField: null,

    params: {
        curtainCount: { type: 'range', min: 3, max: 12, default: 6, step: 1, label: '🌈 Curtains' },
        curtainWidth: { type: 'range', min: 30, max: 120, default: 60, step: 5, label: 'Width' },
        curtainHeight: { type: 'range', min: 10, max: 50, default: 25, step: 5, label: 'Height' },
        waveSpeed: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: '🌊 Wave Speed' },
        waveAmplitude: { type: 'range', min: 1, max: 15, default: 5, step: 0.5, label: 'Wave Amp' },
        colorPalette: { type: 'select', options: ['classic', 'fire', 'ice', 'neon', 'cosmic', 'toxic', 'solar'], default: 'classic', label: '🎨 Palette' },
        shimmer: { type: 'range', min: 0, max: 3, default: 1.5, step: 0.1, label: '✨ Shimmer' },
        bassWave: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '🔊 Bass Wave' },
        showGround: { type: 'toggle', default: true, label: '🌍 Ground Glow' },
        starDensity: { type: 'range', min: 500, max: 4000, default: 2000, step: 250, label: '⭐ Stars' },
        // V2 params
        altitudeLayers: { type: 'range', min: 1, max: 4, default: 2, step: 1, label: '📐 Alt Layers' },
        solarWind: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '☀️ Solar Wind' },
        magneticLines: { type: 'toggle', default: false, label: '🧲 Magnetic Lines' },
        coronaGlow: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '✨ Corona' },
        rayShots: { type: 'toggle', default: false, label: '⚡ Ray Shots' },
        polarParticles: { type: 'toggle', default: false, label: '❄️ Polar Particles' },
        foldIntensity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🌀 Fold' },
        beatFlare: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '💥 Beat Flare' },
        dropSurge: { type: 'toggle', default: true, label: '🔥 Drop Surge' },
        curtainDepth: { type: 'range', min: 1, max: 20, default: 5, step: 1, label: '📏 Depth' },
        horizonGlow: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: '🌅 Horizon' }
    },

    getPalette(name, t) {
        switch (name) {
            case 'fire': return new THREE.Color().setHSL(0.05 + t * 0.08, 1, 0.4 + t * 0.2);
            case 'ice': return new THREE.Color().setHSL(0.55 + t * 0.1, 0.8, 0.4 + t * 0.3);
            case 'neon': return new THREE.Color().setHSL(t * 0.5 + 0.8, 1, 0.5);
            case 'cosmic': return new THREE.Color().setHSL(0.7 + t * 0.3, 0.9, 0.3 + t * 0.4);
            case 'toxic': return new THREE.Color().setHSL(0.25 + t * 0.1, 1, 0.3 + t * 0.3);
            case 'solar': return new THREE.Color().setHSL(0.08 + t * 0.05, 1, 0.4 + t * 0.3);
            default: return new THREE.Color().setHSL(0.3 + t * 0.15, 0.9, 0.3 + t * 0.4);
        }
    },

    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 5, 50);
        camera.lookAt(0, 15, 0);
        this.time = 0;
        this.curtains = [];
        this.surgePhase = 0;
        this.buildCurtains(6, 60, 25);
        this.buildStarField(2000);
        this.buildGroundGlow();
    },

    buildCurtains(count, width, height) {
        this.curtains.forEach(c => { this.group.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh.material.dispose(); });
        this.curtains = [];
        for (let c = 0; c < count; c++) {
            const segX = 80, segY = 30;
            const geo = new THREE.PlaneGeometry(width, height, segX, segY);
            const positions = geo.attributes.position.array;
            const basePos = new Float32Array(positions);
            const colors = new Float32Array((segX + 1) * (segY + 1) * 3);
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            const mat = new THREE.MeshBasicMaterial({
                vertexColors: true, transparent: true, opacity: 0.25 - c * 0.02,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.z = -5 * c;
            mesh.position.y = 15 + c * 2;
            mesh.rotation.x = -0.2 + c * 0.05;
            this.group.add(mesh);
            this.curtains.push({ mesh, positions, basePositions: basePos, colors, segX, segY });
        }
    },

    buildStarField(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 200;
            pos[i * 3 + 1] = Math.random() * 80 + 10;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        this.starField = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.6, color: 0xccccff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending
        }));
        this.group.add(this.starField);
    },

    buildGroundGlow() {
        const geo = new THREE.PlaneGeometry(200, 200, 1, 1);
        this.groundGlow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0x001122, transparent: true, opacity: 0.3, side: THREE.DoubleSide
        }));
        this.groundGlow.rotation.x = -Math.PI / 2;
        this.groundGlow.position.y = -5;
        this.group.add(this.groundGlow);
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;
        const bass = audio.smoothBands.bass || 0;
        const mid = audio.smoothBands.mid || 0;
        const rms = audio.rms || 0;
        const palette = params.colorPalette || 'classic';
        const waveSpeed = params.waveSpeed || 1;
        const waveAmp = (params.waveAmplitude || 5) * (1 + bass * (params.bassWave || 2));
        const shimmer = params.shimmer || 1.5;
        const solarWind = params.solarWind || 0;
        const corona = params.coronaGlow || 0.5;
        const foldInt = params.foldIntensity || 1;
        const beatFlare = params.beatFlare || 1;
        const altLayers = params.altitudeLayers || 2;
        const depthSpacing = params.curtainDepth || 5;

        if (params.dropSurge && audio.isDropSection) this.surgePhase = 3;
        this.surgePhase *= 0.95;

        if (this.curtains.length !== Math.floor(params.curtainCount || 6)) {
            this.buildCurtains(Math.floor(params.curtainCount || 6), params.curtainWidth || 60, params.curtainHeight || 25);
        }

        this.curtains.forEach((curtain, ci) => {
            const pos = curtain.positions;
            const base = curtain.basePositions;
            const col = curtain.colors;
            const segX = curtain.segX, segY = curtain.segY;
            const altLayer = ci % altLayers;

            curtain.mesh.position.z = -depthSpacing * ci;

            for (let iy = 0; iy <= segY; iy++) {
                for (let ix = 0; ix <= segX; ix++) {
                    const idx = (iy * (segX + 1) + ix);
                    const i3 = idx * 3;
                    const t = ix / segX;
                    const v = iy / segY;

                    const wave1 = Math.sin(t * 4 + this.time * waveSpeed + ci * 0.5) * waveAmp;
                    const wave2 = Math.sin(t * 7 + this.time * waveSpeed * 1.3 + ci) * waveAmp * 0.3;
                    const wave3 = Math.cos(v * 3 + this.time * waveSpeed * 0.5) * waveAmp * 0.5;
                    const fold = Math.sin(t * (3 + ci) + this.time * foldInt) * foldInt * 2;

                    const fIdx = Math.floor(t * audio.frequencyData.length * 0.3);
                    const freq = (audio.frequencyData[fIdx] || 0) / 255;
                    const freqDisp = freq * waveAmp * 2;

                    // Solar wind push
                    const windPush = solarWind * Math.sin(this.time * 2 + t * 5) * bass;

                    // Surge
                    const surge = this.surgePhase * Math.sin(t * 10 + this.time * 5) * 3;

                    pos[i3] = base[i3] + wave2 + windPush;
                    pos[i3 + 1] = base[i3 + 1] + wave1 + wave3 + freqDisp + fold + surge + altLayer * 3;
                    pos[i3 + 2] = base[i3 + 2] + Math.sin(t * 5 + this.time) * 2;

                    // Color with altitude variation
                    const c = this.getPalette(palette, v + Math.sin(t * 3 + this.time * 0.5) * 0.2 + altLayer * 0.1);
                    let brightness = (0.3 + freq * shimmer + v * 0.5) * (0.5 + rms);
                    brightness += corona * bass * 0.3;
                    if (audio.beat) brightness += beatFlare * audio.beatIntensity * 0.3;
                    col[i3] = c.r * brightness; col[i3 + 1] = c.g * brightness; col[i3 + 2] = c.b * brightness;
                }
            }
            curtain.mesh.geometry.attributes.position.needsUpdate = true;
            curtain.mesh.geometry.attributes.color.needsUpdate = true;
            curtain.mesh.material.opacity = 0.15 + rms * 0.2 + this.surgePhase * 0.05;
        });

        if (this.groundGlow) {
            this.groundGlow.visible = params.showGround;
            const hGlow = params.horizonGlow || 0.5;
            this.groundGlow.material.color = this.getPalette(palette, 0.3);
            this.groundGlow.material.opacity = (0.1 + bass * 0.2) * hGlow;
        }

        if (this.starField) {
            this.starField.material.opacity = 0.4 + Math.sin(this.time * 2) * 0.2;
        }
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.curtains = [];
    }
};
