# 🎵 AURA — Comprehensive Improvement Specification
### Audio Reactive Visual Generator · v2.0 Target · March 2026

> **How to use this document:** Hand it directly to an AI coding assistant. Each item has a priority tag (`HIGH` / `MED` / `LOW`) and effort estimate (`Low` / `Med` / `High`). Work top-to-bottom within each priority tier. All file references are relative to the project root.

---

## 📁 File Reference Map

| File | Module |
|------|--------|
| `audio.js` | AudioEngine — all DSP, beat detection, analysis |
| `visuals.js` | VisualEngine — Three.js scene, SECTION_BEHAVIORS, effects |
| `ui.js` | UI — transport bar, panels, keyboard, markers UI |
| `params.js` | ParamSystem — param schema, color palettes |
| `markers.js` | MarkerSystem — timeline markers, section types |
| `app.js` | Bootstrap — RAF loop, mode registration |
| `recorder.js` | Recorder — canvas capture, MediaRecorder |
| `geometryShapes2.js` | GeometryForgeMode2 — geometry + displacement mode |
| `hyperforge2.js` | HyperforgeMode2 — superformula + strange attractors |
| `js/modes/*.js` | Individual visual mode files |

---

---

# 01 · Bug Fixes & Stability

---

## 1.1 Critical Bugs

---

### BUG-01 · Double RAF Loop on Tab Restore
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `app.js`

When a tab is restored, the `visibilitychange` handler checks `!_rafId` to decide whether to start a new loop. However if the loop is mid-frame when the tab hides, `running = false` stops the loop but `_rafId` is not cleared before the next rAF fires — leaving a one-frame window where rAF fires once more and re-enters `loop()`. The result is two overlapping RAF callbacks running simultaneously.

**Fix:**
```js
// app.js — visibilitychange handler
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        running = false;
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; } // ADD THIS
    } else {
        if (canvas && !_rafId) { running = true; loop(); }
    }
});
```

---

### BUG-02 · AudioContext Suspended on iOS / Safari
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `audio.js`

`AudioEngine.init()` creates the `AudioContext` immediately on page load but iOS requires a user gesture before allowing audio playback. The `ctx.state` can be `"suspended"` even after `loadFile()` calls `ctx.resume()`. There is no `await` or error handling on the `ctx.resume()` call, silently failing on iOS and Safari.

**Fix:**
```js
// audio.js — replace play()
async function play() {
    if (!audioElement || !audioBus.loaded) return;
    try {
        if (ctx.state === 'suspended') await ctx.resume();
        await audioElement.play();
        audioBus.isPlaying = true;
    } catch(e) {
        console.warn('AudioContext resume failed:', e);
    }
}
```

---

### BUG-03 · Preset localStorage Data Corrupts on Schema Changes
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js`

In `setupPresets()`, loaded presets are applied via `Object.entries(p.global).forEach(([k,v]) => ParamSystem.set(k,v))`. If a param key was renamed or removed since the preset was saved, it silently sets a dead key and the real param gets its default. There is no version check or graceful key mismatch handling.

**Fix:**
```js
// Add versioning to saved presets
const PRESET_VERSION = 1;

// On save: include version
const data = { version: PRESET_VERSION, name, mode, global: ..., mode_params: ... };

// On load: validate keys before applying
function applyPreset(p) {
    if (!p.version || p.version < PRESET_VERSION) {
        console.warn('Old preset format — applying with key filtering');
    }
    if (p.global) {
        Object.entries(p.global).forEach(([k, v]) => {
            if (k in ParamSystem.globalDefaults) ParamSystem.set(k, v); // only known keys
        });
    }
}
```

---

### BUG-04 · Seek Bar Stays Dragging After mouseup Off-Window
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `ui.js`

If the user drags the seek bar, moves the mouse outside the browser window, and releases the button outside, `document mouseup` never fires. The seek bar stays permanently stuck in dragging mode until they click again.

**Fix:**
```js
// ui.js — add window blur handler alongside mouseup
document.addEventListener('mouseup', () => { seekDragging = false; });
window.addEventListener('blur', () => { seekDragging = false; }); // ADD THIS
```

---

### BUG-05 · Mode Error Recovery Wipes User Param Values
**Priority:** `MED` | **Effort:** `Med` | **File:** `visuals.js`

In `setMode()`, when a mode's `init()` throws and the code falls back to the previous mode, it calls `ParamSystem.setModeSchema(activeMode.params)` which resets all `modeValues` to defaults — wiping any values the user had set for the reverted mode.

**Fix:**
```js
// Before calling setModeSchema on fallback, cache existing values
const savedModeValues = { ...ParamSystem.modeValues };
ParamSystem.setModeSchema(activeMode.params || {});
// Restore values that still exist in the schema
Object.entries(savedModeValues).forEach(([k, v]) => {
    if (k in ParamSystem.currentModeSchema) ParamSystem.set(k, v);
});
```

---

### BUG-06 · BPM Display Shows Stale Value for First Few Seconds
**Priority:** `MED` | **Effort:** `Low` | **File:** `audio.js` + `ui.js`

`AudioEngine.loadFile()` resets `beatTimes = []` but not `estimatedBPM`. On a fresh load `estimatedBPM` retains its previous value until 4+ beats are detected. The UI shows the old track's BPM for the first few seconds.

**Fix:**
```js
// audio.js — in loadFile(), also reset BPM state
beatTimes = [];
estimatedBPM = 0; // 0 = "detecting"
audioBus.bpm = 0;

// ui.js — in updateTransport()
if (_bpmDisplay && bus.loaded) {
    _bpmDisplay.textContent = bus.bpm > 0 ? `${bus.bpm} BPM` : '-- BPM';
}
```

---

## 1.2 Visual / Rendering Bugs

---

### BUG-07 · Flash Overlay Color Lerp Runs When Flash is Disabled
**Priority:** `LOW` | **Effort:** `Low` | **File:** `visuals.js`

In `updateEffects()`, the flash overlay material color `lerp()` call runs every frame even when `flashEnabled = false`. The opacity is zeroed so the bug is invisible, but it still triggers `THREE.Color` operations every frame unnecessarily.

**Fix:**
```js
// Gate the entire color-lerp block behind flashEnabled
if (flashEnabled && flashIntensity > 0.05) {
    const c = ParamSystem.getColorThree(audio.rms + clock.elapsedTime * 0.2);
    flashOverlay.material.color.lerp(c, 0.3);
    // chaos color lerp...
    // colorTemp lerp...
}
```

---

### BUG-08 · Bloom Strength Accumulates on Consecutive Bass Beats
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `visuals.js`

In `update()`, `bloomPass.strength` is set by adding `bassBeatIntensity * 0.5 * masterInt` to the base value every frame. On a track with constant bass beats there is no decay — bloom strength keeps climbing indefinitely.

**Fix:**
```js
// Replace direct assignment with lerp + spike
const targetBloom = (ParamSystem.get('bloomIntensity') || 0.8) * effects.bloom;
bloomPass.strength += (targetBloom - bloomPass.strength) * 0.15; // decay toward target
if (audioBus.bassBeat) {
    bloomPass.strength += audioBus.bassBeatIntensity * 0.3 * masterInt; // additive spike on beat
}
```

---

### BUG-09 · GeometryForge2 mirrorMeshes Array Never Disposed on Mode Switch
**Priority:** `HIGH` | **Effort:** `Med` | **File:** `geometryShapes2.js`

The `mirrorMeshes` array is populated when mirror mode is active but the `destroy()` method does not dispose each mirror mesh's geometry and material before removing it from the scene. This causes a VRAM leak on every mode switch when mirrors are active.

**Fix:**
```js
// geometryShapes2.js — in destroy(scene)
destroy(scene) {
    this.mirrorMeshes.forEach(m => {
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
            if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
            else m.material.dispose();
        }
        scene.remove(m);
    });
    this.mirrorMeshes = [];
    // ... rest of existing cleanup
}
```

---

### BUG-10 · Waveform Points Uses GC-Heavy push() Pattern
**Priority:** `MED` | **Effort:** `Low` | **File:** `audio.js`

`audioBus.waveformPoints` is initialized as `new Array(256).fill(0)` then overwritten in `computeWaveformPoints()` with a `pts.push()` loop that creates a brand new array every frame. This generates significant GC pressure at 60fps.

**Fix:**
```js
// audio.js — change initialization
audioBus.waveformPoints = new Float32Array(256);

