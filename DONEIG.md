# AURA — MASTER IMPROVEMENT PLAN
### Complete Audit, Bug Report, Architecture Redesign & Feature Roadmap
**For: Instagram Reels Virality via Tearout / Dubstep / Riddim / Neurohop Visuals**
**Artists reference: Svdden Death · Excision · Nimda · YVM3 · Gvess · Muerte · OddProphet**

---

## TABLE OF CONTENTS

1. [Project State Assessment](#1-project-state-assessment)
2. [Critical Bugs — Fix These First](#2-critical-bugs--fix-these-first)
3. [Performance Killers](#3-performance-killers)
4. [Dead & Redundant Code](#4-dead--redundant-code)
5. [Architecture Overhaul](#5-architecture-overhaul)
6. [Audio Engine Improvements](#6-audio-engine-improvements)
7. [Visual Engine Overhaul](#7-visual-engine-overhaul)
8. [New Feature: Real Bloom Post-Processing](#8-new-feature-real-bloom-post-processing)
9. [New Feature: Vertical (9:16) Recording Mode](#9-new-feature-vertical-916-recording-mode)
10. [New Feature: Multi-Track Stem Input](#10-new-feature-multi-track-stem-input)
11. [New Feature: Instagram Recording Pipeline](#11-new-feature-instagram-recording-pipeline)
12. [New Feature: Post-Processing Pipeline](#12-new-feature-post-processing-pipeline)
13. [New Feature: Smart Presets System](#13-new-feature-smart-presets-system)
14. [New Visual Modes for Tearout](#14-new-visual-modes-for-tearout)
15. [Settings Panel Redesign](#15-settings-panel-redesign)
16. [Per-Mode Deep Audit](#16-per-mode-deep-audit)
17. [Implementation Roadmap](#17-implementation-roadmap)

---

## 1. PROJECT STATE ASSESSMENT

### What AURA Is

AURA is a browser-based, Three.js-powered audio-reactive visual generator. It has a genuinely advanced audio analysis engine (7-band analysis, tearout-specific detectors for gunshots, sirens, screech, wobble, sub sustain), a marker/section system for timeline-based behavior, 30+ visual modes, a recording system, and a parameter UI.

### What AURA Is Not (Yet)

AURA is not currently capable of producing Instagram-viral content at the level you need for the following concrete reasons:

- **No vertical canvas.** Instagram Reels is 9:16. Every recording is landscape. This alone makes it unusable for Reels without re-encoding.
- **Bloom is completely fake.** The most important visual effect for glowing, neon tearout aesthetics doesn't work at all.
- **Several modes destroy and rebuild geometry every single frame.** At 60fps this is catastrophic for GPU performance.
- **The color singleton bug** quietly corrupts colors across modes.
- **No post-processing pipeline** exists in any real sense — chromatic aberration, color grading, vignette, lens distortion are all missing.
- **Parameter overload with zero smart presets.** A first-time user opening Hyperforge sees 60+ sliders and gives up immediately.
- **No text/watermark overlay** in recordings — your Instagram identity/brand is absent.

### Overall Score

| Category | Score | Notes |
|---|---|---|
| Audio Analysis Engine | 9/10 | Genuinely excellent. Tearout detectors are smart. |
| Visual Quality Ceiling | 6/10 | Blocked by fake bloom and missing post-processing. |
| Performance | 5/10 | Several modes have catastrophic per-frame rebuilds. |
| User Experience | 4/10 | Too many parameters, no smart presets, no vertical mode. |
| Instagram Readiness | 2/10 | No 9:16 mode, no watermark, no recording quality control. |
| Code Architecture | 6/10 | Solid structure but critical bugs exist. |

---

## 2. CRITICAL BUGS — FIX THESE FIRST

### BUG-01: Bloom Post-Processing Is Completely Fake

**Severity: CRITICAL — affects every single mode**

**Location:** `index.html` — inline script block, `THREE.UnrealBloomPass`

**What's happening:** The `THREE.UnrealBloomPass` implementation in `index.html` is a hand-written stub. The entire `render()` method is:

```javascript
// THE ACTUAL "BLOOM" CODE:
render: function (renderer, writeBuffer, readBuffer) {
    if (this.renderToScreen) {
        renderer.setRenderTarget(null);
        renderer.toneMappingExposure = 1.0 + this.strength * 0.5;
    }
}
```

This does nothing except slightly boost exposure. There is **zero actual glow, zero blur, zero bloom**. The "Post Processing" toggle and "Bloom Intensity" slider in the UI are effectively broken for any real bloom effect.

**Impact:** The entire visual aesthetic you're aiming for — neon glow, light bleeding, luminous energy — is absent. Tearout visuals literally need bloom to look correct.

**Fix:** Implement a real multi-pass Gaussian bloom using Two-pass separable blur. See Section 8 for full implementation plan.

---

### BUG-02: `getColorThreeHSL` Singleton Color Assigned to Materials

**Severity: CRITICAL — causes silent visual corruption**

**Location:** `params.js` → `getColorThreeHSL()` and multiple mode files

**What's happening:** `getColorThreeHSL()` returns a **cached singleton** `THREE.Color` object called `_cachedColor`. The JSDoc comment says "Caller must clone if storing: color.clone()" but this warning is ignored in multiple modes.

**Specific offenders:**

```javascript
// mobiusRings.js — line ~145
const color = ParamSystem.getColorThree(t + bass * 0.3);
ring.material.color = color; // STORING THE SINGLETON — BUG

// nebula.js — line ~210
this.coreGlow.material.color = ParamSystem.getColorThree(rms + this.time * 0.1); // BUG

// dnaHelix.js — inside tube material creation
color: ParamSystem.getColorThree(h / helixCount + audio.rms * 0.3), // BUG
```

**What happens at runtime:** When `getColorThree` is called again in the same or next frame, `_cachedColor` is overwritten — all materials holding a reference to it instantly change to the new color. This causes colors to flicker, bleed across modes, and behave incorrectly. It's subtle enough that you wouldn't immediately know what's wrong, but it's always corrupting something.

**Fix:**
```javascript
// Every assignment that stores the result must clone:
ring.material.color = ParamSystem.getColorThree(t + bass * 0.3).clone(); // CORRECT

// OR refactor getColorThree to always return a new object:
function getColorThree(t, palette) {
    const hsl = getColorHSL(t, palette);
    return new THREE.Color().setHSL(hsl.h / 360, hsl.s, hsl.l); // always fresh
}
// Keep getColorThreeHSL as the fast singleton for immediate r/g/b reads in tight loops
```

---

### BUG-03: `DnaHelixMode` Destroys and Rebuilds ALL Geometry Every Frame

**Severity: CRITICAL — causes frame drops on every update**

**Location:** `dnaHelix.js` → `update()` function, first 6 lines

```javascript
update(audio, params, dt) {
    if (!this.group) return;
    this.time += dt;

    // THIS RUNS EVERY SINGLE FRAME:
    while (this.group.children.length) {
        const c = this.group.children[0];
        this.group.remove(c);
        if (c.geometry) c.geometry.dispose();  // GPU dealloc every frame
        if (c.material) c.material.dispose();  // GPU dealloc every frame
    }
    // Then rebuilds EVERYTHING from scratch...
```

With `resolution=400`, this creates and destroys 400-point `Line` geometries, `TubeGeometry` for the backbone, bridge `Line` geometries for each bridge pair, enzyme particle geometries, and floating particle geometries — **every single frame at 60fps**.

For TubeGeometry specifically (`backbone === 'tube'`): It first creates a `CatmullRomCurve3` from 133 points, then generates `TubeGeometry` with up to 300 tube segments × 6 radial segments = 1800 triangles — all allocated, uploaded to GPU, rendered once, then immediately deallocated. This is one of the most expensive patterns possible in WebGL.

**Fix:** Convert to a persistent geometry update pattern where position/color buffer arrays are updated in-place using `needsUpdate = true`, never disposing the geometry. See Section 16 for mode-specific fixes.

---

### BUG-04: `MobiusRingsMode` Rebuilds Möbius Geometry for Every Ring Every Frame

**Severity: HIGH**

**Location:** `mobiusRings.js` → `update()`, inside the ring loop

```javascript
for (let i = 0; i < this.rings.length; i++) {
    ring.geometry.dispose(); // GPU dealloc
    ring.geometry = this.createMobiusGeometry( // GPU alloc + upload
        (params.radius || 30) * ...,
        ...
    );
```

With `segments=128` and `tubeSegs=8`, each `createMobiusGeometry()` call creates `(128+1) * (8+1) = 1161` vertices and `128 * 8 * 2 = 2048` triangles. With 8 rings, that's **9288 vertices and 16384 triangles** being allocated, uploaded to GPU, and deallocated every frame. The `buildRings()` initial geometry is also immediately wasted — it's disposed on the first `update()` call.

**Fix:** Only rebuild geometry when params actually change. Cache the last param values and compare.

---

### BUG-05: `analyser.smoothingTimeConstant` PLUS Manual Band Smoothing = Double-Smoothed Audio

**Severity: HIGH — reduces visual reactivity for tearout music**

**Location:** `audio.js` → `init()` and `computeBands()`

The Web Audio API analyser is set to `smoothingTimeConstant = 0.82` (line 302), which already smooths the FFT data significantly. Then `computeBands()` ALSO applies its own exponential smoothing per band. The result is that transients — the gunshot hits, hard drops, and 808 slams that define Svdden Death / Excision tracks — are severely damped before any visual mode ever sees them.

```javascript
// audio.js init():
analyser.smoothingTimeConstant = 0.82; // FFT already smoothed

// computeBands() applies ANOTHER smooth on top:
audioBus.smoothBands[band] += (avg - audioBus.smoothBands[band]) * (1 - smoothing);
```

**For tearout music you want the analyser to be RAW (or near-raw), and handle all smoothing yourself so you can have both a sharp transient signal AND a smooth signal available simultaneously.**

**Fix:**
```javascript
analyser.smoothingTimeConstant = 0.0; // raw FFT data
// Keep your manual smoothing in computeBands() — now you have:
// audioBus.rawBands = instant, no smoothing
// audioBus.bands = your custom smooth rate
// audioBus.smoothBands = heavy smooth for backgrounds
```
This alone will make beats hit harder visually.

---

### BUG-06: `energyHistory.reduce()` is O(n) Every Frame

**Severity: MEDIUM-HIGH — constant CPU overhead**

**Location:** `audio.js` → `detectDrop()`

```javascript
// This runs every frame over 180 elements:
const longAvg = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
// AND this:
const shortWindow = energyHistory.slice(-ENERGY_WINDOW_SHORT); // allocates new array
const shortAvg = shortWindow.reduce((a, b) => a + b, 0) / shortWindow.length;
```

With `ENERGY_WINDOW_LONG = 180`, this is 180 additions, a 30-element array slice, and 30 more additions — every frame. Similar patterns exist for `spectralFluxHistory.reduce()` and `bassFluxHistory.reduce()`.

**Fix:** Use running sums — add new value, subtract oldest value, divide by N. O(1) per frame.

---

### BUG-07: All History Arrays Use `.push()/.shift()` Instead of Ring Buffers

**Severity: MEDIUM — GC pressure, memory churn**

**Location:** `audio.js` — multiple history arrays

```javascript
// These patterns appear in: spectralFluxHistory, bassFluxHistory,
// energyHistory, onsetHistory, beatTimes, onsetTimes,
// loudnessHistory, modulationHistory, _wobblePeakTimes,
// SpectrogramMode.historyBuffer

energyHistory.push(e);
if (energyHistory.length > ENERGY_WINDOW_LONG) energyHistory.shift();
```

`.shift()` on a JavaScript array is O(n) because it shifts every element left. With 180-element arrays running at 60fps, this is 10,800 element moves per second. Every `.push()` before the limit is also a potential array resize.

**Fix:** Replace every history array with a typed ring buffer:

```javascript
class RingBuffer {
    constructor(size) {
        this.buf = new Float32Array(size);
        this.size = size;
        this.head = 0;
        this.count = 0;
        this._sum = 0; // running sum for O(1) average
    }
    push(val) {
        if (this.count === this.size) this._sum -= this.buf[this.head];
        this.buf[this.head] = val;
        this._sum += val;
        this.head = (this.head + 1) % this.size;
        this.count = Math.min(this.count + 1, this.size);
    }
    avg() { return this.count > 0 ? this._sum / this.count : 0; }
    get(i) { return this.buf[(this.head - this.count + i + this.size * 2) % this.size]; }
}
```

---

### BUG-08: Object Spread Creates New Objects Every Frame in the Render Hot Path

**Severity: MEDIUM — feeds GC, causes micro-stutters**

**Location:** `visuals.js` → `update()` and `updateEffects()`

```javascript
// This runs at 60fps — allocates a new merged object every frame:
updateEffects(audioBus, {
    ...ParamSystem.getAllGlobal(),  // getAllGlobal() creates {...globalValues}
    ...ParamSystem.getAllMode()    // getAllMode() creates {...modeValues}
}, dt);

// AND inside updateEffects:
activeMode.update(audioBus, {
    ...ParamSystem.getAllGlobal(),
    ...ParamSystem.getAllMode(),
    _displacementScale: ...,
    _particleScale: ...,
    _speedScale: ...
}, dt);
```

That's **4 object allocations per frame** at 60fps = 240 new objects per second that immediately become garbage. On low-end devices this directly causes the stutters you see during drops when GC runs.

**Fix:** Use a pre-allocated shared params object that gets updated in-place each frame. `ParamSystem` should expose a cached merged view:

```javascript
// In ParamSystem:
const _sharedParams = {};
function getCachedParams() {
    Object.assign(_sharedParams, globalValues, modeValues);
    return _sharedParams;
}
```

---

### BUG-09: `TerrainMeshMode` Calls `computeVertexNormals()` Every Frame for a Material That Ignores Normals

**Severity: MEDIUM — wasted computation**

**Location:** `terrainMesh.js` → `update()`, last line of the vertex loop

```javascript
this.mesh.geometry.computeVertexNormals(); // called every frame
```

The terrain uses `THREE.MeshBasicMaterial` which is unlit — it **never uses vertex normals**. This computes surface normals for every triangle in a 64×64 grid (4096 vertices, ~8000 triangles) every frame for zero visual benefit.

**Fix:** Remove this call entirely. If you ever switch to `MeshPhongMaterial` or `MeshStandardMaterial` for lit terrain, add it back conditionally.

---

### BUG-10: `SpectrogramMode` Allocates a New `Float32Array` Every Frame for History

**Severity: MEDIUM**

**Location:** `spectrogram.js` → `update()`

```javascript
// Every frame, allocates a new typed array of freqData.length (2048 bytes):
const snapshot = new Float32Array(freqData.length);
for (let i = 0; i < freqData.length; i++) snapshot[i] = freqData[i] / 255;
this.historyBuffer.push(snapshot);
while (this.historyBuffer.length > historyDepth) this.historyBuffer.shift();
```

With `historyDepth=60`, this maintains 60 Float32Arrays. At 60fps with 2048 floats each, that's 128KB of arrays being constantly allocated and GC'd.

**Fix:** Pre-allocate a 2D ring buffer in `init()`:

```javascript
// Pre-allocate all history slots:
const BINS = 2048;
this._historyBuf = new Float32Array(MAX_HISTORY_DEPTH * BINS);
this._historyHead = 0;
```

---

### BUG-11: `loadFile` Resolves Only on `canplaythrough` — No Timeout Fallback

**Severity: MEDIUM — UX freeze**

**Location:** `audio.js` → `loadFile()`

```javascript
return new Promise((resolve) => {
    audioElement.addEventListener('canplaythrough', () => {
        audioBus.duration = audioElement.duration;
        resolve();
    }, { once: true });
    // No timeout. If canplaythrough never fires: Promise hangs forever.
});
```

For some codec/browser combinations (particularly FLAC on Chrome, or very large WAV files), `canplaythrough` may never fire. The loading UI spinner will hang indefinitely with no error message and no way to recover except reloading the page.

**Fix:**
```javascript
return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 15000);
    audioElement.addEventListener('canplaythrough', () => {
        clearTimeout(timeout);
        resolve();
    }, { once: true });
    audioElement.addEventListener('error', (e) => {
        clearTimeout(timeout);
        reject(new Error(`Audio error: ${e.target.error?.message}`));
    }, { once: true });
});
```

---

### BUG-12: GLSL `break` in Loop with Dynamic Condition (ShaderTunnel)

**Severity: MEDIUM — potential WebGL 1.0 incompatibility**

**Location:** `shaderTunnel.js` → fragment shader

```glsl
for (float layer = 0.0; layer < 4.0; layer++) {
    if (layer >= uLayers) break; // Dynamic condition break
    ...
}
```

In WebGL 1.0 / GLSL ES 1.00 (which Three.js r128 uses by default), loops must have constant bounds for the compiler to unroll them. A `break` with a runtime-uniform condition (`uLayers`) violates this. Some GPUs/drivers compile it, others don't. This is why ShaderTunnel may silently fail to render on some hardware.

**Fix:** Use a continue/mask pattern instead of break, or switch to WebGL 2.0 / GLSL ES 3.0:

```glsl
for (float layer = 0.0; layer < 4.0; layer++) {
    if (layer < uLayers) { // mask instead of break
        // ... all layer code here
    }
}
```

---

### BUG-13: `alert()` Used for Audio Load Error — Blocking and Terrible UX

**Severity: LOW — UX**

**Location:** `ui.js` → `handleFile()`

```javascript
} catch (err) {
    console.error('Failed to load audio:', err);
    alert('Failed to load audio file. Please try another file.'); // modal alert
}
```

`alert()` is a synchronous modal that blocks the browser tab entirely. Replace with a toast notification or in-app error display that doesn't stop the RAF loop or block the UI.

---

### BUG-14: `cinematicCamera`, `cameraAutoRotate`, `cameraRotateSpeed` Params Are Never Read

**Severity: LOW — dead parameters in UI**

**Location:** `params.js` → `globalDefaults`, and `visuals.js`

These three parameters appear in the global params UI but there is no code in `visuals.js` (or anywhere else) that reads `ParamSystem.get('cinematicCamera')` or `ParamSystem.get('cameraAutoRotate')`. They show up as real controls, the user adjusts them, and absolutely nothing happens.

**Fix:** Either implement them (camera auto-rotation is easy and useful) or remove them from `globalDefaults` to declutter the UI.

---

## 3. PERFORMANCE KILLERS

### PERF-01: Geometry Rebuild Audit — All Modes

The following modes perform full or partial geometry rebuilds in ways that should be converted to buffer updates:

| Mode | What Rebuilds | Frequency | Cost |
|---|---|---|---|
| `DnaHelixMode` | ALL geometry (lines, tubes, bridges, particles) | Every frame | EXTREME |
| `MobiusRingsMode` | Every ring's Möbius geometry | Every frame | HIGH |
| `FrequencyBarsMode` | Bar geometries when count changes | On change | LOW (acceptable) |
| `AuroraMode` | Curtains when count changes | On change | MEDIUM |
| `NebulaMode.build3DMesh()` | 3D surface mesh | On param change | HIGH |
| `TerrainMeshMode` | Full rebuild on resolution change | On change | HIGH |

**For DnaHelix and Möbius:** The fix is to pre-allocate all geometry buffers in `init()` and only update the position/color arrays with `needsUpdate = true` in `update()`. Never call `geometry.dispose()` in the animation loop.

### PERF-02: ParticleStorm Connection Lines Are O(n²)

**Location:** `particleStorm.js` → connection lines feature

When `connectionLines` is enabled, the mode checks distances between pairs of particles to find nearby ones. With 5000 particles, that's **12.5 million distance checks per frame**. Even with an early exit, this is devastating.

**Fix:** Implement spatial hashing — divide space into a grid, only check particles in adjacent cells. Reduces to O(n) average case.

### PERF-03: `visuals.js updateEffects()` — Drop Chaos Pattern Is Expensive

The drop chaos effect checks multiple conditions and lerps multiple values every frame even when no drop is active. Minor optimization: early-exit the chaos block when `dropChaosIntensity < 0.001`.

### PERF-04: `computeVertexNormals()` Called in TerrainMesh for BasicMaterial

Already documented in BUG-09. Wasted computation.

### PERF-05: No GPU Memory Budget Awareness

With modes like DimensionalRift running 10,000 particles, Hyperforge with 8,000 attractor points, and Nebula with 8,000 cloud points simultaneously — there's no memory budget tracking. On mobile or integrated graphics, these will silently stutter or crash the WebGL context.

**Fix:** Add a `gpuBudget` mode in Settings (`Low: 2K particles max`, `Medium: 5K`, `High: unlimited`) that caps buffer sizes across all modes.

---

## 4. DEAD & REDUNDANT CODE

### DEAD-01: Global Params That Do Nothing

| Parameter | Defined in `params.js` | Used anywhere | Verdict |
|---|---|---|---|
| `cinematicCamera` | YES | NO | **Dead — remove or implement** |
| `cameraAutoRotate` | YES | NO | **Dead — remove or implement** |
| `cameraRotateSpeed` | YES | NO | **Dead — remove or implement** |
| `postProcessing` | YES | YES (but bloom is fake) | **Misleading — fix bloom first** |

### DEAD-02: `SECTION_BEHAVIORS` in `visuals.js` Are Partially Unused

`SECTION_BEHAVIORS` defines detailed per-section properties like `trailLength`, `onEnter`, `gunShotReaction`, `screechReaction`, `sirenReaction` etc. — but no code in any mode actually reads `SECTION_BEHAVIORS.drop.screechReaction` or `SECTION_BEHAVIORS.climax.gunShotReaction`. These hint values exist but the modes don't consume them.

Either wire modes to consume these hints, or simplify the contract to only what's actually used.

### DEAD-03: `prevBassSnapshotBuf` Never Used

**Location:** `audio.js`, line 22

```javascript
let prevBassSnapshotBuf = new Float32Array(64); // pre-allocated for detectBeat
```

Searching through the full `audio.js` — this buffer is declared but never written to or read from in `detectBeat()`. Dead allocation.

### DEAD-04: `prevTimeData` Populated but Never Consumed

**Location:** `audio.js` → `computeMicroDynamics()`

```javascript
// Store prevTimeData for future use
for (let i = 0; i < timeData.length; i++) {
    prevTimeData[i] = (timeData[i] - 128) / 128;
}
```

The comment says "for future use." It is stored every frame (2048 writes per frame) but never read back anywhere in the codebase.

### DEAD-05: `_windowRMS` Pre-allocation Comment is Inaccurate

**Location:** `audio.js`, line 119

The `_windowRMS` buffer is used in `computeMicroDynamics()` and is legitimately used. However, the `1.6/1.7` version comment is stale annotation cruft.

### DEAD-06: `DnaHelixMode` Stores Strand Data on `group.userData`

```javascript
if (h === 0) this.group.userData.strand1 = points;
if (h === 1) this.group.userData.strand2 = points;
```

Since `points` is rebuilt every frame as a `new Array`, and the data is used immediately after in the same function, this userData storage is pointless — it's just a local reference that could be a variable.

### DEAD-07: Aurora `magneticLines`, `rayShots`, `polarParticles` Toggles Defined But Not Implemented

**Location:** `aurora.js`

These three params appear in the params schema but have no corresponding build/update code in the mode body:

```javascript
magneticLines: { type: 'toggle', default: false, label: '🧲 Magnetic Lines' },
rayShots: { type: 'toggle', default: false, label: '⚡ Ray Shots' },
polarParticles: { type: 'toggle', default: false, label: '❄️ Polar Particles' },
```

They show in the UI as interactive toggles that do nothing. Remove until implemented.

### DEAD-08: `Nebula.buildMesh()` Partially Wasted

The `build3DMesh()` function in `spectrogram.js` is called with `this.plane.parent` as the scene reference — which means it manually passed the scene through a chain of parent references rather than storing it properly.

---

## 5. ARCHITECTURE OVERHAUL

### ARCH-01: Store Scene Reference in Modes

Currently modes receive `scene` and `camera` in `init(scene, camera, renderer)` but don't store them. This forces patterns like `this.mesh.parent` to reach the scene. Every mode should store:

```javascript
init(scene, camera, renderer) {
    this._scene = scene;
    this._camera = camera;
    this._renderer = renderer;
    // rest of init
}
```

### ARCH-02: Mode Base Class / Interface

All modes share the same shape (`name`, `params`, `init()`, `update()`, `destroy()`) but this contract isn't enforced. Create a `BaseMode` class:

```javascript
class BaseMode {
    constructor() {
        this._scene = null;
        this._camera = null;
        this._renderer = null;
        this._time = 0;
        this._initialized = false;
    }
    init(scene, camera, renderer) {
        this._scene = scene;
        this._camera = camera;
        this._renderer = renderer;
        this._initialized = true;
    }
    update(audio, params, dt) { this._time += dt; }
    destroy() {
        this._scene = null;
        this._camera = null;
        this._initialized = false;
    }
    // Shared utilities every mode benefits from:
    getColor(t) { return ParamSystem.getColorThreeHSL(t); } // internal use only
    getColorForMaterial(t) { return ParamSystem.getColorThreeHSL(t).clone(); } // safe to assign
}
```

### ARCH-03: Centralized Geometry Pool

Modes that create similar geometries (Points, Lines, BufferGeometry) should pull from a pool rather than new-allocating. A `GeometryPool` singleton that recycles `BufferGeometry` instances would eliminate 80% of the allocation overhead in particle and line modes.

### ARCH-04: Upgrade Three.js from r128 to r164+

Three.js r128 is from November 2021. Current stable (as of 2025) is r164+. The upgrade brings:

- WebGPU renderer support (10x performance on compatible hardware)
- `THREE.WebGLRenderer` improvements — better memory management
- `BatchedMesh` — draw thousands of distinct mesh instances in one draw call
- Proper `EffectComposer` with real `UnrealBloomPass`
- `AdaptiveToneMappingPass`, `SSAOPass`, `OutlinePass`
- GLSL ES 3.0 shader support — access to compute-shader-like capabilities

**Migration risk:** Three.js has strong backwards compatibility. The main breaking changes are in OrbitControls (moved to examples/jsm), but since AURA implements its own orbit controls, this is a non-issue. The CDN URL just needs to change, and the inline post-processing shims get deleted.

### ARCH-05: Decouple Marker System from Audio Engine Update Loop

Currently `MarkerSystem.update(audioBus.currentTime)` is called inside `AudioEngine.updateSectionAwareness()`. The Marker System is a UI/timeline concern, not an audio analysis concern. It should be updated in `UI.update()` or `VisualEngine.update()` instead. This separation makes testing and debugging each system easier.

### ARCH-06: Replace `alert()` with In-App Toast Notification System

```javascript
// A simple toast that doesn't block the RAF loop:
function showToast(message, type = 'error', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `aura-toast aura-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}
```

---

## 6. AUDIO ENGINE IMPROVEMENTS

### AUDIO-01: Per-Band Smoothing with Separate Attack and Release Rates

Tearout music needs instant attack (hit immediately on the transient) with slower release (trail off naturally). Currently a single smoothing value applies uniformly.

```javascript
// Proposed per-band attack/release smoothing:
const BAND_ATTACK = { sub: 0.4, bass: 0.35, lowMid: 0.25, mid: 0.2, highMid: 0.2, treble: 0.15, brilliance: 0.1 };
const BAND_RELEASE = { sub: 0.05, bass: 0.07, lowMid: 0.06, mid: 0.05, highMid: 0.04, treble: 0.03, brilliance: 0.02 };

for (const band of BAND_NAMES) {
    const raw = audioBus.rawBands[band];
    const current = audioBus.smoothBands[band];
    const rate = raw > current ? BAND_ATTACK[band] : BAND_RELEASE[band];
    audioBus.smoothBands[band] += (raw - current) * rate;
}
```

This makes sub hits feel like a punch (fast attack) that echoes (slow release) — exactly the Svdden Death / Excision pressure feel.

### AUDIO-02: Dedicated Sub-Bass Channel (20–60 Hz Isolation)

The current `sub` band covers 0–65Hz (bins 0–6). For tearout/riddim, the true sub (20–50Hz) and the upper sub punch (50–100Hz) behave very differently visually. Split them:

```javascript
// New ultra-sub band for 808 pressure and sub bass:
ultraSub: [0, 3],    // 0–32 Hz — pure sub pressure, body feel
sub: [3, 8],         // 32–86 Hz — sub bass, 808 body
bass: [8, 20],       // 86–215 Hz — bass punch, kick drum
```

Expose `audioBus.bands.ultraSub` — modes can use this to drive effects specifically tied to sub pressure, which is one of the defining characteristics of tearout.

### AUDIO-03: Half-Time Beat Detection

Tearout, dubstep, and riddim are largely half-time feels — the groove is felt at 70-90 BPM even when the BPM is 140-180. The current beat detection finds all beats at full speed. Add a half-time mode:

```javascript
audioBus.halfTimeBeat = false;
audioBus.halfTimeBeatIntensity = 0;
// Trigger only on beats 1 and 3 of a 4-beat bar:
if (audioBus.beat && (audioBus.beatCount % 2 === 0)) {
    audioBus.halfTimeBeat = true;
    audioBus.halfTimeBeatIntensity = audioBus.beatIntensity;
}
```

Modes can then check `audio.halfTimeBeat` for massive, slow, weighted reactions rather than rapid-fire full-time ones.

### AUDIO-04: Expose Instantaneous Sub Pressure as Separate Bus Property

```javascript
// Direct, unsmoothed sub reading — for immediate visual reactions:
audioBus.subPressure = freqData[0] / 255 * 2 + freqData[1] / 255 * 1.5 + freqData[2] / 255;
audioBus.subPressureSmooth += (audioBus.subPressure - audioBus.subPressureSmooth) * 0.15;
```

This creates a value that literally represents the pressure felt in the body from sub bass — useful for making visuals feel physically heavy in the way Excision drops do.

### AUDIO-05: Multi-Track Stem Audio Analysis

See Section 10 for full architecture. The audio engine needs to support parallel audio sources:
- `audioBus.stems.drums` — kick/snare/hi-hat analysis
- `audioBus.stems.bass` — bass/sub analysis
- `audioBus.stems.synth` — synth/leads/effects analysis
- `audioBus.stems.vocals` — if vocals are present

### AUDIO-06: Transient Sharpness Score

For gunshot-style transient detection in tearout, add a sharpness metric:

```javascript
// How sharp/percussive vs soft/sustained is the current onset:
audioBus.transientSharpness = audioBus.rmsVelocity * (1 - audioBus.harmonicRatio);
// High = percussive shot (kick, snare, gunshot bass)
// Low = sustained tone (pads, sustained bass, chords)
```

This lets modes distinguish between a hard gunshot hit and a sustained sub note — both have high bass energy, but they should look different visually.

---

## 7. VISUAL ENGINE OVERHAUL

### VIS-01: Real Post-Processing Composer

After upgrading Three.js (see ARCH-04), replace the fake bloom shim with real passes:

```
EffectComposer
├── RenderPass (scene + camera)
├── UnrealBloomPass (real glow)
├── ChromaticAberrationPass (custom)
├── FilmGrainPass (custom)
├── VignettePass (custom)
└── OutputPass
```

All passes should be parameterizable from the Settings panel.

### VIS-02: Screen-Space Chromatic Aberration Pass

Real chromatic aberration as a post-processing pass:

```glsl
// Fragment shader for chromatic aberration:
uniform float uAmount;
uniform sampler2D tDiffuse;
varying vec2 vUv;

void main() {
    vec2 offset = uAmount * (vUv - 0.5);
    float r = texture2D(tDiffuse, vUv - offset).r;
    float g = texture2D(tDiffuse, vUv).g;
    float b = texture2D(tDiffuse, vUv + offset).b;
    gl_FragColor = vec4(r, g, b, 1.0);
}
```

Audio-reactive: `uAmount` driven by `audioBus.screechIntensity` and drop intensity. During Svdden Death-style screech buildup, chromatic aberration ramps up to extreme levels then snaps off at the drop.

### VIS-03: Global Glitch Pass

A global screen-space glitch effect that operates independently of mode:

```glsl
// Digital block corruption — shifts horizontal strips randomly:
float glitchStrength = uDropDecay * uGlitchIntensity;
float strip = floor(vUv.y * 30.0) / 30.0;
float noise = hash(strip + uTime);
vec2 offset = vec2(noise * glitchStrength * 0.1, 0.0);
if (noise > (1.0 - glitchStrength * 0.5)) {
    gl_FragColor = texture2D(tDiffuse, vUv + offset);
} else {
    gl_FragColor = texture2D(tDiffuse, vUv);
}
```

Triggered automatically during `audioBus.gunShotDetected` and `audioBus.isDropSection`.

### VIS-04: Color Grading / LUT Pass

Apply a color lookup table to the final output. Pre-built LUTs:

- **Tearout**: Heavy contrast, crushed blacks, electric blues and oranges
- **Void**: Deep blacks with thin neon edges
- **Solar**: Warm amber blown-out highlights
- **Cryogenic**: Cold blue-green, high saturation
- **Blood Drop**: Red channel boost, dark shadows

These are stored as 16×16×16 3D LUT textures (a PNG strip) and applied in a single texture lookup pass.

### VIS-05: Section Transition Morphing

When moving between markers (e.g., buildup → drop), instead of an immediate mode behavior change, animate a 0.3-second "visual shockwave" transition:

1. Freeze current frame (copy to render target)
2. New mode renders into second target
3. Transition shader dissolves between them using a wipe/shatter/explosion pattern based on the section type

### VIS-06: Beat-Locked Camera Shake Improvement

Current shake is sinusoidal. For tearout, camera shake should be:

- **On gunshot:** Single sharp spike in one random direction, fast decay (0.1s)
- **On drop entry:** Radial explosion shake (camera zooms in then snaps back)
- **During drop:** Rhythmic micro-shakes locked to every beat, not continuous sine
- **On bass wobble:** Slow horizontal sway synchronized to wobble LFO phase

```javascript
function applyTearoutShake(audio, dt) {
    if (audio.gunShotDetected) {
        // Single-frame direction spike:
        const angle = Math.random() * Math.PI * 2;
        cameraShake.x += Math.cos(angle) * audio.gunShotIntensity * shakeAmount * 3;
        cameraShake.y += Math.sin(angle) * audio.gunShotIntensity * shakeAmount * 3;
    }
    if (audio.halfTimeBeat) {
        cameraShake.x += (Math.random() - 0.5) * audio.beatIntensity * shakeAmount;
        cameraShake.y += (Math.random() - 0.5) * audio.beatIntensity * shakeAmount;
    }
    // Wobble sway:
    if (audio.wobbleIntensity > 0.3) {
        camera.position.x = baseCameraPos.x + Math.sin(audio.wobblePhase * Math.PI * 2) * audio.wobbleIntensity * wobbleSwayAmount;
    }
    // Decay:
    cameraShake.x *= 0.75;
    cameraShake.y *= 0.75;
}
```

---

## 8. NEW FEATURE: REAL BLOOM POST-PROCESSING

### Implementation Plan (No Three.js Upgrade Required)

A working bloom can be implemented without `UnrealBloomPass` using Three.js's existing `WebGLRenderTarget` and a custom two-pass Gaussian blur.

**Pass 1:** Render scene to `renderTarget`
**Pass 2:** Threshold pass — keep only bright pixels
**Pass 3:** Horizontal Gaussian blur → `pingTarget`
**Pass 4:** Vertical Gaussian blur → `pongTarget`
**Pass 5:** Additive composite — original + blurred bright layer

```javascript
// Threshold shader (keeps pixels above threshold):
const thresholdShader = {
    uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 0.4 }
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        varying vec2 vUv;
        void main() {
            vec4 col = texture2D(tDiffuse, vUv);
            float brightness = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
            gl_FragColor = brightness > uThreshold ? col : vec4(0.0, 0.0, 0.0, 1.0);
        }
    `
};

// Horizontal + vertical blur passes using 9-tap Gaussian kernel
// Composite pass: original + bloom * strength
```

**Audio reactivity:** `uThreshold` decreases during drops (more of the image blooms), `bloom strength` tracks `audioBus.masterIntensity`. During a Svdden Death drop, nearly everything should glow.

---

## 9. NEW FEATURE: VERTICAL (9:16) RECORDING MODE

This is the most important missing feature for Instagram Reels.

### Canvas Aspect Ratio Control

Add a "Canvas Format" selector to Settings:

| Format | Resolution | Use Case |
|---|---|---|
| Landscape | 1920×1080 | YouTube, desktop |
| Portrait | 1080×1920 | Instagram Reels, TikTok |
| Square | 1080×1080 | Instagram Posts |
| Auto | Window size | Default |

### Implementation

```javascript
function setCanvasFormat(format) {
    const canvas = document.getElementById('aura-canvas');
    const formats = {
        landscape: { w: 1920, h: 1080 },
        portrait:  { w: 1080, h: 1920 },
        square:    { w: 1080, h: 1080 },
        auto:      { w: window.innerWidth, h: window.innerHeight }
    };
    const { w, h } = formats[format];
    
    // Resize renderer to target resolution:
    renderer.setSize(w, h, false); // false = don't update CSS
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    
    // Scale the canvas via CSS to fit screen while maintaining aspect ratio:
    canvas.style.width = '';
    canvas.style.height = '';
    const scaleX = window.innerWidth / w;
    const scaleY = window.innerHeight / h;
    const scale = Math.min(scaleX, scaleY);
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = 'top left';
    canvas.style.position = 'fixed';
    canvas.style.left = `${(window.innerWidth - w * scale) / 2}px`;
    canvas.style.top = `${(window.innerHeight - h * scale) / 2}px`;
    
    // Show black bars in the unused space:
    document.body.style.background = '#000';
    
    currentCanvasFormat = format;
}
```

### Portrait-Aware Modes

When switching to portrait mode, modes should receive a `aspectRatio` param so they can adjust their layout:

- `FrequencyBars`: switch from linear horizontal to linear vertical layout
- `Spectrogram`: rotate 90 degrees
- `GeometryForge`: adjust camera distance for tall viewport
- `ShaderTunnel`: already works — the shader adapts to any aspect ratio

### Recording Format Locking

When recording starts, lock the canvas format. Warn user if trying to change format during recording.

```javascript
// In Recorder.start():
function start(canvas) {
    if (isRecording) return;
    currentRecordingFormat = currentCanvasFormat;
    // ... rest of recording start
}
```

---

## 10. NEW FEATURE: MULTI-TRACK STEM INPUT

### Overview

Allow importing multiple audio files simultaneously, each routed to a separate analyser — enabling independent visual reactions to drums vs. bass vs. synths.

### Architecture

```javascript
// In AudioEngine — new stem structure:
const stems = {
    drums: { analyser: null, bus: null, gainNode: null, sourceNode: null },
    bass:  { analyser: null, bus: null, gainNode: null, sourceNode: null },
    synth: { analyser: null, bus: null, gainNode: null, sourceNode: null },
    other: { analyser: null, bus: null, gainNode: null, sourceNode: null }
};

async function loadStem(file, stemName) {
    if (!stems[stemName]) return;
    const stem = stems[stemName];
    // Create dedicated analyser for this stem:
    stem.analyser = ctx.createAnalyser();
    stem.analyser.fftSize = 2048;
    stem.analyser.smoothingTimeConstant = 0.0;
    stem.gainNode = ctx.createGain();
    
    // Create audio element for this stem:
    const audioEl = document.createElement('audio');
    const url = URL.createObjectURL(file);
    audioEl.src = url;
    audioEl.loop = audioElement.loop;
    
    stem.sourceNode = ctx.createMediaElementSource(audioEl);
    stem.sourceNode.connect(stem.gainNode);
    stem.gainNode.connect(stem.analyser);
    // Also connect to master output (optional — user may want to mute individual stems):
    stem.gainNode.connect(ctx.destination);
    
    stem.audioElement = audioEl;
    stem.bus = createStemBus(); // same structure as main audioBus bands
}
```

### UI for Stem Import

A separate "Stem Mode" panel accessible from Settings:

```
┌────────────────────────────────┐
│  🎛 STEM MIXER                 │
├────────────────────────────────┤
│  🥁 Drums    [Drop file]  [🔊] │
│  🔊 Bass     [Drop file]  [🔊] │
│  🎹 Synth    [Drop file]  [🔊] │
│  🎵 Other    [Drop file]  [🔊] │
├────────────────────────────────┤
│  ⚠️ Stems must be same length  │
│  [Sync all] [Clear stems]      │
└────────────────────────────────┘
```

### Playback Synchronization

All stems must start playing simultaneously using `AudioContext.currentTime` scheduling:

```javascript
function playStemsSync() {
    const startTime = ctx.currentTime + 0.1; // 100ms buffer
    audioElement.play(); // main audio
    Object.values(stems).forEach(stem => {
        if (stem.audioElement) {
            stem.audioElement.currentTime = audioElement.currentTime;
            stem.audioElement.play();
        }
    });
}
```

### Stem Data on AudioBus

Modes access stem data through:

```javascript
audio.stems.drums.bands.bass  // kick drum energy
audio.stems.drums.beat        // drum beat detection
audio.stems.bass.bands.sub    // isolated sub bass
audio.stems.synth.bands.mid   // synth mid frequency
audio.stems.synth.sirenRising // synth pitch sweep detection
```

This is the single biggest improvement for visual quality — being able to react to just the sub without being confused by snares, or react to the synth without the kick triggering it.

---

## 11. NEW FEATURE: INSTAGRAM RECORDING PIPELINE

### Resolution Presets

```javascript
const RECORDING_PRESETS = {
    'IG Reels (9:16)':   { w: 1080, h: 1920, bitrate: 8_000_000, fps: 30 },
    'IG Reels HD':       { w: 1080, h: 1920, bitrate: 16_000_000, fps: 60 },
    'IG Post (1:1)':     { w: 1080, h: 1080, bitrate: 8_000_000, fps: 30 },
    'YouTube (16:9)':    { w: 1920, h: 1080, bitrate: 20_000_000, fps: 60 },
    'YouTube 4K':        { w: 3840, h: 2160, bitrate: 40_000_000, fps: 60 },
    'TikTok':            { w: 1080, h: 1920, bitrate: 8_000_000, fps: 30 },
};
```

### Track Info Overlay (Text Burned Into Recording)

A WebGL-based text overlay that renders artist/track name directly into the scene — visible in recordings without touching the DOM:

```javascript
// Use canvas-based texture for text:
function createTextOverlay(artist, track) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    // Background fade:
    const grad = ctx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 200);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Inter, sans-serif';
    ctx.fillText(artist.toUpperCase(), 40, 80);
    ctx.font = '32px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(track, 40, 130);
    
    return new THREE.CanvasTexture(canvas);
}
```

This texture is placed on a plane that is a child of the camera (like the flash overlay) so it's always in frame and captured in recordings.

### Recording Quality Indicator

Show a real-time recording stats overlay during capture:
- Current duration
- Estimated file size
- Drop frame warnings (when frame time > 33ms)
- Format/resolution info

### Auto-Stop on Track End

Option to automatically stop recording when the audio track ends, then auto-download.

---

## 12. NEW FEATURE: POST-PROCESSING PIPELINE

### Pipeline Architecture

```
Scene Render ──► RenderTarget A
                     │
                     ├──► Threshold Filter ──► Horizontal Blur ──► Vertical Blur
                     │                                                    │
                     │◄───────────────── Bloom Composite ◄───────────────┘
                     │
                     ├──► Chromatic Aberration Pass
                     │
                     ├──► Glitch Pass (audio-triggered)
                     │
                     ├──► Film Grain Pass
                     │
                     ├──► Color Grading / LUT Pass
                     │
                     └──► Vignette Pass ──► Screen Output
```

### Audio-Reactive Pass Parameters

| Pass | Audio Input | Effect |
|---|---|---|
| Bloom Strength | `masterIntensity` | More bloom during drops |
| Bloom Threshold | `1 - dropDecay` | More glows as drop builds |
| Chromatic Aberration | `screechIntensity` | Splits during screech/siren |
| Glitch Intensity | `gunShotDetected` | Hard glitch on transient |
| Film Grain | `isCalm` | More grain in quiet sections |
| Vignette | `energy` | Wider vignette = more focus during drops |
| Saturation | `sectionIntensity` | Desaturate during breakdowns |

### Performance — Adaptive Quality

When frame time exceeds 20ms, automatically reduce:
1. Disable film grain (cheapest to skip)
2. Reduce blur kernel size
3. Reduce chromatic aberration resolution
4. Fall back to single-pass bloom

---

## 13. NEW FEATURE: SMART PRESETS SYSTEM

### Problem

GeometryForge has 42 parameters. Hyperforge has 60+. A user who just dropped a Svdden Death track and wants it to look insane immediately cannot tune 60 sliders. The current preset system requires manual creation.

### Built-In Named Presets Per Mode (Curated)

Each mode ships with 4–6 built-in named presets that are tuned specifically for different music subgenres:

```javascript
// Example: GeometryForge presets
GeometryForgeMode.presets = {
    'Tearout Nuclear': {
        shape: 'icosahedron', displaceMode: 'shatter', displaceAmount: 35,
        beatExplode: 4.5, beatSpinBurst: 2, bassBreath: 4, dropEffect: 'all',
        showWireframe: true, showSolid: true, solidOpacity: 0.15, wireOpacity: 1,
        colorPalette: 'void', vertexColorMode: 'displacement'
    },
    'Riddim Wobble': {
        shape: 'torusKnot', displaceMode: 'magnetic', displaceAmount: 20,
        beatExplode: 2, bassBreath: 3, autoRotateMode: 'beatLock',
        colorPalette: 'cyber', vertexColorMode: 'bands'
    },
    'Neurohop Fractal': {
        shape: 'gyroid', displaceMode: 'fractal', noiseOctaves: 5,
        displaceAmount: 25, beatExplode: 1.5, autoRotateMode: 'chaotic',
        colorPalette: 'nebula', vertexColorMode: 'plasma'
    }
};
```

### Global Music Mode Presets

A top-level "Music Type" selector that configures ALL parameters (global + mode + camera + effects) at once:

| Music Mode | Target Aesthetic | Sets |
|---|---|---|
| **Tearout Chaos** | Maximum chaos, gunshot reactions, extreme shake | All params at max, glitch on, chromatic max |
| **Riddim Pulse** | Locked groove, wobble-synced, minimal extra elements | Half-time lock, wobble LFO drive, clean palette |
| **Neurohop Flow** | Organic movement, complex fractals, dream-like | Slow params, high detail, fractal modes |
| **Dubstep Cinematic** | Epic, slow builds, massive drops | Cinematic camera, long trails, epic bloom |
| **Ambient Drift** | Gentle, evolving, low energy | All intensity at minimum, slow rotation |

### Auto-Pilot Mode

Based on the `audioBus.sectionType` and `audioBus.masterIntensity`, automatically adjust parameters:

```javascript
function autoPilot(audio, dt) {
    if (!autoPilotEnabled) return;
    
    // During buildup: slowly increase params toward max
    if (audio.isBuildingUp) {
        const ramp = audio.sectionProgress; // 0 to 1
        ParamSystem.set('beatExplode', lerp(currentBeatExplode, maxBeatExplode, ramp * 0.02));
        ParamSystem.set('screenShake', lerp(currentShake, maxShake, ramp * 0.01));
    }
    
    // On drop: snap to full chaos preset
    if (audio.sectionChanged && audio.sectionType === 'drop') {
        applyPreset('Tearout Nuclear');
    }
    
    // On breakdown: fade to calm preset
    if (audio.sectionChanged && audio.sectionType === 'breakdown') {
        applyPreset('Calm Drift', { transitionTime: 2.0 });
    }
}
```

---

## 14. NEW VISUAL MODES FOR TEAROUT

These are entirely new modes to add. Each is designed with the specific aesthetics of tearout/dubstep/riddim/neurohop in mind.

### NEW MODE 01: Bass Cannon

**Concept:** Concentric rings of energy that explode outward from the center on every sub hit. Pure, primal. The defining visual of heavy bass music.

**Core mechanic:**
- Every `audio.bassBeat` or `audio.gunShotDetected` spawns a new ring at the center
- Rings expand outward at a speed proportional to beat intensity
- Color shifts from white/yellow at center → purple/blue at edges (like a shockwave)
- During drop: rings layer on top of each other in rapid succession creating a wall of expanding energy
- Sub pressure drives a continuous "breathing" pulse between beats

**Why it goes viral:** Satisfying, universal, immediately readable even on small phone screens. The expanding ring = bass hit is the most intuitive visual language for heavy music.

---

### NEW MODE 02: Pixel Surgeon (Glitch Engine)

**Concept:** A real-time audio-reactive glitch effect engine. Data moshing, pixel sorting, block corruption — but controlled and beautiful rather than random chaos.

**Core mechanic:**
- **Pixel sorting**: Sort horizontal strips of the previous frame by luminance. Audio controls the strip height and sort distance.
- **Block glitch**: Randomly offset rectangular blocks of the image. `gunShotDetected` triggers hard block displacement.
- **Scanlines**: Old CRT-style scanlines that shimmer with treble content.
- **Color channel split**: Separate RGB channels drift apart based on `screechIntensity`.
- **Data mosh**: Repeat rows of data (frame corruption aesthetic) on drops.

**Technical implementation:** This mode operates on a `WebGLRenderTarget` — it first captures what another mode is rendering, then applies the glitch effects as a post-process on top. It becomes a "glitch layer" over any other mode.

**Why it goes viral:** The glitch aesthetic is massively popular in the music/visual art scene. When timed perfectly to drops and transients, it looks intentional and creative rather than broken.

---

### NEW MODE 03: Void Pressure

**Concept:** A dark, heavy, oppressive visual for maximum sub weight. Black space with particles that are crushed inward by sub bass and then violently expelled on drops.

**Core mechanic:**
- 15,000 particles arranged in a sphere, slowly rotating in dark space
- `audioBus.subPressure` compresses them toward the center (implosion)
- At a threshold, the compression triggers an explosion — particles scatter outward
- Gravity pulls them back. The cycle repeats with each bass hit.
- Color: near-black with deep red/purple edges. During explosion: brilliant white/cyan.
- Screen goes almost fully dark between beats — maximum contrast ratio.

**Why it goes viral:** The compression-explosion cycle is physically satisfying and maps perfectly to how riddim and tearout feel in your chest. Maximum dramatic contrast.

---

### NEW MODE 04: Neural Spiderweb

**Concept:** A neural network visualization where nodes light up and connections fire with the music.

**Core mechanic:**
- 200–500 nodes scattered in 3D space
- Connections between nearby nodes (< threshold distance)
- When a band has energy, nodes in that "region" light up and fire signals along connections
- `audioBus.bands.sub` drives the low nodes, `treble` drives high nodes
- On beat: a pulse propagates outward from the center node through all connections
- On drop: ALL nodes fire simultaneously — the whole web lights up white

**Technical note:** This mode can be implemented efficiently using instanced mesh for nodes and a pre-computed edge list for connections (no per-frame distance checks).

**Why it goes viral:** Neural imagery + music = perfect concept alignment for the music technology / AI-adjacent audience that listens to experimental bass music.

---

### NEW MODE 05: Liquid Sub

**Concept:** Metaball-style fluid that responds to sub bass and wobble. Viscous, heavy, organic.

**Core mechanic:**
- 5–20 metaball spheres of varying sizes, slowly orbiting each other
- `audioBus.smoothBands.sub` drives their scale — they grow on sub hits and shrink between
- `audioBus.wobbleLFO` drives a sine-wave oscillation in their positions
- Metaball surface rendered via raymarching GLSL shader in a screen-filling quad
- Color: deep red → orange on sub, cools to purple/blue between hits
- On drop: massive scale explosion, all balls merge into one giant mass then burst apart

**Technical implementation:** Raymarched metaballs in a fragment shader — all computation on GPU, no CPU geometry to manage.

**Why it goes viral:** Fluid/liquid visuals are inherently satisfying and the connection to bass weight is intuitive. The wobble sync creates a hypnotic effect.

---

### NEW MODE 06: Oscilloscope XY

**Concept:** Left channel on X axis, right channel on Y axis — Lissajous patterns like an analog oscilloscope. The sound DRAWS itself.

**Core mechanic:**
- Plot `timeDomainData[i]` (left channel) vs `timeDomainData[i + N/2]` (right channel)
- At 2048 sample points, this creates intricate parametric curves
- Color changes based on velocity — fast-moving points are bright, slow points are dim
- For stereo-mixed tearout music, the patterns are complex and chaotic during drops
- For monophonic synth notes, perfect Lissajous shapes emerge
- Add persistence/fade so previous frames ghost behind current

**Why it goes viral:** Oscilloscope mode is one of the most respected aesthetics in the music visualization community. The mathematical beauty of Lissajous patterns + audio = elite content. Channels like loeder and shadertoy artists get millions of views specifically for this aesthetic.

---

### NEW MODE 07: Fractal Zoom

**Concept:** Continuous zoom into a Mandelbrot/Julia set, with the zoom target and Julia parameters driven by audio.

**Core mechanic:**
- `fractalShader.js` already exists — this extends it with continuous zoom animation
- `audioBus.smoothBands.bass` controls zoom speed — faster zoom during intense moments
- `audioBus.wobblePhase` slowly rotates the Julia parameter in a circle
- On drop: extreme zoom acceleration — the fractal blurs into abstraction then snaps to a new location
- Color cycling at audio-reactive speed
- On beat: momentary color inversion

**Why it goes viral:** Fractal zoom content is already proven-viral on YouTube. Adding audio reactivity makes it fresh and unique. The infinite detail = infinite energy = perfect metaphor for tearout.

---

### NEW MODE 08: Geometry Storm

**Concept:** Hundreds of different geometric shapes flying through space in formation, reacting individually to different frequency bands.

**Core mechanic:**
- 200 small polyhedra, each assigned to a frequency bin
- Their scale reacts to their assigned bin's energy
- They orbit a central attractor point that shifts with the music
- On beat: all shapes snap to face the camera simultaneously then scatter
- On drop: chaotic scatter then snap back into formation
- Uses `THREE.InstancedMesh` for efficiency — all shapes in a single draw call

**Why it goes viral:** Ordered chaos — the snap-to-formation moments create extremely satisfying visual patterns.

---

### NEW MODE 09: Bass String Theory

**Concept:** Dimensional strings that vibrate and resonate with audio frequencies, inspired by string theory physics.

**Core mechanic:**
- 50–100 3D strings spanning the scene (thin tube geometries or line geometries)
- Each string has a resonant frequency — it vibrates more when audio energy is high in its range
- Strings are color-coded by frequency: red = sub, orange = bass, green = mid, blue = treble
- During drop: strings shatter into particles then reassemble
- Wobble creates a wave that travels along all strings simultaneously

---

### NEW MODE 10: Signal Interference

**Concept:** Multiple wave sources interfering with each other — constructive and destructive interference patterns visible in real-time.

**Core mechanic:**
- 3–7 point sources of waves on a 3D plane
- Each wave source frequency driven by a different audio band
- Interference pattern computed per-vertex
- High interference = bright point, zero = dark
- On beat: new wave source spawns at a random location with a burst amplitude
- On drop: all sources synchronize in phase — massive constructive interference creates a blinding peak

**Why it goes viral:** The physics are real and beautiful. Patterns emerge from simplicity. The connection between audio waves and visual waves is literal, not metaphorical.

---

## 15. SETTINGS PANEL REDESIGN

### Current Problem

The current params panel is a flat list of ALL parameters for the active mode — 60+ sliders for Hyperforge. Users are overwhelmed and can't find what matters.

### Proposed Structure

#### Tab 1: QUICK (Most Impactful Parameters)

Always shows only the 3–5 parameters that have the biggest visual impact for the current mode. Curated per mode.

```javascript
// Each mode defines its "hero params":
GeometryForgeMode.quickParams = ['displaceMode', 'displaceAmount', 'colorPalette', 'beatExplode', 'dropEffect'];
HyperforgeMode.quickParams = ['outerSurface', 'attractorType', 'colorMode', 'displaceAmt', 'beatExplode'];
```

#### Tab 2: AUDIO (Audio Reactivity Controls)

All parameters related to how audio drives the visuals — reactivity, beat response, drop behavior. Universal across modes.

#### Tab 3: VISUAL (Appearance Controls)

Shape, color, opacity, size, render mode. What it looks like statically.

#### Tab 4: MOTION (Animation Controls)

Rotation, speed, physics, trails. How it moves.

#### Tab 5: ADVANCED (Everything Else)

All remaining parameters for power users. Hidden by default.

### Global Settings Modal (New)

Separate from the params panel — a proper settings page for:

```
DISPLAY
  Canvas Format: [Landscape] [Portrait] [Square] [Custom]
  Resolution: [HD] [Full HD] [4K]
  Pixel Ratio: [1x] [2x] [Auto]

PERFORMANCE
  GPU Budget: [Low] [Medium] [High] [Ultra]
  Particle Cap: [slider]
  Target FPS: [30] [60]

RECORDING
  Format: [IG Reels] [YouTube] [Custom]
  Quality: [Good] [High] [Maximum]
  Audio: [Include] [Mute]
  Watermark: [text input] [position]

AUDIO
  FFT Size: [2048] [4096] [8192]
  Sub Boost: [slider]
  Beat Sensitivity: [slider]
  BPM Override: [slider]

POST-PROCESSING
  Bloom: [toggle] [intensity] [threshold]
  Chromatic Aberration: [toggle] [amount]
  Glitch: [toggle] [intensity]
  Film Grain: [toggle] [amount]
  Vignette: [toggle] [amount]
  Color Grade: [dropdown of LUTs]
```

---

## 16. PER-MODE DEEP AUDIT

### GeometryForge (geometryShapes.js)

**Issues:**
- Ghost trail system uses an array of `ghosts` with individual meshes — expensive. Should use a single multi-segment line with fading alpha.
- `morphTargetBase` and the morph system stores a full vertex buffer copy during morphing — could be a uniform blend factor instead.
- 30 shape options but `menger` and `calabi` are mathematically very expensive (fractal/Calabi-Yau manifold approximations). Should carry a performance warning.
- `rotSpeedX/Y/Z` vs `autoRotateMode` — there's an implicit conflict where `autoRotateMode = 'beatLock'` ignores the individual speed sliders but they're still shown.

**What to keep:** Ghost trails, particle system, mirror copies, vertex colors, all displacement modes.

**What to improve:** Real ghost trails using geometry morphTargets + opacity buffer. Convert morph to GPU-side.

---

### Hyperforge (hyperforge.js)

**Issues:**
- `attractorSystem` with 8000 particles uses per-particle velocity objects stored in an array `attractorVelocities: []` which mixes typed and untyped memory.
- `smoothSfM, smoothSfN1, smoothSfN2, smoothSfN3` are instance properties on the mode object but also params — there's a double tracking issue.
- The `lastRebuildTime` / `lastSfParams` guard to prevent per-frame surface rebuilds is good practice — this should be the model for DnaHelix and Möbius to copy.
- `flowVelocities: []` — same typed/untyped mixing as attractor velocities.

**Convert:** `attractorVelocities` and `flowVelocities` to `Float32Array` with stride-3 layout.

---

### DnaHelix (dnaHelix.js)

**Critical fix needed:** Full geometry rebuild every frame.

**Proposed fix architecture:**
```javascript
init(scene, camera) {
    // Pre-allocate all buffers:
    const maxRes = 1000;
    this._helixPositions = []; // one Float32Array per helix
    this._helixGeos = []; // one BufferGeometry per helix
    this._helixLines = []; // one Line per helix
    for (let h = 0; h < 4; h++) { // max 4 helixes
        const pos = new Float32Array(maxRes * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.LineBasicMaterial({ ... });
        const line = new THREE.Line(geo, mat);
        line.visible = false;
        scene.add(line);
        this._helixPositions.push(pos);
        this._helixGeos.push(geo);
        this._helixLines.push(line);
    }
}

update(audio, params, dt) {
    const helixCount = Math.min(4, Math.floor(params.helixCount || 2));
    const res = Math.min(1000, Math.floor(params.resolution || 400));
    // Update positions in place — NO dispose/recreate:
    for (let h = 0; h < 4; h++) {
        this._helixLines[h].visible = h < helixCount;
        if (h >= helixCount) continue;
        const pos = this._helixPositions[h];
        for (let i = 0; i < res; i++) {
            // ... compute x, y, z
            pos[i * 3] = x;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = z;
        }
        this._helixGeos[h].setDrawRange(0, res);
        this._helixGeos[h].attributes.position.needsUpdate = true;
    }
}
```

---

### MobiusRings (mobiusRings.js)

**Critical fix needed:** Geometry rebuild every ring every frame.

**Fix:** Only rebuild when geometry-affecting params change:

```javascript
update(audio, params, dt) {
    const count = Math.floor(params.ringCount || 3);
    if (count !== this.rings.length) this.buildRings(count);
    
    // Cache last geometry params:
    const geoKey = `${params.radius}_${params.tubeRadius}_${params.segments}_${Math.round(params.twist * 10)}`;
    if (geoKey !== this._lastGeoKey) {
        this._lastGeoKey = geoKey;
        this.rings.forEach((ring, i) => {
            ring.geometry.dispose();
            ring.geometry = this.createMobiusGeometry(params.radius, params.tubeRadius, params.segments, params.twist);
        });
    }
    // Everything else: just update rotation, color, opacity — no geometry changes:
    this.rings.forEach((ring, i) => {
        ring.rotation.x = ...;
        ring.material.color.copy(ParamSystem.getColorThreeHSL(t + bass * 0.3)); // in-place copy, not assignment
        ring.material.opacity = ...;
    });
}
```

---

### ShaderTunnel (shaderTunnel.js)

**Fix the GLSL loop break issue.** Otherwise this mode is architecturally excellent — it's the right approach (fullscreen shader for tunnel visuals).

**Enhancement:** Add an audio-reactive raymarched SDF version of the tunnel that shows actual geometry in 3D rather than a flat-mapped UV projection. Would look significantly more dimensional.

---

### Spectrogram (spectrogram.js)

**Fix:** Replace `historyBuffer` push/shift with a typed ring buffer.

**Enhancement:** The 3D waterfall mode (`3DWaterfall`) is already implemented but the `build3DMesh` call uses `this.plane.parent` — store the scene reference in `init()` instead.

**Enhancement:** Add a "bass focus" mode that zooms the frequency axis to just 20–300Hz for sub-heavy tearout music, giving much more detail in the low end.

---

### TerrainMesh (terrainMesh.js)

**Remove:** `computeVertexNormals()` call (BUG-09).

**Fix:** `this.mesh.parent.fog` should be `this._scene.fog`.

**Enhancement:** The `dropFissure` effect (cracks appearing on drops) is a great idea. Make it more dramatic — actual dark crack lines that spread across the terrain on drop entry.

---

### Aurora (aurora.js)

**Fix:** The three declared-but-unimplemented params (`magneticLines`, `rayShots`, `polarParticles`) should either be implemented or removed.

**Enhancement:** `magneticLines` would actually look incredible for tearout — field lines that arc between two poles, bending dramatically with bass energy. Implement as 20–50 Catmull-Rom spline curves that deform with audio.

---

### Nebula (nebula.js)

**Fix:** `getColorThreeHSL` singleton assignment.

**Enhancement:** `pulsarJets` (declared but underimplemented) should emit actual jet geometry — two opposing cone-shaped particle streams that pulse with the music. During drops, the jets extend to fill the screen.

---

## 17. IMPLEMENTATION ROADMAP

### Phase 1: Critical Fixes (Do These Now — 1–2 Days)

These are bugs that actively hurt the visual quality or cause crashes. Fix before anything else.

1. **BUG-02** — Fix `getColorThreeHSL` singleton in `mobiusRings.js`, `nebula.js`, `dnaHelix.js`
2. **BUG-03** — Fix `DnaHelixMode` geometry rebuild (convert to buffer update)
3. **BUG-04** — Fix `MobiusRingsMode` geometry rebuild (cache param key)
4. **BUG-05** — Set `analyser.smoothingTimeConstant = 0.0`, keep manual smoothing
5. **BUG-09** — Remove `computeVertexNormals()` from TerrainMesh
6. **BUG-13** — Replace `alert()` with toast notification
7. **DEAD-07** — Remove the three stub params from Aurora

**Estimated visual quality improvement: +30%** (bloom still fake, but drops will hit harder and colors will be correct)

---

### Phase 2: Bloom + Post-Processing (2–3 Days)

8. Implement real 2-pass Gaussian bloom (Section 8)
9. Implement chromatic aberration pass
10. Implement global glitch pass (audio-triggered)
11. Wire all passes to audio reactivity

**Estimated visual quality improvement: +50%** (this changes everything — glowing neon visuals instead of flat colors)

---

### Phase 3: Vertical Mode + Recording (1–2 Days)

12. Implement canvas format selector (portrait/landscape/square) (Section 9)
13. Implement recording quality presets (Section 11)
14. Implement track name overlay texture (Section 11)
15. Auto-stop recording on track end

**Instagram readiness: NOW POSSIBLE** — you can record proper Reels format.

---

### Phase 4: Performance (1–2 Days)

16. **BUG-06** — Replace `reduce()` with running sums
17. **BUG-07** — Replace all history arrays with ring buffers
18. **BUG-08** — Pre-allocate shared params object
19. **PERF-02** — Spatial hashing for ParticleStorm connections
20. Upgrade Three.js to r164+

---

### Phase 5: Smart Presets + UX (2–3 Days)

21. Built-in presets per mode (Section 13)
22. Global music type presets (Section 13)
23. Settings panel tab redesign (Section 15)
24. Auto-pilot mode (Section 13)
25. Global settings modal

---

### Phase 6: New Modes (Ongoing — 1 Day Each)

26. Bass Cannon mode
27. Pixel Surgeon / Glitch Engine mode
28. Void Pressure mode
29. Oscilloscope XY mode
30. Liquid Sub (metaballs) mode
31. Neural Spiderweb mode
32. Fractal Zoom mode
33. Signal Interference mode

---

### Phase 7: Multi-Track Stems (3–5 Days)

34. Multi-track audio engine (Section 10)
35. Stem mixer UI
36. Sync playback system
37. All modes updated to read `audio.stems.*`

---

### Phase 8: Audio Engine Deep Work (2–3 Days)

38. Per-band attack/release smoothing (AUDIO-01)
39. Dedicated ultraSub band (AUDIO-02)
40. Half-time beat detection (AUDIO-03)
41. Sub pressure bus property (AUDIO-04)
42. Transient sharpness score (AUDIO-06)

---

### Priority Summary for Instagram Virality

If you only have time for ONE phase: **Do Phase 2 (Bloom)**. Real glow transforms the visual quality more than any other single change.

If you have time for TWO phases: **Phase 2 + Phase 3 (Vertical Mode)**. Now you have beautiful glowing visuals in Reels format.

If you have time for THREE phases: **Phase 2 + Phase 3 + Phase 5 (Smart Presets)**. Now you can quickly set up a perfect look without tuning 60 sliders.

With all phases complete, AURA becomes a genuinely professional-grade, Instagram-native tearout visual generator that no competitor currently offers at the quality level this codebase is capable of producing.

---

## APPENDIX: AUDIO BUS REFERENCE (After Improvements)

### New Properties to Add

```javascript
// Sub pressure (new):
audioBus.ultraSubBands.raw     // 0-32 Hz instant
audioBus.ultraSubBands.smooth  // smoothed
audioBus.subPressure           // weighted sub pressure score

// Half-time:
audioBus.halfTimeBeat          // boolean
audioBus.halfTimeBeatIntensity // 0-1

// Transient sharpness:
audioBus.transientSharpness    // high = percussive, low = sustained

// Stems (if loaded):
audioBus.stems.drums.bands.*
audioBus.stems.bass.bands.*
audioBus.stems.synth.bands.*
audioBus.stems.other.bands.*
```

### Recommended Audio-to-Visual Mappings for Tearout

| Visual Effect | Audio Source | Notes |
|---|---|---|
| Scale explosion | `gunShotDetected + gunShotIntensity` | Snap to max scale, fast decay |
| Sub pulse (concentric rings) | `rawBands.sub` | Unsmoothed for maximum punch |
| Wobble deform | `wobbleLFO * wobbleIntensity` | Smooth wave, use phase not binary |
| Screech chromatic split | `screechIntensity` | Ramp up during screech, snap at drop |
| Siren pitch color | `sirenFrequency` | Map frequency to hue |
| Drop camera shake | `isDropSection + dropSectionIntensity` | Beat-locked, not continuous |
| Background color temp | `colorTemp` (marker-driven) | Smooth lerp between temperatures |
| Beat morph | `halfTimeBeat` | Half-time for weight, full for energy |
| Bloom threshold | `masterIntensity` | More bloom = more energy |
| Trail length | `sectionEffects.speed` | Longer trails in breakdowns |

---

*Document compiled after full source audit of all 18 uploaded mode files plus core engine files (audio.js, visuals.js, ui.js, params.js, markers.js, recorder.js, app.js, index.html, style.css).*

*Total lines of code reviewed: ~12,000*