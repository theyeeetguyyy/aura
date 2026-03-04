// ============================================================
// AURA Mode — Fractal Tree V2
// Recursive branching with wind physics, leaf particles,
// L-system rules, season modes, growth animation
// ============================================================

const FractalTreeMode = {
    name: 'Fractal Tree',
    group: null,
    leafParticles: null,
    time: 0,
    growthProgress: 0,

    params: {
        depth: { type: 'range', min: 2, max: 10, default: 7, step: 1, label: 'Depth' },
        branchAngle: { type: 'range', min: 10, max: 90, default: 30, step: 1, label: 'Branch Angle' },
        branchLength: { type: 'range', min: 5, max: 40, default: 20, step: 1, label: 'Branch Length' },
        shrinkRatio: { type: 'range', min: 0.4, max: 0.9, default: 0.7, step: 0.05, label: 'Shrink' },
        branches: { type: 'range', min: 2, max: 5, default: 2, step: 1, label: 'Branches' },
        sway: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: 'Sway' },
        thickness: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: 'Thickness' },
        is3D: { type: 'toggle', default: true, label: '3D Mode' },
        leafSize: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Leaf Size' },
        // V2 params
        branchingRule: { type: 'select', options: ['binary', 'ternary', 'fibonacci', 'random', 'alternate'], default: 'binary', label: '🌿 Branch Rule' },
        windForce: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '💨 Wind Force' },
        windDirection: { type: 'range', min: 0, max: 6.28, default: 0, step: 0.1, label: '💨 Wind Dir' },
        windTurbulence: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '🌪️ Turbulence' },
        leafParticles: { type: 'toggle', default: false, label: '🍃 Leaf Particles' },
        leafCount: { type: 'range', min: 50, max: 500, default: 150, step: 25, label: 'Leaf Count' },
        trunkThickness: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.5, label: '🪵 Trunk Width' },
        branchTaper: { type: 'range', min: 0, max: 1, default: 0.3, step: 0.05, label: '📐 Taper' },
        seasonMode: { type: 'select', options: ['evergreen', 'spring', 'summer', 'autumn', 'winter'], default: 'evergreen', label: '🍂 Season' },
        growthAnimation: { type: 'toggle', default: false, label: '🌱 Growth Anim' },
        growOnBeat: { type: 'toggle', default: false, label: '💥 Grow on Beat' },
        glowBranches: { type: 'range', min: 0, max: 2, default: 0, step: 0.1, label: '✨ Glow' },
        dropShed: { type: 'toggle', default: false, label: '🔥 Drop Shed' },
        fractalSymmetry: { type: 'select', options: ['single', 'mirror', 'radial3', 'radial4'], default: 'single', label: '🪞 Symmetry' }
    },

    getSeasonColor(season, t, depth) {
        switch (season) {
            case 'spring': return new THREE.Color().setHSL(0.3 + t * 0.15, 0.8, 0.4 + depth * 0.05);
            case 'summer': return new THREE.Color().setHSL(0.25 + t * 0.1, 0.9, 0.3 + depth * 0.04);
            case 'autumn': return new THREE.Color().setHSL(0.05 + t * 0.08, 0.9, 0.4 + depth * 0.05);
            case 'winter': return new THREE.Color().setHSL(0.6, 0.1, 0.5 + depth * 0.05);
            default: return null;
        }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 20, 100);
        camera.lookAt(0, 20, 0);
        this.time = 0;
        this.growthProgress = 0;
    },

    buildTree(depth, maxDepth, pos, dir, length, branchCount, angle, shrink, is3D, audio, reactivity, rule) {
        if (depth <= 0 || length < 0.5) return [];

        const lines = [];
        const freqIdx = Math.floor(((maxDepth - depth) / maxDepth) * (audio.frequencyData?.length || 256) * 0.5);
        const freq = audio.frequencyData ? (audio.frequencyData[freqIdx] || 0) / 255 : 0;

        const end = pos.clone().add(dir.clone().multiplyScalar(length * (1 + freq * reactivity * 0.3)));
        lines.push({ start: pos.clone(), end: end.clone(), depth, freq, maxDepth });

        // Branching rules
        let actualBranchCount = branchCount;
        if (rule === 'ternary') actualBranchCount = 3;
        else if (rule === 'fibonacci') actualBranchCount = depth > 3 ? 3 : 2;
        else if (rule === 'random') actualBranchCount = 2 + Math.floor(Math.random() * 2);
        else if (rule === 'alternate') actualBranchCount = depth % 2 === 0 ? 3 : 2;

        for (let b = 0; b < actualBranchCount; b++) {
            const t = actualBranchCount > 1 ? b / (actualBranchCount - 1) : 0.5;
            const angleOffset = (t - 0.5) * angle * 2;

            const newDir = dir.clone();
            const cosA = Math.cos(angleOffset * Math.PI / 180);
            const sinA = Math.sin(angleOffset * Math.PI / 180);
            const rx = newDir.x * cosA - newDir.y * sinA;
            const ry = newDir.x * sinA + newDir.y * cosA;
            newDir.x = rx;
            newDir.y = ry;

            if (is3D) {
                const zAngle = (b / actualBranchCount) * Math.PI * 2 + this.time * 0.5;
                const cosZ = Math.cos(zAngle * 0.3);
                const sinZ = Math.sin(zAngle * 0.3);
                const rx2 = newDir.x * cosZ - newDir.z * sinZ;
                const rz2 = newDir.x * sinZ + newDir.z * cosZ;
                newDir.x = rx2;
                newDir.z = rz2;
            }

            newDir.normalize();
            const subLines = this.buildTree(depth - 1, maxDepth, end, newDir, length * shrink, branchCount, angle, shrink, is3D, audio, reactivity, rule);
            lines.push(...subLines);
        }

        return lines;
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        // Growth animation
        if (params.growthAnimation) {
            this.growthProgress = Math.min(1, this.growthProgress + dt * 0.3);
        } else {
            this.growthProgress = 1;
        }
        if (params.growOnBeat && audio.beat) {
            this.growthProgress = Math.min(1, this.growthProgress + audio.beatIntensity * 0.2);
        }

        // Clear
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }

        const depth = Math.floor((params.depth || 7) * this.growthProgress);
        if (depth < 1) return;

        const branchAngle = (params.branchAngle || 30) + audio.smoothBands.bass * 20 * (params.reactivity || 1);
        const branchLen = params.branchLength || 20;
        const shrink = params.shrinkRatio || 0.7;
        const branches = Math.floor(params.branches || 2);
        const sway = params.sway || 0.5;
        const is3D = params.is3D;
        const reactivity = params.reactivity || 1;
        const rule = params.branchingRule || 'binary';
        const windF = params.windForce || 0;
        const windDir = params.windDirection || 0;
        const windTurb = params.windTurbulence || 0.5;
        const taper = params.branchTaper || 0.3;
        const season = params.seasonMode || 'evergreen';
        const glow = params.glowBranches || 0;

        // Wind + sway
        const windX = Math.cos(windDir) * windF * 0.1 + Math.sin(this.time * 1.5) * sway * audio.smoothBands.mid;
        const windY = 1;
        const windZ = Math.sin(windDir) * windF * 0.1;
        const dir = new THREE.Vector3(windX, windY, windZ).normalize();

        // Build based on symmetry
        const symmetry = params.fractalSymmetry || 'single';
        const copies = symmetry === 'mirror' ? 2 : symmetry === 'radial3' ? 3 : symmetry === 'radial4' ? 4 : 1;

        for (let s = 0; s < copies; s++) {
            const angleOff = (s / copies) * Math.PI * 2;
            const symDir = symmetry === 'single' ? dir : new THREE.Vector3(
                Math.sin(angleOff) * 0.3 + windX, windY, Math.cos(angleOff) * 0.3 + windZ
            ).normalize();

            const lines = this.buildTree(
                depth, depth, new THREE.Vector3(0, -30, 0),
                symDir, branchLen, branches, branchAngle, shrink, is3D, audio, reactivity, rule
            );

            const tips = [];
            for (const line of lines) {
                const geo = new THREE.BufferGeometry().setFromPoints([line.start, line.end]);
                const t = 1 - line.depth / line.maxDepth;
                const seasonColor = this.getSeasonColor(season, t, line.depth);
                const color = seasonColor || ParamSystem.getColorThree(t + line.freq * 0.3);
                const lineWidth = (params.trunkThickness || 2) * (line.depth / line.maxDepth) * (1 - taper * t);

                const mat = new THREE.LineBasicMaterial({
                    color, transparent: true,
                    opacity: (0.5 + line.freq * 0.5) * (0.5 + glow),
                    blending: THREE.AdditiveBlending
                });
                this.group.add(new THREE.Line(geo, mat));

                // Leaf at tips
                if (line.depth === 1 && params.leafSize > 0) {
                    const leafGeo = new THREE.SphereGeometry(params.leafSize * (0.5 + line.freq), 4, 4);
                    const leafColor = seasonColor || ParamSystem.getColorThree(0.3 + line.freq);
                    const leafMat = new THREE.MeshBasicMaterial({
                        color: leafColor, transparent: true, opacity: season === 'winter' ? 0.1 : 0.6,
                        blending: THREE.AdditiveBlending
                    });
                    const leaf = new THREE.Mesh(leafGeo, leafMat);
                    leaf.position.copy(line.end);
                    this.group.add(leaf);
                    tips.push(line.end.clone());
                }
            }

            // Floating leaf particles
            if (params.leafParticles && tips.length > 0 && season !== 'winter') {
                const leafCount = Math.min(params.leafCount || 150, tips.length * 3);
                const leafPos = new Float32Array(leafCount * 3);
                const leafCols = new Float32Array(leafCount * 3);
                for (let i = 0; i < leafCount; i++) {
                    const tip = tips[i % tips.length];
                    leafPos[i * 3] = tip.x + (Math.random() - 0.5) * 10 + Math.sin(this.time + i) * windF;
                    leafPos[i * 3 + 1] = tip.y + (Math.random() - 0.5) * 10 - Math.abs(Math.sin(this.time * 0.5 + i)) * 5;
                    leafPos[i * 3 + 2] = tip.z + (Math.random() - 0.5) * 10;
                    const lc = this.getSeasonColor(season, i / leafCount, 1) || new THREE.Color(0.3, 0.8, 0.3);
                    leafCols[i * 3] = lc.r; leafCols[i * 3 + 1] = lc.g; leafCols[i * 3 + 2] = lc.b;
                }
                const lpGeo = new THREE.BufferGeometry();
                lpGeo.setAttribute('position', new THREE.Float32BufferAttribute(leafPos, 3));
                lpGeo.setAttribute('color', new THREE.Float32BufferAttribute(leafCols, 3));
                const lpMat = new THREE.PointsMaterial({
                    size: params.leafSize * 0.8, vertexColors: true, transparent: true, opacity: 0.5,
                    blending: THREE.AdditiveBlending, depthWrite: false
                });
                this.group.add(new THREE.Points(lpGeo, lpMat));
            }
        }

        // Drop shed - reset growth
        if (params.dropShed && audio.isDrop) {
            this.growthProgress = 0.3;
        }
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
    }
};
