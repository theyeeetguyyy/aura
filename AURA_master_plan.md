# 🎯 AURA — MASTER IMPROVEMENT PLAN (MERGED)

> **Two independent deep audits merged, cross-referenced, and completed.**
> Original Claude Web audit (Sections 1–7 partial) + Antigravity audit → unified plan with completed Sections 8–17.

---

## Status of the Claude Web Document

The `claudewebincomplete.md` file contains **Sections 1–7** (partially — Section 7 cuts off mid-GLSL shader at VIS-03). **Sections 8–17** from the table of contents are entirely missing. This document completes them.

### Corrections to the Claude Web Document

After verifying every claim against the actual source code:

| Item | Claude's Claim | Actual Finding | Verdict |
|------|---------------|----------------|---------|
| **DEAD-03** `prevBassSnapshotBuf` | "Never used" | Used at `audio.js` L567-568 (written) and L625 (read in `computeBassFlux`) | ❌ **INCORRECT — it IS used** |
| **BUG-14** `cinematicCamera` | "Never read anywhere" | Read at `visuals.js` L412: `if (params.cinematicCamera) {` | ⚠️ **PARTIALLY WRONG** — it IS read, but `cameraAutoRotate` and `cameraRotateSpeed` are indeed dead |
| **BUG-05** Double smoothing | `smoothingTimeConstant = 0.82` | Verified correct at audio.js L302. The double-smooth is real and does dampen transients. | ✅ **CONFIRMED** — excellent catch |
| **BUG-02** Color singleton | Lists specific offenders | All confirmed. Additionally `hyperforge.js` L514 and L520 also allocate `new THREE.Color()` per-vertex (different bug but related) | ✅ **CONFIRMED + EXTENDED** |

### New Bugs Found Only In Antigravity Audit

These were NOT in the Claude doc:

| Bug | Severity | Description |
|-----|----------|-------------|
| **Wireframe Desync** | CRITICAL | GeometryForge wireframe never copies displaced positions — stays frozen |
| **Hyperforge Per-Frame Normals** | HIGH | `computeVertexNormals()` every frame for `MeshBasicMaterial` that ignores normals |
| **Frame-Rate Dependent Lerp** | MEDIUM | MarkerSystem `smoothedEffects` lerp uses fixed rate, not `dt`-based |
| **Silent Recording** | MEDIUM | No user warning when audio stream is null → video-only recording |
| **Unused Marker Fields** | LOW | `cameraPreset`, `colorTemp`, `rhythmLock` defined but never consumed |
| **Duplicate Code** | LOW | `noise3D`/`fbm` copy-pasted across 5+ modes, `_parametric`/`_grid` identical |

---

## COMPLETE BUG REGISTRY (Both Audits Combined)

| ID | Severity | Source | Summary |
|----|----------|--------|---------|
| BUG-01 | 🔴 CRITICAL | Both | Bloom is a no-op shim |
| BUG-02 | 🔴 CRITICAL | Claude | Color singleton assigned directly to materials |
| BUG-03 | 🔴 CRITICAL | Claude | DnaHelix destroys ALL geometry every frame |
| BUG-04 | 🟠 HIGH | Claude | MobiusRings rebuilds all ring geometry every frame |
| BUG-05 | 🟠 HIGH | Claude | Double-smoothed audio (analyser + manual) dampens transients |
| BUG-15 | 🔴 CRITICAL | Antigravity | GeometryForge wireframe completely desynced from mesh |
| BUG-16 | 🟠 HIGH | Antigravity | Hyperforge `computeVertexNormals()` per frame (wasted) |
| BUG-17 | 🟠 HIGH | Antigravity | Hyperforge rebuilds `WireframeGeometry` every frame |
| BUG-06 | 🟡 MEDIUM | Claude | `energyHistory.reduce()` O(n) every frame |
| BUG-07 | 🟡 MEDIUM | Claude | All history arrays use push/shift instead of ring buffers |
| BUG-08 | 🟡 MEDIUM | Claude | Object spread allocations in render hot path |
| BUG-09 | 🟡 MEDIUM | Claude | TerrainMesh `computeVertexNormals` for BasicMaterial |
| BUG-10 | 🟡 MEDIUM | Claude | Spectrogram allocates new Float32Array every frame |
| BUG-11 | 🟡 MEDIUM | Claude | `loadFile` hangs forever if `canplaythrough` never fires |
| BUG-12 | 🟡 MEDIUM | Claude | GLSL `break` with dynamic condition in ShaderTunnel |
| BUG-18 | 🟡 MEDIUM | Antigravity | MarkerSystem lerp is frame-rate dependent |
| BUG-19 | 🟡 MEDIUM | Antigravity | Recording can be silent with no warning |
| BUG-13 | 🟢 LOW | Claude | `alert()` blocks UI thread |
| BUG-14 | 🟢 LOW | Claude (corrected) | `cameraAutoRotate` + `cameraRotateSpeed` are dead params |

