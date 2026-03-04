// ============================================================
// AURA Mode — Möbius Rings
// Twisted ring geometries orbiting, audio-reactive
// ============================================================

const MobiusRingsMode = {
    name: 'Möbius Rings',
    group: null,
    rings: [],
    time: 0,

    params: {
        ringCount: { type: 'range', min: 1, max: 8, default: 3, step: 1, label: 'Ring Count' },
        twist: { type: 'range', min: 0, max: 10, default: 3, step: 0.5, label: 'Twist' },
        radius: { type: 'range', min: 10, max: 60, default: 30, step: 1, label: 'Radius' },
        tubeRadius: { type: 'range', min: 0.3, max: 5, default: 1.5, step: 0.1, label: 'Tube Width' },
        segments: { type: 'range', min: 32, max: 256, default: 128, step: 8, label: 'Segments' },
        renderMode: { type: 'select', options: ['wireframe', 'solid', 'points'], default: 'wireframe', label: 'Render' },
        orbitSpeed: { type: 'range', min: 0, max: 3, default: 0.5, step: 0.1, label: 'Orbit Speed' },
        scaleReact: { type: 'range', min: 0, max: 2, default: 1, step: 0.1, label: 'Scale React' },
        tiltVariation: { type: 'range', min: 0, max: 2, default: 1, step: 0.1, label: 'Tilt' },
        glowColor: { type: 'toggle', default: true, label: 'Glow' }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 30, 80);
        camera.lookAt(0, 0, 0);
        this.buildRings(3);
    },

    createMobiusGeometry(radius, tubeRadius, segments, twist) {
        const geo = new THREE.BufferGeometry();
        const positions = [];
        const indices = [];
        const tubeSegs = 8;

        for (let i = 0; i <= segments; i++) {
            const u = (i / segments) * Math.PI * 2;
            const twistAngle = (i / segments) * Math.PI * twist;

            const cx = Math.cos(u) * radius;
            const cy = Math.sin(u) * radius;

            for (let j = 0; j <= tubeSegs; j++) {
                const v = (j / tubeSegs) * Math.PI * 2;

                const nx = Math.cos(v) * Math.cos(twistAngle) - Math.sin(v) * Math.sin(twistAngle);
                const ny = Math.cos(v) * Math.sin(twistAngle) + Math.sin(v) * Math.cos(twistAngle);

                positions.push(
                    cx + Math.cos(u) * nx * tubeRadius,
                    cy + Math.sin(u) * nx * tubeRadius,
                    ny * tubeRadius
                );

                if (i < segments && j < tubeSegs) {
                    const a = i * (tubeSegs + 1) + j;
                    const b = a + tubeSegs + 1;
                    indices.push(a, b, a + 1);
                    indices.push(a + 1, b, b + 1);
                }
            }
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    },

    buildRings(count) {
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }
        this.rings = [];

        for (let i = 0; i < count; i++) {
            const geo = this.createMobiusGeometry(30, 1.5, 128, 3);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x8b5cf6,
                wireframe: true,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = i * Math.PI / count;
            mesh.rotation.y = i * Math.PI * 0.3;
            this.group.add(mesh);
            this.rings.push(mesh);
        }
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        const count = Math.floor(params.ringCount || 3);
        if (count !== this.rings.length) this.buildRings(count);

        const reactivity = params.reactivity || 1;
        const bass = audio.smoothBands.bass;
        const mid = audio.smoothBands.mid;
        const treble = audio.smoothBands.treble;
        const orbitSpeed = params.orbitSpeed || 0.5;
        const tilt = params.tiltVariation || 1;

        for (let i = 0; i < this.rings.length; i++) {
            const ring = this.rings[i];
            const t = i / this.rings.length;

            // Rebuild with current params
            ring.geometry.dispose();
            ring.geometry = this.createMobiusGeometry(
                (params.radius || 30) * (1 + bass * params.scaleReact * reactivity * 0.3),
                (params.tubeRadius || 1.5) * (1 + mid * reactivity * 0.5),
                Math.floor(params.segments || 128),
                (params.twist || 3) + bass * 2 * reactivity
            );

            ring.material.wireframe = params.renderMode === 'wireframe';

            // Orbit
            ring.rotation.x = t * Math.PI + this.time * orbitSpeed * (1 + i * 0.3) + Math.sin(this.time) * tilt * 0.3;
            ring.rotation.y = t * Math.PI * 0.7 + this.time * orbitSpeed * 0.5;
            ring.rotation.z = Math.sin(this.time * 0.3 + i) * tilt * 0.5;

            // Color
            const color = ParamSystem.getColorThree(t + bass * 0.3);
            ring.material.color = color;
            ring.material.opacity = 0.4 + treble * 0.4;
        }

        if (audio.beat) {
            this.group.rotation.z += audio.beatIntensity * 0.15;
        }
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.rings = [];
    }
};
