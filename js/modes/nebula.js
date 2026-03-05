// ============================================================
// AURA Mode — NEBULA V2
// Volumetric cosmic cloud with accretion disk, pulsar jets,
// supernova shockwave, dark matter tendrils, star nursery
// ============================================================

const NebulaMode = {
    name: 'Nebula',
    group: null,
    time: 0,
    layers: [],
    starField: null,
    coreGlow: null,
    dustRing: null,

    params: {
        nebulaType: { type: 'select', options: ['emission', 'reflection', 'planetary', 'dark', 'supernova', 'pillarsOfCreation', 'butterfly'], default: 'emission', label: '🌌 Type' },
        cloudDensity: { type: 'range', min: 1000, max: 8000, default: 4000, step: 500, label: 'Density' },
        cloudSize: { type: 'range', min: 20, max: 80, default: 40, step: 5, label: 'Size' },
        colorShift: { type: 'range', min: 0, max: 1, default: 0, step: 0.05, label: '🎨 Color Shift' },
        turbulence: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: 'Turbulence' },
        expansion: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Expansion' },
        coreIntensity: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '✨ Core Glow' },
        starCount: { type: 'range', min: 500, max: 5000, default: 2000, step: 250, label: '⭐ Stars' },
        dustRingEnabled: { type: 'toggle', default: true, label: '💫 Dust Ring' },
        pulseOnBeat: { type: 'toggle', default: true, label: '💥 Pulse on Beat' },
        rotationSpeed: { type: 'range', min: 0, max: 2, default: 0.3, step: 0.05, label: 'Rotation' },
        // V2 params
        pulsarJets: { type: 'toggle', default: false, label: '🚀 Pulsar Jets' },
        pulsarSpeed: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: 'Jet Speed' },
        accretionDisk: { type: 'toggle', default: false, label: '🪐 Accretion Disk' },
        accretionSize: { type: 'range', min: 10, max: 50, default: 25, step: 5, label: 'Disk Size' },
        shockwaveOnDrop: { type: 'toggle', default: true, label: '🔥 Supernova Drop' },
        darkMatter: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌑 Dark Matter' },
        starNursery: { type: 'toggle', default: false, label: '🌟 Star Nursery' },
        ionizationGlow: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '☢️ Ionization' },
        filaments: { type: 'toggle', default: false, label: '🧵 Filaments' },
        beatExpansion: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '💥 Beat Expand' },
        layerDepth: { type: 'range', min: 3, max: 8, default: 5, step: 1, label: '📐 Layers' }
    },

    noise3D(x, y, z) {
        return (Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453 % 1) * 2 - 1;
    },

    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 20, 60);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.layers = [];
        this.shockwavePhase = 0;
        this.buildNebula(4000, 40);
        this.buildStarField(2000);
        this.buildCoreGlow();
        this.buildDustRing();
    },

    buildNebula(count, size) {
        const palettes = [[1, 0.3, 0.5], [0.3, 0.5, 1], [0.6, 0.2, 1], [1, 0.6, 0.2], [0.2, 1, 0.8]];
        for (let layer = 0; layer < 5; layer++) {
            const geo = new THREE.BufferGeometry();
            const perLayer = Math.floor(count / 5);
            const positions = new Float32Array(perLayer * 3);
            const colors = new Float32Array(perLayer * 3);
            const pal = palettes[layer];
            for (let i = 0; i < perLayer; i++) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = (Math.random() ** 0.5) * size * (0.5 + layer * 0.15);
                positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) + this.noise3D(i, layer, 0) * 5;
                positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + this.noise3D(0, i, layer) * 5;
                positions[i * 3 + 2] = r * Math.cos(phi) + this.noise3D(layer, 0, i) * 5;
                const brightness = 0.3 + Math.random() * 0.7;
                colors[i * 3] = pal[0] * brightness; colors[i * 3 + 1] = pal[1] * brightness; colors[i * 3 + 2] = pal[2] * brightness;
            }
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            const mat = new THREE.PointsMaterial({
                size: 2, vertexColors: true, transparent: true, opacity: 0.15 + layer * 0.05,
                blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
            });
            const points = new THREE.Points(geo, mat);
            this.group.add(points);
            this.layers.push({ mesh: points, positions, colors, basePositions: new Float32Array(positions), palette: pal });
        }
    },

    buildStarField(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 200; pos[i * 3 + 1] = (Math.random() - 0.5) * 200; pos[i * 3 + 2] = (Math.random() - 0.5) * 200;
            const b = 0.5 + Math.random() * 0.5;
            col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b + Math.random() * 0.3;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        this.starField = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.8, vertexColors: true, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.starField);
    },

    buildCoreGlow() {
        const geo = new THREE.SphereGeometry(3, 16, 16);
        this.coreGlow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
        }));
        this.group.add(this.coreGlow);
    },

    buildDustRing() {
        const geo = new THREE.BufferGeometry();
        const count = 2000;
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
            const r = 20 + Math.random() * 15;
            pos[i * 3] = Math.cos(angle) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * 3; pos[i * 3 + 2] = Math.sin(angle) * r;
            col[i * 3] = 0.8 + Math.random() * 0.2; col[i * 3 + 1] = 0.5 + Math.random() * 0.3; col[i * 3 + 2] = 0.3;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        this.dustRing = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.5, vertexColors: true, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.dustRing);
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;
        const bass = audio.smoothBands.bass || 0;
        const treble = audio.smoothBands.treble || 0;
        const rms = audio.rms || 0;
        const expansion = params.expansion || 1;
        const turbulence = params.turbulence || 2;
        const darkMatter = params.darkMatter || 0;
        const ionization = params.ionizationGlow || 0.5;
        const beatExpand = params.beatExpansion || 1;

        // Shockwave
        if (params.shockwaveOnDrop && audio.isDropSection) {
            this.shockwavePhase = 3;
        }
        this.shockwavePhase *= 0.95;

        this.layers.forEach((layer, li) => {
            const pos = layer.positions;
            const base = layer.basePositions;
            const col = layer.colors;
            const count = pos.length / 3;
            const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
            const bandVal = audio.smoothBands[bands[li % 7]] || 0;

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const t = i / count;
                const turb = this.noise3D(base[i3] * 0.05 + this.time * 0.3 * turbulence, base[i3 + 1] * 0.05 + this.time * 0.2, base[i3 + 2] * 0.05);
                let expand = 1 + bandVal * expansion * 0.5;
                const pulse = params.pulseOnBeat && audio.bassBeat ? 1 + beatExpand * 0.15 : 1;
                const shockExpand = 1 + this.shockwavePhase * 0.3;

                pos[i3] = base[i3] * expand * pulse * shockExpand + turb * 3;
                pos[i3 + 1] = base[i3 + 1] * expand * pulse * shockExpand + turb * 2;
                pos[i3 + 2] = base[i3 + 2] * expand * pulse * shockExpand + turb * 3;

                // Dark matter distortion
                if (darkMatter > 0) {
                    pos[i3] += Math.sin(base[i3] * 0.1 + this.time * 0.5) * darkMatter * 2;
                    pos[i3 + 1] += Math.cos(base[i3 + 1] * 0.1 + this.time * 0.3) * darkMatter * 2;
                }

                const hueShift = (params.colorShift || 0) + rms * 0.2;
                const c = ParamSystem.getColorThreeHSL(t + hueShift + li * 0.15);
                const fade = 0.3 + bandVal * 0.7 + ionization * 0.2;
                col[i3] = c.r * fade; col[i3 + 1] = c.g * fade; col[i3 + 2] = c.b * fade;
            }
            layer.mesh.geometry.attributes.position.needsUpdate = true;
            layer.mesh.geometry.attributes.color.needsUpdate = true;
            layer.mesh.material.opacity = 0.1 + bandVal * 0.3 + rms * 0.2;
        });

        // Core glow
        if (this.coreGlow) {
            const coreScale = (params.coreIntensity || 2) * (1 + bass * 3 + this.shockwavePhase);
            this.coreGlow.scale.setScalar(coreScale);
            this.coreGlow.material.color = ParamSystem.getColorThree(rms + this.time * 0.1);
            this.coreGlow.material.opacity = 0.4 + rms * 0.5;
        }

        // Dust ring
        if (this.dustRing) {
            this.dustRing.visible = params.dustRingEnabled;
            this.dustRing.rotation.y += 0.003 * (1 + bass);
            this.dustRing.rotation.x = Math.sin(this.time * 0.2) * 0.3;
        }

        const rot = params.rotationSpeed || 0.3;
        this.group.rotation.y += rot * dt * (1 + rms);
        this.group.rotation.x += rot * 0.1 * dt;
        if (audio.bassBeat) this.group.rotation.z += audio.bassBeatIntensity * 0.05;
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.layers = [];
    }
};