---

## SECTION 8: Real Bloom Post-Processing

### The Problem
The current `THREE.UnrealBloomPass` shim only adjusts `toneMappingExposure`. Zero actual bloom.

### Implementation Plan

**Option A: Self-Hosted Real Passes (Recommended)**

Bundle the actual Three.js post-processing passes from the `examples/jsm/` directory. Since AURA uses script tags (no bundler), self-host as IIFE-wrapped scripts:

```
js/postprocessing/
├── EffectComposer.js    ← real implementation
├── RenderPass.js
├── UnrealBloomPass.js   ← real kawase blur bloom
├── ShaderPass.js        ← for custom passes
├── CopyShader.js
└── LuminosityHighPassShader.js
```

**Option B: Inline Custom Bloom (Lighter)**

Write a custom 2-pass Gaussian bloom directly:

1. **Brightness Extract** — threshold pixels (keep only > 0.7 luminance)
2. **Horizontal Blur** — 9-tap Gaussian on the bright pixels
3. **Vertical Blur** — 9-tap Gaussian on the H-blurred result
4. **Composite** — Add blurred result back to original scene

```
Pass 1: Scene → RenderTarget A
Pass 2: A → Brightness Extract → RenderTarget B
Pass 3: B → H-Blur → RenderTarget C
Pass 4: C → V-Blur → RenderTarget D
Pass 5: A + D → Screen (additive composite)
```

**Audio Reactivity:**
- `bloom.strength` → `0.5 + audioBus.rms * 1.5 + sectionEffects.bloom * 0.5`
- `bloom.threshold` → lower during drops (more glow), higher during calm (subtler)
- `bloom.radius` → widens on bass beats for "bloom pulse" effect

**Estimated effort:** 4-6 hours for Option B, 2-3 hours for Option A.

---

## SECTION 9: Vertical (9:16) Recording Mode

### Architecture

```js
const RECORDING_PROFILES = {
    landscape:  { width: 1920, height: 1080, label: '16:9 Landscape' },
    portrait:   { width: 1080, height: 1920, label: '9:16 Portrait (Reels)' },
    square:     { width: 1080, height: 1080, label: '1:1 Square' },
    ultrawide:  { width: 2560, height: 1080, label: '21:9 Ultrawide' },
    '4k':       { width: 3840, height: 2160, label: '4K' }
};
```

### Record Flow

```
User clicks Record → Profile Selection Modal
                   → Store current canvas size
                   → Resize renderer to profile dimensions
                   → Update camera aspect ratio
                   → Start MediaRecorder
                   → ... recording ...
                   → Stop MediaRecorder
                   → Restore original canvas size
                   → Download file
```

### Key Implementation Details

1. **Renderer resize:**
```js
function setRecordingProfile(profileKey) {
    const p = RECORDING_PROFILES[profileKey];
    savedWidth = canvas.width;
    savedHeight = canvas.height;
    renderer.setSize(p.width, p.height);
    camera.aspect = p.width / p.height;
    camera.updateProjectionMatrix();
    // DOM: hide canvas overflow, center on screen
    canvas.style.width = p.width + 'px';
    canvas.style.height = p.height + 'px';
}
```

