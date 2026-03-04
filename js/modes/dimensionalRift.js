// ============================================================
// AURA Mode — DIMENSIONAL RIFT v2
// Beat-synced reality-tearing portals, 4D geometry projections,
// quantum field particles — persistent geometry, no per-frame rebuild
// ============================================================

const DimensionalRiftMode = {
    name: 'Dimensional Rift',
    group: null,
    time: 0,
    tearPhase: 0,
    collapsePhase: 0,

    // Persistent geometry
    riftLines: [],       // 4D edge lines
    riftSpheres: [],     // 4D vertex spheres
    portalRings: [],     // portal ring lines
    portalInners: [],    // portal inner glow meshes
    portalEdgePts: [],   // portal edge particles
    beamLines: [],       // inter-portal beam lines
    fieldParticles: null,
    fieldPositions: null,
    fieldColors: null,
    fieldCount: 0,
    horizonMesh: null,
    webLines: [],
    cloudMesh: null,
    entangleLines: [],

    // Cached polytope
    currentPolytopeType: '',
    currentPolytope: null,
    currentLayers: 0,
    currentPortalCount: 0,

    params: {
        // --- Core Rift ---
        riftType: { type: 'select', options: ['wormhole', 'tesseract', 'fractalVoid', 'quantumField', 'eventHorizon', 'dimensionalBleed', 'timeFracture', 'singularity'], default: 'wormhole', label: '🌀 Rift Type' },
        riftIntensity: { type: 'range', min: 0.5, max: 5, default: 2, step: 0.1, label: '⚡ Intensity' },
        riftScale: { type: 'range', min: 10, max: 80, default: 40, step: 5, label: '📏 Scale' },

        // --- 4D Geometry ---
        dimension4: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🔮 4D Depth' },
        projectionAngle: { type: 'range', min: 0, max: 6.28, default: 0, step: 0.1, label: '📐 4D Angle' },
        rotateW: { type: 'range', min: 0, max: 2, default: 0.5, step: 0.05, label: '🌀 W-Rotation' },
        geometryType: { type: 'select', options: ['tesseract', 'pentachoron', 'hexadecachoron', 'icositetrachoron', 'duoprism'], default: 'tesseract', label: '🔷 4D Shape' },

        // --- Portal ---
        portalCount: { type: 'range', min: 1, max: 5, default: 2, step: 1, label: '🚪 Portals' },
        portalRadius: { type: 'range', min: 5, max: 30, default: 15, step: 1, label: 'Portal Size' },
        portalDistortion: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '🌊 Distortion' },
        portalEdgeGlow: { type: 'range', min: 0, max: 3, default: 1.5, step: 0.1, label: '✨ Edge Glow' },
        interPortalBeams: { type: 'toggle', default: true, label: '⚡ Inter-beams' },

        // --- Quantum Field ---
        fieldParticleCount: { type: 'range', min: 1000, max: 10000, default: 5000, step: 500, label: '🌟 Field Particles' },
        quantumFoam: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🫧 Quantum Foam' },
        entanglement: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🔗 Entanglement' },
        probabilityCloud: { type: 'toggle', default: false, label: '☁️ Prob. Cloud' },

        // --- Spacetime ---
        spacetimeWarp: { type: 'range', min: 0, max: 5, default: 1, step: 0.1, label: '🕳️ Spacetime Warp' },
        timeDilation: { type: 'range', min: 0.1, max: 3, default: 1, step: 0.1, label: '⏳ Time Dilation' },
        gravitationalLensing: { type: 'range', min: 0, max: 3, default: 0, step: 0.1, label: '🔭 Grav Lensing' },
        causalityWeb: { type: 'toggle', default: false, label: '🕸️ Causality Web' },

        // --- Visuals ---
        colorDimension: { type: 'select', options: ['ultraviolet', 'infrared', 'xray', 'gamma', 'cosmic', 'void', 'chromatic', 'inverted'], default: 'cosmic', label: '🎨 Spectrum' },
        glitchReality: { type: 'range', min: 0, max: 5, default: 0, step: 0.1, label: '📺 Reality Glitch' },
        dimensionalLayers: { type: 'range', min: 1, max: 5, default: 3, step: 1, label: '📐 Dim Layers' },

        // --- Audio React ---
        beatTear: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '💥 Beat Tear' },
        dropCollapse: { type: 'toggle', default: true, label: '🔥 Drop Collapse' },
        bassGravity: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🔊 Bass Gravity' },
        trebleFlicker: { type: 'range', min: 0, max: 3, default: 1, step: 0.1, label: '🎵 Treble Flicker' }
    },

    // 4D Geometry: vertices for various polytopes
    getPolytope(type) {
        const phi = (1 + Math.sqrt(5)) / 2;
        switch (type) {
            case 'pentachoron':
                return {
                    vertices: [
                        [1, 1, 1, -1], [1, -1, -1, -1], [-1, 1, -1, -1],
                        [-1, -1, 1, -1], [0, 0, 0, Math.sqrt(5) - 1]
                    ],
                    edges: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]
                };
            case 'hexadecachoron':
                return {
                    vertices: [
                        [1, 0, 0, 0], [-1, 0, 0, 0], [0, 1, 0, 0], [0, -1, 0, 0],
                        [0, 0, 1, 0], [0, 0, -1, 0], [0, 0, 0, 1], [0, 0, 0, -1]
                    ],
                    edges: [[0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7],
                    [2, 4], [2, 5], [2, 6], [2, 7], [3, 4], [3, 5], [3, 6], [3, 7], [4, 6], [4, 7], [5, 6], [5, 7]]
                };
            case 'icositetrachoron':
                {
                    const verts = [];
                    const perms = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
                    for (const [a, b] of perms) {
                        for (const sa of [-1, 1]) {
                            for (const sb of [-1, 1]) {
                                const v = [0, 0, 0, 0];
                                v[a] = sa; v[b] = sb;
                                verts.push(v);
                            }
                        }
                    }
                    const edges = [];
                    for (let i = 0; i < verts.length; i++) {
                        for (let j = i + 1; j < verts.length; j++) {
                            let dist2 = 0;
                            for (let k = 0; k < 4; k++) dist2 += (verts[i][k] - verts[j][k]) ** 2;
                            if (Math.abs(dist2 - 2) < 0.01) edges.push([i, j]);
                        }
                    }
                    return { vertices: verts, edges };
                }
            case 'duoprism':
                {
                    const verts = [];
                    const n = 6;
                    for (let i = 0; i < n; i++) {
                        for (let j = 0; j < n; j++) {
                            const a1 = (i / n) * Math.PI * 2;
                            const a2 = (j / n) * Math.PI * 2;
                            verts.push([Math.cos(a1), Math.sin(a1), Math.cos(a2), Math.sin(a2)]);
                        }
                    }
                    const edges = [];
                    for (let i = 0; i < n; i++) {
                        for (let j = 0; j < n; j++) {
                            const idx = i * n + j;
                            if (j < n - 1) edges.push([idx, idx + 1]);
                            else edges.push([idx, i * n]);
                            if (i < n - 1) edges.push([idx, idx + n]);
                            else edges.push([idx, j]);
                        }
                    }
                    return { vertices: verts, edges };
                }
            default: // tesseract
                return {
                    vertices: [
                        [-1, -1, -1, -1], [-1, -1, -1, 1], [-1, -1, 1, -1], [-1, -1, 1, 1],
                        [-1, 1, -1, -1], [-1, 1, -1, 1], [-1, 1, 1, -1], [-1, 1, 1, 1],
                        [1, -1, -1, -1], [1, -1, -1, 1], [1, -1, 1, -1], [1, -1, 1, 1],
                        [1, 1, -1, -1], [1, 1, -1, 1], [1, 1, 1, -1], [1, 1, 1, 1]
                    ],
                    edges: [
                        [0, 1], [0, 2], [0, 4], [0, 8], [1, 3], [1, 5], [1, 9], [2, 3], [2, 6], [2, 10],
                        [3, 7], [3, 11], [4, 5], [4, 6], [4, 12], [5, 7], [5, 13], [6, 7], [6, 14],
                        [7, 15], [8, 9], [8, 10], [8, 12], [9, 11], [9, 13], [10, 11], [10, 14],
                        [11, 15], [12, 13], [12, 14], [13, 15], [14, 15]
                    ]
                };
        }
    },

    // Project 4D to 3D via stereographic projection
    project4D(v4, wAngle, d4) {
        const cosW = Math.cos(wAngle), sinW = Math.sin(wAngle);
        const x1 = v4[0] * cosW - v4[3] * sinW;
        const w1 = v4[0] * sinW + v4[3] * cosW;
        const y1 = v4[1] * cosW * 0.7 - w1 * sinW * 0.3;
        const w2 = v4[1] * sinW * 0.3 + w1 * cosW * 0.7;
        const distance = 3 + d4;
        const scale = distance / (distance - w2);
        return new THREE.Vector3(x1 * scale, y1 * scale, v4[2] * scale);
    },

    getSpectrumColor(spectrum, t) {
        switch (spectrum) {
            case 'ultraviolet': return new THREE.Color().setHSL(0.75 + t * 0.15, 1, 0.3 + t * 0.4);
            case 'infrared': return new THREE.Color().setHSL(0.0 + t * 0.08, 1, 0.3 + t * 0.3);
            case 'xray': return new THREE.Color().setHSL(0.55 + t * 0.1, 0.5, 0.5 + t * 0.3);
            case 'gamma': return new THREE.Color().setHSL(0.8 + t * 0.2, 1, 0.4 + t * 0.4);
            case 'void': return new THREE.Color().setHSL(0.7, 0.2 + t * 0.3, 0.05 + t * 0.2);
            case 'chromatic': return new THREE.Color().setHSL(t, 1, 0.5);
            case 'inverted': return new THREE.Color().setHSL(1 - t, 1, 0.6 - t * 0.3);
            default: return new THREE.Color().setHSL(0.6 + t * 0.3, 0.9, 0.3 + t * 0.4);
        }
    },

    init(scene, camera, renderer) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);
        this.time = 0;
        this.tearPhase = 0;
        this.collapsePhase = 0;
        this.currentPolytopeType = '';
        this.currentPolytope = null;
        this.currentLayers = 0;
        this.currentPortalCount = 0;

        // Pre-allocate persistent objects
        this.riftLines = [];
        this.riftSpheres = [];
        this.portalRings = [];
        this.portalInners = [];
        this.portalEdgePts = [];
        this.beamLines = [];
        this.webLines = [];
        this.entangleLines = [];
        this.fieldParticles = null;
        this.horizonMesh = null;
        this.cloudMesh = null;
    },

    // Build persistent 4D geometry objects
    build4DGeometry(polytope, layers) {
        // Dispose old
        this.riftLines.forEach(l => { this.group.remove(l); l.geometry.dispose(); l.material.dispose(); });
        this.riftSpheres.forEach(s => { this.group.remove(s); s.geometry.dispose(); s.material.dispose(); });
        this.riftLines = [];
        this.riftSpheres = [];

        for (let layer = 0; layer < layers; layer++) {
            // Edge lines
            for (const edge of polytope.edges) {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
                const mat = new THREE.LineBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.4,
                    blending: THREE.AdditiveBlending
                });
                const line = new THREE.Line(geo, mat);
                line.userData = { layer, edge };
                this.group.add(line);
                this.riftLines.push(line);
            }
            // Vertex spheres
            const sphereGeo = new THREE.SphereGeometry(0.3, 6, 6);
            for (let vi = 0; vi < polytope.vertices.length; vi++) {
                const mat = new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.5,
                    blending: THREE.AdditiveBlending
                });
                const mesh = new THREE.Mesh(sphereGeo.clone(), mat);
                mesh.userData = { layer, vi };
                this.group.add(mesh);
                this.riftSpheres.push(mesh);
            }
        }
    },

    // Build persistent portal objects
    buildPortals(count) {
        this.portalRings.forEach(l => { this.group.remove(l); l.geometry.dispose(); l.material.dispose(); });
        this.portalInners.forEach(m => { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); });
        this.portalEdgePts.forEach(p => { this.group.remove(p); p.geometry.dispose(); p.material.dispose(); });
        this.beamLines.forEach(l => { this.group.remove(l); l.geometry.dispose(); l.material.dispose(); });
        this.portalRings = [];
        this.portalInners = [];
        this.portalEdgePts = [];
        this.beamLines = [];

        const ringSegments = 65;
        const edgePCount = 200;

        for (let p = 0; p < count; p++) {
            // Ring line
            const ringPos = new Float32Array(ringSegments * 3);
            const ringGeo = new THREE.BufferGeometry();
            ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPos, 3));
            const ringMat = new THREE.LineBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.6,
                blending: THREE.AdditiveBlending
            });
            const ring = new THREE.Line(ringGeo, ringMat);
            this.group.add(ring);
            this.portalRings.push(ring);

            // Inner glow
            const innerGeo = new THREE.SphereGeometry(1, 8, 8);
            const innerMat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.05,
                blending: THREE.AdditiveBlending
            });
            const inner = new THREE.Mesh(innerGeo, innerMat);
            inner.scale.z = 0.1;
            this.group.add(inner);
            this.portalInners.push(inner);

            // Edge particles
            const epPos = new Float32Array(edgePCount * 3);
            const epCols = new Float32Array(edgePCount * 3);
            const epGeo = new THREE.BufferGeometry();
            epGeo.setAttribute('position', new THREE.Float32BufferAttribute(epPos, 3));
            epGeo.setAttribute('color', new THREE.Float32BufferAttribute(epCols, 3));
            const epPts = new THREE.Points(epGeo, new THREE.PointsMaterial({
                size: 0.5, vertexColors: true, transparent: true,
                opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false
            }));
            this.group.add(epPts);
            this.portalEdgePts.push(epPts);
        }

        // Beam lines between portals
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const beamPos = new Float32Array(31 * 3);
                const beamGeo = new THREE.BufferGeometry();
                beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(beamPos, 3));
                const beamMat = new THREE.LineBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.3,
                    blending: THREE.AdditiveBlending
                });
                const beam = new THREE.Line(beamGeo, beamMat);
                beam.userData = { i, j };
                this.group.add(beam);
                this.beamLines.push(beam);
            }
        }
    },

    // Build persistent field particles
    buildFieldParticles(count) {
        if (this.fieldParticles) {
            this.group.remove(this.fieldParticles);
            this.fieldParticles.geometry.dispose();
            this.fieldParticles.material.dispose();
        }
        this.fieldCount = count;
        this.fieldPositions = new Float32Array(count * 3);
        this.fieldColors = new Float32Array(count * 3);
        // Initialize random positions
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = (Math.random() ** 0.3) * 60;
            this.fieldPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            this.fieldPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            this.fieldPositions[i * 3 + 2] = r * Math.cos(phi);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.fieldPositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.fieldColors, 3));
        this.fieldParticles = new THREE.Points(geo, new THREE.PointsMaterial({
            size: 0.5, vertexColors: true, transparent: true,
            opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false,
            sizeAttenuation: true
        }));
        this.group.add(this.fieldParticles);
    },

    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt * (params.timeDilation || 1);

        const reactivity = params.reactivity || 1;
        const bass = audio.smoothBands.bass;
        const mid = audio.smoothBands.mid;
        const treble = audio.smoothBands.treble;
        const rms = audio.rms;
        const intensity = params.riftIntensity || 2;
        const scale = params.riftScale || 40;
        const spectrum = params.colorDimension || 'cosmic';
        const glitch = params.glitchReality || 0;
        const warp = params.spacetimeWarp || 1;
        const layers = Math.floor(params.dimensionalLayers || 3);

        // Beat tear — only on bass beats for rhythmic sync
        if ((params.beatTear || 0) > 0 && audio.bassBeat) {
            this.tearPhase = Math.min(5, this.tearPhase + audio.bassBeatIntensity * (params.beatTear || 2) * 0.7);
        }
        // Drop collapse — beat-synced
        if (params.dropCollapse && audio.isDrop && audio.bassBeat) {
            this.collapsePhase = Math.min(5, this.collapsePhase + 2);
            this.tearPhase = Math.min(5, this.tearPhase + 2);
        }
        this.tearPhase *= 0.93;
        this.collapsePhase *= 0.92;

        const gravity = (params.bassGravity || 1) * bass * reactivity;
        const flicker = (params.trebleFlicker || 1) * treble * reactivity;
        const d4 = params.dimension4 || 1;
        const wAngle = (params.projectionAngle || 0) + this.time * (params.rotateW || 0.5);

        // Beat phase for rhythmic animation
        const beatPulse = Math.sin((audio.beatPhase || 0) * Math.PI * 2) * 0.5 + 0.5;

        // ======= REBUILD IF NEEDED =======
        const geoType = params.geometryType || 'tesseract';
        if (geoType !== this.currentPolytopeType || layers !== this.currentLayers) {
            this.currentPolytope = this.getPolytope(geoType);
            this.currentPolytopeType = geoType;
            this.currentLayers = layers;
            this.build4DGeometry(this.currentPolytope, layers);
        }
        const portalCount = Math.floor(params.portalCount || 2);
        if (portalCount !== this.currentPortalCount) {
            this.currentPortalCount = portalCount;
            this.buildPortals(portalCount);
        }
        const fCount = Math.floor(params.fieldParticleCount || 5000);
        if (!this.fieldParticles || fCount !== this.fieldCount) {
            this.buildFieldParticles(fCount);
        }

        const polytope = this.currentPolytope;

        // ======= UPDATE 4D GEOMETRY (in-place) =======
        let lineIdx = 0;
        let sphereIdx = 0;
        for (let layer = 0; layer < layers; layer++) {
            const layerOffset = layer * 0.15;
            const layerAngle = wAngle + layer * Math.PI / (layers * 2);
            const layerScale = scale * (1 - layer * 0.1) * (1 + gravity * 0.3);

            const projectedVerts = polytope.vertices.map((v, vi) => {
                const distorted = [...v];
                const freqIdx = Math.floor((vi / polytope.vertices.length) * audio.frequencyData.length * 0.5);
                const freq = (audio.frequencyData[freqIdx] || 0) / 255;

                // Rhythmic distortion using beatPhase
                distorted[0] += Math.sin(this.time * 2 + vi) * freq * intensity * 0.2 * (0.5 + beatPulse * 0.5);
                distorted[1] += Math.cos(this.time * 1.7 + vi * 2) * freq * intensity * 0.2 * (0.5 + beatPulse * 0.5);
                distorted[2] += Math.sin(this.time * 1.3 + vi * 3) * mid * intensity * 0.15;
                distorted[3] += Math.cos(this.time + vi * 0.5) * bass * intensity * 0.3 * beatPulse;

                if (this.tearPhase > 0.1) {
                    distorted[3] += Math.sin(this.time * 5 + vi * 7) * this.tearPhase * 0.2;
                }
                if (this.collapsePhase > 0.1) {
                    const collapseFactor = 1 - this.collapsePhase * 0.08;
                    distorted[0] *= collapseFactor;
                    distorted[1] *= collapseFactor;
                    distorted[2] *= collapseFactor;
                }
                if (glitch > 0 && Math.random() < glitch * 0.01) {
                    distorted[Math.floor(Math.random() * 4)] += (Math.random() - 0.5) * glitch;
                }

                const p3d = this.project4D(distorted, layerAngle, d4);
                return p3d.multiplyScalar(layerScale);
            });

            // Update edge lines in-place
            for (const edge of polytope.edges) {
                if (lineIdx >= this.riftLines.length) break;
                const line = this.riftLines[lineIdx++];
                const p1 = projectedVerts[edge[0]];
                const p2 = projectedVerts[edge[1]];
                if (!p1 || !p2) continue;

                const pos = line.geometry.attributes.position.array;
                pos[0] = p1.x; pos[1] = p1.y; pos[2] = p1.z;
                pos[3] = p2.x; pos[4] = p2.y; pos[5] = p2.z;
                line.geometry.attributes.position.needsUpdate = true;

                const edgeT = edge[0] / polytope.vertices.length;
                const color = this.getSpectrumColor(spectrum, edgeT + layerOffset + this.time * 0.02);
                line.material.color.copy(color);
                line.material.opacity = (0.4 + flicker * 0.2 + beatPulse * 0.1) / layers * (1 + this.tearPhase * 0.05);
            }

            // Update vertex spheres in-place
            for (let vi = 0; vi < projectedVerts.length; vi++) {
                if (sphereIdx >= this.riftSpheres.length) break;
                const sphere = this.riftSpheres[sphereIdx++];
                sphere.position.copy(projectedVerts[vi]);
                sphere.scale.setScalar(0.3 + bass * 0.3 + beatPulse * 0.2);
                const color = this.getSpectrumColor(spectrum, vi / projectedVerts.length + layerOffset);
                sphere.material.color.copy(color);
                sphere.material.opacity = (0.5 + rms * 0.3) / layers;
            }
        }

        // ======= UPDATE PORTALS (in-place) =======
        const portalRadius = (params.portalRadius || 15) * (1 + bass * 0.2 * beatPulse);
        const portalDist = params.portalDistortion || 2;
        const edgeGlow = params.portalEdgeGlow || 1.5;
        const portalPositions = [];
        const ringSegments = 64;
        const edgePCount = 200;

        for (let p = 0; p < portalCount; p++) {
            const pAngle = (p / portalCount) * Math.PI * 2 + this.time * 0.2;
            const pDist = scale * 0.6;
            const px = Math.cos(pAngle) * pDist;
            const py = Math.sin(pAngle * 0.7) * pDist * 0.3;
            const pz = Math.sin(pAngle) * pDist * 0.5;
            portalPositions.push(new THREE.Vector3(px, py, pz));

            // Update ring line positions
            if (p < this.portalRings.length) {
                const ring = this.portalRings[p];
                const pos = ring.geometry.attributes.position.array;
                for (let i = 0; i < ringSegments; i++) {
                    const a = (i / ringSegments) * Math.PI * 2;
                    const r = portalRadius * (1 + Math.sin(a * 3 + this.time * 3) * portalDist * 0.03 * bass * beatPulse);
                    const freqIdx = Math.floor((i / ringSegments) * audio.frequencyData.length * 0.3);
                    const freq = (audio.frequencyData[freqIdx] || 0) / 255;
                    pos[i * 3] = px + Math.cos(a) * r * (1 + freq * portalDist * 0.06);
                    pos[i * 3 + 1] = py + Math.sin(a) * r * (1 + freq * portalDist * 0.06);
                    pos[i * 3 + 2] = pz + Math.sin(a * 2 + this.time * 2) * portalDist * 0.3;
                }
                // Close the loop
                if (ringSegments < pos.length / 3) {
                    pos[ringSegments * 3] = pos[0];
                    pos[ringSegments * 3 + 1] = pos[1];
                    pos[ringSegments * 3 + 2] = pos[2];
                }
                ring.geometry.attributes.position.needsUpdate = true;
                const ringColor = this.getSpectrumColor(spectrum, p / portalCount + this.time * 0.05);
                ring.material.color.copy(ringColor);
                ring.material.opacity = 0.5 + rms * 0.2 + edgeGlow * 0.08 + beatPulse * 0.1;
            }

            // Update inner glow
            if (p < this.portalInners.length) {
                const inner = this.portalInners[p];
                inner.position.set(px, py, pz);
                inner.scale.set(portalRadius * 0.8, portalRadius * 0.8, portalRadius * 0.08);
                inner.material.color.copy(this.getSpectrumColor(spectrum, 0.5 + p * 0.2));
                inner.material.opacity = 0.03 + bass * 0.08 * edgeGlow * beatPulse;
            }

            // Update edge particles
            if (p < this.portalEdgePts.length) {
                const pts = this.portalEdgePts[p];
                const ePos = pts.geometry.attributes.position.array;
                const eCols = pts.geometry.attributes.color.array;
                for (let i = 0; i < edgePCount; i++) {
                    const a = (i / edgePCount) * Math.PI * 2 + this.time * 0.5;
                    const r = portalRadius * (0.9 + Math.sin(this.time * 2 + i) * 0.1);
                    ePos[i * 3] = px + Math.cos(a) * r;
                    ePos[i * 3 + 1] = py + Math.sin(a) * r;
                    ePos[i * 3 + 2] = pz + Math.sin(this.time + i * 0.3) * 1.5;
                    const ec = this.getSpectrumColor(spectrum, i / edgePCount + this.time * 0.1);
                    eCols[i * 3] = ec.r; eCols[i * 3 + 1] = ec.g; eCols[i * 3 + 2] = ec.b;
                }
                pts.geometry.attributes.position.needsUpdate = true;
                pts.geometry.attributes.color.needsUpdate = true;
                pts.material.size = 0.4 + edgeGlow * 0.2 + beatPulse * 0.2;
                pts.material.opacity = 0.3 + rms * 0.2 + beatPulse * 0.1;
            }
        }

        // Update beam lines
        if (params.interPortalBeams && portalPositions.length > 1) {
            let beamIdx = 0;
            for (let i = 0; i < portalPositions.length; i++) {
                for (let j = i + 1; j < portalPositions.length; j++) {
                    if (beamIdx >= this.beamLines.length) break;
                    const beam = this.beamLines[beamIdx++];
                    beam.visible = true;
                    const bPos = beam.geometry.attributes.position.array;
                    const p1 = portalPositions[i], p2 = portalPositions[j];
                    for (let t = 0; t <= 30; t++) {
                        const f = t / 30;
                        const mx = p1.x + (p2.x - p1.x) * f + Math.sin(f * 10 + this.time * 3) * this.tearPhase * 0.8;
                        const my = p1.y + (p2.y - p1.y) * f + Math.sin(f * Math.PI) * 10 * (1 + bass * warp * beatPulse);
                        const mz = p1.z + (p2.z - p1.z) * f + Math.cos(f * 8 + this.time * 2) * treble * 2;
                        bPos[t * 3] = mx; bPos[t * 3 + 1] = my; bPos[t * 3 + 2] = mz;
                    }
                    beam.geometry.attributes.position.needsUpdate = true;
                    beam.material.color.copy(this.getSpectrumColor(spectrum, (i + j) * 0.2 + this.time * 0.03));
                    beam.material.opacity = 0.2 + rms * 0.2 + this.tearPhase * 0.05 + beatPulse * 0.1;
                }
            }
        } else {
            this.beamLines.forEach(b => b.visible = false);
        }

        // ======= UPDATE FIELD PARTICLES (in-place) =======
        if (this.fieldParticles) {
            const foam = params.quantumFoam || 1;
            const fpPos = this.fieldPositions;
            const fpCols = this.fieldColors;

            for (let i = 0; i < this.fieldCount; i++) {
                const t = i / this.fieldCount;
                const freqIdx = Math.floor(t * audio.frequencyData.length * 0.5);
                const freq = (audio.frequencyData[freqIdx] || 0) / 255;

                // Animate positions with drift + foam instead of resetting every frame
                let x = fpPos[i * 3], y = fpPos[i * 3 + 1], z = fpPos[i * 3 + 2];
                const dist = Math.sqrt(x * x + y * y + z * z) || 1;

                // Gentle orbit
                const angle = Math.atan2(z, x) + dt * 0.3 * (1 + bass * 0.5);
                const newR = dist + Math.sin(this.time * foam + i * 0.01) * foam * 0.3 * freq;
                const phi = Math.acos(Math.max(-1, Math.min(1, y / dist)));
                x = newR * Math.sin(phi) * Math.cos(angle);
                z = newR * Math.sin(phi) * Math.sin(angle);
                y += Math.sin(this.time * 0.5 + i * 0.02) * dt * mid * 2;

                // Warp toward nearest portal
                if (warp > 0 && portalPositions.length > 0) {
                    let minD = Infinity, nearP = null;
                    for (const pp of portalPositions) {
                        const d = Math.sqrt((x - pp.x) ** 2 + (y - pp.y) ** 2 + (z - pp.z) ** 2);
                        if (d < minD) { minD = d; nearP = pp; }
                    }
                    if (nearP && minD < scale) {
                        const pull = warp * 0.02 * (1 - minD / scale) * (1 + bass * gravity * beatPulse);
                        x += (nearP.x - x) * pull;
                        y += (nearP.y - y) * pull;
                        z += (nearP.z - z) * pull;
                    }
                }

                // Collapse effect
                if (this.collapsePhase > 0.1) {
                    const cFactor = this.collapsePhase * 0.05;
                    x *= (1 - cFactor); y *= (1 - cFactor); z *= (1 - cFactor);
                }

                // Bounds check
                if (dist > scale * 2 || !isFinite(x)) {
                    const a = Math.random() * Math.PI * 2;
                    const p = Math.acos(2 * Math.random() - 1);
                    const r = (Math.random() ** 0.3) * scale * 1.5;
                    x = r * Math.sin(p) * Math.cos(a);
                    y = r * Math.sin(p) * Math.sin(a);
                    z = r * Math.cos(p);
                }

                fpPos[i * 3] = x; fpPos[i * 3 + 1] = y; fpPos[i * 3 + 2] = z;

                const c = this.getSpectrumColor(spectrum, t + freq * 0.3 + this.time * 0.02);
                const brightness = 0.3 + freq * 0.5 + flicker * 0.15 + beatPulse * 0.1;
                fpCols[i * 3] = c.r * brightness;
                fpCols[i * 3 + 1] = c.g * brightness;
                fpCols[i * 3 + 2] = c.b * brightness;
            }

            this.fieldParticles.geometry.attributes.position.needsUpdate = true;
            this.fieldParticles.geometry.attributes.color.needsUpdate = true;
            this.fieldParticles.material.size = 0.4 + (foam * 0.2) + beatPulse * 0.15;
            this.fieldParticles.material.opacity = 0.25 + rms * 0.2 + beatPulse * 0.05;
        }

        // Event horizon disk
        if (params.riftType === 'singularity' || params.riftType === 'eventHorizon') {
            if (!this.horizonMesh) {
                const diskGeo = new THREE.RingGeometry(scale * 0.2, scale * 0.7, 64);
                const diskMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 0.15,
                    side: THREE.DoubleSide, blending: THREE.AdditiveBlending
                });
                this.horizonMesh = new THREE.Mesh(diskGeo, diskMat);
                this.group.add(this.horizonMesh);
            }
            this.horizonMesh.visible = true;
            this.horizonMesh.material.color.copy(this.getSpectrumColor(spectrum, bass + this.time * 0.05));
            this.horizonMesh.material.opacity = 0.1 + rms * 0.15 + beatPulse * 0.05;
            this.horizonMesh.rotation.x = Math.PI / 2 + Math.sin(this.time * 0.3) * 0.15;
        } else if (this.horizonMesh) {
            this.horizonMesh.visible = false;
        }

        // Group rotation — controlled, beat-synced
        this.group.rotation.y += 0.003 * (1 + rms * 0.5);
        this.group.rotation.x = Math.sin(this.time * 0.1) * 0.08;

        // Beat kick — controlled
        if (audio.bassBeat) {
            this.group.rotation.z += Math.min(0.02, audio.bassBeatIntensity * 0.015);
        }
    },

    destroy(scene) {
        if (this.group) {
            this.group.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            scene.remove(this.group);
        }
        this.riftLines = [];
        this.riftSpheres = [];
        this.portalRings = [];
        this.portalInners = [];
        this.portalEdgePts = [];
        this.beamLines = [];
        this.fieldParticles = null;
        this.horizonMesh = null;
    }
};
