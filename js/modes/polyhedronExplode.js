// ============================================================
// AURA Mode — Polyhedron Explode V2
// Solids that shatter with gravity, orbiting fragments,
// chain explosions, multi-shape, magnetic reform
// ============================================================

const PolyhedronExplodeMode = {
    name: 'Polyhedron Explode',
    group: null,
    fragments: [],
    time: 0,
    explodePhase: 0,
    innerCoreMesh: null,
    shrapnelPts: null,

    params: {
        shape: { type: 'select', options: ['icosahedron', 'dodecahedron', 'octahedron', 'cube', 'torusKnot', 'sphere', 'cone', 'cylinder'], default: 'icosahedron', label: 'Shape' },
        detail: { type: 'range', min: 0, max: 4, default: 1, step: 1, label: 'Detail' },
        size: { type: 'range', min: 10, max: 60, default: 30, step: 1, label: 'Size' },
        explodeForce: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: 'Explode Force' },
        reformSpeed: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: 'Reform Speed' },
        rotSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: 'Rotation' },
        fragmentSpin: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Fragment Spin' },
        trailParticles: { type: 'toggle', default: true, label: 'Trails' },
        renderMode: { type: 'select', options: ['solid', 'wireframe', 'dual'], default: 'solid', label: 'Render' },
        autoExplode: { type: 'toggle', default: false, label: 'Auto Explode' },
        // V2 params
        gravityPull: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '🌍 Gravity' },
        magneticReform: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🧲 Magnetic' },
        orbitFragments: { type: 'toggle', default: false, label: '🪐 Orbit Fragments' },
        orbitSpeed: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Orbit Speed' },
        chainReaction: { type: 'toggle', default: false, label: '💥 Chain React' },
        fragmentGlow: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: '✨ Fragment Glow' },
        sizeByFreq: { type: 'toggle', default: false, label: '🔊 Size by Freq' },
        colorByVelocity: { type: 'toggle', default: false, label: '🎨 Color by Vel' },
        shrapnelCount: { type: 'range', min: 0, max: 200, default: 0, step: 10, label: '💫 Shrapnel' },
        dropShatter: { type: 'toggle', default: true, label: '🔥 Drop Shatter' },
        multiShape: { type: 'toggle', default: false, label: '🔷 Multi-Shape' },
        innerCore: { type: 'toggle', default: false, label: '⭐ Inner Core' }
    },

    getGeometry(shape, detail) {
        switch (shape) {
            case 'dodecahedron': return new THREE.DodecahedronGeometry(1, detail);
            case 'octahedron': return new THREE.OctahedronGeometry(1, detail);
            case 'cube': return new THREE.BoxGeometry(1, 1, 1, detail + 1, detail + 1, detail + 1);
            case 'torusKnot': return new THREE.TorusKnotGeometry(1, 0.3, 32, 8);
            case 'sphere': return new THREE.SphereGeometry(1, 16 + detail * 4, 16 + detail * 4);
            case 'cone': return new THREE.ConeGeometry(1, 2, 16 + detail * 4);
            case 'cylinder': return new THREE.CylinderGeometry(1, 1, 2, 16 + detail * 4);
            default: return new THREE.IcosahedronGeometry(1, detail);
        }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.buildFragments('icosahedron', 1);
    },

    buildFragments(shape, detail) {
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }
        this.fragments = [];
        const baseGeo = this.getGeometry(shape, detail);
        const positions = baseGeo.attributes.position.array;
        const faceCount = positions.length / 9;

        for (let f = 0; f < faceCount; f++) {
            const i = f * 9;
            const cx = (positions[i] + positions[i + 3] + positions[i + 6]) / 3;
            const cy = (positions[i + 1] + positions[i + 4] + positions[i + 7]) / 3;
            const cz = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3;
            const localVerts = new Float32Array([
                positions[i] - cx, positions[i + 1] - cy, positions[i + 2] - cz,
                positions[i + 3] - cx, positions[i + 4] - cy, positions[i + 5] - cz,
                positions[i + 6] - cx, positions[i + 7] - cy, positions[i + 8] - cz
            ]);
            const fragGeo = new THREE.BufferGeometry();
            fragGeo.setAttribute('position', new THREE.BufferAttribute(localVerts, 3));
            fragGeo.computeVertexNormals();

            const mat = new THREE.MeshBasicMaterial({
                color: 0x8b5cf6, transparent: true, opacity: 0.8,
                side: THREE.DoubleSide, blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Mesh(fragGeo, mat);
            mesh.position.set(cx, cy, cz);
            const dir = new THREE.Vector3(cx, cy, cz).normalize();
            this.group.add(mesh);
            this.fragments.push({
                mesh, homePos: new THREE.Vector3(cx, cy, cz), direction: dir,
                velocity: new THREE.Vector3(), currentOffset: 0,
                spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
                spinAngle: 0, orbitAngle: Math.random() * Math.PI * 2
            });
        }
        baseGeo.dispose();
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        const reactivity = params.reactivity || 1;
        const explodeForce = params.explodeForce || 2;
        const reformSpeed = params.reformSpeed || 2;
        const rotSpeed = params.rotSpeed || 0.5;
        const fragSpin = params.fragmentSpin || 1;
        const size = params.size || 30;
        const gravity = params.gravityPull || 0;
        const magnetic = params.magneticReform || 1;
        const glow = params.fragmentGlow || 0.5;

        if (audio.beat) {
            this.explodePhase = Math.min(this.explodePhase + audio.beatIntensity * explodeForce, 3);
        }
        if (params.dropShatter && audio.isDrop) {
            this.explodePhase = 3;
        }
        if (params.autoExplode) {
            this.explodePhase = (Math.sin(this.time * 2) * 0.5 + 0.5) * explodeForce * audio.smoothBands.bass * reactivity;
        }
        this.explodePhase *= (1 - reformSpeed * dt * magnetic);
        if (this.explodePhase < 0.01) this.explodePhase = 0;

        for (let i = 0; i < this.fragments.length; i++) {
            const frag = this.fragments[i];
            const t = i / this.fragments.length;
            const fIdx = Math.floor(t * audio.frequencyData.length * 0.5);
            const freq = (audio.frequencyData[fIdx] || 0) / 255;

            let offset = this.explodePhase * (1 + freq * reactivity) * 30;

            // Orbit fragments
            if (params.orbitFragments && this.explodePhase > 0.3) {
                frag.orbitAngle += (params.orbitSpeed || 1) * dt * 2;
                const orbitOffset = new THREE.Vector3(
                    Math.cos(frag.orbitAngle) * 0.3, 0, Math.sin(frag.orbitAngle) * 0.3
                );
                frag.mesh.position.copy(frag.homePos).addScaledVector(frag.direction, offset);
                frag.mesh.position.add(orbitOffset.multiplyScalar(offset));
            } else {
                frag.mesh.position.copy(frag.homePos).addScaledVector(frag.direction, offset);
            }

            // Gravity
            if (gravity > 0 && this.explodePhase > 0.1) {
                frag.mesh.position.y -= gravity * this.explodePhase * 0.5;
            }

            frag.mesh.position.multiplyScalar(size);

            // Chain reaction
            if (params.chainReaction && audio.beat && freq > 0.5) {
                frag.velocity.addScaledVector(frag.direction, freq * 2);
            }
            frag.velocity.multiplyScalar(0.95);
            frag.mesh.position.add(frag.velocity);

            // Spin
            if (this.explodePhase > 0.1) {
                frag.spinAngle += this.explodePhase * fragSpin * dt * 5;
                frag.mesh.setRotationFromAxisAngle(frag.spinAxis, frag.spinAngle);
            }

            // Scale
            let fragScale = size * (1 + freq * 0.3 * reactivity);
            if (params.sizeByFreq) fragScale *= (0.5 + freq);
            frag.mesh.scale.setScalar(fragScale);

            // Color
            if (params.colorByVelocity) {
                const speed = frag.velocity.length() + this.explodePhase;
                const c = new THREE.Color().setHSL(0.65 - Math.min(speed * 0.3, 0.6), 1, 0.4 + speed * 0.1);
                frag.mesh.material.color = c;
            } else {
                frag.mesh.material.color = ParamSystem.getColorThree(t + audio.rms * 0.3);
            }
            frag.mesh.material.opacity = (0.5 + freq * 0.4) * (0.5 + glow);
            frag.mesh.material.wireframe = params.renderMode === 'wireframe';
        }

        // Inner core — persistent, update in place
        if (params.innerCore) {
            if (!this.innerCoreMesh) {
                const coreGeo = new THREE.SphereGeometry(1, 8, 8);
                const coreMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.3,
                    blending: THREE.AdditiveBlending
                });
                this.innerCoreMesh = new THREE.Mesh(coreGeo, coreMat);
                this.group.add(this.innerCoreMesh);
            }
            this.innerCoreMesh.visible = true;
            this.innerCoreMesh.scale.setScalar(size * 0.3);
            this.innerCoreMesh.material.color.copy(ParamSystem.getColorThree(audio.rms + this.time * 0.1));
            this.innerCoreMesh.material.opacity = 0.3 + audio.smoothBands.bass * 0.3;
        } else if (this.innerCoreMesh) {
            this.innerCoreMesh.visible = false;
        }

        // Shrapnel particles — persistent, update in place
        if (params.shrapnelCount > 0 && this.explodePhase > 0.5) {
            const sCount = Math.floor(params.shrapnelCount * this.explodePhase / 3);
            if (!this.shrapnelPts || this.shrapnelPts.geometry.attributes.position.count < sCount) {
                if (this.shrapnelPts) {
                    this.group.remove(this.shrapnelPts);
                    this.shrapnelPts.geometry.dispose();
                    this.shrapnelPts.material.dispose();
                }
                const sPos = new Float32Array(Math.floor(params.shrapnelCount) * 3);
                const sGeo = new THREE.BufferGeometry();
                sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
                this.shrapnelPts = new THREE.Points(sGeo, new THREE.PointsMaterial({
                    size: 0.5, color: 0xffaa00, transparent: true, opacity: 0.5,
                    blending: THREE.AdditiveBlending, depthWrite: false
                }));
                this.group.add(this.shrapnelPts);
            }
            this.shrapnelPts.visible = true;
            const sPos = this.shrapnelPts.geometry.attributes.position.array;
            for (let i = 0; i < sCount && i * 3 + 2 < sPos.length; i++) {
                const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
                const dist = this.explodePhase * 30 * size * 0.05;
                sPos[i * 3] = dir.x * dist * (1 + Math.random());
                sPos[i * 3 + 1] = dir.y * dist * (1 + Math.random());
                sPos[i * 3 + 2] = dir.z * dist * (1 + Math.random());
            }
            this.shrapnelPts.geometry.attributes.position.needsUpdate = true;
            this.shrapnelPts.geometry.setDrawRange(0, sCount);
            this.shrapnelPts.material.opacity = 0.5 * this.explodePhase;
        } else if (this.shrapnelPts) {
            this.shrapnelPts.visible = false;
        }

        this.group.rotation.y += rotSpeed * dt * (1 + audio.smoothBands.mid * reactivity);
        this.group.rotation.x += rotSpeed * dt * 0.3;
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(this.group);
        }
        this.fragments = [];
        this.innerCoreMesh = null;
        this.shrapnelPts = null;
    }
};
