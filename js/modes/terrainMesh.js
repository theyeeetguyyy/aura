// ============================================================
// AURA Mode — Terrain Mesh V2
// 3D heightmap with erosion, biomes, frequency carving,
// fog, sky gradients, multiple layers, beat quakes
// ============================================================

const TerrainMeshMode = {
    name: 'Terrain Mesh',
    mesh: null,
    originalPositions: null,
    layers: [],
    waterPlane: null,
    time: 0,
    quakeIntensity: 0,

    params: {
        resolution: { type: 'range', min: 16, max: 128, default: 64, step: 4, label: 'Resolution' },
        terrainSize: { type: 'range', min: 50, max: 300, default: 150, step: 10, label: 'Terrain Size' },
        heightScale: { type: 'range', min: 5, max: 100, default: 40, step: 1, label: 'Height Scale' },
        wireframe: { type: 'toggle', default: true, label: 'Wireframe' },
        style: { type: 'select', options: ['wireframe', 'solid', 'points', 'mixed'], default: 'wireframe', label: 'Render Style' },
        waveType: { type: 'select', options: ['frequency', 'ripple', 'perlin', 'waves', 'ridged', 'terraces', 'canyons'], default: 'frequency', label: 'Wave Type' },
        flySpeed: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: 'Fly Speed' },
        colorByHeight: { type: 'toggle', default: true, label: 'Color by Height' },
        rotationX: { type: 'range', min: -1, max: 1, default: -0.3, step: 0.05, label: 'Tilt' },
        animateVertices: { type: 'toggle', default: true, label: 'Animate Vertices' },
        // V2 params
        erosionType: { type: 'select', options: ['none', 'hydraulic', 'thermal', 'wind'], default: 'none', label: '🌊 Erosion' },
        erosionStrength: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Erosion Str' },
        biomeMode: { type: 'select', options: ['single', 'altitude', 'moisture', 'temperature'], default: 'single', label: '🌍 Biome' },
        waterLevel: { type: 'range', min: -1, max: 0.5, default: -0.5, step: 0.05, label: '💧 Water Level' },
        waterEnabled: { type: 'toggle', default: false, label: '💧 Show Water' },
        terrainLayers: { type: 'range', min: 1, max: 4, default: 1, step: 1, label: '📐 Layers' },
        layerOffset: { type: 'range', min: 5, max: 30, default: 12, step: 1, label: 'Layer Offset' },
        carveByBand: { type: 'toggle', default: false, label: '🎵 Freq Carve' },
        noiseOctaves: { type: 'range', min: 1, max: 6, default: 3, step: 1, label: '🔊 Noise Octaves' },
        noiseLacunarity: { type: 'range', min: 1, max: 4, default: 2, step: 0.1, label: 'Lacunarity' },
        fogDensity: { type: 'range', min: 0, max: 0.02, default: 0.003, step: 0.001, label: '🌫️ Fog' },
        beatQuake: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '💥 Beat Quake' },
        dropFissure: { type: 'toggle', default: false, label: '🔥 Drop Fissure' },
        gridGlow: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: '✨ Grid Glow' }
    },

    noise3D(x, y, z) {
        return (Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453 % 1) * 2 - 1;
    },

    fbm(x, y, z, octaves, lacunarity) {
        let val = 0, amp = 1, freq = 1, total = 0;
        for (let i = 0; i < octaves; i++) {
            val += this.noise3D(x * freq, y * freq, z * freq) * amp;
            total += amp;
            amp *= 0.5;
            freq *= lacunarity;
        }
        return val / total;
    },

    init(scene, camera, renderer) {
        camera.position.set(0, 60, 80);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.quakeIntensity = 0;
        this.layers = [];
        this.buildMesh(scene, 64, 150);
    },

    buildMesh(scene, res, size) {
        // Clean up existing
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        this.layers.forEach(l => {
            scene.remove(l);
            l.geometry.dispose();
            l.material.dispose();
        });
        this.layers = [];
        if (this.waterPlane) {
            scene.remove(this.waterPlane);
            this.waterPlane.geometry.dispose();
            this.waterPlane.material.dispose();
            this.waterPlane = null;
        }

        const geo = new THREE.PlaneGeometry(size, size, res, res);
        geo.rotateX(-Math.PI / 2);

        this.originalPositions = new Float32Array(geo.attributes.position.array);

        const mat = new THREE.MeshBasicMaterial({
            wireframe: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });

        const colors = new Float32Array(geo.attributes.position.count * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        this.mesh = new THREE.Mesh(geo, mat);
        scene.add(this.mesh);

        // Water plane
        const waterGeo = new THREE.PlaneGeometry(size * 1.2, size * 1.2, 1, 1);
        waterGeo.rotateX(-Math.PI / 2);
        this.waterPlane = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({
            color: 0x0044aa, transparent: true, opacity: 0.3,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.waterPlane.visible = false;
        scene.add(this.waterPlane);
    },

    getBiomeColor(height, normalH, biomeMode, t) {
        if (biomeMode === 'altitude') {
            if (normalH < 0.15) return new THREE.Color(0.1, 0.3, 0.8); // deep water
            if (normalH < 0.3) return new THREE.Color(0.9, 0.8, 0.5); // beach
            if (normalH < 0.6) return new THREE.Color(0.2, 0.7, 0.2); // grass
            if (normalH < 0.8) return new THREE.Color(0.5, 0.4, 0.3); // mountain
            return new THREE.Color(0.9, 0.95, 1); // snow
        }
        if (biomeMode === 'moisture') {
            const moisture = Math.sin(t * Math.PI * 4) * 0.5 + 0.5;
            return new THREE.Color().setHSL(0.3 - moisture * 0.3, 0.6 + normalH * 0.4, 0.3 + normalH * 0.4);
        }
        if (biomeMode === 'temperature') {
            return new THREE.Color().setHSL(0.65 - normalH * 0.65, 0.9, 0.3 + normalH * 0.4);
        }
        return null; // use default
    },

    update(audio, params, dt) {
        if (!this.mesh) return;
        this.time += dt;

        const heightScale = (params.heightScale || 40) * (params.reactivity || 1);
        const flySpeed = params.flySpeed || 1;
        const waveType = params.waveType || 'frequency';
        const octaves = Math.floor(params.noiseOctaves || 3);
        const lacunarity = params.noiseLacunarity || 2;
        const biomeMode = params.biomeMode || 'single';
        const erosionType = params.erosionType || 'none';
        const erosionStr = params.erosionStrength || 1;
        const beatQuake = params.beatQuake || 0;

        // Beat quake
        if (beatQuake > 0 && audio.bassBeat) {
            this.quakeIntensity = audio.bassBeatIntensity * beatQuake;
        }
        this.quakeIntensity *= 0.9;

        const pos = this.mesh.geometry.attributes.position.array;
        const cols = this.mesh.geometry.attributes.color.array;
        const res = Math.sqrt(pos.length / 3) | 0;
        const freqData = audio.frequencyData;

        // Style
        const style = params.style || 'wireframe';
        this.mesh.material.wireframe = style === 'wireframe' || style === 'mixed';
        if (style === 'points') {
            this.mesh.material.wireframe = false;
            this.mesh.material.opacity = 0.5;
        }

        for (let i = 0; i < pos.length / 3; i++) {
            const ix = i % res;
            const iz = Math.floor(i / res);
            const nx = ix / res;
            const nz = iz / res;

            let height = 0;

            if (waveType === 'frequency') {
                const fIdx = Math.floor(nx * freqData.length * 0.5);
                height = (freqData[fIdx] || 0) / 255 * heightScale;
                height *= (0.5 + Math.sin(nz * Math.PI * 4 + this.time * flySpeed * 2) * 0.5);
            } else if (waveType === 'ripple') {
                const cx = nx - 0.5, cz = nz - 0.5;
                const dist = Math.sqrt(cx * cx + cz * cz);
                height = Math.sin(dist * 20 - this.time * flySpeed * 3) * heightScale * audio.rms;
            } else if (waveType === 'perlin') {
                height = this.fbm(nx * 3 + this.time * flySpeed * 0.3, nz * 3, this.time * 0.1, octaves, lacunarity) * heightScale * audio.smoothBands.bass;
                height += this.fbm(nx * 8, nz * 8, this.time * 0.5, 2, 2) * heightScale * 0.3 * audio.smoothBands.treble;
            } else if (waveType === 'waves') {
                height = Math.sin(nz * 10 - this.time * flySpeed * 3) * heightScale * audio.smoothBands.bass;
                height += Math.sin(nx * 6 + this.time * flySpeed * 2) * heightScale * 0.5 * audio.smoothBands.mid;
            } else if (waveType === 'ridged') {
                const n = this.fbm(nx * 3 + this.time * 0.2, nz * 3, 0, octaves, lacunarity);
                height = (1 - Math.abs(n)) * heightScale * (0.5 + audio.smoothBands.bass);
            } else if (waveType === 'terraces') {
                const n = this.fbm(nx * 3, nz * 3, this.time * 0.1, octaves, lacunarity);
                height = Math.floor(n * 5) / 5 * heightScale * (0.5 + audio.smoothBands.mid);
            } else if (waveType === 'canyons') {
                const n = this.fbm(nx * 2, nz * 4 + this.time * flySpeed * 0.3, 0, octaves, lacunarity);
                height = Math.pow(Math.abs(n), 0.5) * Math.sign(n) * heightScale * (0.5 + audio.rms);
            }

            // Frequency carving
            if (params.carveByBand) {
                const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
                const bandIdx = Math.floor(nx * bands.length);
                const bandVal = audio.smoothBands[bands[Math.min(bandIdx, bands.length - 1)]] || 0;
                height *= (0.3 + bandVal * 2);
            }

            // Erosion effects
            if (erosionType === 'hydraulic') {
                const erosion = Math.max(0, height) * erosionStr * 0.1;
                height -= erosion * Math.sin(this.time + nx * 10);
            } else if (erosionType === 'thermal') {
                const neighbor = (i > 0) ? pos[(i - 1) * 3 + 1] : height;
                const diff = height - neighbor;
                if (Math.abs(diff) > heightScale * 0.3) height -= diff * erosionStr * 0.1;
            } else if (erosionType === 'wind') {
                height += Math.sin(nx * 20 + this.time * 3) * erosionStr * 2;
            }

            // Beat quake
            if (this.quakeIntensity > 0.01) {
                height += (Math.random() - 0.5) * this.quakeIntensity * heightScale * 0.3;
            }

            // Drop fissure
            if (params.dropFissure && audio.dropDecay > 0.1) {
                const fissure = Math.abs(Math.sin(nx * 30 + nz * 30)) < 0.1 ? -heightScale * audio.dropDecay : 0;
                height += fissure;
            }

            pos[i * 3 + 1] = height;

            // Color
            const normalH = Math.abs(height) / heightScale;
            const biomeColor = this.getBiomeColor(height, normalH, biomeMode, nx);
            if (biomeColor) {
                cols[i * 3] = biomeColor.r;
                cols[i * 3 + 1] = biomeColor.g;
                cols[i * 3 + 2] = biomeColor.b;
            } else {
                const c = ParamSystem.getColorThreeHSL(normalH);
                cols[i * 3] = c.r;
                cols[i * 3 + 1] = c.g;
                cols[i * 3 + 2] = c.b;
            }

            // Grid glow
            const glow = params.gridGlow || 0.5;
            cols[i * 3] *= (0.5 + normalH * glow);
            cols[i * 3 + 1] *= (0.5 + normalH * glow);
            cols[i * 3 + 2] *= (0.5 + normalH * glow);
        }

        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.attributes.color.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();

        // Tilt
        this.mesh.rotation.x = params.rotationX || -0.3;

        // Fly forward effect
        this.mesh.position.z = (this.time * flySpeed * 10) % 50 - 25;

        // Water
        if (this.waterPlane) {
            this.waterPlane.visible = params.waterEnabled;
            if (params.waterEnabled) {
                this.waterPlane.position.y = (params.waterLevel || -0.5) * heightScale;
                this.waterPlane.rotation.x = params.rotationX || -0.3;
                this.waterPlane.position.z = this.mesh.position.z;
                this.waterPlane.material.opacity = 0.2 + audio.smoothBands.bass * 0.15;
            }
        }

        // Fog
        if (this.mesh.parent && this.mesh.parent.fog) {
            this.mesh.parent.fog.density = params.fogDensity || 0.003;
        }
    },

    destroy(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
        if (this.waterPlane) {
            scene.remove(this.waterPlane);
            this.waterPlane.geometry.dispose();
            this.waterPlane.material.dispose();
            this.waterPlane = null;
        }
        this.layers.forEach(l => {
            scene.remove(l);
            l.geometry.dispose();
            l.material.dispose();
        });
        this.layers = [];
    }
};