// In computeWaveformPoints():
function computeWaveformPoints() {
    const step = Math.max(1, Math.floor(timeData.length / 256));
    for (let i = 0; i < 256; i++) {
        const idx = Math.min(i * step, timeData.length - 1);
        audioBus.waveformPoints[i] = (timeData[idx] - 128) / 128;
    }
}
```

---

### BUG-11 · Ghost Trail Meshes Leak When ghostCount Param is Reduced
**Priority:** `MED` | **Effort:** `Med` | **File:** `geometryShapes2.js`

In `GeometryForgeMode2`, the `ghosts[]` array accumulates mesh objects. When the `ghostCount` param is reduced at runtime, old excess ghosts are not disposed from the scene or from GPU memory.

**Fix:**
```js
// When trimming ghosts array to newCount:
while (this.ghosts.length > newCount) {
    const ghost = this.ghosts.pop();
    ghost.geometry?.dispose();
    if (ghost.material) ghost.material.dispose();
    this.group.remove(ghost);
}
```

---

---

# 02 · Performance Optimizations

---

## 2.1 Audio Engine

---

### PERF-01 · computeSpectralFeatures Geometric Mean Runs Every Frame
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `audio.js`

`computeSpectralFeatures()` computes spectral flatness using `Math.exp(geoMean/count)` where `geoMean` is a sum of `Math.log()` calls over all `freqData` bins (up to 2048). This is expensive and runs every frame. Move it to the `_analysisFrame % 4 === 0` bucket alongside other throttled analysis.

```js
// In update():
if (_analysisFrame % 4 === 0) {
    computeSpectralFeatures(); // was unthrottled
    computeHarmonicAnalysis();
}
```

---

### PERF-02 · detectBeat Division by 255 in Inner Loop
**Priority:** `MED` | **Effort:** `Low` | **File:** `audio.js`

In `detectBeat()`, `freqData[i] / 255` is computed inside the inner loop for every bin every frame. Hoist to a constant multiplier.

```js
const INV_255 = 1 / 255; // module-level constant

// In detectBeat() inner loop:
for (let i = 0; i < freqData.length; i++) {
    const fNorm = freqData[i] * INV_255; // multiply is faster than divide
    const diff = fNorm - prevFreqData[i];
    if (diff > 0) flux += diff;
    prevFreqData[i] = fNorm;
}
```

---

### PERF-03 · computeRhythmAnalysis Allocates Arrays Every 5 Frames
**Priority:** `MED` | **Effort:** `Low` | **File:** `audio.js`

`computeRhythmAnalysis()` allocates `let intervals = []` and `const buckets = new Array(8).fill(0)` on every execution. Pre-allocate these as module-level buffers and reuse them.

```js
// Module-level pre-allocation
const _rhythmIntervals = new Float32Array(40);
const _rhythmBuckets = new Uint32Array(8);

// In computeRhythmAnalysis():
_rhythmBuckets.fill(0);
let intervalCount = 0;
// ... fill _rhythmIntervals instead of pushing to intervals[]
```

---

### PERF-04 · BPM Estimation Uses Array Slice on Every Beat
**Priority:** `MED` | **Effort:** `Low` | **File:** `audio.js`

`beatTimes` array grows to 20 items and is never truly circular — it shifts from the front on every beat which is O(n). Switch to a ring buffer with a head pointer using a typed array.

```js
const beatTimesRing = new Float64Array(20);
let beatTimesHead = 0;
let beatTimesCount = 0;

// On beat:
beatTimesRing[beatTimesHead % 20] = now;
beatTimesHead++;
beatTimesCount = Math.min(beatTimesCount + 1, 20);
```

---

## 2.2 Visual Engine

---

### PERF-05 · disposeMaterial Allocates Array Literal on Every Call
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `visuals.js`

`disposeMaterial()` defines the texture slot array inline: `['map', 'normalMap', ...]`. This creates a new array object on every single call — and dispose is called for every mesh on every mode switch. Hoist it to module scope.

```js
// Module-level constant — defined ONCE
const MATERIAL_TEXTURE_SLOTS = [
    'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
    'aoMap', 'envMap', 'alphaMap', 'lightMap'
];

function disposeMaterial(mat) {
    MATERIAL_TEXTURE_SLOTS.forEach(slot => {
        if (mat[slot]) mat[slot].dispose();
    });
    mat.dispose();
}
```

---

### PERF-06 · camera.lookAt() Called Every Frame Even When Stationary
**Priority:** `MED` | **Effort:** `Low` | **File:** `visuals.js`

`camera.lookAt(0, 0, 0)` is called every frame inside `updateEffects()` even when neither the orbit position nor the shake offset has changed. Add a dirty flag.

```js
let cameraPositionDirty = false;
// Set cameraPositionDirty = true when shake changes or orbit is applied
// Only call camera.lookAt() when dirty
if (cameraPositionDirty) {
    camera.lookAt(0, 0, 0);
    cameraPositionDirty = false;
}
```

---

### PERF-07 · Section Indicator DOM Query on Every Frame
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `ui.js`

`updateMarkerSection()` calls `document.getElementById('section-indicator')` every frame. Cache it alongside the other cached DOM references at the top of `UI`.

```js
// In UI module top, alongside _seekBar, _playBtn, etc:
let _sectionIndicator = null;

// In setupTransport():
_sectionIndicator = document.getElementById('section-indicator');

// In updateMarkerSection(): use _sectionIndicator directly
```

---

### PERF-08 · Debug HUD FPS History Updates Even When Hidden
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js`

In `updateTransport()`, `updateDebugHUD(bus)` is only called when `debugHUDVisible` is true — but `_fpsHistory.push()` and the `performance.now()` diff happen unconditionally. Move the entire block inside the guard.

```js
// In updateTransport():
if (debugHUDVisible && _debugHUD) {
    const now = performance.now();
    _fpsHistory.push(1000 / (now - _lastFpsTime));
    _lastFpsTime = now;
    if (_fpsHistory.length > 60) _fpsHistory.shift();
    updateDebugHUD(bus);
}
```

---

### PERF-09 · getModeIcon() Rebuilds Object Literal on Every Call
**Priority:** `LOW` | **Effort:** `Low` | **File:** `ui.js`

`getModeIcon()` defines a large `const icons = { ... }` object literal on every invocation. Move it to module scope.

```js
// Module-level constant at top of UI IIFE:
const MODE_ICONS = {
    frequencyBars: '📊', particleStorm: '✨', radialBloom: '🌸',
    // ... all entries
};

function getModeIcon(key) {
    return MODE_ICONS[key] || '◆';
}
```

---

## 2.3 Memory Management

---

### PERF-10 · Blob URL Revoked Before Audio Element Finishes Using It
**Priority:** `MED` | **Effort:** `Low` | **File:** `audio.js`

`loadFile()` revokes `prevBlobUrl` immediately at the start of the next load call. If the audio element is mid-buffer at that moment (e.g. user drops a file while another is loading), revoking early can cause a brief audio gap or load error. Revoke only after the new file's `canplaythrough` event fires.

```js
async function loadFile(file) {
    const urlToRevoke = prevBlobUrl; // hold reference, don't revoke yet
    const url = URL.createObjectURL(file);
    prevBlobUrl = url;
    audioElement.src = url;
    // ...
    return new Promise((resolve) => {
        audioElement.addEventListener('canplaythrough', () => {
            if (urlToRevoke) URL.revokeObjectURL(urlToRevoke); // safe to revoke now
            audioBus.duration = audioElement.duration;
            resolve();
        }, { once: true });
    });
}
```

---

### PERF-11 · Particle Position Arrays Recreated on Count Param Change
**Priority:** `LOW` | **Effort:** `Med` | **File:** `geometryShapes2.js`, `hyperforge2.js`

When the `particleCount` param changes, the entire particle buffer is recreated and the old geometry is disposed. This causes a frame hitch. Instead, allocate at max capacity once and use a uniform/attribute to tell the shader how many particles are active.

```js
// On init: always allocate MAX_PARTICLES
const MAX_PARTICLES = 5000;
this.particlePositions = new Float32Array(MAX_PARTICLES * 3);

// Pass active count as a uniform or draw only activeCount particles:
particleGeometry.setDrawRange(0, params.particleCount);
```

