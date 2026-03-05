// ============================================================
// AURA Mode — Grid Distortion V2
// Flat grid warped by audio with vortex, hex, 3D surface,
// shockwave, color by distortion, perspective tilt
// ============================================================

const GridDistortionMode = {
    name: 'Grid Distortion',
    group: null,
    time: 0,

    params: {
        gridSize: { type: 'range', min: 5, max: 40, default: 20, step: 1, label: 'Grid Size' },
        spacing: { type: 'range', min: 2, max: 10, default: 5, step: 0.5, label: 'Spacing' },
        warpStrength: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: 'Warp' },
        warpType: { type: 'select', options: ['ripple', 'noise', 'directional', 'radial', 'twist', 'seismic', 'shockwave'], default: 'ripple', label: 'Warp Type' },
        perspective: { type: 'toggle', default: true, label: '3D Perspective' },
        dotMode: { type: 'toggle', default: false, label: 'Show Dots' },
        dotSize: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.5, label: 'Dot Size' },
        waveSpeed: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: 'Wave Speed' },
        // V2 params
        gridType: { type: 'select', options: ['square', 'hex', 'triangular', 'isometric', 'polar'], default: 'square', label: '📐 Grid Type' },
        vortexCount: { type: 'range', min: 0, max: 5, default: 0, step: 1, label: '🌀 Vortex Count' },
        vortexStrength: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: 'Vortex Str' },
        surface3D: { type: 'toggle', default: false, label: '🧊 3D Surface' },
        cellSize: { type: 'range', min: 1, max: 10, default: 5, step: 0.5, label: 'Cell Size' },
        gridThickness: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: 'Thickness' },
        noiseDistortion: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🌪️ Noise' },
        beatRipple: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '💥 Beat Ripple' },
        dropShockwave: { type: 'toggle', default: true, label: '🔥 Drop Shockwave' },
        colorByDistortion: { type: 'toggle', default: true, label: '🎨 Color by Warp' },
        gridRotation: { type: 'range', min: 0, max: 2, default: 0, step: 0.05, label: '🌀 Rotation' },
        perspectiveTilt: { type: 'range', min: -1, max: 0, default: -0.5, step: 0.05, label: '📐 Tilt' },
        glowIntensity: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.1, label: '✨ Glow' }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 40, 80);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.shockwaveTime = -10;
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

        const gridSize = Math.floor(params.gridSize || 20);
        const spacing = params.spacing || 5;
        const warp = (params.warpStrength || 2) * (params.reactivity || 1);
        const warpType = params.warpType || 'ripple';
        const waveSpeed = params.waveSpeed || 2;
        const bass = audio.smoothBands.bass;
        const mid = audio.smoothBands.mid;
        const treble = audio.smoothBands.treble;
        const vortexCount = Math.floor(params.vortexCount || 0);
        const vortexStr = params.vortexStrength || 1;
        const noiseDist = params.noiseDistortion || 0;
        const beatRipple = params.beatRipple || 0;
        const glowInt = params.glowIntensity || 0.5;
        const gridType = params.gridType || 'square';

        if (params.dropShockwave && audio.isDropSection) {
            this.shockwaveTime = this.time;
        }

        const offset = (gridSize * spacing) / 2;

        const gridPoints = [];
        for (let x = 0; x <= gridSize; x++) {
            const row = [];
            for (let z = 0; z <= gridSize; z++) {
                let px, pz;

                if (gridType === 'hex') {
                    px = x * spacing - offset + (z % 2) * spacing * 0.5;
                    pz = z * spacing * 0.866 - offset;
                } else if (gridType === 'triangular') {
                    px = x * spacing - offset + (z % 2) * spacing * 0.5;
                    pz = z * spacing * 0.866 - offset;
                } else if (gridType === 'isometric') {
                    px = (x - z) * spacing * 0.5;
                    pz = (x + z) * spacing * 0.25 - offset * 0.5;
                } else if (gridType === 'polar') {
                    const angle = (x / gridSize) * Math.PI * 2;
                    const radius = (z / gridSize) * offset;
                    px = Math.cos(angle) * radius;
                    pz = Math.sin(angle) * radius;
                } else {
                    px = x * spacing - offset;
                    pz = z * spacing - offset;
                }

                let py = 0;
                const nx = x / gridSize, nz = z / gridSize;
                const cx = nx - 0.5, cz = nz - 0.5;
                const dist = Math.sqrt(cx * cx + cz * cz);
                const fIdx = Math.floor(nx * audio.frequencyData.length * 0.5);
                const freq = (audio.frequencyData[fIdx] || 0) / 255;

                if (warpType === 'ripple') {
                    py = Math.sin(dist * 15 - this.time * waveSpeed) * warp * 5 * bass;
                    py += Math.sin(nx * 10 + this.time * 2) * warp * 2 * freq;
                } else if (warpType === 'noise') {
                    py = Math.sin(px * 0.1 + this.time * waveSpeed) * Math.cos(pz * 0.12 + this.time * waveSpeed * 0.7) * warp * 8 * bass;
                    py += Math.sin(px * 0.3 + pz * 0.2 + this.time * 3) * warp * 3 * treble;
                } else if (warpType === 'directional') {
                    py = Math.sin(nz * 20 - this.time * waveSpeed * 2) * warp * 5 * bass;
                } else if (warpType === 'radial') {
                    py = Math.sin(dist * 20 - this.time * waveSpeed * 3) * warp * 8 * (0.5 - dist) * bass;
                } else if (warpType === 'twist') {
                    const angle = Math.atan2(cz, cx) + this.time * waveSpeed * 0.5;
                    py = Math.sin(angle * 5 + dist * 10) * warp * 5 * bass;
                } else if (warpType === 'seismic') {
                    py = Math.sin(dist * 30 - this.time * waveSpeed * 5) * warp * 8 * bass * Math.exp(-dist * 3);
                } else if (warpType === 'shockwave') {
                    const timeSinceShock = this.time - this.shockwaveTime;
                    const shockRadius = timeSinceShock * 0.5;
                    const shockWidth = 0.1;
                    const shock = Math.exp(-Math.pow(dist - shockRadius, 2) / shockWidth) * warp * 10 * Math.exp(-timeSinceShock * 2);
                    py = shock + Math.sin(dist * 15 - this.time * waveSpeed) * warp * 3 * bass;
                }

                // Noise distortion
                if (noiseDist > 0) {
                    py += Math.sin(px * 0.5 + this.time) * Math.cos(pz * 0.3 + this.time * 0.7) * noiseDist * 3;
                }

                // Vortex distortion
                for (let v = 0; v < vortexCount; v++) {
                    const vAngle = (v / vortexCount) * Math.PI * 2 + this.time * 0.3;
                    const vx = Math.cos(vAngle) * offset * 0.3;
                    const vz = Math.sin(vAngle) * offset * 0.3;
                    const vDist = Math.sqrt((px - vx) ** 2 + (pz - vz) ** 2);
                    py += Math.sin(vDist * 5 - this.time * 3) * vortexStr * 3 / (vDist * 0.1 + 1);
                }

                // Beat ripple
                if (beatRipple > 0 && audio.beat) {
                    py += Math.sin(dist * 30 - this.time * 10) * beatRipple * audio.beatIntensity * 3 * Math.exp(-dist * 5);
                }

                row.push(new THREE.Vector3(px, py, pz));
            }
            gridPoints.push(row);
        }

        // Draw horizontal lines
        for (let x = 0; x <= gridSize; x++) {
            const points = gridPoints[x];
            if (!points || points.length < 2) continue;
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const t = x / gridSize;
            let color;
            if (params.colorByDistortion) {
                const avgY = points.reduce((s, p) => s + Math.abs(p.y), 0) / points.length;
                color = ParamSystem.getColorThree(avgY / (warp * 5 + 0.1));
            } else {
                color = ParamSystem.getColorThree(t + bass * 0.2);
            }
            const mat = new THREE.LineBasicMaterial({
                color, transparent: true, opacity: (0.5 + bass * 0.3) * (0.5 + glowInt),
                blending: THREE.AdditiveBlending
            });
            this.group.add(new THREE.Line(geo, mat));
        }

        // Draw vertical lines
        for (let z = 0; z <= gridSize; z++) {
            const points = [];
            for (let x = 0; x <= gridSize; x++) {
                if (gridPoints[x] && gridPoints[x][z]) points.push(gridPoints[x][z]);
            }
            if (points.length < 2) continue;
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const t = z / gridSize;
            let color;
            if (params.colorByDistortion) {
                const avgY = points.reduce((s, p) => s + Math.abs(p.y), 0) / points.length;
                color = ParamSystem.getColorThree(avgY / (warp * 5 + 0.1));
            } else {
                color = ParamSystem.getColorThree(t + mid * 0.2);
            }
            const mat = new THREE.LineBasicMaterial({
                color, transparent: true, opacity: (0.5 + mid * 0.3) * (0.5 + glowInt),
                blending: THREE.AdditiveBlending
            });
            this.group.add(new THREE.Line(geo, mat));
        }

        // Dots
        if (params.dotMode) {
            const dotPositions = [];
            const dotColors = [];
            for (let x = 0; x <= gridSize; x++) {
                for (let z = 0; z <= gridSize; z++) {
                    if (!gridPoints[x] || !gridPoints[x][z]) continue;
                    const p = gridPoints[x][z];
                    dotPositions.push(p.x, p.y, p.z);
                    const h = Math.abs(p.y) / (warp * 8 + 0.1);
                    const c = ParamSystem.getColorThreeHSL(h);
                    dotColors.push(c.r, c.g, c.b);
                }
            }
            const dotGeo = new THREE.BufferGeometry();
            dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
            dotGeo.setAttribute('color', new THREE.Float32BufferAttribute(dotColors, 3));
            const dotMat = new THREE.PointsMaterial({
                size: params.dotSize || 2, vertexColors: true, transparent: true,
                opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
            });
            this.group.add(new THREE.Points(dotGeo, dotMat));
        }

        // Tilt and rotation
        const tiltAngle = params.perspectiveTilt || -0.5;
        this.group.rotation.x = params.perspective ? tiltAngle + Math.sin(this.time * 0.3) * 0.1 : -Math.PI / 2;
        if (params.gridRotation > 0) {
            this.group.rotation.y += params.gridRotation * dt;
        }
    },

    destroy(scene) {
        if (this.group) scene.remove(this.group);
    }
};
