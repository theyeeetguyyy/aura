<p align="center">
  <h1 align="center">🎵 AURA</h1>
  <p align="center"><strong>Audio Reactive Visual Generator</strong></p>
  <p align="center">
    Drop your music. Watch it come alive.
  </p>
</p>

---

**AURA** is a real-time audio visualizer that transforms any music file into stunning 3D visuals. Built with **Three.js**, it features **33 unique visual modes**, deep audio analysis, beat-synced effects, and full parameter control — all running in your browser with zero dependencies to install.

## ✨ Features

### 🎧 Audio Engine
- **7-band frequency analysis** — Sub, Bass, Low Mid, Mid, High Mid, Treble, Brilliance
- **Beat & BPM detection** — real-time beat tracking with phase-locked sync
- **Advanced spectral analysis** — spectral flux, centroid, flatness, rolloff, entropy
- **Transient & onset detection** — percussive, tonal, and sibilance classification
- **Harmonic analysis** — fundamental frequency, harmonic ratio, chord density, pitch class
- **Micro-dynamics** — modulation depth, rhythmic density, groove swing
- **Structure-aware sections** — Intro, Verse, Build-up, Drop, Breakdown, Bridge, Climax, Outro

### 🎨 33 Visual Modes

| Mode | Description |
|------|-------------|
| **Frequency Bars** | Classic spectrum analyzer with reactive 3D bars |
| **Particle Storm** | Thousands of particles driven by audio energy |
| **Radial Bloom** | Circular burst patterns synced to beats |
| **Terrain Mesh** | Audio-sculpted landscape that morphs in real time |
| **Waveform Scope** | Oscilloscope-style waveform visualization |
| **Spectrogram** | Scrolling frequency-over-time heat map |
| **Kaleidoscope** | Mirrored geometric patterns with audio reactivity |
| **Shader Tunnel** | Fly-through tunnel driven by audio frequencies |
| **Geometry Forge** | Dynamic 3D geometry that reacts to every beat |
| **Geometry Forge Old** | Legacy geometry mode with alternate behaviors |
| **Hyperforge** | Extreme geometry with complex mathematical shapes |
| **God Rays** | Volumetric light beams pulsing to the music |
| **Particle Field** | Interactive particle manipulation with audio forces |
| **Math Mode** | Mathematical functions visualized through audio |
| **Fractal Tree** | Recursive branching structures driven by sound |
| **Voronoi Field** | Organic cell patterns responsive to frequency bands |
| **Lissajous** | Classic Lissajous curves animated by audio |
| **Möbius Rings** | Twisted ring geometry with beat-synced motion |
| **Grid Distortion** | Deformable grid responding to audio intensity |
| **DNA Helix** | Double helix structure modulated by sound |
| **Polyhedron Explode** | Exploding/imploding polyhedra on beat drops |
| **Starfield** | Warp-speed star field with audio-controlled speed |
| **Nebula** | Cosmic gas clouds shaped by frequency data |
| **Aurora** | Northern lights simulation driven by audio |
| **Cyber Grid** | Retro-futuristic grid with neon aesthetics |
| **Neon Plasma** | Flowing plasma fields with vibrant neon colors |
| **Dimensional Rift** | Reality-tearing portal effects on beat drops |
| **Rhythmic Geometry** | Beat-locked geometric patterns and transformations |
| **SDF Raymarcher** | Raymarched signed-distance-field geometry with boolean ops |
| **Noise Realm** | Layered noise fields with domain warping and FBM |
| **GPGPU Particles** | 65K GPU-simulated particles with curl noise and vortex forces |
| **Fractal Shader** | Mandelbrot, Julia, and Burning Ship fractals with audio zoom |
| **Void Engine** | Raymarched black hole with gravitational lensing and accretion disk |


### 🎛️ Parameter System
- **Global controls** — Reactivity, Smoothing, Screen Shake, Beat Flash, Zoom Punch, Bloom
- **Per-mode parameters** — Each mode exposes its own unique set of tweakable parameters
- **10 color palettes** — Rainbow, Fire, Ocean, Neon, Pastel, Monochrome, Cyberpunk, Aurora, Sunset, Synthwave
- **Preset save/load** — Export and import parameter configurations as JSON
- **Randomize** — One-click random parameter exploration

### 🎬 Recording & Export
- **Video recording** — Capture visuals + audio as MP4 (H.264) or WebM at native resolution
- **Screenshot** — Save the current frame as an image (`Ctrl+S`)

