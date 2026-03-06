// ============================================================
// AURA Mode — LASER SHOW
// Sweeping laser beams, mirror reflections, smoke haze,
// beat burst rings, fan arrays, drop-section chaos
// ============================================================

const LaserShowMode = {
    name: 'Laser Show',
    group: null,
    time: 0,

    // Working arrays
    beams: [],          // { line, mat, offset, baseAngle, band }
    reflectionBeams: [], // { line, mat }
    burstRings: [],     // { mesh, mat, age, maxAge }
    hazeGeo: null,
    hazeMat: null,
    hazePoints: null,
    hazePositions: null,
    hazeColors: null,
    coreMesh: null,
    coreGlow: null,

    // Drop state
    dropPhase: 0,

    params: {
        laserMode: { type: 'select', options: ['fan', 'radial', 'cross', 'spider'], default: 'radial', label: '✨ Layout' },
        beamCount: { type: 'range', min: 2, max: 24, default: 8, step: 1, label: '🔆 Beams' },
        beamLength: { type: 'range', min: 10, max: 90, default: 50, step: 2, label: 'Length' },
        beamWidth: { type: 'range', min: 0.5, max: 4, default: 1.5, step: 0.5, label: 'Width' },
        sweepSpeed: { type: 'range', min: 0, max: 5, default: 1.2, step: 0.1, label: '🔄 Sweep Speed' },
        sweepAngle: { type: 'range', min: 0, max: 180, default: 60, step: 5, label: 'Sweep Arc°' },
        fanCount: { type: 'range', min: 1, max: 6, default: 2, step: 1, label: '🌀 Fans' },
        colorMode: { type: 'select', options: ['cycle', 'band', 'solid', 'chaos'], default: 'cycle', label: '🎨 Color Mode' },
        solidHue: { type: 'range', min: 0, max: 1, default: 0.55, step: 0.01, label: 'Hue' },
        hazeParticles: { type: 'range', min: 0, max: 3000, default: 800, step: 100, label: '💨 Haze' },
        reflections: { type: 'toggle', default: true, label: '🪞 Reflections' },
        beatBurst: { type: 'range', min: 0, max: 5, default: 2, step: 0.1, label: '🔊 Beat Burst' },
        dropIntensity: { type: 'range', min: 0, max: 5, default: 2.5, step: 0.1, label: '🔥 Drop Power' },
        convergence: { type: 'toggle', default: false, label: '🎯 Converge on Beat' },
        coreEnabled: { type: 'toggle', default: true, label: '💡 Core Light' },
        originSpread: { type: 'range', min: 0, max: 20, default: 0, step: 1, label: '📡 Origin Spread' },
    },

    // ── INIT ───────────────────────────────────────────────
    init(scene, camera) {
        this.group = new THREE.Group();
        scene.add(this.group);
        camera.position.set(0, 0, 80);
        camera.lookAt(0, 0, 0);

        this.time = 0;
        this.dropPhase = 0;
        this.beams = [];
        this.reflectionBeams = [];
        this.burstRings = [];

        this._buildBeams(8, 'radial');
        this._buildHaze(800);
        this._buildCore();
    },

    // ── BEAM BUILDER ───────────────────────────────────────
    _buildBeams(count, mode) {
        // Destroy old beams
        this.beams.forEach(b => {
            this.group.remove(b.line);
            b.line.geometry.dispose();
            b.line.material.dispose();
            // Also remove layered width lines
            if (b.extraLines) b.extraLines.forEach(el => {
                this.group.remove(el);
                el.geometry.dispose();
                el.material.dispose();
            });
        });
        this.reflectionBeams.forEach(b => {
            this.group.remove(b.line);
            b.line.geometry.dispose();
            b.line.material.dispose();
        });
        this.beams = [];
        this.reflectionBeams = [];

        const BANDS = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];

        for (let i = 0; i < count; i++) {
            const t = i / count;

            // Compute base angle from layout mode
            let baseAngle = 0;
            if (mode === 'radial') {
                baseAngle = t * Math.PI * 2;
            } else if (mode === 'fan') {
                baseAngle = (t - 0.5) * Math.PI; // spread across top half
            } else if (mode === 'cross') {
                // 4 axes × ceil(count/4), evenly distributed within each axis
                const axis = i % 4;
                const sub = Math.floor(i / 4);
                const subCount = Math.ceil(count / 4);
                const spread = (subCount > 1) ? ((sub / (subCount - 1)) - 0.5) * 0.5 : 0;
                baseAngle = (axis / 4) * Math.PI * 2 + spread;
            } else if (mode === 'spider') {
                // Same as radial but we'll sweep toward center on beat
                baseAngle = t * Math.PI * 2;
            }

            // Main beam line (2-point line)
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            const line = new THREE.Line(geo, mat);
            line.frustumCulled = false;
            this.group.add(line);

            // "Width" fake: two extra thinner lines with slight angular offset
            const extraLines = [];
            for (let w = 0; w < 2; w++) {
                const wGeo = new THREE.BufferGeometry();
                wGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
                const wMat = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.3,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                });
                const wLine = new THREE.Line(wGeo, wMat);
                wLine.frustumCulled = false;
                this.group.add(wLine);
                extraLines.push(wLine);
            }

            this.beams.push({
                line,
                mat,
                extraLines,
                baseAngle,
                band: BANDS[i % BANDS.length],
                sweepOffset: Math.random() * Math.PI * 2, // random sweep phase
                originOffset: new THREE.Vector3(0, 0, 0),
            });

            // Reflection beams (2 mirrors: flipped X, flipped Y)
            for (let r = 0; r < 2; r++) {
                const rGeo = new THREE.BufferGeometry();
                rGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
                const rMat = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.18,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                });
                const rLine = new THREE.Line(rGeo, rMat);
                rLine.frustumCulled = false;
                this.group.add(rLine);
                this.reflectionBeams.push({ line: rLine, mat: rMat, beamIdx: i, mirrorAxis: r }); // r=0 → flip X, r=1 → flip Y
            }
        }
    },

    // ── HAZE BUILDER ───────────────────────────────────────
    _buildHaze(count) {
        if (this.hazePoints) {
            this.group.remove(this.hazePoints);
            this.hazeGeo.dispose();
            this.hazeMat.dispose();
        }
        if (count === 0) { this.hazePoints = null; return; }

        this.hazeGeo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3); // stored in userData for update

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 120;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 80;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
            col[i * 3] = 0.15;
            col[i * 3 + 1] = 0.15;
            col[i * 3 + 2] = 0.15;
            vel[i * 3] = (Math.random() - 0.5) * 0.02;
            vel[i * 3 + 1] = Math.random() * 0.04 + 0.01;
            vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
        }
        this.hazeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        this.hazeGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        this.hazeGeo.userData = { vel };
        this.hazeMat = new THREE.PointsMaterial({
            size: 1.2, vertexColors: true, transparent: true, opacity: 0.18,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.hazePoints = new THREE.Points(this.hazeGeo, this.hazeMat);
        this.hazePoints.frustumCulled = false;
        this.group.add(this.hazePoints);
        this.hazePositions = pos;
        this.hazeColors = col;
        this._hazeVel = vel;
        this._hazeCount = count;
    },

    // ── CORE LIGHT BUILDER ─────────────────────────────────
    _buildCore() {
        if (this.coreMesh) {
            this.group.remove(this.coreMesh);
            this.coreMesh.geometry.dispose();
            this.coreMesh.material.dispose();
            this.group.remove(this.coreGlow);
            this.coreGlow.geometry.dispose();
            this.coreGlow.material.dispose();
        }
        const cGeo = new THREE.SphereGeometry(1.2, 12, 12);
        const cMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
        this.coreMesh = new THREE.Mesh(cGeo, cMat);
        this.group.add(this.coreMesh);

        const gGeo = new THREE.SphereGeometry(4, 12, 12);
        const gMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending });
        this.coreGlow = new THREE.Mesh(gGeo, gMat);
        this.group.add(this.coreGlow);
    },

    // ── UPDATE ─────────────────────────────────────────────
    update(audio, params, dt) {
        if (!this.group) return;
        this.time += dt;

        const bass = audio.smoothBands?.bass || 0;
        const mid = audio.smoothBands?.mid || 0;
        const treble = audio.smoothBands?.treble || 0;
        const rms = audio.rms || 0;

        const laserMode = params.laserMode || 'radial';
        const beamCount = Math.floor(params.beamCount || 8);
        const beamLength = params.beamLength || 50;
        const sweepSpeed = params.sweepSpeed || 1.2;
        const sweepAngle = ((params.sweepAngle || 60) * Math.PI) / 180;
        const fanCount = Math.floor(params.fanCount || 2);
        const colorMode = params.colorMode || 'cycle';
        const solidHue = params.solidHue || 0.55;
        const hazeCount = Math.floor(params.hazeParticles || 800);
        const reflections = params.reflections !== false;
        const beatBurst = params.beatBurst || 2;
        const dropPow = params.dropIntensity || 2.5;
        const convergence = !!params.convergence;
        const coreEnabled = params.coreEnabled !== false;
        const originSpread = params.originSpread || 0;
        const beamWidth = params.beamWidth || 1.5;

        // Drop phase
        if (audio.isDropSection) {
            this.dropPhase = Math.min(1, this.dropPhase + dt * 4);
        } else {
            this.dropPhase = Math.max(0, this.dropPhase - dt * 2);
        }
        const dp = this.dropPhase;

        // ── Rebuild beams if count or layout changed
        if (this.beams.length !== beamCount || this._lastLayout !== laserMode) {
            this._buildBeams(beamCount, laserMode);
            this._lastLayout = laserMode;
        }
        // ── Rebuild haze if count changed
        if (this._lastHazeCount !== hazeCount) {
            this._buildHaze(hazeCount);
            this._lastHazeCount = hazeCount;
        }

        // ── DROP: emit burst rings on beat
        if (audio.beat && beatBurst > 0) {
            const intensity = audio.beatIntensity * beatBurst * (1 + dp * dropPow);
            this._emitBurstRing(intensity, audio);
        }
        if (dp > 0.3 && audio.beat) {
            // Extra rings in drop
            this._emitBurstRing(dp * dropPow * audio.beatIntensity, audio);
        }

        // ── Update burst rings
        this._updateBurstRings(dt, dp);

        // ── Compute beam hue helper
        const BANDS = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
        const _color = new THREE.Color();

        const getBeamHue = (i, t) => {
            if (colorMode === 'solid') return solidHue;
            if (colorMode === 'chaos') return (this.time * 0.3 + i * 0.13 + Math.sin(this.time * 2 + i) * 0.3) % 1;
            if (colorMode === 'band') return (i / beamCount + this.time * 0.02) % 1;
            /* cycle */                return (i / beamCount + this.time * 0.08) % 1;
        };

        // ── Update each beam
        this.beams.forEach((beam, i) => {
            const bandVal = audio.smoothBands?.[beam.band] || 0;
            const hue = getBeamHue(i, this.time);
            _color.setHSL(hue, 1.0, 0.55 + rms * 0.3 + dp * 0.15);

            // Compute sweep angle for this beam
            let sweepT = Math.sin(this.time * sweepSpeed * (1 + dp * dropPow * 0.5) + beam.sweepOffset);

            // Fan grouping: each fan sweeps independently
            const fanIdx = i % fanCount;
            const fanPhase = (fanIdx / fanCount) * Math.PI * 2;
            sweepT = Math.sin(this.time * sweepSpeed * (1 + fanIdx * 0.3) + beam.sweepOffset + fanPhase);

            const currentAngle = beam.baseAngle + sweepT * (sweepAngle * 0.5);

            // Convergence: on beat, beams pulse toward center
            let lengthMult = 1 + bandVal * 1.5 + dp * dropPow * 0.4;
            let originPull = 0;
            if (convergence && audio.beat) {
                originPull = audio.beatIntensity * 0.5;
                lengthMult *= (1 - originPull * 0.5);
            }

            const len = beamLength * lengthMult;

            // Origin spread: emitters distributed on a small circle
            let ox = 0, oy = 0;
            if (originSpread > 0) {
                const oa = (i / beamCount) * Math.PI * 2 + this.time * 0.1;
                ox = Math.cos(oa) * originSpread;
                oy = Math.sin(oa) * originSpread;
            }

            // Beam endpoints
            const x0 = ox, y0 = oy, z0 = 0;
            const x1 = ox + Math.cos(currentAngle) * len;
            const y1 = oy + Math.sin(currentAngle) * len;
            const z1 = Math.sin(this.time * 0.5 + i) * 5 * dp;

            const posArr = beam.line.geometry.attributes.position.array;
            posArr[0] = x0; posArr[1] = y0; posArr[2] = z0;
            posArr[3] = x1; posArr[4] = y1; posArr[5] = z1;
            beam.line.geometry.attributes.position.needsUpdate = true;

            beam.mat.color.copy(_color);
            beam.mat.opacity = 0.6 + bandVal * 0.4 + dp * 0.3;

            // Extra width lines (slight angular offset)
            const widthAngle = (beamWidth - 1) * 0.015;
            beam.extraLines.forEach((wl, wi) => {
                const wa = currentAngle + (wi === 0 ? widthAngle : -widthAngle);
                const wp = wl.geometry.attributes.position.array;
                wp[0] = x0; wp[1] = y0; wp[2] = z0;
                wp[3] = ox + Math.cos(wa) * len; wp[4] = oy + Math.sin(wa) * len; wp[5] = z1;
                wl.geometry.attributes.position.needsUpdate = true;
                wl.material.color.copy(_color);
                wl.material.opacity = 0.2 + bandVal * 0.2;
            });

            // ── Reflection beams
            const rBase = i * 2;
            if (rBase + 1 < this.reflectionBeams.length) {
                const rb0 = this.reflectionBeams[rBase];     // flip X
                const rb1 = this.reflectionBeams[rBase + 1]; // flip Y

                const reflVisible = reflections && (0.2 + bandVal * 0.3 + dp * 0.2) > 0;
                rb0.line.visible = reflVisible;
                rb1.line.visible = reflVisible;

                if (reflVisible) {
                    // flip X
                    const p0 = rb0.line.geometry.attributes.position.array;
                    p0[0] = -x0; p0[1] = y0; p0[2] = z0;
                    p0[3] = -x1; p0[4] = y1; p0[5] = z1;
                    rb0.line.geometry.attributes.position.needsUpdate = true;
                    rb0.mat.color.copy(_color);
                    rb0.mat.opacity = (0.12 + bandVal * 0.12 + dp * 0.1);

                    // flip Y
                    const p1 = rb1.line.geometry.attributes.position.array;
                    p1[0] = x0; p1[1] = -y0; p1[2] = z0;
                    p1[3] = x1; p1[4] = -y1; p1[5] = z1;
                    rb1.line.geometry.attributes.position.needsUpdate = true;
                    rb1.mat.color.copy(_color);
                    rb1.mat.opacity = (0.12 + bandVal * 0.12 + dp * 0.1);
                }
            }
        });

        // ── Update haze
        if (this.hazePoints && hazeCount > 0) {
            this.hazePoints.visible = true;
            const pos = this.hazePositions;
            const col = this.hazeColors;
            const vel = this._hazeVel;
            const cnt = this._hazeCount;
            const hazeHue = (this.time * 0.06 + rms * 0.3) % 1;
            _color.setHSL(hazeHue, 0.7, 0.12 + bass * 0.05 + dp * 0.08);

            for (let i = 0; i < cnt; i++) {
                pos[i * 3] += vel[i * 3];
                pos[i * 3 + 1] += vel[i * 3 + 1] * (1 + bass * 0.5);
                pos[i * 3 + 2] += vel[i * 3 + 2];

                // Wrap particles
                if (pos[i * 3 + 1] > 50) pos[i * 3 + 1] = -50;
                if (pos[i * 3] > 65) pos[i * 3] = -65;
                if (pos[i * 3] < -65) pos[i * 3] = 65;

                col[i * 3] = _color.r;
                col[i * 3 + 1] = _color.g;
                col[i * 3 + 2] = _color.b;
            }
            this.hazeGeo.attributes.position.needsUpdate = true;
            this.hazeGeo.attributes.color.needsUpdate = true;
            this.hazeMat.opacity = 0.12 + dp * 0.12;
        } else if (this.hazePoints) {
            this.hazePoints.visible = false;
        }

        // ── Core light
        if (this.coreMesh) {
            this.coreMesh.visible = coreEnabled;
            this.coreGlow.visible = coreEnabled;
            if (coreEnabled) {
                const coreScale = 1 + bass * 2 + dp * dropPow;
                this.coreMesh.scale.setScalar(coreScale);
                this.coreGlow.scale.setScalar(coreScale * 2.5 + rms * 2);
                const cHue = (this.time * 0.15) % 1;
                _color.setHSL(cHue, 1, 0.7 + rms * 0.2);
                this.coreMesh.material.color.copy(_color);
                this.coreMesh.material.opacity = 0.8 + bass * 0.2;
                this.coreGlow.material.color.copy(_color);
                this.coreGlow.material.opacity = 0.04 + bass * 0.06 + dp * 0.1;
            }
        }
    },

    // ── BURST RING EMITTER ─────────────────────────────────
    _emitBurstRing(intensity, audio) {
        // max 12 live rings
        if (this.burstRings.length >= 12) return;
        const segments = 48;
        const geo = new THREE.BufferGeometry();
        const pts = new Float32Array((segments + 1) * 3);
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            pts[i * 3] = Math.cos(a);
            pts[i * 3 + 1] = Math.sin(a);
            pts[i * 3 + 2] = 0;
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const hue = (this.time * 0.15 + Math.random() * 0.3) % 1;
        const mat = new THREE.LineBasicMaterial({
            color: new THREE.Color().setHSL(hue, 1, 0.7),
            transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const ring = new THREE.LineLoop(geo, mat);
        ring.scale.setScalar(0.5);
        ring.frustumCulled = false;
        this.group.add(ring);
        this.burstRings.push({ mesh: ring, mat, age: 0, maxAge: 0.5 + intensity * 0.15, speed: 15 + intensity * 12, hue });
    },

    _updateBurstRings(dt, dp) {
        for (let i = this.burstRings.length - 1; i >= 0; i--) {
            const r = this.burstRings[i];
            r.age += dt;
            const progress = r.age / r.maxAge;
            r.mesh.scale.setScalar(r.speed * r.age + 0.5);
            r.mat.opacity = (1 - progress) * (0.8 + dp * 0.2);
            if (r.age >= r.maxAge) {
                this.group.remove(r.mesh);
                r.mesh.geometry.dispose();
                r.mat.dispose();
                this.burstRings.splice(i, 1);
            }
        }
    },

    // ── DESTROY ────────────────────────────────────────────
    destroy(scene) {
        if (this.group) scene.remove(this.group);
        this.group = null;
        this.beams = [];
        this.reflectionBeams = [];
        this.burstRings = [];
        this.hazePoints = null;
        this.hazeGeo = null;
        this.hazeMat = null;
        this.hazePositions = null;
        this.hazeColors = null;
        this._hazeVel = null;
        this.coreMesh = null;
        this.coreGlow = null;
    }
};