2. **CSS for portrait preview:** When recording in portrait, show a centered portrait window on the screen with dark bars on sides.

3. **Mode adaptation:** Modes should check `camera.aspect` and adjust positioning so visuals aren't clipped in portrait. This is mostly automatic with Three.js perspective camera.

**Estimated effort:** 3-4 hours.

---

## SECTION 10: Multi-Track Stem Input

### Architecture

The audio engine needs to support N parallel audio sources, each with its own `AnalyserNode`:

```
                    ┌─── AnalyserNode (drums) ─── drumsBus
AudioContext ───┬──►├─── AnalyserNode (bass)  ─── bassBus
                │   ├─── AnalyserNode (synth) ─── synthBus
                │   └─── AnalyserNode (full)  ─── masterBus
                └──► GainNode → Destination (what user hears)
```

### UI: Stem Import Panel

```
┌──────────────────────────────────────┐
│  🎵 STEMS                           │
│  ─────────────────────────────────── │
│  [Master Mix]  track.mp3     ✓ 🔊   │
│  [Drums]       drums.wav     + ○     │
│  [Bass/Sub]    bass.wav      + ○     │
│  [Synth/FX]    synth.wav     + ○     │
│  [Vocals]      (none)        + ○     │
│                                      │
│  All stems sync to master timeline   │
└──────────────────────────────────────┘
```

### AudioBus Extension

```js
audioBus.stems = {
    drums: {
        bands: { sub: 0, bass: 0, ... },
        rms: 0,
        beat: false,
        kick: false,      // isolated kick detection
        snare: false,      // isolated snare detection
        hihat: false       // isolated hi-hat detection
    },
    bass: {
        bands: { sub: 0, bass: 0, ... },
        subPressure: 0,    // raw sub energy
        wobbleRate: 0,     // wobble LFO frequency
        growlIntensity: 0  // growl/distortion amount
    },
    synth: {
        bands: { ... },
        screechIntensity: 0,
        riserLevel: 0,
        pad: 0
    }
};
```

### Fallback: Single-File Mode

When stems aren't provided, the master mix analysis populates all bus properties as it does today. Modes should always read from `audioBus.smoothBands` (global) by default, and optionally from `audioBus.stems.drums.kick` etc. when stems are available.

**Estimated effort:** 8-12 hours.

---

## SECTION 11: Instagram Recording Pipeline

### Watermark/Brand Overlay

```js
function addWatermark(canvas, text = 'theyeetguy', position = 'bottom-right') {
    const ctx = canvas.getContext('2d'); // Use 2D overlay canvas
    ctx.font = '600 14px Inter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(text, canvas.width - 20, canvas.height - 20);
}
```

**Better approach:** Use a transparent HTML overlay `<div>` positioned over the canvas, styled with CSS. The `captureStream()` won't capture HTML overlays, so use a 2D canvas composited via `drawImage()` for the watermark in recorded output.

### Quality Control Settings

```
Recording Settings:
├── Resolution Profile (9:16, 16:9, 1:1)
├── Frame Rate (30fps, 60fps)
├── Bitrate (8Mbps, 16Mbps, 32Mbps)
├── Codec Priority (H.264 > VP9 > VP8)
├── Watermark Text
├── Watermark Position (corners)
├── Auto-trim (start/end seconds)
└── Audio Include (on/off)
```

### Export Filename Convention

```
aura_{mode}_{resolution}_{timestamp}.mp4
// Example: aura_hyperforge_1080x1920_20260416.mp4
```

**Estimated effort:** 4-6 hours.

---

## SECTION 12: Post-Processing Pipeline (Full)

### Pass Chain

