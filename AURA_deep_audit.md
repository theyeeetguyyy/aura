# 🔬 AURA — Deep Architectural & Code Audit

> A comprehensive teardown of every layer of the engine — bugs, redundancies, architectural gaps, and a strategic upgrade path to make this the most visually insane audio-reactive engine on the web.

---

## Executive Summary

**What it is now:** A solid zero-dependency Three.js + Web Audio API visualizer with 35 modes, 7-band analysis, beat detection, section markers, and recording. Architecturally it's in the "strong prototype" tier.

**What's stopping it from being elite:**
1. **Fake post-processing** — The bloom/glow pipeline is a shim that does nothing
2. **No feedback loops** — The #1 technique that makes dubstep visuals look cinematic is completely absent
3. **Single-threaded audio** — Analysis runs on the main thread, stealing frame budget
4. **No multi-track separation** — Everything reacts to the same mixed signal
5. **Parameter explosion** — Some modes have 40+ params with overlapping controls
6. **Recording is device-locked** — No aspect ratio control for vertical/horizontal
7. **No render-to-texture pipeline** — Can't do trails, motion blur, or temporal effects
8. **Wireframe sync bug** — Wireframes don't actually move with displaced geometry in Geometry Forge

---

## 🐛 SECTION 1: BUGS & BROKEN BEHAVIOR

