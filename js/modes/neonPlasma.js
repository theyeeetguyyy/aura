// ============================================================
// AURA Mode — NEON PLASMA V2
// Electric plasma tendrils with arc lightning, plasma ball,
// magnetic containment, fusion core, bifrost bridge
// ============================================================

const NeonPlasmaMode = {
    name: 'Neon Plasma',
    group: null,
    time: 0,
    tendrils: [],
    orbs: [],
    ringParticles: null,

    params: {
        tendrilCount: { type: 'range', min: 3, max: 15, default: 8, step: 1, label: '⚡ Tendrils' },
        tendrilLength: { type: 'range', min: 20, max: 80, default: 40, step: 5, label: 'Length' },
        tendrilWidth: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.5, label: 'Width' },
        orbCount: { type: 'range', min: 2, max: 8, default: 4, step: 1, label: '🔮 Orbs' },
        orbSize: { type: 'range', min: 1, max: 8, default: 3, step: 0.5, label: 'Orb Size' },
        colorCycle: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🌈 Color Cycle' },
        electricIntensity: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '💥 Electric' },
        plasmaWave: { type: 'range', min: 0, max: 10, default: 4, step: 0.5, label: '🌊 Plasma Wave' },
        ringEnabled: { type: 'toggle', default: true, label: '💫 Energy Ring' },
        beatBurst: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '🔊 Beat Burst' },
        dropReaction: { type: 'toggle', default: true, label: '🔥 Drop Reaction' },
        // V2 params
        arcLightning: { type: 'toggle', default: false, label: '⚡ Arc Lightning' },
        arcCount: { type: 'range', min: 1, max: 10, default: 3, step: 1, label: 'Arc Count' },
        plasmaMode: { type: 'select', options: ['tendrils', 'plasmaBall', 'fusion', 'bifrost', 'nebula'], default: 'tendrils', label: '🔮 Plasma Mode' },
        containmentField: { type: 'toggle', default: false, label: '🛡️ Containment' },
        containRadius: { type: 'range', min: 15, max: 50, default: 25, step: 1, label: 'Contain Radius' },
        fusionCore: { type: 'toggle', default: false, label: '☢️ Fusion Core' },
        coreIntensity: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: 'Core Power' },
        orbInterconnect: { type: 'toggle', default: false, label: '🔗 Interconnect' },
        particleTrails: { type: 'range', min: 0, max: 500, default: 0, step: 25, label: '✨ Trails' },
        beatShockwave: { type: 'toggle', default: false, label: '💥 Beat Shock' },
        dropDischarge: { type: 'toggle', default: true, label: '🔥 Drop Discharge' },
        chromaticSplit: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌈 Chromatic' }
    },

    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 50);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.tendrils = [];
        this.orbs = [];
        this.shockPhase = 0;
        this.buildTendrils(8, 40);
        this.buildOrbs(4);
        this.buildRing();
    },

    buildTendrils(count, length) {
        this.tendrils.forEach(t => { this.group.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); });
        this.tendrils = [];
        for (let i = 0; i < count; i++) {
            const points = Math.floor(length * 2);
            const geo = new THREE.BufferGeometry();
            const positions = new Float32Array(points * 3);
            const colors = new Float32Array(points * 3);
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
            const line = new THREE.Line(geo, mat);
            this.group.add(line);
            this.tendrils.push({ line, positions, colors, points, baseAngle: (i / count) * Math.PI * 2 });
        }
    },

    buildOrbs(count) {
        this.orbs.forEach(o => { this.group.remove(o.mesh); o.mesh.geometry.dispose(); o.mesh.material.dispose(); if (o.halo) { this.group.remove(o.halo); o.halo.geometry.dispose(); o.halo.material.dispose(); } });
        this.orbs = [];
        for (let i = 0; i < count; i++) {
            const geo = new THREE.SphereGeometry(3, 16, 16);
            const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
            const mesh = new THREE.Mesh(geo, mat);
            const angle = (i / count) * Math.PI * 2;
            mesh.position.set(Math.cos(angle) * 12, 0, Math.sin(angle) * 12);
            this.group.add(mesh);
            const haloGeo = new THREE.SphereGeometry(5, 12, 12);
            const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: 0x8800ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending }));
            halo.position.copy(mesh.position);
            this.group.add(halo);
            this.orbs.push({ mesh, halo, angle, baseR: 12 });
        }
    },

    buildRing() {
        const count = 3000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const r = 20 + Math.random() * 3;
            pos[i * 3] = Math.cos(angle) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * 2; pos[i * 3 + 2] = Math.sin(angle) * r;
            col[i * 3] = 1; col[i * 3 + 1] = 0; col[i * 3 + 2] = 1;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        this.ringParticles = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 1.2, vertexColors: true, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        this.group.add(this.ringParticles);
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;
        const bass = audio.smoothBands.bass || 0;
        const mid = audio.smoothBands.mid || 0;
        const treble = audio.smoothBands.treble || 0;
        const rms = audio.rms || 0;
        const colorCycle = params.colorCycle || 1;
        const electric = params.electricIntensity || 2;
        const plasmaWave = params.plasmaWave || 4;
        const beatBurst = params.beatBurst || 2;
        const plasmaMode = params.plasmaMode || 'tendrils';
        const chromatic = params.chromaticSplit || 0;
        const coreInt = params.coreIntensity || 2;

        // Shockwave
        if (params.beatShockwave && audio.beat) this.shockPhase = Math.max(this.shockPhase, audio.beatIntensity * 2);
        if (params.dropDischarge && audio.isDropSection) this.shockPhase = 3;
        this.shockPhase *= 0.93;

        if (this.tendrils.length !== Math.floor(params.tendrilCount || 8)) {
            this.buildTendrils(Math.floor(params.tendrilCount || 8), params.tendrilLength || 40);
        }

        // Tendrils
        this.tendrils.forEach((tendril, ti) => {
            const pos = tendril.positions;
            const col = tendril.colors;
            const count = tendril.points;
            const baseAngle = tendril.baseAngle + this.time * 0.3;
            const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
            const bandVal = audio.smoothBands[bands[ti % 7]] || 0;

            for (let i = 0; i < count; i++) {
                const t = i / count;
                const len = (params.tendrilLength || 40) * t;
                const angleOffset = Math.sin(t * plasmaWave + this.time * 2) * electric;
                const fIdx = Math.floor(t * audio.frequencyData.length * 0.3);
                const freq = (audio.frequencyData[fIdx] || 0) / 255;
                const chaos = audio.bassBeat ? freq * beatBurst * 3 : freq;

                if (plasmaMode === 'plasmaBall') {
                    const sphereAngle = baseAngle + t * Math.PI * 4;
                    const r = 15 * (1 + freq * electric * 0.2 + this.shockPhase * 0.2);
                    pos[i * 3] = Math.cos(sphereAngle) * Math.sin(t * Math.PI) * r + Math.sin(this.time * 5 + i) * chaos;
                    pos[i * 3 + 1] = Math.cos(t * Math.PI) * r + Math.cos(this.time * 3 + i) * chaos;
                    pos[i * 3 + 2] = Math.sin(sphereAngle) * Math.sin(t * Math.PI) * r;
                } else if (plasmaMode === 'fusion') {
                    const r = 5 + t * 15;
                    const a = baseAngle + t * 10 + Math.sin(this.time * 3) * 2;
                    pos[i * 3] = Math.cos(a) * r + Math.sin(t * 20 + this.time * 5) * chaos * 3;
                    pos[i * 3 + 1] = Math.sin(a * 0.7) * r * 0.5 + Math.cos(t * 15 + this.time * 3) * chaos * 2;
                    pos[i * 3 + 2] = Math.sin(a) * r * 0.3 + freq * 5;
                } else if (plasmaMode === 'bifrost') {
                    const bridge = t * 80 - 40;
                    const arch = Math.sin(t * Math.PI) * 20;
                    pos[i * 3] = bridge + Math.sin(this.time * 3 + t * 10) * chaos * 2;
                    pos[i * 3 + 1] = arch + Math.cos(this.time * 2 + t * 8) * chaos;
                    pos[i * 3 + 2] = Math.sin(baseAngle + t * 5) * 5 + freq * 3;
                } else {
                    pos[i * 3] = Math.cos(baseAngle + angleOffset) * len + Math.sin(t * 10 + this.time * 3) * chaos * 3;
                    pos[i * 3 + 1] = Math.sin(baseAngle * 0.7 + angleOffset * 0.5) * len * 0.5 + Math.cos(t * 8 + this.time * 2) * chaos * 2;
                    pos[i * 3 + 2] = Math.sin(baseAngle + t * 3) * len * 0.3 + freq * 5;
                }

                const hue = (t * 0.5 + this.time * colorCycle * 0.1 + ti * 0.1 + bandVal + chromatic * t) % 1;
                const c = new THREE.Color().setHSL(hue, 1, 0.4 + freq * 0.4);
                col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
            }
            tendril.line.geometry.attributes.position.needsUpdate = true;
            tendril.line.geometry.attributes.color.needsUpdate = true;
            tendril.line.material.opacity = 0.5 + bandVal * 0.4;
        });

        // Orbs
        const orbResize = (params.orbCount || 4) !== this.orbs.length;
        if (orbResize) this.buildOrbs(Math.floor(params.orbCount || 4));

        this.orbs.forEach((orb, i) => {
            const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
            const bandVal = audio.smoothBands[bands[i % 7]] || 0;
            const r = orb.baseR + bandVal * 10;
            const angle = orb.angle + this.time * 0.5;
            orb.mesh.position.x = Math.cos(angle) * r;
            orb.mesh.position.y = Math.sin(this.time * 1.5 + i) * 5;
            orb.mesh.position.z = Math.sin(angle) * r;
            const scale = (params.orbSize || 3) * (0.5 + bandVal * 2);
            orb.mesh.scale.setScalar(scale);
            orb.halo.scale.setScalar(scale * 1.5);
            orb.halo.position.copy(orb.mesh.position);
            const hue = (this.time * colorCycle * 0.1 + i * 0.25) % 1;
            orb.mesh.material.color.setHSL(hue, 1, 0.5 + rms * 0.3);
            orb.halo.material.color.setHSL(hue, 0.8, 0.3);
            orb.mesh.material.opacity = 0.4 + bandVal * 0.5;
        });

        // Orb interconnect
        if (params.orbInterconnect && this.orbs.length > 1) {
            for (let i = 0; i < this.orbs.length; i++) {
                for (let j = i + 1; j < this.orbs.length; j++) {
                    const geo = new THREE.BufferGeometry().setFromPoints([this.orbs[i].mesh.position, this.orbs[j].mesh.position]);
                    const mat = new THREE.LineBasicMaterial({
                        color: ParamSystem.getColorThree((i + j) / this.orbs.length + rms),
                        transparent: true, opacity: 0.2 + bass * 0.3, blending: THREE.AdditiveBlending
                    });
                    const line = new THREE.Line(geo, mat);
                    line.userData._temp = true;
                    this.group.add(line);
                }
            }
        }

        // Fusion core
        if (params.fusionCore) {
            const coreGeo = new THREE.SphereGeometry(3 + bass * coreInt * 2, 12, 12);
            const coreMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL((this.time * 0.1) % 1, 1, 0.6 + bass * 0.3),
                transparent: true, opacity: 0.5 + rms * 0.3, blending: THREE.AdditiveBlending
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.userData._temp = true;
            this.group.add(core);
        }

        // Containment field
        if (params.containmentField) {
            const cRadius = params.containRadius || 25;
            const cGeo = new THREE.SphereGeometry(cRadius * (1 + bass * 0.1), 16, 16);
            const cMat = new THREE.MeshBasicMaterial({
                color: 0x4444ff, transparent: true, opacity: 0.05 + rms * 0.05,
                wireframe: true, blending: THREE.AdditiveBlending
            });
            const contain = new THREE.Mesh(cGeo, cMat);
            contain.userData._temp = true;
            this.group.add(contain);
        }

        // Ring
        if (this.ringParticles) {
            this.ringParticles.visible = params.ringEnabled;
            this.ringParticles.rotation.y += 0.01 * (1 + bass * 2);
            this.ringParticles.rotation.x = Math.sin(this.time * 0.3) * 0.3;
            this.ringParticles.scale.setScalar(1 + bass * 0.3 + this.shockPhase * 0.3);
            const rCol = this.ringParticles.geometry.attributes.color.array;
            const rPos = this.ringParticles.geometry.attributes.position.array;
            const rCount = rCol.length / 3;
            for (let i = 0; i < rCount; i++) {
                const t = i / rCount;
                const angle = (i / rCount) * Math.PI * 2;
                const hue = (t + this.time * colorCycle * 0.05) % 1;
                const c = new THREE.Color().setHSL(hue, 1, 0.4 + rms * 0.4);
                rCol[i * 3] = c.r; rCol[i * 3 + 1] = c.g; rCol[i * 3 + 2] = c.b;
                const r = 20 + Math.sin(angle * 6 + this.time * 3) * 2 * bass + this.shockPhase * 3;
                rPos[i * 3] = Math.cos(angle) * r;
                rPos[i * 3 + 2] = Math.sin(angle) * r;
                rPos[i * 3 + 1] = Math.sin(angle * 4 + this.time * 2) * (1 + treble * 3);
            }
            this.ringParticles.geometry.attributes.color.needsUpdate = true;
            this.ringParticles.geometry.attributes.position.needsUpdate = true;
        }

        // Cleanup temp objects from last frame
        const toRemove = this.group.children.filter(c => c.userData._temp);
        toRemove.forEach(c => { this.group.remove(c); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });

        if (params.dropReaction && audio.isDropSection) this.group.rotation.z += 0.3;
        this.group.rotation.y += 0.002 * (1 + rms);
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.tendrils = [];
        this.orbs = [];
    }
};