---

---

# 03 · New Features

---

## 3.1 Audio Engine Additions

---

### FEAT-01 · Musical Key Detection & Chroma Vector
**Priority:** `MED` | **Effort:** `Med` | **File:** `audio.js`

Extend the harmonic analysis to detect the musical key using the Krumhansl-Schmuckler algorithm on a 12-bin chroma vector (pitch class distribution). Expose:
- `audioBus.chromaVector` — `Float32Array(12)` one value per pitch class (C, C#, D... B)
- `audioBus.musicalKey` — string e.g. `"C# minor"` or `"F major"`
- `audioBus.dominantPitchClass` — 0–11 integer

Modes can use `chromaVector` to generate harmonically correct color assignments per pitch class (e.g. each note maps to a hue in the color wheel).

---

### FEAT-02 · Frequency Band Isolation (Solo / Mute)
**Priority:** `MED` | **Effort:** `Med` | **File:** `audio.js` + `params.js`

Add a `FrequencyIsolation` filter that can restrict the frequency data feeding visual modes. Add to global params:

```js
// params.js — globalDefaults
isolationBand: {
    type: 'select',
    options: ['full', 'sub-only', 'bass-only', 'mid-only', 'treble-only', 'sub+bass', 'mid+treble'],
    default: 'full',
    label: '🎚️ Frequency Isolation'
}
```

When not `'full'`, zero out the irrelevant band values on `audioBus.smoothBands` before modes read them. This focuses the visual reaction to a single spectral range.

---

### FEAT-03 · Beat Grid Quantize
**Priority:** `MED` | **Effort:** `Med` | **File:** `audio.js`

Implement a beat grid quantizer. Expose:
- `audioBus.quantizedBeatPhase` — `beatPhase` snapped to the nearest division
- `audioBus.quantStep` — current division (`1/4`, `1/8`, `1/16`)

Modes can subscribe to `quantizedBeatPhase` for locked, rhythmically precise animations. Especially powerful for geometry rotation snapping and particle burst timing.

```js
// Add to audioBus:
quantizedBeatPhase: 0,
quantStep: 0.25, // 1/4 note default

// In update():
const divisions = Math.round(1 / audioBus.quantStep);
audioBus.quantizedBeatPhase = Math.round(audioBus.beatPhase * divisions) / divisions;
```

---

### FEAT-04 · Tap Tempo Visual Feedback
**Priority:** `HIGH` | **Effort:** `Low` | **File:** `ui.js`

The `T` key tap BPM function exists in `AudioEngine.tapBPM()` but has zero visual feedback. The user has no idea it's working.

**Implement:**
1. On each `T` tap, briefly flash the BPM badge (add/remove a CSS class `bpm-flash` for 150ms)
2. Show a "Tapping… (n/8)" counter badge that fades after 2 seconds of no taps
3. Add `T` to the keyboard shortcuts modal

```js
// ui.js — in keyboard handler, case 'KeyT':
AudioEngine.tapBPM();
if (_bpmDisplay) {
    _bpmDisplay.classList.add('bpm-flash');
    setTimeout(() => _bpmDisplay.classList.remove('bpm-flash'), 150);
}
```

---

### FEAT-05 · Silence Detection Graceful Fade
**Priority:** `LOW` | **Effort:** `Low` | **File:** `audio.js`

Extend `silenceDetected` (currently boolean) into a `silenceProgress` (0–1) that smoothly grows the longer silence is sustained. Modes can use this to gracefully dim/fade rather than freezing.

```js
// audio.js — module-level:
let _silenceFrames = 0;

// In computeLoudness():
if (audioBus.silenceDetected) {
    _silenceFrames = Math.min(180, _silenceFrames + 1);
} else {
    _silenceFrames = Math.max(0, _silenceFrames - 10);
}
audioBus.silenceProgress = _silenceFrames / 180; // 0 = audio present, 1 = 3s of silence
```

---

## 3.2 Visual Engine Additions

---

### FEAT-06 · Per-Mode Camera Presets with Lerp Transition
**Priority:** `MED` | **Effort:** `Med` | **File:** `visuals.js`

Each mode can optionally declare a `cameraPreset` property. When `setMode()` is called, instead of snapping the camera to `(0, 0, 100)`, smoothly tween it to the mode's preferred position over 1.5 seconds. This removes the jarring camera reset on every mode switch.

```js
// Example in a mode definition:
const MyMode = {
    name: 'My Mode',
    cameraPreset: { position: [0, 30, 80], fov: 60, lookAt: [0, 0, 0] },
    // ...
};

// In VisualEngine.setMode():
if (activeMode.cameraPreset) {
    const cp = activeMode.cameraPreset;
    startCameraTween(cp.position, cp.fov, cp.lookAt, 1.5); // lerp over 1.5s
}
```

---

### FEAT-07 · Section Transition Wipe Effect
**Priority:** `MED` | **Effort:** `Med` | **File:** `visuals.js`

When `audioBus.sectionChanged === true`, trigger a brief full-screen effect to mark the boundary. Implement three styles as a global param `sectionWipeStyle`:

- `"flash"` — existing behavior (opacity spike on flashOverlay)
- `"scanline"` — a horizontal bright line sweeps across the screen in 0.15s
- `"shatter"` — screen appears to crack/break using a Voronoi-pattern overlay for 0.3s

Store wipe state as a module-level struct. On `sectionChanged`, activate the wipe. The wipe fades out automatically regardless of what the mode is doing.

---

### FEAT-08 · Color Temperature Gradient Mixing
**Priority:** `LOW` | **Effort:** `Low` | **File:** `visuals.js`

The current `colorTemp` system snaps fog, background, and flash colors to preset hues. Extend it to interpolate smoothly between the previous and current `colorTemp` using `audioBus.transitionFade` (already 0→1 over 0.5s). This creates a cinematic color grade shift.

```js
// visuals.js — updateEffects():
// Instead of direct fog color set, lerp from previous color temp
const prevFogColor = _fogColorMap[prevColorTemp] || _fogColorMap.neutral;
const nextFogColor = _fogColorMap[audio.colorTemp] || _fogColorMap.neutral;
_tempColor.copy(prevFogColor).lerp(nextFogColor, audio.transitionFade);
scene.fog.color.lerp(_tempColor, 0.05);
```

---

### FEAT-09 · Real Post-Processing Pipeline
**Priority:** `MED` | **Effort:** `High` | **File:** `visuals.js`

The current post-processing is a stub (simplified UnrealBloomPass). Build a real multi-pass pipeline using WebGL render-to-texture ping-pong. Add the following effects as global param toggles:

| Effect | Param Key | Trigger |
|--------|-----------|---------|
| Chromatic Aberration | `chromaticAberration` | treble intensity |
| Radial Blur | `radialBlur` | zoom punch magnitude |
| RGB Glitch | `rgbGlitch` | gunshot detection |
| Vignette | `vignette` | always, strength param |
| CRT Scanlines | `crtScanlines` | manual toggle |

Each effect is implemented as a GLSL fragment shader that reads from the previous render target and writes to the next.

---

### FEAT-10 · Camera Path Recording & Playback
**Priority:** `LOW` | **Effort:** `High` | **File:** `visuals.js`

Allow recording camera keyframes during playback. Press a configurable key (default: `C`) to stamp a keyframe with `{ time, position, fov, lookAt }`. During subsequent playback from the same position, automatically interpolate (cubic spline) between keyframes. Store paths in `localStorage` keyed by track filename hash.

**New UI controls needed:**
- "Record Camera Path" toggle button in transport bar
- "Clear Camera Path" button
- Visual indicator when path is recording/playing

---

## 3.3 Marker System Additions

---

### FEAT-11 · Auto-Detect Sections from Audio
**Priority:** `MED` | **Effort:** `High` | **File:** `markers.js` + `ui.js`

Add an "Auto-Detect Sections" button. Algorithm:

1. Build an energy profile by sampling `energyHistory` at 0.5s intervals across the full track
2. Find sustained high-energy regions → `drop` or `climax` markers
3. Find sharp energy rises preceding high-energy → `buildup` markers
4. Find sustained low-energy regions → `breakdown` or `intro`/`outro` markers
5. Find energy plateaus → `verse` markers

Show a preview of detected markers before committing (allow user to review/discard). Add to markers panel as `🔍 Auto-Detect` button.

---

### FEAT-12 · Marker Export / Import UI
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js` + `markers.js`

`MarkerSystem.exportMarkers()` and `importMarkers()` already exist but are not wired to any UI. Add:

- **Export Markers** button → downloads `markers_${trackName}.json`
- **Import Markers** button → file picker for `.json` files
- **Auto-load** — when a track is loaded, hash the filename and check `localStorage` for saved markers matching that hash. If found, auto-load them with a toast notification: *"Loaded saved markers for this track"*

---

### FEAT-13 · Marker Timeline Zoom
**Priority:** `LOW` | **Effort:** `Med` | **File:** `ui.js`

The marker track becomes crowded with many markers. Add zoom functionality:

- Scroll wheel over the marker track zooms in/out (shows a sub-range of the timeline)
- When zoomed, the visible range is indicated by a minimap at the bottom
- Clicking outside the zoom window seeks to that position
- Double-click the marker track to reset zoom to full view

---

### FEAT-14 · Marker Context Menu (Nudge / Change Type / Delete)
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js`

Right-click on a marker dot currently only deletes it. Replace with a context menu:

- **Jump To** — seek to marker time
- **Nudge -0.1s / +0.1s** — fine-tune marker position
- **Change Type** — sub-menu with all section types
- **Delete** — with 1-click confirm

```js
// ui.js — marker dot contextmenu handler
dot.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMarkerContextMenu(e.clientX, e.clientY, m);
});
```

---

## 3.4 Recording System Additions

---

### FEAT-15 · Scheduled Recording (Record N Seconds)
**Priority:** `MED` | **Effort:** `Low` | **File:** `recorder.js` + `ui.js`

Add "Record 30s / 60s / Custom" quick buttons. When clicked, recording starts immediately and auto-stops after the specified duration. Show a countdown in the REC overlay: `● REC 0:23 / 0:30`.

---

### FEAT-16 · Recording Quality Presets
**Priority:** `LOW` | **Effort:** `Low` | **File:** `recorder.js`

The bitrate is hardcoded at 16 Mbps. Add quality presets as a global param:

| Preset | Bitrate | Resolution |
|--------|---------|------------|
| Draft | 4 Mbps | 0.5× canvas |
| Standard | 16 Mbps | 1× canvas |
| Archive | 40 Mbps | 1× canvas |

```js
// recorder.js — use param to set bitrate
const QUALITY_PRESETS = {
    draft:    { videoBitsPerSecond: 4_000_000,  scale: 0.5 },
    standard: { videoBitsPerSecond: 16_000_000, scale: 1.0 },
    archive:  { videoBitsPerSecond: 40_000_000, scale: 1.0 },
};
```

---

### FEAT-17 · Animated GIF Export
**Priority:** `LOW` | **Effort:** `High` | **File:** `recorder.js`

Add a GIF export mode using a pure-JS GIF encoder (e.g. `gif.js` from CDN). Capture a configurable duration (2–5 seconds) at 15–24fps, then encode and download. Cap resolution at 480p to keep file size manageable.

```html
<!-- Add to index.html -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js"></script>
```

---

---

# 04 · New Visual Modes

> Add each as a new file in `js/modes/` and register in `app.js` `registerModes()`.

---

## MODE-01 · "Gravity Well" — Reactive Physics
**Complexity:** High

A field of thousands of particles orbiting dynamic gravity wells. Each well's mass and position is driven by different audio bands. Sub-bass contracts wells (particles pulled inward). Treble spikes scatter particles outward. Beat triggers implosion bursts.

**Key params:**
- `wellCount` — 2–8 gravity wells
- `particleCount` — 5,000–30,000
- `gravityStrength` — overall force scale
- `audioMap` — which band drives which well
- `colorMode` — velocity magnitude / distance to well / palette

**Audio mapping:**
- `smoothBands.sub` → well mass
- `smoothBands.treble` → repulsion pulse strength
- `beat` → synchronized implosion burst across all wells
- `isDrop` → wells merge into single mega-well explosion

---

## MODE-02 · "Navier-Stokes Field" — Fluid Simulation
**Complexity:** High

A 2D Eulerian fluid simulation rendered on a WebGL grid using Jos Stam's "Stable Fluids" algorithm implemented as GLSL shaders in a ping-pong framebuffer pair. Audio bands inject velocity at different grid positions.

**Key params:**
- `gridResolution` — 128 / 256 / 512
- `viscosity` — fluid thickness
- `diffusion` — color spread rate
- `velocityScale` — overall injection strength
- `colorMode` — palette gradient / frequency-mapped hue

**Audio mapping:**
- `smoothBands.sub` → large circular vortex injection center
- `smoothBands.treble` → high-frequency turbulence injection
- `beat` → velocity spike at random point
- Drop → massive multi-point injection burst

---

## MODE-03 · "Cyber Skyline" — Generative City
**Complexity:** Med

A procedurally generated city grid viewed from above or street level. Buildings pulse with window lights driven by frequency bands. Traffic-like particle streams flow through streets. Camera slowly orbits. On drop, buildings morph into abstract towers.

**Key params:**
- `buildingCount` — 200–800
- `viewMode` — aerial, street, orbit
- `windowDensity` — lights per building face
- `trafficDensity` — particle streams in streets
- `glowIntensity` — neon sign bloom

---

## MODE-04 · "Boids Storm" — Biological Swarm
**Complexity:** Med

Reynolds' Boids algorithm with up to 15,000 agents. Separation, alignment, and cohesion forces are modulated by audio bands. Bass increases cohesion (flock tightens). Treble increases separation (flock scatters). Beat triggers predator avoidance bursts.

**Key params:**
- `agentCount` — 1,000–15,000
- `separationForce` / `alignmentForce` / `cohesionForce`
- `audioMapping` — which band drives which force
- `trailLength` — agent history length
- `colorMode` — heading angle / speed / palette

---

## MODE-05 · "Atmosphere" — Volumetric Clouds
**Complexity:** High

Raymarched volumetric noise clouds in a GLSL fragment shader. Cloud density modulated by RMS and energy. Lightning-like flashes discharge on drop using exponential glow in the cloud core. Soft color gradients shift with `colorTemp`.

**Key params:**
- `cloudDensity` — base density
- `noiseOctaves` — cloud detail (4–8 FBM layers)
- `lightColor` — sky gradient tint
- `lightningEnabled` — trigger on gunshot/drop
- `sunPosition` — controls light scatter direction

---

## MODE-06 · "Mandalic" — Sacred Geometry
**Complexity:** Med

Layered radial geometry rendered with `THREE.Line` segments. Concentric rings, polygons, and Flower-of-Life patterns. Each ring responds to a different frequency band. Rings rotate at different speeds. Beat causes a synchronized angle snap.

**Key params:**
- `ringCount` — 3–12
- `pattern` — circle, polygon, lotus, merkaba, metatron, sri-yantra
- `beatSnapAngle` — 30° / 45° / 60° / off
- `rotationVariance` — how different each ring speed is
- `colorMode` — gradient wash / frequency-mapped per ring

---

## MODE-07 · "Mercury Flow" — Liquid Metal
**Complexity:** Med

A metallic fluid surface using environment-mapped reflective material on a subdivided plane geometry. Surface displaced every frame by audio frequency data as a heightmap. Normals recalculated each frame. Droplets spawn on beat.

**Key params:**
- `surfaceResolution` — 64 / 128 / 256 subdivisions
- `displacementSource` — frequency bars / waveform / energy
- `reflectivity` — metallic sheen intensity
- `dropletCount` — spawned on beat
- `colorTint` — applied over reflection

---

## MODE-08 · "Mandelbrot Live" — Fractal Zoom
**Complexity:** Med

Real-time Mandelbrot/Julia set renderer in GLSL. Zoom level driven by audio energy (slowly diving deeper). The Julia set parameter `c` spirals driven by `wobbleLFO`. Color banding speed driven by BPM.

**Key params:**
- `fractalType` — Mandelbrot, Julia, Burning Ship, Newton
- `maxIterations` — 64–512 (performance sensitive)
- `zoomRate` — how fast energy drives zoom
- `colorCycleSpeed` — palette animation speed
- `smoothColoring` — distance estimator anti-banding toggle

---

## MODE-09 · "Shape Shifter" — Topology Transformer
**Complexity:** Med

A single mesh that continuously morphs between topologically distinct surfaces using vertex-to-vertex interpolation. Holds 10 target shapes in GPU memory. Blends between them based on beat and section markers. Drop triggers instant morph burst.

**Key params:**
- `morphSpeed` — audio-driven lerp rate
- `beatMorphTrigger` — snap to next target on bass beat
- `targetLibrary` — which shapes are in the rotation pool
- `easing` — linear / ease-in / elastic / bounce

---

## MODE-10 · "Lyric Storm" — Text Visualizer
**Complexity:** High

Users paste in lyrics or any text. Words appear, scale, and shatter in 3D space synchronized to the music. Beat causes words to expand and fragment into letter particles. Uses `THREE.TextGeometry` with font loader.

**Key params:**
- `textContent` — multi-line text input
- `wordTimings` — manual click-to-place or auto-distribute
- `fragmentationStyle` — shatter / scatter / dissolve / explode
- `fontStyle` — bold / thin / italic
- `colorMode` — palette / frequency / rainbow

---

---

# 05 · UI / UX Improvements

---

## 5.1 Transport Bar

---

### UI-01 · Seek Bar Waveform Preview
**Priority:** `MED` | **Effort:** `Med` | **File:** `ui.js`

Replace the plain `<input type="range">` seek bar with a canvas element overlaid with the audio waveform. When a file is loaded, decode the audio buffer at low resolution (512 points) and draw a filled waveform behind the seek handle. Tint it to the current color palette. Marker regions overlay as transparent colored bands.

The seek handle overlays on top and drag behavior is identical to the current implementation.

---

### UI-02 · Beat-Pulse Play Button Ring
**Priority:** `LOW` | **Effort:** `Low` | **File:** `ui.js` + CSS

Add a subtle pulsing CSS glow ring around the play button that activates on every beat. Pulse intensity scales with `beatIntensity`. Color shifts to match `colorTemp`. Gives the user a visual beat indicator without needing the full visualizer.

```css
/* CSS */
#btn-play.beat-pulse {
    box-shadow: 0 0 12px 4px var(--accent);
    transition: box-shadow 0.05s ease-out;
}
```

```js
// ui.js — in updateTransport()
if (bus.beat) {
    _playBtn.classList.add('beat-pulse');
    setTimeout(() => _playBtn.classList.remove('beat-pulse'), 80);
}
```

---

### UI-03 · VU Meter Level Display
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js` + CSS

Replace the current simple `level-fill` bar with a proper vertical VU meter with 10 segments that light green → yellow → red. Add a peak-hold indicator that stays at maximum for 2 seconds then slowly falls.

```
● ● ← RED    (> 0.85)
● ● ← ORANGE (> 0.70)
● ● ← YELLOW (> 0.55)
● ● ← GREEN  (> 0.30)
● ● ← GREEN  (always)
```

---

### UI-04 · Track Progress Arc Around BPM Badge
**Priority:** `LOW` | **Effort:** `Low` | **File:** `ui.js`

Display track progress as a thin SVG arc drawn around the BPM badge. The arc fills as the track progresses. Section colors are visible as arc segments, giving a compact visual summary of the timeline structure. On loop, it resets with a brief flash.

---

## 5.2 Mode Panel

---

### UI-05 · Mode Favorites / Pin to Top
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js`

Let users star/favorite modes. Starred modes appear in a "★ Favorites" section at the top of the mode list. Persist to `localStorage`. Show a ★ button on each mode item on hover (CSS `:hover` reveal).

```js
// ui.js
const favKey = 'aura_favorite_modes';
function getFavorites() { return JSON.parse(localStorage.getItem(favKey) || '[]'); }
function toggleFavorite(key) {
    const favs = getFavorites();
    const idx = favs.indexOf(key);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(key);
    localStorage.setItem(favKey, JSON.stringify(favs));
    updateModeList(); // re-render
}
```

---

### UI-06 · Mode Category Grouping
**Priority:** `LOW` | **Effort:** `Low` | **File:** `ui.js`

Add a `category` property to each mode definition. Group the mode list by category with collapsible headers. Add a category filter dropdown at the top of the modes panel.

Suggested categories: `Geometry`, `Particles`, `Shaders`, `Abstract`, `Space`, `Organic`

---

### UI-07 · Mode Preview Thumbnail on Hover
**Priority:** `LOW` | **Effort:** `High` | **File:** `ui.js`

When hovering a mode in the list for > 500ms, show a small animated thumbnail (120×80 canvas) in a tooltip running the mode's `update()` at low resolution with synthetic silent audio data. This lets users preview modes without switching. Render at 15fps to reduce CPU impact.

---

### UI-08 · "Random on Drop" Mode
**Priority:** `LOW` | **Effort:** `Low` | **File:** `ui.js` + `visuals.js`

Add a toggle "🎲 Random on Drop" in the modes panel header. When enabled, every time a `DROP` or `CLIMAX` section starts (`audioBus.sectionChanged && audioBus.sectionType === 'drop'`), automatically switch to a random mode from the mode list. Creates surprise variety in live performances.

---

## 5.3 Parameters Panel

---

### UI-09 · Parameter Lock / Protect
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js` + `params.js`

Add a 🔒 icon next to each parameter. When locked, the `Randomize` button skips that parameter. This lets users protect a carefully tuned base palette while randomizing everything else.

```js
// params.js — add lockedParams Set
const lockedParams = new Set();
function isLocked(key) { return lockedParams.has(key); }
function toggleLock(key) {
    if (lockedParams.has(key)) lockedParams.delete(key);
    else lockedParams.add(key);
}

// In randomize():
for (const [key, schema] of Object.entries(currentModeSchema)) {
    if (isLocked(key)) continue; // skip locked params
    // ... randomize
}
```

---

### UI-10 · Preset Sharing via URL Hash
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js`

Add an "🔗 Share" button that encodes the current preset as base64 JSON in the URL hash (`#preset=...`). On page load, check for this hash and auto-apply the preset. This requires no server — entirely client-side.

```js
// Export:
const encoded = btoa(JSON.stringify({ mode, global, mode_params }));
window.location.hash = `preset=${encoded}`;

// On load:
const hash = window.location.hash;
if (hash.startsWith('#preset=')) {
    const data = JSON.parse(atob(hash.slice(8)));
    applyPreset(data);
}
```

---

### UI-11 · Param Animation Keyframes (Automation)
**Priority:** `LOW` | **Effort:** `High` | **File:** `ui.js` + `params.js`

Add a "Record Params" button. While active, every param change is timestamped as `{ time, key, value }`. On playback from the same position, params animate to match the recorded changes. This is "parameter automation" similar to a DAW. Store automation data alongside presets in `localStorage`.

---

## 5.4 Overall UX

---

### UI-12 · Toast Notification System
**Priority:** `HIGH` | **Effort:** `Med` | **File:** `ui.js`

Replace all `alert()` and `console.log` calls in user-facing flows with non-blocking toast notifications. Toasts appear at bottom-left, slide in, and auto-dismiss after 2.5 seconds.

```js
// ui.js — Toast module
const Toast = {
    container: null,
    init() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.style.cssText = `position:fixed;bottom:80px;left:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;`;
        document.body.appendChild(this.container);
    },
    show(message, type = 'info') { // type: 'info' | 'success' | 'error' | 'warning'
        const toast = document.createElement('div');
        const colors = { info: '#2563EB', success: '#059669', error: '#DC2626', warning: '#D97706' };
        toast.style.cssText = `background:rgba(0,0,0,0.85);color:white;padding:10px 16px;border-radius:8px;font-size:13px;border-left:3px solid ${colors[type]};max-width:280px;animation:toastIn 0.2s ease;`;
        toast.textContent = message;
        this.container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
};
```

**Replace these existing calls:**
- `alert('Failed to load audio file...')` → `Toast.show('Failed to load audio', 'error')`
- Mode switch logged to console → `Toast.show('Mode: ${name}', 'info')`
- Preset saved → `Toast.show('Preset saved ✓', 'success')`
- Recording started → `Toast.show('Recording started 🔴', 'info')`

---

### UI-13 · Onboarding Tour (First Visit)
**Priority:** `LOW` | **Effort:** `Med` | **File:** `ui.js`

On first visit (detected via `localStorage.getItem('aura_visited')`), show a 5-step guided tour:
1. **Drop Zone** — "Drop a music file here or click Import"
2. **Modes Panel** — "Browse 30+ visual modes here"
3. **Params Panel** — "Fine-tune every parameter in real time"
4. **Markers** — "Mark sections of your track for reactive effects"
5. **Record** — "Record your session in HD"

Each step highlights the relevant element with a pulsing glow ring overlay. Dismissible. Re-launchable via the `?` button secondary action.

---

### UI-14 · Mobile Layout Overhaul
**Priority:** `MED` | **Effort:** `High` | **File:** `ui.js` + CSS

Current layout breaks on mobile screens. For viewports < 768px:

- Both panels collapse into **bottom sheets** that slide up with a swipe gesture
- Transport bar uses larger touch targets (minimum 44×44px per WCAG 2.1)
- BPM badge, section indicator, and level meter are hidden by default (expandable)
- Swipe left/right on the canvas to change mode
- Volume control becomes a vertical slider in the side panel
- Marker track is hidden until explicitly opened (tap the timeline icon)

---

### UI-15 · Accessibility Improvements
**Priority:** `MED` | **Effort:** `Med` | **File:** `ui.js` + `index.html`

Current issues to fix:

- All icon-only buttons lack `aria-label` (some have it, most don't)
- All `<input type="range">` sliders need `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- The shortcuts modal needs `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Focus should trap inside open modals and return to trigger element on close
- Add visible focus rings that use `var(--accent)` color
- The canvas element should have `aria-label="Audio reactive visualization canvas"`

---

---

# 06 · Architecture & Code Quality

---

## 6.1 Module System

---

### ARCH-01 · Convert to ES Modules
**Priority:** `LOW` | **Effort:** `High` | **All Files**

All files rely on implicit globals loaded via ordered `<script>` tags. Wrong tag order crashes the app silently. Migrate to ES modules.

```js
// audio.js
export const AudioEngine = (() => { ... })();

// visuals.js
import { AudioEngine } from './audio.js';
export const VisualEngine = (() => { ... })();

// index.html
<script type="module" src="js/app.js"></script>
```

Benefits: explicit dependency graph, no global namespace pollution, enables tree-shaking, better IDE support.

---

### ARCH-02 · Lazy Mode Loading via Dynamic Import
**Priority:** `LOW` | **Effort:** `Med` | **File:** `app.js` + `visuals.js`

Currently all 30+ mode files are parsed and executed on page load even if the user never uses them. Switch to dynamic `import()`:

```js
// app.js — register modes as lazy loaders
VisualEngine.registerModeLazy('gravityWell', () => import('./modes/gravityWell.js'));

// visuals.js — setMode() loads the module on first use
async function setMode(key) {
    if (lazyLoaders[key] && !modes[key]) {
        const mod = await lazyLoaders[key]();
        modes[key] = mod.default;
    }
    // ... activate mode
}
```

---

### ARCH-03 · Event Bus for Cross-Module Communication
**Priority:** `LOW` | **Effort:** `Med` | **New File:** `eventbus.js`

Modules currently call each other directly. Create a lightweight EventBus to reduce coupling:

```js
// eventbus.js
const EventBus = {
    _listeners: {},
    on(event, fn) { (this._listeners[event] = this._listeners[event] || []).push(fn); },
    off(event, fn) { this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn); },
    emit(event, data) { (this._listeners[event] || []).forEach(fn => fn(data)); }
};

// Usage:
EventBus.on('beat', ({ intensity }) => { /* react */ });
EventBus.emit('beat', { intensity: audioBus.beatIntensity });
```

---

### ARCH-04 · WebWorker for Heavy Audio Analysis
**Priority:** `LOW` | **Effort:** `High` | **New File:** `audio-worker.js`

Move throttled analysis functions to a Web Worker using `SharedArrayBuffer` for zero-copy data transfer:

```js
// Main thread:
const sharedFreq = new SharedArrayBuffer(2048);
const freqView = new Uint8Array(sharedFreq);
const worker = new Worker('./js/audio-worker.js');
worker.postMessage({ type: 'init', sharedFreq });

// audio-worker.js receives freqData, computes harmonic/rhythm/spectral analysis,
// posts results back to main thread
worker.onmessage = ({ data }) => {
    Object.assign(audioBus, data.results);
};
```

Functions to move: `computeHarmonicAnalysis`, `computeRhythmAnalysis`, `computeSpectralFeatures`, `computeSpectralDynamics`

---

## 6.2 Code Quality

---

### ARCH-05 · JSDoc AudioBus Type Definition
**Priority:** `MED` | **Effort:** `Med` | **File:** `audio.js`

The `audioBus` object has ~65 properties. Add `@typedef` JSDoc so any developer or AI assistant working on modes gets full autocomplete.

```js
/**
 * @typedef {Object} AudioBus
 * @property {Uint8Array} frequencyData - Raw FFT frequency data (0-255)
 * @property {Uint8Array} timeDomainData - Raw waveform data (0-255)
 * @property {{sub:number, bass:number, lowMid:number, mid:number, highMid:number, treble:number, brilliance:number}} smoothBands - Smoothed 0-1 band energies
 * @property {boolean} beat - True on beat detection frame
 * @property {number} beatIntensity - Beat strength 0-1
 * @property {number} beatPhase - 0-1 position within current beat cycle
 * @property {number} bpm - Estimated BPM
 * @property {number} rms - Overall loudness 0-1
 * @property {Float32Array} waveformPoints - 256-point waveform
 * @property {string|null} sectionType - Current marker section type
 * @property {number} masterIntensity - Combined intensity multiplier
 * ... etc
 */
```

---

### ARCH-06 · Mode Interface Validation
**Priority:** `LOW` | **Effort:** `Low` | **File:** `visuals.js`

Add a `validateMode()` function called during `registerMode()` that warns if required methods are missing.

```js
function validateMode(key, modeObj) {
    const required = ['name', 'update'];
    const recommended = ['init', 'destroy', 'params'];
    required.forEach(m => {
        if (!(m in modeObj)) console.error(`Mode "${key}" missing required property: ${m}`);
    });
    recommended.forEach(m => {
        if (!(m in modeObj)) console.warn(`Mode "${key}" missing recommended property: ${m}`);
    });
}
```

---

### ARCH-07 · Consistent Error Handling
**Priority:** `MED` | **Effort:** `Med` | **New File:** `errorhandler.js`

Define a global `ErrorHandler` module:

```js
const ErrorHandler = {
    log(context, error) {
        console.error(`[${context}]`, error);
        // optionally send to analytics
    },
    modeError(modeKey, frameNumber, error) {
        this.log(`Mode:${modeKey} frame:${frameNumber}`, error);
    }
};
```

Replace all `console.warn('Mode error...')` patterns in `visuals.js` with `ErrorHandler.modeError()`.

---

---

# 07 · Creative Add-Ons & Wild Ideas

---

## 7.1 AI-Powered Features

---

### CREATIVE-01 · Generative Color Palette from Text
**Priority:** `LOW` | **Effort:** `Med`

Add a text field in the params panel: "Describe a color mood". Parse keywords to generate a palette:

```js
const moodPalettes = {
    'sunset': (t) => `hsl(${t * 50 + 5}, 90%, ${45 + t * 30}%)`,
    'deep ocean': (t) => `hsl(${200 + t * 30}, 80%, ${15 + t * 35}%)`,
    'acid rain': (t) => `hsl(${80 + t * 60}, 100%, ${40 + t * 20}%)`,
    'void': (t) => `hsl(${270 + t * 30}, 60%, ${5 + t * 25}%)`,
    // ... more
};
// Map user input to closest keyword using simple word matching
// Then inject the palette function into ParamSystem.palettes
```

---

### CREATIVE-02 · Genre-Aware Default Configuration
**Priority:** `LOW` | **Effort:** `Med` | **File:** `audio.js` + `ui.js`

Analyze the first 10 seconds of a loaded track to classify its genre. Use spectral features: bass-heavy with strong kick → EDM; mid-heavy with complex rhythm → Hip-Hop; wide dynamic range, sparse → Classical.

Show a suggestion banner: *"Sounds like EDM — try Hyperforge with Drop markers?"* with a one-click "Apply Suggestion" button.

---

## 7.2 Social & Sharing

---

### CREATIVE-03 · Visual Snapshot Gallery
**Priority:** `LOW` | **Effort:** `Med` | **File:** `ui.js`

Auto-capture a screenshot every time a `drop` or `climax` section starts (if markers are set). Store up to 12 in memory as a `<canvas>` grid. Access via a new `📸 Gallery` button in the transport bar. User can download any individual snapshot.

---

### CREATIVE-04 · Streaming Mode (OBS-Ready)
**Priority:** `MED` | **Effort:** `Low` | **File:** `ui.js`

Add a "Streaming Mode" triggered via `?streaming=true` URL param or a keyboard shortcut (`Shift+S`). In streaming mode:
- All UI panels are hidden
- Transport bar is hidden
- Background is pure black
- Window maximizes
- Canvas fills 100% viewport with no letterboxing

---

## 7.3 Visual Novelties

---

### CREATIVE-05 · Feedback Loop Effect (Infinite Mirror)
**Priority:** `MED` | **Effort:** `Med` | **File:** `visuals.js`

Implement a framebuffer feedback effect: each frame, the previous frame is blended back into the current render at reduced opacity, creating psychedelic trailing afterimages.

```
1. Render current scene → renderTargetA
2. Blit renderTargetA to screen at 100% opacity
3. On next frame, first blit renderTargetA at 0.88 opacity (the "echo")
4. Then render current frame on top at 100%
```

Blend amount driven by `audioBus.energySmooth`. Add as a global toggle param `feedbackLoop` with a `feedbackDecay` slider (0.70–0.98).

---

### CREATIVE-06 · Screen Mirror / Kaleidoscope Overlay
**Priority:** `LOW` | **Effort:** `Med` | **File:** `visuals.js`

A global post-process toggle that reflects or tiles the rendered scene geometrically. Modes: bilateral (Y-axis mirror), quad (4-way), hex (6-way). Achieved by rendering the scene to a texture then applying a GLSL shader that remaps UV coordinates.

The mirror axis angle can oscillate with `wobbleLFO` for a living, breathing kaleidoscope effect from any base mode.

---

### CREATIVE-07 · Perlin Warp Distortion
**Priority:** `LOW` | **Effort:** `Med` | **File:** `visuals.js`

A global post-process GLSL shader that warps screen UVs with 2D Perlin noise. The noise field evolves over time driven by `smoothBands.bass`. Creates a heat-haze / liquid lens distortion effect. Intensity param 0–1. Only activates above a bass threshold so it feels reactive.

```glsl
// Fragment shader warp
vec2 uv = vUv;
float warpX = noise(uv * 3.0 + time * 0.5) * warpIntensity;
float warpY = noise(uv * 3.0 + time * 0.5 + 47.0) * warpIntensity;
uv += vec2(warpX, warpY);
gl_FragColor = texture2D(tDiffuse, uv);
```

---

### CREATIVE-08 · 3D Spectrum Waterfall
**Priority:** `MED` | **Effort:** `Med` | **New Mode**

Extend the existing spectrogram concept into 3D: frequency data scrolls backward in Z-depth over time, creating a mountainous landscape of frequency history. Each row is a `THREE.Line` colored by its energy level. Fog creates natural depth. Camera orbits slowly.

This is a classic "Winamp-era" visualizer elevated with modern 3D rendering.

---

### CREATIVE-09 · Noise Painting Canvas
**Priority:** `LOW` | **Effort:** `Med` | **New Mode**

A generative art canvas where music literally "paints" onto a persistent 2D surface:
- Bass beats drip new paint flows downward (fluid simulation approximation)
- Mid energy drives swirling brush strokes
- Treble adds fine splatter points
- Painting accumulates over the entire track duration
- Optional: "Reset Canvas" on mode switch vs. keep painting across modes

The final result is a unique piece of generative art created by the music.

---

### CREATIVE-10 · Constellation Harmonics
**Priority:** `LOW` | **Effort:** `Med` | **New Mode**

Connect points in the frequency spectrum with lines based on harmonic relationships. Frequencies at integer ratios (2:1, 3:2, 4:3, 5:4) are connected with glowing lines of varying thickness. The constellation updates with the audio, creating a visual representation of the harmonic structure of the music.

Color: consonant intervals (octave, fifth) get warm colors. Dissonant intervals get cooler, more unstable colors.

---

## 7.4 Mode-Specific Enhancements

---

### CREATIVE-11 · GeometryForge2: Reaction-Diffusion Texture
**Priority:** `LOW` | **Effort:** `High` | **File:** `geometryShapes2.js`

Add a `"reaction-diffusion"` option to `surfacePattern`. Implement Gray-Scott reaction-diffusion in a ping-pong WebGL framebuffer. The Turing pattern grows across the mesh surface texture and is driven by audio energy. High bass = faster reaction speed. Creates organic-looking spots, stripes, and maze patterns that pulse with the music.

---

### CREATIVE-12 · HyperforgeMode2: GPGPU Attractor Particles
**Priority:** `LOW` | **Effort:** `High` | **File:** `hyperforge2.js`

Move the attractor particle integration from JavaScript to GPGPU (GPU compute via render-to-texture). This allows 500,000+ attractor particles instead of the current 8,000 limit. Lorenz/Rössler equations implemented in GLSL with audio parameters as uniforms.

```glsl
// GPGPU position update shader
uniform float dt;
uniform float sigma, rho, beta; // Lorenz params, driven by audio uniforms
uniform float audioMod;

void main() {
    vec4 pos = texture2D(tPositions, vUv);
    float dx = sigma * (pos.y - pos.x) * dt * audioMod;
    float dy = (pos.x * (rho - pos.z) - pos.y) * dt;
    float dz = (pos.x * pos.y - beta * pos.z) * dt;
    gl_FragColor = pos + vec4(dx, dy, dz, 0.0);
}
```

---

### CREATIVE-13 · Starfield: Deep Space Nebula Generator
**Priority:** `LOW` | **Effort:** `Med` | **File:** `js/modes/starfield.js`

Enhance the existing starfield mode:
- Volumetric nebula clouds using layered billboard sprites with additive blending
- Stars with spectral color classification (O-type = blue, G-type = yellow, M-type = red)
- Audio energy drives nebula cloud density
- Shooting stars emit on `gunShotDetected`
- Pulsar flicker effect on bass beats (random star temporarily brightens 10×)
- Black hole center that warps nearby stars on `isDrop`

---

---

# 08 · Master Priority Table

| # | Item | Priority | Effort | File(s) |
|---|------|----------|--------|---------|
| 01 | BUG-01: Double RAF on tab restore | `HIGH` | Low | `app.js` |
| 02 | BUG-02: iOS AudioContext suspended | `HIGH` | Low | `audio.js` |
| 03 | BUG-04: Seek bar stuck after off-window mouseup | `HIGH` | Low | `ui.js` |
| 04 | BUG-09: Mirror mesh VRAM leak on mode switch | `HIGH` | Med | `geometryShapes2.js` |
| 05 | BUG-08: Bloom strength accumulation | `HIGH` | Low | `visuals.js` |
| 06 | PERF-01: spectralFeatures throttle | `HIGH` | Low | `audio.js` |
| 07 | PERF-05: disposeMaterial array literal | `HIGH` | Low | `visuals.js` |
| 08 | PERF-07: Section indicator DOM cache | `HIGH` | Low | `ui.js` |
| 09 | UI-12: Toast notification system | `HIGH` | Med | `ui.js` |
| 10 | FEAT-04: Tap Tempo visual feedback | `HIGH` | Low | `ui.js` |
| 11 | FEAT-06: Per-mode camera tween | `MED` | Med | `visuals.js` |
| 12 | FEAT-07: Section transition wipe | `MED` | Med | `visuals.js` |
| 13 | FEAT-08: Color temp gradient mixing | `MED` | Low | `visuals.js` |
| 14 | FEAT-11: Auto-detect sections | `MED` | High | `markers.js` + `ui.js` |
| 15 | FEAT-12: Marker export/import UI | `MED` | Low | `ui.js` + `markers.js` |
| 16 | UI-01: Seek bar waveform preview | `MED` | Med | `ui.js` |
| 17 | UI-03: VU meter level display | `MED` | Low | `ui.js` |
| 18 | UI-05: Mode favorites / pin to top | `MED` | Low | `ui.js` |
| 19 | UI-09: Parameter lock/protect | `MED` | Low | `ui.js` + `params.js` |
| 20 | UI-10: Preset sharing via URL hash | `MED` | Low | `ui.js` |
| 21 | UI-14: Mobile layout overhaul | `MED` | High | `ui.js` + CSS |
| 22 | UI-15: Accessibility improvements | `MED` | Med | `ui.js` + HTML |
| 23 | FEAT-01: Musical key detection | `MED` | Med | `audio.js` |
| 24 | FEAT-09: Real post-processing pipeline | `MED` | High | `visuals.js` |
| 25 | CREATIVE-04: Streaming mode | `MED` | Low | `ui.js` |
| 26 | CREATIVE-05: Feedback loop effect | `MED` | Med | `visuals.js` |
| 27 | CREATIVE-08: 3D spectrum waterfall | `MED` | Med | new mode |
| 28 | NEW MODE: Gravity Well physics | `MED` | High | `modes/gravityWell.js` |
| 29 | NEW MODE: Navier-Stokes fluid | `MED` | High | `modes/fluidSim.js` |
| 30 | BUG-10: Waveform points GC | `MED` | Low | `audio.js` |
| 31 | PERF-04: BPM ring buffer | `MED` | Low | `audio.js` |
| 32 | ARCH-07: Consistent error handling | `MED` | Med | all files |
| 33 | UI-06: Mode category grouping | `LOW` | Low | `ui.js` |
| 34 | UI-13: Onboarding tour | `LOW` | Med | `ui.js` |
| 35 | FEAT-10: Camera path recording | `LOW` | High | `visuals.js` |
| 36 | ARCH-01: ES Modules migration | `LOW` | High | all files |
| 37 | ARCH-02: Lazy mode loading | `LOW` | Med | `app.js` + `visuals.js` |
| 38 | ARCH-04: WebWorker audio analysis | `LOW` | High | new file |
| 39 | NEW MODE: Boids Storm | `LOW` | Med | `modes/boidsStorm.js` |
| 40 | NEW MODE: Mandelbrot Live | `LOW` | Med | `modes/mandelbrotLive.js` |
| 41 | NEW MODE: Mandalic geometry | `LOW` | Med | `modes/mandalic.js` |
| 42 | NEW MODE: Mercury Flow | `LOW` | Med | `modes/mercuryFlow.js` |
| 43 | CREATIVE-12: GPGPU attractor particles | `LOW` | High | `hyperforge2.js` |
| 44 | FEAT-17: Animated GIF export | `LOW` | High | `recorder.js` |

---

---

# 09 · Implementation Notes for AI

---

## 9.1 Hard Constraints

> **⚠️ Three.js r128 only.** The project loads Three.js r128 from CDN. Do NOT use any APIs added after r128. Specifically: no `CapsuleGeometry` (added r142), no `WebGPURenderer`, no `BatchedMesh`. Before adding any Three.js feature, verify it exists in r128.

> **⚠️ No build system.** There is no webpack/rollup/vite. All JS files are loaded via `<script>` tags in `index.html` in dependency order. Any new file must be added as a `<script src="js/...">` tag. New mode files go in `js/modes/` and need a tag before `js/app.js`.

> **⚠️ Modes are global object literals.** Each mode is declared as `const ModeName = { name, params, init, update, destroy }` at global scope. The constant must be globally accessible before `app.js` runs. Do not wrap modes in async functions or IIFE.

> **⚠️ Shared geometry pattern.** GeometryForge2 and HyperforgeMode2 use a single `BufferGeometry` instance shared between solid mesh and wireframe mesh. This is intentional — position buffer updates auto-propagate to both meshes. Do not break this sharing pattern when modifying those modes.

---

## 9.2 Three.js Patterns Used in This Project

- **Pre-allocated scratch objects** are module-level: `_tempColor = new THREE.Color()`, `_tempVec3 = new THREE.Vector3()`. Never `new THREE.Color()` inside an `update()` loop.
- **`disposeMaterial(mat)`** is the project-standard disposal helper. Always use it when removing materials.
- **`camera` is a child of `scene`** because `flashOverlay` is a child of `camera`. Never remove `camera` from `scene`.
- **`renderer.info.render.calls` / `.triangles`** are the primary performance counters. Keep triangles < 300k per frame.
- **`THREE.AdditiveBlending`** is the standard blending for particles and glows.
- **Geometry disposal:** always call `geometry.dispose()` before `scene.remove()` to free VRAM.

---

## 9.3 AudioBus Quick Reference for Mode Developers

When writing a new mode's `update(audioBus, params, dt)`, use these properties:

```
ENERGY & LOUDNESS
  audioBus.rms                     — overall loudness 0–1
  audioBus.smoothBands.sub/.bass/.lowMid/.mid/.highMid/.treble/.brilliance
  audioBus.energySmooth            — slow-follower energy (use for smooth reactions)
  audioBus.masterIntensity         — main "how intense should this be" multiplier

BEAT & RHYTHM
  audioBus.beat                    — true on beat detection frame
  audioBus.beatIntensity           — beat strength 0–1
  audioBus.beatPhase               — 0–1 position within current beat
  audioBus.barPhase                — 0–1 position within 4-beat bar
  audioBus.bpm                     — estimated BPM
  audioBus.bassBeat                — true on bass-specific beat

WAVEFORM
  audioBus.waveformPoints          — Float32Array(256) waveform
  audioBus.frequencyData           — Uint8Array FFT data

SECTION / MARKERS
  audioBus.sectionType             — e.g. "drop", "verse", null
  audioBus.sectionIntensity        — 0.3–2.0 intensity multiplier
  audioBus.sectionEffects          — { shake, flash, zoom, bloom, speed, particleScale, displacementScale }
  audioBus.isDropSection           — true during drop/climax markers
  audioBus.dropSectionIntensity    — chaos level during drop
  audioBus.sectionChanged          — one-shot true on section boundary
  audioBus.transitionFade          — 0→1 over 0.5s after section change
  audioBus.anticipation            — 0→1 approaching a high-energy section

ADVANCED ANALYSIS
  audioBus.onsetDetected           — true on transient/attack
  audioBus.onsetStrength           — 0–1
  audioBus.harmonicRatio           — 0=noise, 1=tonal
  audioBus.fundamentalFreq         — dominant frequency in Hz
  audioBus.wobbleLFO               — -1 to +1 LFO from bass wobble
  audioBus.isDrop                  — auto-detected drop (without markers)

PLAYBACK
  audioBus.isPlaying               — playback state
  audioBus.currentTime             — current position in seconds
  audioBus.duration                — total duration in seconds
```

---

## 9.4 CSS Variables Reference

All UI components should use these custom properties defined in `css/style.css`:

```css
--bg            /* main background */
--panel-bg      /* panel background */
--border        /* border color */
--accent        /* primary accent color */
--accent-dim    /* dimmed accent */
--text          /* primary text */
--text-dim      /* secondary text */
--mono          /* monospace font stack */
--transport-h   /* transport bar height */
```

---

## 9.5 Adding a New Visual Mode — Checklist

```
□ 1. Create js/modes/myMode.js
□ 2. Declare: const MyModeMode = { name, params, init, update, destroy }
□ 3. In init(scene, camera, renderer): set up geometry, materials, add to scene
□ 4. In update(audioBus, params, dt): animate using audioBus properties
□ 5. In destroy(scene): dispose ALL geometries, materials, textures; remove from scene
□ 6. Add <script src="js/modes/myMode.js"></script> to index.html BEFORE app.js
□ 7. In app.js registerModes(): add VisualEngine.registerMode('myMode', MyModeMode)
□ 8. Add an icon entry to getModeIcon() in ui.js
□ 9. Test mode switch in/out 10× to verify no VRAM leak (check renderer.info)
□ 10. Test with silence (no audio file loaded) to ensure no crash
```

---

*AURA Improvement Specification · End of Document*
*Generated March 2026 · 44 improvement items across 9 categories*