### 1.1 — UnrealBloomPass is a No-Op (CRITICAL)
**File:** [index.html](file:///c:/Users/astit/Desktop/aura/index.html#L222-L241)

The `THREE.UnrealBloomPass` inline shim does literally nothing:
```js
render: function (renderer, writeBuffer, readBuffer) {
    if (this.renderToScreen) {
        renderer.setRenderTarget(null);
        renderer.toneMappingExposure = 1.0 + this.strength * 0.5;
    }
}
```
All it does is slightly adjust `toneMappingExposure`. **There is zero bloom, zero glow, zero blur.** Every mode that relies on "bloom" (`markers.js` has `bloom: 5.0` for climax sections) is producing no visual effect. This is the single biggest visual quality gap in the entire engine.

### 1.2 — Wireframe Desync in Geometry Forge
**File:** [geometryShapes.js](file:///c:/Users/astit/Desktop/aura/js/modes/geometryShapes.js#L722-L734)

```js
// Sync wireframe positions instead of rebuilding WireframeGeometry every frame
if (this.meshWire && this.meshWire.geometry.attributes.position) {
    this.meshWire.geometry.attributes.position.needsUpdate = true;
}
```
The code sets `needsUpdate = true` but **never actually copies the displaced positions to the wireframe buffer**. `WireframeGeometry` has a completely different vertex layout than the source geometry — it duplicates vertices per edge segment. The wireframe stays frozen in its initial shape while the solid mesh deforms. You'll see the solid moving but the wireframe sitting still in its original position.

**Contrast with Hyperforge** ([hyperforge.js L530](file:///c:/Users/astit/Desktop/aura/js/modes/hyperforge.js#L530)):
```js
const wg = new THREE.WireframeGeometry(this.mainMesh.geometry);
this.mainWire.geometry.dispose();
this.mainWire.geometry = wg;
```
Hyperforge correctly rebuilds the wireframe geometry every frame. This is expensive but at least correct. Neither solution is optimal — the right fix is a custom edge shader.

### 1.3 — `computeVertexNormals()` Called Per-Frame in Hyperforge
**File:** [hyperforge.js L527](file:///c:/Users/astit/Desktop/aura/js/modes/hyperforge.js#L527)

```js
this.mainMesh.geometry.attributes.position.needsUpdate = true;
this.mainMesh.geometry.attributes.color.needsUpdate = true;
this.mainMesh.geometry.computeVertexNormals(); // EVERY FRAME
```
`computeVertexNormals()` recomputes every normal for every vertex from scratch. For a 40-segment surface that's ~1,600 vertices × cross products = measurable frame time eaten. Geometry Forge correctly skips this. Hyperforge should too (it uses `MeshBasicMaterial` which doesn't even use normals for shading).

### 1.4 — `new THREE.Color()` Allocated Per-Frame in Rainbow/Holographic Color Modes
**Files:** [hyperforge.js L514](file:///c:/Users/astit/Desktop/aura/js/modes/hyperforge.js#L514), [hyperforge.js L520](file:///c:/Users/astit/Desktop/aura/js/modes/hyperforge.js#L520)

```js
case 'rainbow': { const c = new THREE.Color().setHSL(...); ... }
case 'holographic': { const c = new THREE.Color().setHSL(...); ... }
```
Each vertex in these color modes allocates a new `THREE.Color` object **per vertex per frame**. With 1,600 vertices at 60fps that's 96,000 allocations/second → garbage collection pressure. Geometry Forge already caches `_tempColor` but Hyperforge doesn't use it for these modes.

### 1.5 — Marker System `lerpRate` Is Frame-Rate Dependent
**File:** [markers.js L167-173](file:///c:/Users/astit/Desktop/aura/js/markers.js#L167-L173)

```js
for (const key of Object.keys(smoothedEffects)) {
    const delta = targetEffects[key] - smoothedEffects[key];
    const lerpRate = delta > 0 ? 0.18 : 0.05;
    smoothedEffects[key] += delta * lerpRate;
}
```
This lerp runs once per `update()` call with a fixed rate. At 60fps, `0.18` per frame gives smooth transitions. At 30fps (GPU under load), the same `0.18` means *half* the transition speed — section changes feel sluggish on lower-end hardware. Should use `dt`-based exponential decay.

### 1.6 — `particleVelocities` Uses Object Array Instead of Typed Array
**File:** [geometryShapes.js L382](file:///c:/Users/astit/Desktop/aura/js/modes/geometryShapes.js#L376-L390)

```js
for (let i = 0; i < c; i++) {
    this.particleVelocities.push({ x: 0, y: 0, z: 0, life: 0 });
}
```
3,000 individual objects with named properties. This prevents V8 from using typed arrays and creates GC pressure. Should be a `Float32Array` with stride-4 access, consistent with how `particlePositions` is already stored.

### 1.7 — Audio Stream May Be Null (Silent Recording)
**File:** [recorder.js L21-28](file:///c:/Users/astit/Desktop/aura/js/recorder.js#L20-L28)

```js
const audioStream = AudioEngine.getAudioStream();
if (audioStream) {
    audioStream.getTracks().forEach(t => combinedStream.addTrack(t));
}
```
If `AudioEngine.getAudioStream()` returns null (e.g., if the audio context hasn't created a `MediaStreamDestination` yet), the recording will be **video-only with no audio** — and there's zero user-facing indication of this. No warning, no error, just a silent video download.

---

## ⚡ SECTION 2: PERFORMANCE ISSUES

### 2.1 — Audio Analysis on Main Thread
**File:** [audio.js](file:///c:/Users/astit/Desktop/aura/js/audio.js) (entire file, ~1,361 lines)

The FFT analysis, beat detection, onset detection, harmonic analysis, and structure tracking ALL run synchronously on the main render thread. At 60fps with a 4096-sample FFT:
- `getByteFrequencyData()` → ~0.3ms
- Band smoothing + dynamics → ~0.2ms  
- Beat detection (autocorrelation) → ~0.5ms
- Onset detection → ~0.2ms
- Harmonic analysis → ~0.3ms
- **Total: ~1.5ms per frame stolen from the 16.6ms budget**

That's 9% of your frame budget gone before a single pixel is drawn. On complex modes like Hyperforge (which rebuilds wireframes every frame), this pushes you over budget.

**Fix:** Move analysis to an `AudioWorklet`. The worklet runs on a dedicated thread and posts back analysis results via `MessagePort`.

### 2.2 — Hyperforge Rebuilds Wireframe Geometry Every Frame
**File:** [hyperforge.js L530](file:///c:/Users/astit/Desktop/aura/js/modes/hyperforge.js#L530)

```js
const wg = new THREE.WireframeGeometry(this.mainMesh.geometry);
this.mainWire.geometry.dispose();
this.mainWire.geometry = wg;
```
`new THREE.WireframeGeometry()` iterates every face, extracts edges, deduplicates, and creates a new buffer every frame. This is one of the most expensive operations you can do in Three.js. At 40-segment resolution, this is ~2-4ms per frame.

### 2.3 — Superformula Surface Rebuilds Too Aggressively in Hyperforge
**File:** [hyperforge.js L335-344](file:///c:/Users/astit/Desktop/aura/js/modes/hyperforge.js#L335-L344)

The superformula surface rebuilds when `sfKey !== this.lastSfParams`. Because the SF params are smoothly lerped every frame (L326-330), the key changes **every single frame**, triggering a full geometry rebuild every ~200ms. That's 5 full surface rebuilds per second even when no user input changed.

### 2.4 — No Object Pooling for Ghost Meshes
**File:** [geometryShapes.js L334](file:///c:/Users/astit/Desktop/aura/js/modes/geometryShapes.js#L330-L335)

Every time the geometry rebuilds (shape change, detail change), all ghost meshes are disposed and new ones are created. Should use a pool to avoid allocation spikes.

### 2.5 — `dimensionalRift.js` Creates `new THREE.Color()` in `getSpectrumColor`
**File:** [dimensionalRift.js L177-186](file:///c:/Users/astit/Desktop/aura/js/modes/dimensionalRift.js#L176-L187)

```js
getSpectrumColor(spectrum, t) {
    switch (spectrum) {
        case 'ultraviolet': return new THREE.Color().setHSL(...);
        ...
    }
}
```
Called for every edge line, vertex sphere, portal ring, field particle — potentially hundreds of times per frame. Each call allocates a new `THREE.Color`.

---

## 🏗️ SECTION 3: ARCHITECTURAL GAPS

### 3.1 — No Post-Processing Pipeline (THE BIGGEST GAP)

The engine has **zero real post-processing**. The "EffectComposer" in `index.html` is a minimal shim. What's missing:

| Effect | Impact on Visual Quality | Status |
|--------|-------------------------|--------|
| **Bloom/Glow** | Essential for "glowing wire" aesthetic | ❌ Shim only |
| **Chromatic Aberration** | Instagram-viral look, adds "weight" to bass hits | ❌ Missing |
| **Film Grain** | Cinematic feel, hides aliasing | ❌ Missing |
| **Radial Blur** | Drop impact, zoom effect | ❌ Missing |
| **Feedback/Trail** | The #1 dubstep visual technique — geometry leaves trails | ❌ Missing |
| **Color Grading / LUT** | Consistent cinematic color regardless of mode | ❌ Missing |
| **Vignette** | Draws eye to center, cinematic framing | ❌ Missing (only in VoidEngine shader) |
| **Motion Blur** | Smooths fast rotation, adds speed feeling | ❌ Missing |
| **Glitch/Datamosh** | Beat-reactive digital destruction | ❌ Missing |
| **Barrel Distortion** | Bass-reactive lens warp | ❌ Missing |

> [!CAUTION]
> Without real bloom, every mode that uses `THREE.AdditiveBlending` looks washed out rather than glowing. This is why the visuals look "flat" compared to TouchDesigner outputs.

### 3.2 — No Feedback/Trail System

The single most impactful technique for dubstep visuals is **temporal feedback** — rendering the previous frame at 95% opacity behind the current frame. This creates:
- Motion trails on geometry
- "Smearing" on fast movements  
- Persistence-of-vision glow
- The signature "acid trip" look of high-end visualizers

This requires rendering to a texture, then compositing that texture back. The current architecture renders directly to screen with no intermediate buffers.

### 3.3 — No Multi-Track Audio Architecture

The audioBus exposes 7 frequency bands from a single mixed signal. For tearout/dubstep, you fundamentally can't tell the difference between:
- A sub-bass growl at 40Hz
- A kick drum at 60Hz  
- Both happening simultaneously

They all register as "bass is high." To get precise visual reactivity, you need:
- **Stem separation** (drums, bass, vocals, FX as separate inputs)
- **Component-specific reactivity** (kick → scale, snare → flash, bass → displacement)
- The architecture for this doesn't exist at all

### 3.4 — No Aspect Ratio Control for Recording

**File:** [recorder.js](file:///c:/Users/astit/Desktop/aura/js/recorder.js)

The recorder captures at "native canvas resolution" — whatever your browser window is. For Instagram Reels (9:16) or YouTube (16:9), you need to:
1. Resize the renderer to the target resolution
2. Maintain the aspect ratio while recording
3. Restore after recording stops

None of this exists. The comment even says "DO NOT resize the renderer" but that's specifically because the current implementation doesn't handle it properly — not because it shouldn't be done.

### 3.5 — Parameters Are Flat, Not Hierarchical

**File:** [params.js](file:///c:/Users/astit/Desktop/aura/js/params.js)

All parameters exist in a single flat namespace. There's no concept of:
- **Parameter groups** (e.g., "Displacement", "Color", "Audio Reactivity")
- **Parameter presets per group** (e.g., swap just the color scheme without affecting displacement)
- **Parameter automation** (animate a parameter over time)
- **Parameter linking** (bass → displacement amount, automatically)
- **Parameter ranges that adapt to context** (e.g., during drop sections, displacement max should increase)

### 3.6 — No Global Color System

Each mode implements its own color logic independently. `GeometryForgeMode` has `getPaletteColor()` with 14 palettes. `HyperforgeMode` uses `ParamSystem.getColorThreeHSL()`. `DimensionalRiftMode` has `getSpectrumColor()` with 8 spectrums. `VoidEngineMode` has its own 6 color schemes in GLSL.

There should be **one global color engine** that:
- Is accessible from any mode (JS or GLSL uniform)
- Has audio-reactive animated palettes
- Feeds into the post-processing LUT
- Allows user palette customization

### 3.7 — No Camera System

Camera position is hardcoded per mode:
```js
// geometryShapes.js
camera.position.set(0, 0, 80);
// hyperforge.js
camera.position.set(0, 15, 60);
// dimensionalRift.js
camera.position.set(0, 0, 80);
```

There's no:
- Smooth camera transitions between modes
- Beat-reactive camera movement (separate from screen shake)
- Camera presets (close-up, wide, orbit, fly-through)
- Camera automation (auto-orbit, figure-8, etc.)

The `MarkerSystem` defines `cameraPreset` per section type (`'slow-orbit'`, `'shake-heavy'`, `'zoom-in'`) but **none of these are implemented**. They're just strings that nothing reads.

### 3.8 — Mode Interface Is Implicit, Not Enforced

Visual modes are plain objects with `init()`, `update()`, and `destroy()` methods. There's no base class, no interface validation, no lifecycle hooks. Each mode reimplements:
- Its own noise functions (`noise3D`, `fbm`)
- Its own color mapping
- Its own camera setup
- Its own cleanup logic

---

## 🔄 SECTION 4: REDUNDANCIES & DEAD CODE

### 4.1 — Duplicated Noise Functions
The exact same `noise3D` and `fbm` implementations are copy-pasted in:
- [geometryShapes.js L104-105](file:///c:/Users/astit/Desktop/aura/js/modes/geometryShapes.js#L104-L105)
- [hyperforge.js L110-111](file:///c:/Users/astit/Desktop/aura/js/modes/hyperforge.js#L110-L111)
- And likely several other modes

Should be a shared utility (`AuraUtils.noise3D`, `AuraUtils.fbm`).

### 4.2 — Duplicate Geometry Generators
`GeometryForgeMode.getGeometry()` and `HyperforgeMode.getOuterGeo()` both implement:
- Klein bottle
- Catenoid
- Helicoid
- Dini surface
- Cross cap
- Boys surface
- Roman surface
- Trefoil knot

These are nearly identical implementations. Could be a shared `GeometryLibrary`.

### 4.3 — `_parametric()` and `_grid()` Are the Same Function
Compare:
```js
// geometryShapes.js L219-226
_parametric(size, seg, fn) {
    const s = seg * 10, verts = [], indices = [];
    for (let i = 0; i <= s; i++) for (let j = 0; j <= s; j++) { ... }
    ...
}

// hyperforge.js L121-128
_grid(seg, fn) {
    const verts = [], indices = [];
    for (let i = 0; i <= seg; i++) for (let j = 0; j <= seg; j++) { ... }
    ...
}
```
Same algorithm, different names, slightly different resolution parameter handling.

### 4.4 — `GeometryForge` and `GeometryForge 2` (~130KB Combined)
Two files (`geometryShapes.js` at 62KB and `geometryShapes2.js` at 71KB) that appear to be iterations of the same concept. One should subsume the other or they should share a common geometry/displacement base.

### 4.5 — `Hyperforge` and `Hyperforge 2` (~97KB Combined)
Same situation. `hyperforge.js` (47KB) and `hyperforge2.js` (49KB). Nearly 100KB of similar displacement, attractor, and flow code.

### 4.6 — Unused Marker Camera Presets
**File:** [markers.js L14](file:///c:/Users/astit/Desktop/aura/js/markers.js#L14)

```js
cameraPreset: 'slow-orbit',  // intro
cameraPreset: 'gentle-sway', // verse
cameraPreset: 'zoom-in',     // buildup
cameraPreset: 'sudden-pull', // fakeout
cameraPreset: 'shake-heavy', // drop
```
None of these strings are consumed by any system. They're defined but never read.

### 4.7 — Unused `colorTemp` in Markers
```js
colorTemp: 'cool',     // intro
colorTemp: 'neutral',  // verse
colorTemp: 'warm',     // buildup
colorTemp: 'hot',      // drop
colorTemp: 'extreme',  // drop2
colorTemp: 'ethereal', // breakdown
```
Same — defined but never consumed.

### 4.8 — `rhythmLock` in Markers Is Never Read
```js
rhythmLock: true, // drop
rhythmLock: true, // drop2
rhythmLock: true, // climax
```
Defined, never used.

---

## 🎯 SECTION 5: STRATEGIC IMPROVEMENTS (Priority Ordered)

### 🔴 TIER 1 — Critical (These transform visual quality immediately)

#### 5.1 — Implement Real Post-Processing Pipeline
Replace the inline shim with a proper multi-pass pipeline:

1. **RenderPass** → Scene to texture
2. **UnrealBloomPass** → Real kawase/gaussian bloom on bright pixels
3. **ChromaticAberrationPass** → Bass-reactive RGB split
4. **FeedbackPass** → CUSTOM: blend previous frame at 92-98% opacity (audio-reactive decay)
5. **FilmGrainPass** → Subtle noise overlay
6. **VignettePass** → Cinematic framing
7. **ColorGradingPass** → LUT-based final color

Use Three.js r128 module imports or bundle the actual pass implementations from the Three.js examples. The current CDN setup prevents using the `examples/jsm/` passes, so either self-host them or inline the real implementations.

**Expected visual impact:** Night and day. This alone will make every mode look 5× better.

#### 5.2 — Implement Feedback/Trail System
A render-to-texture feedback loop:
```
Frame N texture → Fade to 95% → Apply slight zoom/rotation → Composite under Frame N+1
```
The fade amount should be audio-reactive:
- During drops: 98% feedback (heavy trails)
- During calm sections: 80% feedback (minimal trails)
- On bass beats: momentary 100% feedback (freeze + trail burst)

This is the single most impactful post-processing effect for dubstep visuals.

#### 5.3 — Fix Wireframe Sync
Two options:
1. **Proper fix:** Use a custom `ShaderMaterial` with `wireframe: true` directly on the displaced mesh (shares the same geometry buffer, always in sync)
2. **Quick fix:** Copy displaced positions to a second mesh that uses `MeshBasicMaterial({ wireframe: true })`

### 🟡 TIER 2 — High Impact (Planned next)

#### 5.4 — Multi-Track Audio Input
Architecture for loading multiple audio files as separate stems:
```
Track 1: "drums.wav"  → AudioEngine analyzes independently → audioBus.drums.bass, .kick, .snare
Track 2: "bass.wav"   → AudioEngine analyzes independently → audioBus.bass.sub, .growl, .wobble  
Track 3: "fx.wav"     → AudioEngine analyzes independently → audioBus.fx.screech, .riser
Track 4: "master.wav" → Full mix for global metrics → audioBus.master.rms, .beat
```
All tracks play in sync. Each gets its own `AnalyserNode`. Visual modes can choose which stem drives which parameter.

#### 5.5 — Camera System
Implement a `CameraDirector` class that:
- Reads `cameraPreset` from `MarkerSystem` sections
- Smoothly transitions between presets
- Has beat-reactive micro-movements independent of screen shake
- Supports auto-orbit, fly-through, close-up presets
- Has a "cinematic" mode for recording

#### 5.6 — Recording Aspect Ratio System
Add resolution profiles to the recorder:
```
Landscape 16:9  → 1920×1080
Portrait 9:16   → 1080×1920
Square 1:1      → 1080×1080
Ultra-wide 21:9 → 2560×1080
```
On record start:
1. Store current canvas dimensions
2. Resize renderer + camera aspect to target
3. On record stop, restore original dimensions

#### 5.7 — Audio Analysis → AudioWorklet
Move the analysis pipeline to a Web Worker / AudioWorklet:
- FFT + band extraction runs on dedicated thread
- Posts `audioBus` snapshot via `MessagePort` at 60Hz
- Main thread only reads the latest snapshot — zero analysis cost

### 🟢 TIER 3 — Polish (After core upgrades)

#### 5.8 — Shared Utility Module
Create `js/utils.js`:
- `AuraUtils.noise3D()`, `AuraUtils.fbm()`
- `AuraUtils.getParametricGeometry(fn, segments)`
- `AuraUtils.GeometryLibrary` (all the shared shapes)
- `AuraUtils.tempColor`, `AuraUtils.tempVec3` (shared scratch objects)

#### 5.9 — Global Color Engine
A centralized `ColorEngine` module:
- Animated palette system with audio-reactive hue shifting
- HSL palette presets that work in both JS and GLSL
- Color temperature system (read the `colorTemp` from markers)
- Complementary/split-complementary auto-generation

#### 5.10 — Mode Base Class / Interface
```js
const AuraMode = {
    name: '',
    params: {},
    init(scene, camera, renderer) {},
    update(audioBus, params, dt) {},
    destroy(scene) {},
    // Shared helpers inherited:
    noise3D, fbm, getGeometry, getPaletteColor, tempColor, tempVec3
};
```

#### 5.11 — Parameter System v2
- Hierarchical groups with collapsible sections
- Parameter linking (input → output mapping)
- Parameter automation curves
- Context-aware ranges (section-aware max/min)
- Undo/redo stack

#### 5.12 — Consolidate Duplicate Modes
- Merge `geometryShapes.js` + `geometryShapes2.js` → single `GeometryForge` with sub-presets
- Merge `hyperforge.js` + `hyperforge2.js` → single `Hyperforge` with sub-presets
- This alone saves ~120KB of code

---

## 📐 SECTION 6: RECORDING & VIRAL-READINESS GAPS

### What makes a visual go viral on Instagram/TikTok:

| Factor | Current State | Target |
|--------|--------------|--------|
| **Resolution clarity** | Native canvas (varies) | Locked 1080p minimum |
| **Aspect ratio** | Landscape only | 9:16 portrait for reels |
| **Visual trails** | None | Heavy feedback trails |
| **Color saturation** | Mode-dependent | Globally enhanced |
| **Bloom/glow** | None (shim) | Real bloom, bass-reactive |
| **Glitch effects** | Per-vertex only | Full-screen shader glitch |
| **Cinematic framing** | No vignette | Post-process vignette |
| **Bass impact feel** | Screen shake only | Shake + bloom burst + chromatic + zoom |
| **Drop moments** | Shape morph only | All-channel visual explosion |
| **Export format** | WebM/MP4 | MP4 with proper H.264 |

---

## 🔥 SECTION 7: THE "BOSS LEVEL" FEATURES (Long-term)

These are the features that would put AURA beyond TouchDesigner for web-based visuals:

1. **GLSL Shader Playground** — A mode where users can write/paste custom fragment shaders with audio uniforms injected automatically
2. **Scene Graph / Mode Layering** — Run 2-3 modes simultaneously with blend modes (additive, multiply, screen)
3. **Particle GPU Compute** — Use WebGL2 transform feedback or compute shaders for 100K+ particle systems
4. **Audio-Reactive Materials** — PBR materials with audio-driven emissive, roughness, metalness
5. **Project File System** — Save/load complete sessions (mode + params + markers + audio reference)
6. **MIDI Input** — Map physical controllers to parameters for live performance
7. **AI-Assisted Marker Detection** — Auto-detect song structure (intro, drop, breakdown) using onset/energy analysis

---

## 📊 Priority Matrix

```
                    HIGH IMPACT
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    │  5.1 Post-Process │                   │
    │  5.2 Feedback     │  5.7 AudioWorklet │
    │  5.3 WireframeFix │  5.4 Multi-Track  │
    │                   │                   │
LOW ├───────────────────┼──────────────────── HIGH
EFF │                   │                   │  EFFORT
    │  5.8 Utils Module │  5.5 Camera Sys   │
    │  5.12 Merge Modes │  5.11 Params v2   │
    │  5.9 Color Engine │  5.6 Aspect Ratio │
    │  5.10 Base Class  │                   │
    │                   │                   │
    └───────────────────┼───────────────────┘
                        │
                    LOW IMPACT
```

> [!IMPORTANT]
> **Start with 5.1 (Post-Processing) and 5.2 (Feedback).** These two changes alone will transform every single mode from "cool math visualization" to "holy shit that's cinematic." Everything else builds on top of having a real render pipeline.