```
Scene Render → RenderTarget
    ↓
[1] UnrealBloomPass     — real glow (Section 8)
    ↓
[2] FeedbackPass        — temporal trail/smear (CUSTOM)
    ↓
[3] ChromaticAberPass   — RGB split on bass/screech
    ↓
[4] GlitchPass          — block corruption on drops
    ↓  
[5] FilmGrainPass       — subtle noise overlay
    ↓
[6] VignettePass        — cinematic edge darkening
    ↓
[7] ColorGradingPass    — final LUT-based color
    ↓
Screen Output
```

### Pass 2: FeedbackPass (The Secret Weapon)

This is the most impactful single addition for tearout visuals:

```glsl
uniform sampler2D tDiffuse;     // current frame
uniform sampler2D tFeedback;    // previous frame
uniform float uDecay;           // 0.92-0.98 (audio-reactive)
uniform float uZoom;            // slight zoom per frame (1.001-1.01)
uniform float uRotation;        // slight rotation per frame
varying vec2 vUv;

void main() {
    // Sample previous frame with slight zoom/rotation
    vec2 center = vec2(0.5);
    vec2 feedUv = (vUv - center) / uZoom;
    feedUv = mat2(cos(uRotation), -sin(uRotation),
                  sin(uRotation), cos(uRotation)) * feedUv;
    feedUv += center;
    
    vec3 prev = texture2D(tFeedback, feedUv).rgb * uDecay;
    vec3 curr = texture2D(tDiffuse, vUv).rgb;
    
    // Composite: current frame on top of faded previous
    gl_FragColor = vec4(max(curr, prev), 1.0);
}
```

**Audio mapping:**
- `uDecay` = `0.85` (calm) → `0.97` (drop) — more trail during drops
- `uZoom` = `1.0` (no zoom) → `1.005` on bass beat (pull-in trail)
- `uRotation` = `0.0` → `0.002` on drops (rotational smear)

### Pass 5: FilmGrainPass

```glsl
uniform float uIntensity;  // 0.03-0.08
uniform float uTime;

float grain(vec2 uv, float t) {
    return fract(sin(dot(uv + t, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec3 col = texture2D(tDiffuse, vUv).rgb;
    float noise = grain(vUv * 500.0, uTime) * uIntensity;
    col += noise - uIntensity * 0.5;  // centered noise
    gl_FragColor = vec4(col, 1.0);
}
```

### Pass 6: VignettePass

```glsl
uniform float uIntensity;  // 0.3-0.8
uniform float uSoftness;   // 0.3-0.7

void main() {
    vec3 col = texture2D(tDiffuse, vUv).rgb;
    float dist = length(vUv - 0.5) * 2.0;
    float vig = smoothstep(1.0 - uSoftness, 1.0, dist) * uIntensity;
    col *= 1.0 - vig;
    gl_FragColor = vec4(col, 1.0);
}
```

### Global Params for All Passes

```js
// Added to globalDefaults in params.js:
bloomIntensity:   { type: 'range', min: 0, max: 3, default: 1.2, ... },
bloomThreshold:   { type: 'range', min: 0, max: 1, default: 0.6, ... },
feedbackAmount:   { type: 'range', min: 0, max: 0.99, default: 0.0, ... },
chromaticAber:    { type: 'range', min: 0, max: 0.05, default: 0, ... },
filmGrain:        { type: 'range', min: 0, max: 0.1, default: 0.03, ... },
vignetteIntensity:{ type: 'range', min: 0, max: 1, default: 0.4, ... },
glitchIntensity:  { type: 'range', min: 0, max: 1, default: 0, ... },
```

**Estimated effort:** 10-15 hours for full pipeline.

---

## SECTION 13: Smart Presets System

### The Problem

Modes like Hyperforge have 60+ parameters. A new user sees a wall of sliders and gives up. Smart presets solve this by providing curated starting points.

### Architecture

