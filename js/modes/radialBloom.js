// ============================================================
// AURA Mode — Radial Bloom V2
// Expanding circular rings with 3D depth, wave modes,
// frequency mapping, symmetry, spiral, bloom pulse
// ============================================================

const RadialBloomMode = {
    name: 'Radial Bloom',
    group: null,
    rings: [],
    innerRings: [],
    time: 0,

    params: {
        ringCount: { type: 'range', min: 3, max: 30, default: 12, step: 1, label: 'Ring Count' },
        maxRadius: { type: 'range', min: 20, max: 200, default: 80, step: 5, label: 'Max Radius' },
        thickness: { type: 'range', min: 0.1, max: 3, default: 0.5, step: 0.1, label: 'Thickness' },
        expandSpeed: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: 'Expand Speed' },
        segments: { type: 'range', min: 16, max: 128, default: 64, step: 1, label: 'Segments' },
        pulsateMode: { type: 'select', options: ['bass', 'mid', 'treble', 'rms', 'beat', 'sub', 'brilliance'], default: 'bass', label: 'Pulse Source' },
        style: { type: 'select', options: ['rings', 'dots', 'dashed', 'wave', 'torus', 'helix'], default: 'rings', label: 'Style' },
        rotationSpeed: { type: 'range', min: 0, max: 3, default: 0.3, step: 0.1, label: 'Rotation' },
        opacity: { type: 'range', min: 0.1, max: 1, default: 0.7, step: 0.05, label: 'Opacity' },
        // V2 params
        depth3D: { type: 'range', min: 0, max: 50, default: 0, step: 2, label: '🧊 3D Depth' },
        ringShape: { type: 'select', options: ['circle', 'hexagon', 'star', 'square', 'triangle', 'octagon'], default: 'circle', label: '🔷 Ring Shape' },
        waveMode: { type: 'select', options: ['sine', 'sawtooth', 'triangle', 'pulse', 'noise'], default: 'sine', label: '〰️ Wave Mode' },
        frequencyMap: { type: 'toggle', default: false, label: '🎵 Freq Map (per-ring)' },
        colorWave: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌈 Color Wave' },
        innerRingsEnabled: { type: 'toggle', default: false, label: '🔄 Inner Rings' },
        bloomPulse: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '✨ Bloom Pulse' },
        rotatePerRing: { type: 'toggle', default: true, label: '🌀 Per-ring Rotate' },
        spiralAngle: { type: 'range', min: 0, max: 1, default: 0, step: 0.05, label: '🌀 Spiral' },
        beatBurst: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '💥 Beat Burst' },
        dropReaction: { type: 'select', options: ['none', 'explode', 'implode', 'colorStorm', 'freeze'], default: 'none', label: '🔥 Drop Reaction' },
        symmetryMode: { type: 'select', options: ['none', 'bilateral', 'radial4', 'radial6'], default: 'none', label: '🪞 Symmetry' },
        glowIntensity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '💡 Glow' },
        ringSpacing: { type: 'range', min: 0.5, max: 3, default: 1, step: 0.1, label: 'Ring Spacing' }
    },

    getShapeGeo(shape, radius, thick, segments) {
        if (shape === 'hexagon') return new THREE.RingGeometry(radius, radius + thick, 6, 1);
        if (shape === 'star') {
            const pts = [];
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                const r = i % 2 === 0 ? radius + thick : radius;
                pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
            }
            const shp = new THREE.Shape(pts);
            return new THREE.ShapeGeometry(shp);
        }
        if (shape === 'square') return new THREE.RingGeometry(radius, radius + thick, 4, 1);
        if (shape === 'triangle') return new THREE.RingGeometry(radius, radius + thick, 3, 1);
        if (shape === 'octagon') return new THREE.RingGeometry(radius, radius + thick, 8, 1);
        return new THREE.RingGeometry(radius, radius + thick, segments, 1);
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 120);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.buildRings(12, 64);
    },

    buildRings(count, segments) {
        while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }
        this.rings = [];
        this.innerRings = [];

        for (let i = 0; i < count; i++) {
            const radius = 5 + (i / count) * 60;
            const geo = new THREE.RingGeometry(radius, radius + 0.5, segments, 1);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x8b5cf6,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            this.group.add(mesh);
            this.rings.push({ mesh, baseRadius: radius, phase: (i / count) * Math.PI * 2, burstOffset: 0 });
        }
    },

    getWaveValue(mode, phase) {
        switch (mode) {
            case 'sawtooth': return (phase % (Math.PI * 2)) / (Math.PI * 2) * 2 - 1;
            case 'triangle': return Math.abs((phase % (Math.PI * 2)) / Math.PI - 1) * 2 - 1;
            case 'pulse': return Math.sin(phase) > 0 ? 1 : -1;
            case 'noise': return Math.sin(phase * 12.9898 + 78.233) * 43758.5453 % 1 * 2 - 1;
            default: return Math.sin(phase);
        }
    },

    update(audio, params, dt) {
        this.time += dt;

        const count = Math.floor(params.ringCount || 12);
        const segs = Math.floor(params.segments || 64);

        if (count !== this.rings.length) {
            this.buildRings(count, segs);
        }

        const maxR = params.maxRadius || 80;
        const thick = params.thickness || 0.5;
        const expand = params.expandSpeed || 1;
        const rotSpeed = params.rotationSpeed || 0.3;
        const opacity = params.opacity || 0.7;
        const reactivity = params.reactivity || 1;
        const depth3D = params.depth3D || 0;
        const ringShape = params.ringShape || 'circle';
        const waveMode = params.waveMode || 'sine';
        const colorWave = params.colorWave || 0;
        const bloomPulse = params.bloomPulse || 0;
        const spiralAngle = params.spiralAngle || 0;
        const beatBurst = params.beatBurst || 0;
        const glowInt = params.glowIntensity || 1;
        const spacing = params.ringSpacing || 1;

        // Pulse source
        let pulse = 0;
        switch (params.pulsateMode) {
            case 'bass': pulse = audio.smoothBands.bass; break;
            case 'mid': pulse = audio.smoothBands.mid; break;
            case 'treble': pulse = audio.smoothBands.treble; break;
            case 'rms': pulse = audio.rms; break;
            case 'beat': pulse = audio.beatIntensity; break;
            case 'sub': pulse = audio.smoothBands.sub; break;
            case 'brilliance': pulse = audio.smoothBands.brilliance; break;
            default: pulse = audio.smoothBands.bass;
        }

        // Drop reaction
        if (params.dropReaction !== 'none' && audio.isDropSection) {
            if (params.dropReaction === 'explode') {
                for (let i = 0; i < this.rings.length; i++) {
                    this.rings[i].burstOffset = (i + 1) * 5 * audio.dropIntensity;
                }
            } else if (params.dropReaction === 'implode') {
                for (let i = 0; i < this.rings.length; i++) {
                    this.rings[i].burstOffset = -(i + 1) * 3 * audio.dropIntensity;
                }
            }
        }

        for (let i = 0; i < this.rings.length; i++) {
            const ring = this.rings[i];
            const t = i / this.rings.length;

            // Decay burst offset
            if (ring.burstOffset) ring.burstOffset *= 0.92;

            // Animated radius with wave mode
            const phase = ring.phase + this.time * expand;
            const radiusMod = this.getWaveValue(waveMode, phase) * 0.5 + 0.5;

            // Per-ring frequency mapping
            let freqPulse = pulse;
            if (params.frequencyMap) {
                const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
                freqPulse = audio.smoothBands[bands[i % bands.length]] || 0;
            }

            const radius = (5 + t * maxR * spacing) * (1 + freqPulse * reactivity * 0.5) * (0.5 + radiusMod * 0.5) + (ring.burstOffset || 0);

            // Beat burst
            let burstMod = 1;
            if (beatBurst > 0 && audio.beat) {
                burstMod = 1 + audio.beatIntensity * beatBurst * 0.3;
            }

            // Rebuild geometry
            ring.mesh.geometry.dispose();
            const thickMod = thick * (1 + freqPulse * 2) * burstMod;
            ring.mesh.geometry = this.getShapeGeo(ringShape, radius * burstMod, thickMod, segs);

            // 3D depth
            ring.mesh.position.z = depth3D > 0 ? (t - 0.5) * depth3D : 0;

            // Spiral
            if (spiralAngle > 0) {
                ring.mesh.position.x = Math.cos(t * Math.PI * 2 * spiralAngle + this.time * 0.5) * depth3D * 0.3;
                ring.mesh.position.y = Math.sin(t * Math.PI * 2 * spiralAngle + this.time * 0.5) * depth3D * 0.3;
            }

            // Color with wave
            const colorT = t + this.time * colorWave * 0.1;
            const color = ParamSystem.getColorThree(colorT);
            ring.mesh.material.color = color;

            // Bloom pulse
            const bp = bloomPulse > 0 ? (1 + Math.sin(this.time * 3 + i * 0.5) * bloomPulse * freqPulse * 0.3) : 1;
            ring.mesh.material.opacity = opacity * (0.3 + freqPulse * 0.7) * bp * glowInt;

            // Scale based on audio
            const bands = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
            const scaleReact = 1 + (audio.smoothBands[bands[i % 7]] || 0) * reactivity;
            ring.mesh.scale.set(scaleReact, scaleReact, 1);

            // Rotation
            if (params.rotatePerRing) {
                ring.mesh.rotation.z = this.time * rotSpeed * (i % 2 === 0 ? 1 : -1) * 0.5;
            }
        }

        // Inner rings
        if (params.innerRingsEnabled && this.innerRings.length === 0) {
            for (let i = 0; i < Math.min(count, 8); i++) {
                const radius = 3 + (i / 8) * 20;
                const geo = new THREE.RingGeometry(radius, radius + 0.3, segs, 1);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0xff00ff, transparent: true, opacity: 0.3,
                    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
                });
                const mesh = new THREE.Mesh(geo, mat);
                this.group.add(mesh);
                this.innerRings.push(mesh);
            }
        }
        if (this.innerRings.length > 0) {
            this.innerRings.forEach((ir, i) => {
                ir.visible = params.innerRingsEnabled;
                if (ir.visible) {
                    const t = i / this.innerRings.length;
                    ir.rotation.z = -this.time * rotSpeed * (1 + t);
                    const scale = 1 + pulse * reactivity * 0.5;
                    ir.scale.set(scale, scale, 1);
                    ir.material.opacity = 0.2 + pulse * 0.3;
                    ir.material.color = ParamSystem.getColorThree(t + 0.5 + this.time * 0.05);
                }
            });
        }

        // Spin on beat
        if (audio.beat) {
            this.group.rotation.z += audio.beatIntensity * 0.3;
        }
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.rings = [];
        this.innerRings = [];
    }
};
