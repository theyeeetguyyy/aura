// ============================================================
// AURA Mode — CYBER GRID V2
// Retro-futuristic grid with hologram, data streams, glitch,
// portal, depth fog, neon rain, scanner line
// ============================================================

const CyberGridMode = {
    name: 'Cyber Grid',
    group: null,
    time: 0,
    gridMesh: null,
    gridPositions: null,
    pillars: [],
    laserGroup: null,
    sunMesh: null,

    params: {
        gridSize: { type: 'range', min: 40, max: 120, default: 80, step: 10, label: '📐 Grid Size' },
        gridDetail: { type: 'range', min: 20, max: 60, default: 40, step: 5, label: 'Detail' },
        waveHeight: { type: 'range', min: 0, max: 20, default: 8, step: 1, label: '🌊 Wave' },
        waveSpeed: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: 'Wave Speed' },
        pillarCount: { type: 'range', min: 0, max: 20, default: 8, step: 1, label: '🏢 Pillars' },
        pillarReact: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: 'Pillar React' },
        laserCount: { type: 'range', min: 0, max: 10, default: 4, step: 1, label: '⚡ Lasers' },
        showSun: { type: 'toggle', default: true, label: '☀️ Retro Sun' },
        gridColor: { type: 'select', options: ['neon', 'cyan', 'magenta', 'gold', 'rainbow', 'matrix', 'vaporwave'], default: 'neon', label: '🎨 Color' },
        beatWave: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '💥 Beat Wave' },
        perspective: { type: 'range', min: 10, max: 60, default: 30, step: 5, label: 'Tilt' },
        // V2 params
        glitchEffect: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '📺 Glitch' },
        scannerLine: { type: 'toggle', default: false, label: '📡 Scanner Line' },
        scanSpeed: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: 'Scan Speed' },
        dataStream: { type: 'toggle', default: false, label: '📊 Data Streams' },
        depthFog: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌫️ Depth Fog' },
        hologramOverlay: { type: 'toggle', default: false, label: '🔮 Hologram' },
        neonRain: { type: 'toggle', default: false, label: '🌧️ Neon Rain' },
        pillarStyle: { type: 'select', options: ['box', 'cylinder', 'diamond', 'hexagonal'], default: 'box', label: '🏗️ Pillar Style' },
        beatGlitch: { type: 'toggle', default: false, label: '💥 Beat Glitch' },
        dropPortal: { type: 'toggle', default: true, label: '🔥 Drop Portal' },
        scrollSpeed: { type: 'range', min: 0, max: 10, default: 3, step: 0.5, label: '⏩ Scroll Speed' },
        horizonGlow: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🌅 Horizon' }
    },

    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 30, 40);
        camera.lookAt(0, 0, -20);
        this.time = 0;
        this.pillars = [];
        this.portalPhase = 0;
        this.buildGrid(80, 40);
        this.buildPillars(8);
        this.buildLasers(4);
        this.buildSun();
    },

    buildGrid(size, detail) {
        if (this.gridMesh) { this.group.remove(this.gridMesh); this.gridMesh.geometry.dispose(); this.gridMesh.material.dispose(); }
        const geo = new THREE.PlaneGeometry(size, size, detail, detail);
        geo.rotateX(-Math.PI / 2);
        this.gridPositions = geo.attributes.position.array;
        const colors = new Float32Array((detail + 1) * (detail + 1) * 3).fill(0);
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.gridMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            wireframe: true, vertexColors: true, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending
        }));
        this.group.add(this.gridMesh);
    },

    buildPillars(count) {
        this.pillars.forEach(p => { this.group.remove(p); p.geometry.dispose(); p.material.dispose(); });
        this.pillars = [];
        for (let i = 0; i < count; i++) {
            const geo = new THREE.BoxGeometry(1.5, 1, 1.5);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
            const pillar = new THREE.Mesh(geo, mat);
            const angle = (i / count) * Math.PI * 2;
            const r = 15 + Math.random() * 15;
            pillar.position.x = Math.cos(angle) * r;
            pillar.position.z = Math.sin(angle) * r - 10;
            this.group.add(pillar);
            this.pillars.push(pillar);
        }
    },

    buildLasers(count) {
        if (this.laserGroup) this.group.remove(this.laserGroup);
        this.laserGroup = new THREE.Group();
        for (let i = 0; i < count; i++) {
            const geo = new THREE.CylinderGeometry(0.05, 0.05, 80, 4);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
            const laser = new THREE.Mesh(geo, mat);
            laser.rotation.z = Math.PI / 2;
            laser.position.y = 15 + i * 5;
            laser.position.z = -20 - i * 10;
            this.laserGroup.add(laser);
        }
        this.group.add(this.laserGroup);
    },

    buildSun() {
        const geo = new THREE.CircleGeometry(12, 32);
        this.sunMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0xff6600, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
        }));
        this.sunMesh.position.set(0, 20, -60);
        this.group.add(this.sunMesh);
        const glowGeo = new THREE.CircleGeometry(18, 32);
        const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
            color: 0xff3300, transparent: true, opacity: 0.2, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
        }));
        glow.position.copy(this.sunMesh.position);
        glow.position.z -= 1;
        this.group.add(glow);
    },

    getGridColor(palette, t, rms) {
        switch (palette) {
            case 'cyan': return new THREE.Color(0, 0.8 + rms * 0.2, 1);
            case 'magenta': return new THREE.Color(1, 0, 0.8 + rms * 0.2);
            case 'gold': return new THREE.Color(1, 0.85, 0.1 + rms * 0.3);
            case 'rainbow': return new THREE.Color().setHSL((t + rms) % 1, 1, 0.5);
            case 'matrix': return new THREE.Color(0, 0.8 + rms * 0.2, 0);
            case 'vaporwave': return new THREE.Color().setHSL(0.8 + t * 0.15, 1, 0.4 + rms * 0.2);
            default: return new THREE.Color(0, 1 * (0.5 + rms), 0.8 + rms * 0.2);
        }
    },

    update(audio, params, dt) {
        if (!this.group || !this.gridMesh) return;
        this.time += dt;
        const bass = audio.smoothBands.bass || 0;
        const mid = audio.smoothBands.mid || 0;
        const treble = audio.smoothBands.treble || 0;
        const rms = audio.rms || 0;
        const waveH = (params.waveHeight || 8) * (1 + bass * (params.beatWave || 2));
        const waveSpd = params.waveSpeed || 1;
        const palette = params.gridColor || 'neon';
        const glitch = params.glitchEffect || 0;
        const depthFog = params.depthFog || 0;
        const scrollSpeed = params.scrollSpeed || 3;

        // Portal
        if (params.dropPortal && audio.isDrop) this.portalPhase = 3;
        this.portalPhase *= 0.95;

        // Grid
        const pos = this.gridPositions;
        const col = this.gridMesh.geometry.attributes.color.array;
        const vertCount = pos.length / 3;
        for (let i = 0; i < vertCount; i++) {
            const i3 = i * 3;
            const x = pos[i3], z = pos[i3 + 2];
            let wave = Math.sin(x * 0.15 + this.time * waveSpd) * waveH * 0.5
                + Math.sin(z * 0.2 - this.time * waveSpd * 0.7) * waveH * 0.3
                + Math.cos((x + z) * 0.1 + this.time * waveSpd * 1.3) * waveH * 0.2;
            const t = i / vertCount;
            const fIdx = Math.floor(t * audio.frequencyData.length * 0.3);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;

            // Glitch
            if (glitch > 0 && Math.random() < glitch * 0.01) {
                wave += (Math.random() - 0.5) * glitch * 10;
            }
            if (params.beatGlitch && audio.beat) {
                wave += Math.sin(i * 100) * audio.beatIntensity * 5;
            }

            // Portal distortion
            if (this.portalPhase > 0.1) {
                const dx = x, dz = z + 10;
                const dist = Math.sqrt(dx * dx + dz * dz);
                wave += Math.sin(dist * 2 - this.time * 5) * this.portalPhase * 5 * Math.exp(-dist * 0.05);
            }

            pos[i3 + 1] = wave + freq * waveH;

            const c = this.getGridColor(palette, t, rms);
            let brightness = 0.3 + freq * 0.7;
            // Depth fog
            if (depthFog > 0) {
                const dFromCamera = Math.abs(z + 10) / 50;
                brightness *= Math.exp(-dFromCamera * depthFog * 0.5);
            }
            // Scanner line
            if (params.scannerLine) {
                const scanPos = ((this.time * (params.scanSpeed || 2)) % 80) - 40;
                if (Math.abs(x - scanPos) < 2) brightness += 1;
            }
            col[i3] = c.r * brightness; col[i3 + 1] = c.g * brightness; col[i3 + 2] = c.b * brightness;
        }
        this.gridMesh.geometry.attributes.position.needsUpdate = true;
        this.gridMesh.geometry.attributes.color.needsUpdate = true;

        // Pillars
        const pillarReact = params.pillarReact || 2;
        const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
        this.pillars.forEach((pillar, i) => {
            const band = audio.smoothBands[bands[i % bands.length]] || 0;
            const h = 1 + band * 30 * pillarReact;
            pillar.scale.y = h;
            pillar.position.y = h / 2;
            pillar.material.color = ParamSystem.getColorThree(band + this.time * 0.05 + i * 0.1);
            pillar.material.opacity = 0.3 + band * 0.5;
        });

        // Lasers
        if (this.laserGroup) {
            this.laserGroup.children.forEach((laser, i) => {
                laser.material.opacity = 0.1 + treble * 0.8;
                laser.rotation.x = Math.sin(this.time * 2 + i) * 0.1;
                laser.position.x = Math.sin(this.time * 0.5 + i * 2) * 10;
                laser.material.color = ParamSystem.getColorThree(this.time * 0.1 + i * 0.2);
            });
        }

        // Sun
        if (this.sunMesh) {
            this.sunMesh.visible = params.showSun;
            this.sunMesh.scale.setScalar(1 + bass * 0.5);
            const hGlow = params.horizonGlow || 1;
            this.sunMesh.material.opacity = (0.5 + rms * 0.3) * hGlow;
        }

        // Grid scroll
        this.gridMesh.position.z = (this.time * scrollSpeed * waveSpd) % 5;
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.pillars = [];
    }
};