```js
const SMART_PRESETS = {
    // Genre presets (apply to ANY mode)
    genres: {
        tearout: {
            global: { bloomIntensity: 1.8, feedbackAmount: 0.93, chromaticAber: 0.02, vignetteIntensity: 0.5 },
            audio: { smoothingTimeConstant: 0.0 }, // raw FFT for harder hits
            description: 'Maximum impact. Raw transients, heavy bloom, temporal trails.'
        },
        riddim: {
            global: { bloomIntensity: 1.5, feedbackAmount: 0.88, chromaticAber: 0.01 },
            description: 'Half-time groove. Steady pulse, rhythmic reactions.'
        },
        melodic: {
            global: { bloomIntensity: 1.0, feedbackAmount: 0.7, filmGrain: 0.05, vignetteIntensity: 0.6 },
            description: 'Cinematic, smooth, dreamy. Soft bloom, film grain.'
        }
    },
    // Per-mode presets
    modes: {
        hyperforge: {
            'Chaos Engine': { outerSurface: 'superformula', attractorType: 'lorenz', displaceMode: 'turbulence', beatExplode: 3, ... },
            'Cosmic Reef': { outerSurface: 'diniSurface', attractorType: 'aizawa', displaceMode: 'reaction', ... },
            'Bass Cannon': { outerSurface: 'torusKnot', attractorType: 'halvorsen', displaceMode: 'gravitationalWell', bassBreath: 4, ... }
        },
        geometryForge: {
            'Glass Sculpture': { shape: 'icosahedron', displaceMode: 'noise', showPoints: true, ghostTrail: true, ... },
            'Tearout Bomb': { shape: 'star', displaceMode: 'shatter', beatExplode: 3, dropEffect: 'all', ... }
        }
    }
};
```

### UI: Preset Selector

A horizontal scrollable chip row at the top of the params panel:

```
┌──────────────────────────────────────┐
│ 🎛️ PRESETS                          │
│ [Tearout] [Riddim] [Melodic] [Custom]│
│ ─────────────────────────────────────│
│ Mode Presets:                        │
│ [Chaos Engine] [Cosmic Reef] [+Save] │
└──────────────────────────────────────┘
```

Clicking a preset sets all its params at once. The user can then tweak individual values on top of the preset. A "Modified" indicator shows when values have diverged from the preset.

**Estimated effort:** 4-6 hours.

---

## SECTION 14: New Visual Modes for Tearout

### MODE: Bass Vortex
A central spinning vortex that sucks particles inward on sub bass, explodes them outward on drops. The vortex tube deforms based on frequency spectrum — low freqs widen the funnel, high freqs create spiraling filaments.

### MODE: Frequency Shredder
Inspired by the visual style of Svdden Death drops: sharp, angular geometry that shatters and reforms. Uses instanced box geometry that responds to frequency bands — each box is a frequency bin, arranged in a circle, that shoots outward on transients and collapses inward on sustained notes.

### MODE: Warp Corridor
A first-person perspective flying through a deforming tunnel. The tunnel walls are a displacement-mapped cylinder driven by the waveform data. On drops, the tunnel splits, inverts, or folds back on itself. Camera speed linked to BPM.

### MODE: Particle Supernova
A dense particle sphere that implodes on buildups and explodes on drops. Uses GPU transform feedback (WebGL2) for 100K+ particles. The explosion wave propagates outward with audio-reactive shockwave rings.

### MODE: Glitch Matrix
A grid of floating cubes/polygons in 3D space. During calm sections they orbit peacefully. On each bass hit they snap to random positions, creating a "datamosh" glitch effect. During drops the entire grid liquefies with noise displacement. Uses `BatchedMesh` for performance.

**Estimated effort:** 6-10 hours per mode.

---

## SECTION 15: Settings Panel Redesign

### Current Problem
All global params and all mode params share the same scrolling list. With 60+ mode params, it's impossible to find anything.

### Proposed: Tabbed Panel