### 📌 Song Markers
- **Section markers** — Tag song sections (Intro, Verse, Build-up, Drop, Breakdown, Bridge, Climax, Outro)
- **Visual timeline** — Markers appear on the seek bar for quick navigation
- **Section-aware visuals** — Effects automatically adapt intensity based on the current section

### 🖱️ Controls
- **Mouse orbit** — Click and drag to rotate the camera around the scene
- **Scroll zoom** — Mouse wheel to zoom in/out
- **Fullscreen** — Press `G` for immersive full-screen mode

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Tab` | Toggle Modes Panel |
| `P` | Toggle Parameters Panel |
| `1-9` | Quick Mode Switch |
| `[ ]` | Previous / Next Mode |
| `← →` | Seek ±5 seconds |
| `↑ ↓` | Volume Up / Down |
| `L` | Toggle Loop |
| `M` | Add Marker |
| `R` | Start / Stop Recording |
| `F` | Toggle Beat Flash |
| `G` | Toggle Fullscreen |
| `D` | Toggle Debug HUD |
| `Ctrl+S` | Screenshot |
| `?` | Show Shortcuts Modal |

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/theyeeetguyyy/aura.git
cd aura
```

### 2. Open in a browser

AURA is a static web app — no build step required. Simply open `index.html` in any modern browser:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Or just open index.html directly in your browser
```

### 3. Drop your music

Drag and drop an audio file onto the welcome screen, or click **Import Audio**. Supported formats:

- MP3
- WAV
- FLAC
- OGG
- M4A
- AAC

## 🏗️ Architecture

```
aura/
├── index.html              # Main entry point + Three.js post-processing shims
├── css/
│   └── style.css           # Full application styling
└── js/
    ├── app.js              # Bootstrap & animation loop
    ├── audio.js            # Audio Engine — FFT analysis, beat detection, spectral features
    ├── visuals.js          # Visual Engine — Three.js scene, mode registry, dubstep effects
    ├── params.js           # Parameter System — schema-driven controls, palettes, presets
    ├── ui.js               # UI Controller — panels, transport bar, keyboard shortcuts
    ├── recorder.js         # Recording System — MediaRecorder MP4/WebM capture
    ├── markers.js          # Marker System — song section tagging & timeline
    └── modes/              # 33 visual mode plugins
        ├── frequencyBars.js
        ├── particleStorm.js
        ├── radialBloom.js
        ├── terrainMesh.js
        ├── waveformScope.js
        ├── spectrogram.js
        ├── kaleidoscope.js
        ├── shaderTunnel.js
        ├── geometryShapes.js
        ├── geometryShapes2.js
        ├── hyperforge.js
        ├── godRays.js
        ├── particleManipulation.js
        ├── mathMode.js
        ├── fractalTree.js
        ├── voronoiField.js
        ├── lissajous.js
        ├── mobiusRings.js
        ├── gridDistortion.js
        ├── dnaHelix.js
        ├── polyhedronExplode.js
        ├── starfield.js
        ├── nebula.js
        ├── aurora.js
        ├── cyberGrid.js
        ├── neonPlasma.js
        ├── dimensionalRift.js
        ├── rhythmicGeometry.js
        ├── sdfRaymarcher.js
        ├── noiseRealm.js
        ├── gpgpuParticles.js
        ├── fractalShader.js
        └── voidEngine.js
```

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Three.js** (r128) | 3D rendering engine |
| **Web Audio API** | Real-time FFT analysis & audio processing |
| **MediaRecorder API** | Video/audio capture & export |
| **Canvas API** | 2D rendering for select modes |
| **Vanilla JS** | Zero-dependency modular architecture |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-new-mode`
3. Add your visual mode in `js/modes/`
4. Register it in `js/app.js` → `registerModes()`
5. Commit and open a Pull Request

### Adding a New Visual Mode

Each mode is a plain object with the following interface:

```javascript
const MyMode = {
    name: 'My Mode',
    params: {
        // Schema-driven parameter definitions
        myParam: { type: 'range', min: 0, max: 1, default: 0.5, step: 0.01, label: 'My Param' }
    },
    init(scene, camera) {
        // Set up Three.js objects
    },
    update(scene, camera, audio, params, dt) {
        // Called every frame — react to audio data
    },
    dispose(scene) {
        // Clean up Three.js objects & materials
    }
};
```

## 📄 License

This project is open source. Feel free to use, modify, and distribute.

---

<p align="center">
  Made with 🎵 and ✨ by <a href="https://github.com/theyeeetguyyy">theyeeetguyyy</a>
</p>
