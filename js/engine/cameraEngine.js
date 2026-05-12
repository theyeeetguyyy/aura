// ============================================================
// AURA — Camera Physics Engine (Phase 2)
// Stackable, physically-weighted motion layers.
// ============================================================

const CameraEngine = (() => {
    // ── SPRING PHYSICS SYSTEM ──
    class SpringAxis {
        constructor(mass, stiffness, damping) {
            this.value = 0;
            this.target = 0;
            this.velocity = 0;
            this.mass = mass || 1.0;
            this.stiffness = stiffness || 100;
            this.damping = damping || 10;
        }

        applyForce(f) {
            this.velocity += f / this.mass;
        }

        update(dt) {
            const springForce = -this.stiffness * (this.value - this.target);
            const dampingForce = -this.damping * this.velocity;
            const acceleration = (springForce + dampingForce) / this.mass;
            this.velocity += acceleration * dt;
            this.value += this.velocity * dt;
        }

        set(val) {
            this.value = val;
            this.target = val;
            this.velocity = 0;
        }
    }

    // ── BASE CAMERA LAYER ──
    class CameraLayer {
        constructor(name) {
            this.name = name;
            this.active = true;
            this.weight = 1.0;
            // Outputs to be summed
            this.pos = new THREE.Vector3();
            this.rot = new THREE.Euler();
            this.fovOffset = 0;
        }
        update(dt) {}
        getOffset() { return { pos: this.pos, rot: this.rot, fov: this.fovOffset }; }
    }

    // ── LAYER: ORBIT ──
    class OrbitLayer extends CameraLayer {
        constructor() {
            super('orbit');
            this.radius = new SpringAxis(1.0, 50, 8);
            this.theta = 0; // Continuous rotation
            this.phi = new SpringAxis(1.0, 40, 8);
            
            this.radius.set(100);
            this.phi.set(Math.PI / 2);
            
            // Director parameters
            this.rotationSpeed = 0.5;
            this.swayAmp = 0.1;
        }
        
        update(dt) {
            this.theta += this.rotationSpeed * dt;
            
            // Add sway to phi target (continuous smooth drift)
            // Use time rather than fixed delta to keep it consistent
            this.phi.target = Math.PI / 2 + Math.sin(performance.now() * 0.0005) * this.swayAmp;
            
            this.radius.update(dt);
            this.phi.update(dt);
            
            // Convert spherical to cartesian
            this.pos.x = this.radius.value * Math.sin(this.phi.value) * Math.sin(this.theta);
            this.pos.y = this.radius.value * Math.cos(this.phi.value);
            this.pos.z = this.radius.value * Math.sin(this.phi.value) * Math.cos(this.theta);
        }
    }

    // ── LAYER: IMPACT (RECOIL) ──
    class ImpactLayer extends CameraLayer {
        constructor() {
            super('impact');
            this.zPush = new SpringAxis(1.0, 150, 10);
            this.pitch = new SpringAxis(1.0, 200, 15);
        }
        
        impulse(zForce, pitchForce) {
            this.zPush.applyForce(zForce);
            this.pitch.applyForce(pitchForce);
        }
        
        update(dt) {
            this.zPush.update(dt);
            this.pitch.update(dt);
            
            this.pos.z = this.zPush.value;
            this.rot.x = this.pitch.value;
        }
    }

    // ── LAYER: SHAKE ──
    class ShakeLayer extends CameraLayer {
        constructor() {
            super('shake');
            this.intensity = 0;
            this.time = 0;
        }
        
        update(dt) {
            this.time += dt * 25;
            this.intensity *= Math.pow(0.85, dt * 60); // decay
            
            if (this.intensity > 0.01) {
                this.pos.x = (Math.sin(this.time) * 0.6 + Math.sin(this.time * 2.3) * 0.4) * this.intensity;
                this.pos.y = (Math.sin(this.time * 1.7) * 0.6 + Math.sin(this.time * 3.1) * 0.4) * this.intensity;
                this.pos.z = Math.sin(this.time * 0.9) * this.intensity * 0.2;
                this.rot.z = Math.sin(this.time * 1.4) * this.intensity * 0.02;
            } else {
                this.pos.set(0,0,0);
                this.rot.set(0,0,0);
            }
        }
    }

    // ── LAYER: PUSH (Z-MOMENTUM) ──
    class PushLayer extends CameraLayer {
        constructor() {
            super('push');
            this.zVelocity = 0;
            this.zOffset = 0;
            this.fovCompress = new SpringAxis(1.0, 60, 10);
        }
        
        update(dt) {
            // Decays velocity over time
            this.zVelocity *= Math.pow(0.95, dt * 60);
            this.zOffset += this.zVelocity * dt;
            
            // Slowly return to 0 if no velocity
            if (Math.abs(this.zVelocity) < 0.1) {
                this.zOffset += (0 - this.zOffset) * (dt * 2.0);
            }
            
            this.fovCompress.update(dt);
            
            this.pos.z = this.zOffset;
            this.fovOffset = this.fovCompress.value;
        }
    }

    // ── LAYER: DRIFT ──
    class DriftLayer extends CameraLayer {
        constructor() {
            super('drift');
            this.time = 0;
            this.amp = 1.0;
        }
        update(dt) {
            this.time += dt * 0.5;
            this.pos.x = Math.sin(this.time * 0.7) * 3 * this.amp;
            this.pos.y = Math.cos(this.time * 1.1) * 2 * this.amp;
            this.rot.z = Math.sin(this.time * 0.4) * 0.05 * this.amp;
        }
    }

    // ── REGISTRY ──
    const layers = {
        orbit: new OrbitLayer(),
        impact: new ImpactLayer(),
        shake: new ShakeLayer(),
        push: new PushLayer(),
        drift: new DriftLayer()
    };
    
    let baseCamera = null;
    let baseFOV = 75;

    function init(cameraRef) {
        baseCamera = cameraRef;
        if (cameraRef) baseFOV = cameraRef.fov || 75;
    }

    function update(dt) {
        if (!baseCamera) return;

        let finalPos = new THREE.Vector3();
        let finalRot = new THREE.Euler();
        let finalFOVOffset = 0;

        // Base frame is defined by Orbit
        layers.orbit.update(dt);
        const orbitOut = layers.orbit.getOffset();
        finalPos.copy(orbitOut.pos);
        
        // Sum the local offsets
        const offsetLayers = [layers.impact, layers.shake, layers.push, layers.drift];
        let localOffset = new THREE.Vector3();
        
        for (const layer of offsetLayers) {
            if (!layer.active) continue;
            layer.update(dt);
            const out = layer.getOffset();
            localOffset.add(out.pos);
            
            finalRot.x += out.rot.x;
            finalRot.y += out.rot.y;
            finalRot.z += out.rot.z;
            
            finalFOVOffset += out.fov;
        }

        // Apply absolute position and framing
        baseCamera.position.copy(finalPos);
        baseCamera.lookAt(0, 0, 0);
        
        // Apply local offsets (shake/impact) relative to the new lookAt rotation
        baseCamera.translateX(localOffset.x);
        baseCamera.translateY(localOffset.y);
        baseCamera.translateZ(localOffset.z);
        
        // Apply angular offsets (roll, pitch recoil)
        baseCamera.rotateX(finalRot.x);
        baseCamera.rotateY(finalRot.y);
        baseCamera.rotateZ(finalRot.z);

        // FOV
        baseCamera.fov = Math.max(10, Math.min(160, baseFOV + finalFOVOffset));
        baseCamera.updateProjectionMatrix();
    }

    // ── PUBLIC API ──
    return {
        init,
        update,
        layers,
        // Helper to instantly reset camera
        reset: () => {
            layers.orbit.radius.set(100);
            layers.orbit.phi.set(Math.PI / 2);
            layers.orbit.theta = 0;
        }
    };
})();