```
┌──────────────────────────────────────┐
│ ⚙️ SETTINGS                         │
│ [Visual] [Audio] [Record] [About]    │
│ ─────────────────────────────────────│
│                                      │
│ VISUAL TAB:                          │
│ ▸ Post-Processing                    │
│   Bloom ──────────[====]── 1.2       │
│   Trails ─────────[==]──── 0.0       │
│   Chromatic ──────[=]───── 0.01      │
│   Grain ──────────[=]───── 0.03      │
│   Vignette ───────[===]─── 0.4       │
│ ▸ Colors                             │
│   Palette ────────[▼ Solar]          │
│   Hue Shift ──────[===]─── 0.5       │
│ ▸ Camera                             │
│   Auto Cam ───────[✓]               │
│   Orbit Speed ────[==]──── 0.3       │
│                                      │
│ AUDIO TAB:                           │
│ ▸ Reactivity                         │
│   Global React ───[====]── 1.5       │
│   Smoothing ──────[===]─── 0.82      │
│ ▸ Beat Detection                     │
│   Half-time ──────[✗]               │
│   Beat Threshold ─[===]─── 0.5       │
│ ▸ Stems                              │
│   [Import Stems...]                  │
│                                      │
│ RECORD TAB:                          │
│   Profile ────────[▼ 9:16 Portrait]  │
│   FPS ────────────[▼ 60]            │
│   Bitrate ────────[▼ 16 Mbps]       │
│   Watermark ──────[theyeetguy]       │
│                                      │
└──────────────────────────────────────┘
```

### Mode Params: Grouped & Collapsible

Mode params should auto-group by their label emoji prefixes:
- `🔮` → Shape/Surface group
- `🌊` → Displacement group  
- `🎨` → Color group
- `💥` → Beat/Drop group
- `🔊` → Audio Reactivity group
- `✨` → Effects group

**Estimated effort:** 6-8 hours.

---

## SECTION 16: Per-Mode Deep Audit

### Critical Fix Modes (Per-Frame Rebuild — Must Fix)

| Mode | Issue | Fix Strategy |
|------|-------|-------------|
| **DnaHelix** | Destroys + rebuilds ALL (lines, tubes, bridges, particles) every frame | Pre-allocate max-count Line/Points buffers in `init()`, update positions in-place via `needsUpdate` |
| **MobiusRings** | Rebuilds every ring's geometry every frame | Cache last radius/twist/segments, only rebuild when they actually change. During audio react, update vertex positions in-place instead |
| **Hyperforge** | Rebuilds wireframe every frame (`new WireframeGeometry()`) | Use `wireframe: true` material flag on the mesh directly, or a custom wireframe shader |

### High-Priority Fix Modes

| Mode | Issue | Fix |
|------|-------|-----|
| **GeometryForge** | Wireframe positions never synced to displaced mesh | Copy displaced positions to wireframe mesh, or use `wireframe: true` material |
| **Hyperforge** | `computeVertexNormals()` every frame for BasicMaterial | Remove the call entirely |
| **Hyperforge** | Superformula rebuilds every 200ms due to smoothed param key change | Round smoothed values to 1 decimal in the cache key |
| **Spectrogram** | New `Float32Array` allocated every frame for history | Pre-allocate 2D ring buffer |
| **TerrainMesh** | `computeVertexNormals()` for unlit material | Remove |

### Modes With Color Singleton Bug

| Mode | Line | Fix |
|------|------|-----|
| **MobiusRings** | L136: `ring.material.color = color;` | Add `.clone()` |
| **DnaHelix** | L120: `color: ParamSystem.getColorThree(...)` | Add `.clone()` |
| **Nebula** | Various `material.color = getColorThree()` | Add `.clone()` |

### Modes With Dead/Unused Params

| Mode | Param | Status |
|------|-------|--------|
| **Aurora** | `magneticLines`, `rayShots`, `polarParticles` | Defined, never implemented → remove |
| **Global** | `cameraAutoRotate`, `cameraRotateSpeed` | Defined, never read → remove or implement |

### Clean Modes (No Issues Found)

