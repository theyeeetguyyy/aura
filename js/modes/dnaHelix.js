// ============================================================
// AURA Mode — DNA Helix V2
// Double/triple helix with base pair colors, unwind,
// radiation glow, enzyme particles, mutations
// ============================================================

const DnaHelixMode = {
    name: 'DNA Helix',
    group: null,
    time: 0,

    params: {
        helixCount: { type: 'range', min: 1, max: 4, default: 2, step: 1, label: 'Helix Count' },
        coils: { type: 'range', min: 2, max: 20, default: 8, step: 1, label: 'Coils' },
        radius: { type: 'range', min: 5, max: 40, default: 15, step: 1, label: 'Radius' },
        height: { type: 'range', min: 30, max: 200, default: 100, step: 5, label: 'Height' },
        resolution: { type: 'range', min: 100, max: 1000, default: 400, step: 50, label: 'Resolution' },
        renderMode: { type: 'select', options: ['line', 'tube', 'points'], default: 'line', label: 'Render' },
        showBridges: { type: 'toggle', default: true, label: 'Bridges' },
        bridgeCount: { type: 'range', min: 5, max: 50, default: 20, step: 1, label: 'Bridge Count' },
        rotSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: 'Rotation' },
        twistReact: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Twist React' },
        particleDensity: { type: 'range', min: 0, max: 500, default: 100, step: 10, label: 'Particles' },
        // V2 params
        basePairColors: { type: 'toggle', default: true, label: '🧬 Base Pair Colors' },
        unwindOnBeat: { type: 'toggle', default: false, label: '💥 Unwind on Beat' },
        unwindSpeed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Unwind Speed' },
        radiationGlow: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: '☢️ Radiation' },
        enzymes: { type: 'toggle', default: false, label: '🔬 Enzyme Particles' },
        enzymeCount: { type: 'range', min: 10, max: 100, default: 30, step: 5, label: 'Enzyme Count' },
        mutationChance: { type: 'range', min: 0, max: 0.5, default: 0, step: 0.05, label: '🧪 Mutation' },
        helixSpacing: { type: 'range', min: 0, max: 5, default: 0, step: 0.5, label: 'Helix Spacing' },
        majorGroove: { type: 'range', min: 0.5, max: 2, default: 1, step: 0.1, label: '📐 Groove Width' },
        dropUnzip: { type: 'toggle', default: true, label: '🔥 Drop Unzip' },
        phosphorescence: { type: 'toggle', default: false, label: '✨ Phosphorescence' },
        backbone: { type: 'select', options: ['line', 'tube', 'ribbon', 'dotted'], default: 'line', label: '🦴 Backbone' }
    },

    getBasePairColor(index, total) {
        const bases = [
            new THREE.Color(0.8, 0.2, 0.2), // A - red
            new THREE.Color(0.2, 0.2, 0.8), // T - blue
            new THREE.Color(0.2, 0.8, 0.2), // G - green
            new THREE.Color(0.8, 0.8, 0.2)  // C - yellow
        ];
        return bases[Math.floor((index * 4.7) % 4)];
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 120);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.unwindPhase = 0;
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

        const helixCount = Math.floor(params.helixCount || 2);
        const coils = params.coils || 8;
        const baseRadius = (params.radius || 15) * (1 + audio.smoothBands.bass * (params.twistReact || 1) * (params.reactivity || 1) * 0.3);
        const height = params.height || 100;
        const res = Math.floor(params.resolution || 400);
        const rotSpeed = params.rotSpeed || 0.5;
        const reactivity = params.reactivity || 1;
        const radiationGlow = params.radiationGlow || 0.5;
        const grooveWidth = params.majorGroove || 1;
        const helixSpacing = params.helixSpacing || 0;

        // Unwind
        if (params.unwindOnBeat && audio.beat) {
            this.unwindPhase = Math.min(3, this.unwindPhase + audio.beatIntensity * (params.unwindSpeed || 1));
        }
        if (params.dropUnzip && audio.isDropSection) {
            this.unwindPhase = 3;
        }
        this.unwindPhase *= 0.97;

        for (let h = 0; h < helixCount; h++) {
            const phaseOffset = (h / helixCount) * Math.PI * 2;
            const points = [];
            const radius = baseRadius + h * helixSpacing;

            for (let i = 0; i < res; i++) {
                const t = i / res;
                const unwindOffset = this.unwindPhase * Math.sin(t * Math.PI) * 5 * (h % 2 === 0 ? 1 : -1);
                const angle = t * Math.PI * 2 * coils * grooveWidth + phaseOffset + this.time * rotSpeed;
                const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
                const freq = (audio.frequencyData[fIdx] || 0) / 255;

                // Mutation wobble
                const mutation = params.mutationChance > 0 && Math.random() < params.mutationChance ?
                    (Math.random() - 0.5) * 5 : 0;

                const r = radius * (1 + freq * 0.3 * reactivity) + unwindOffset;
                const x = Math.cos(angle) * r + mutation;
                const y = (t - 0.5) * height;
                const z = Math.sin(angle) * r;

                points.push(new THREE.Vector3(x, y, z));
            }

            // Render backbone
            if (params.backbone === 'tube' && points.length > 10) {
                try {
                    const subset = points.filter((_, i) => i % 3 === 0);
                    const curve = new THREE.CatmullRomCurve3(subset);
                    const tubeGeo = new THREE.TubeGeometry(curve, Math.min(subset.length, 300), 0.5, 6, false);
                    const mat = new THREE.MeshBasicMaterial({
                        color: ParamSystem.getColorThree(h / helixCount + audio.rms * 0.3),
                        transparent: true, opacity: (0.6 + radiationGlow * 0.2), blending: THREE.AdditiveBlending
                    });
                    this.group.add(new THREE.Mesh(tubeGeo, mat));
                } catch (e) { }
            } else {
                const geo = new THREE.BufferGeometry().setFromPoints(points);
                const mat = new THREE.LineBasicMaterial({
                    color: ParamSystem.getColorThree(h / helixCount + audio.rms * 0.3),
                    transparent: true, opacity: 0.8 + radiationGlow * 0.1,
                    blending: THREE.AdditiveBlending
                });
                if (params.backbone === 'dotted') {
                    this.group.add(new THREE.Points(geo, new THREE.PointsMaterial({
                        size: 0.8, color: ParamSystem.getColorThree(h / helixCount),
                        transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending
                    })));
                } else {
                    this.group.add(new THREE.Line(geo, mat));
                }
            }

            if (h === 0) this.group.userData.strand1 = points;
            if (h === 1) this.group.userData.strand2 = points;
        }

        // Bridges
        if (params.showBridges && helixCount >= 2) {
            const s1 = this.group.userData.strand1;
            const s2 = this.group.userData.strand2;
            if (s1 && s2) {
                const bridgeCount = Math.floor(params.bridgeCount || 20);
                const step = Math.floor(res / bridgeCount);
                for (let i = 0; i < bridgeCount; i++) {
                    const idx = i * step;
                    if (idx >= s1.length || idx >= s2.length) continue;
                    const bridgeGeo = new THREE.BufferGeometry().setFromPoints([s1[idx], s2[idx]]);
                    const freq = (audio.frequencyData[Math.floor(i / bridgeCount * 256)] || 0) / 255;
                    const color = params.basePairColors ?
                        this.getBasePairColor(i, bridgeCount) :
                        ParamSystem.getColorThree(i / bridgeCount);
                    const bridgeMat = new THREE.LineBasicMaterial({
                        color, transparent: true, opacity: 0.3 + freq * 0.5,
                        blending: THREE.AdditiveBlending
                    });
                    this.group.add(new THREE.Line(bridgeGeo, bridgeMat));
                }
            }
        }

        // Phosphorescence glow
        if (params.phosphorescence && radiationGlow > 0) {
            const glowGeo = new THREE.SphereGeometry(baseRadius * 1.5, 8, 8);
            const glowMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(0.2, 0.8, 0.3), transparent: true,
                opacity: 0.05 * radiationGlow * audio.smoothBands.bass,
                blending: THREE.AdditiveBlending
            });
            const glowMesh = new THREE.Mesh(glowGeo, glowMat);
            this.group.add(glowMesh);
        }

        // Enzyme particles
        if (params.enzymes) {
            const eCount = Math.floor(params.enzymeCount || 30);
            const ePos = new Float32Array(eCount * 3);
            const eCols = new Float32Array(eCount * 3);
            for (let i = 0; i < eCount; i++) {
                const t = i / eCount;
                const angle = t * Math.PI * 2 * coils + this.time * rotSpeed * 1.5 + Math.sin(i) * 2;
                const r = baseRadius * 1.3;
                ePos[i * 3] = Math.cos(angle) * r + Math.sin(this.time * 3 + i) * 3;
                ePos[i * 3 + 1] = (t - 0.5) * height;
                ePos[i * 3 + 2] = Math.sin(angle) * r + Math.cos(this.time * 2 + i) * 3;
                eCols[i * 3] = 0.9; eCols[i * 3 + 1] = 0.6; eCols[i * 3 + 2] = 0.1;
            }
            const eGeo = new THREE.BufferGeometry();
            eGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3));
            eGeo.setAttribute('color', new THREE.Float32BufferAttribute(eCols, 3));
            this.group.add(new THREE.Points(eGeo, new THREE.PointsMaterial({
                size: 1.5, vertexColors: true, transparent: true, opacity: 0.6,
                blending: THREE.AdditiveBlending, depthWrite: false
            })));
        }

        // Floating particles
        if (params.particleDensity > 0) {
            const pCount = Math.floor(params.particleDensity);
            const pPos = new Float32Array(pCount * 3);
            const pCols = new Float32Array(pCount * 3);
            for (let i = 0; i < pCount; i++) {
                const t = i / pCount;
                const angle = t * Math.PI * 2 * coils + this.time * rotSpeed;
                const r = baseRadius * (1.5 + Math.sin(this.time * 3 + i) * 0.5);
                pPos[i * 3] = Math.cos(angle + Math.random()) * r * (0.5 + Math.random());
                pPos[i * 3 + 1] = (t - 0.5) * height + (Math.random() - 0.5) * 5;
                pPos[i * 3 + 2] = Math.sin(angle + Math.random()) * r * (0.5 + Math.random());
                const c = ParamSystem.getColorThreeHSL(t);
                pCols[i * 3] = c.r; pCols[i * 3 + 1] = c.g; pCols[i * 3 + 2] = c.b;
            }
            const pGeo = new THREE.BufferGeometry();
            pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
            pGeo.setAttribute('color', new THREE.Float32BufferAttribute(pCols, 3));
            this.group.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
                size: 0.8, vertexColors: true, transparent: true, opacity: 0.5,
                blending: THREE.AdditiveBlending, depthWrite: false
            })));
        }

        this.group.rotation.y += rotSpeed * dt * 0.3;
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(this.group);
        }
    }
};