`frequencyBars`, `particleStorm` (except O(n²) connections), `radialBloom`, `kaleidoscope`, `shaderTunnel` (except GLSL break), `godRays`, `laserShow`, `starfield`, `cyberGrid`, `noiseRealm`, `fractalShader`, `sdfRaymarcher`, `voidEngine`, `gpgpuParticles`

---

## SECTION 17: Implementation Roadmap

### Phase 1: Foundation (1-2 days)
*Maximum visual impact with minimum code change*

- [ ] **Implement real bloom** (Section 8) — self-host or inline real passes
- [ ] **Fix DnaHelix per-frame rebuild** — convert to persistent buffers
- [ ] **Fix MobiusRings per-frame rebuild** — cache params, update in-place
- [ ] **Fix GeometryForge wireframe desync** — use `wireframe: true` material
- [ ] **Fix Hyperforge wireframe** — remove per-frame `new WireframeGeometry()`
- [ ] **Fix color singleton bug** — add `.clone()` at all offender sites
- [ ] **Set `smoothingTimeConstant = 0`** — raw FFT, manual smoothing only
- [ ] **Remove dead params** from UI

### Phase 2: Post-Processing Pipeline (2-3 days)
*The "wow factor" upgrade*

- [ ] **FeedbackPass** (temporal trails) — the single most impactful visual
- [ ] **ChromaticAberrationPass** — bass/screech-reactive RGB split
- [ ] **VignettePass** — cinematic framing
- [ ] **FilmGrainPass** — texture/depth
- [ ] **GlitchPass** — drop-triggered digital destruction
- [ ] **Wire all passes to audio bus** — automatic audio reactivity
- [ ] **Add global post-proc params to UI**

### Phase 3: Recording & Social Pipeline (1-2 days)
*Instagram/TikTok readiness*

- [ ] **Aspect ratio profiles** (9:16, 16:9, 1:1)
- [ ] **Recording quality settings** (bitrate, FPS)
- [ ] **Watermark overlay system**
- [ ] **Profile selection UI** in recording panel
- [ ] **Smart presets system** (genre + per-mode)
- [ ] **Settings panel redesign** (tabbed layout)

### Phase 4: Advanced Features (3-5 days)
*Next-level capabilities*

- [ ] **Multi-track stem input** — parallel AnalyserNodes
- [ ] **Camera Director system** — consume marker `cameraPreset` values
- [ ] **Per-band attack/release smoothing** — tearout-tuned reactivity
- [ ] **Half-time beat detection** — dubstep groove awareness
- [ ] **Sub pressure bus property** — physical weight feel
- [ ] **Audio analysis → AudioWorklet** — off-main-thread
- [ ] **Shared utils module** — deduplicate noise/geometry code
- [ ] **Mode consolidation** — merge GeometryForge 1+2, Hyperforge 1+2
- [ ] **New tearout-specific modes** (Section 14)

---

## Priority Matrix (What To Build First)

```
                        VISUAL IMPACT
                    ▲
                    │
          HIGH  ────┤  ★ BLOOM (8)
                    │  ★ FEEDBACK TRAILS (12.2)
                    │  ★ FIX WIREFRAMES (BUG-15/17)
                    │  • Chromatic Aberration
                    │  • Fix DnaHelix/Mobius (BUG-3/4)
                    │
          MED   ────┤  • 9:16 Recording (9)
                    │  • Smart Presets (13)
                    │  • Vignette + Film Grain
                    │  • Half-time beats (AUDIO-03)
                    │  • Raw FFT (BUG-05)
                    │
          LOW   ────┤  • Multi-track stems (10)
                    │  • AudioWorklet
                    │  • Settings panel redesign
                    │  • Mode consolidation
                    │  • Utils module
                    │
                    └────┬──────────┬──────────┬────►
                        LOW      MED       HIGH    EFFORT
```

> [!IMPORTANT]
> **Build bloom + feedback trails first.** These two features alone transform every single mode from "math visualization" to "cinematic acid trip." Everything else is polish on top of this foundation.
