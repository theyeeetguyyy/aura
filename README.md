<p align="center">
  <h1 align="center">🎵 AURA STUDIO</h1>
  <p align="center"><strong>The Professional Audio Visualization Suite</strong></p>
  <p align="center">
    Create, Sequence, and Render Cinematic 3D Visuals from any Audio.
  </p>
</p>

---

**AURA STUDIO** is a high-fidelity, real-time audio visualization studio that transforms music into cinematic 3D experiences. Unlike standard visualizers, Aura Studio features a professional **Non-Linear Editor (NLE)** workflow, allowing you to sequence complex visual states, automate camera paths, and render high-quality video directly in your browser.

## 🚀 Key Features

### 🎞️ Professional NLE Timeline
Aura Studio introduces a standard-grade timeline interaction model inspired by Premiere Pro and DaVinci Resolve.
- **Select-then-Drag**: Intuitive interaction prevents accidental clip movement.
- **Edge Trimming**: Grab the handles of any state clip to precisely cut or extend its duration on the beat.
- **Automatic Transitions**: Simply overlap two clips on the timeline to create an automatic, smooth transition blend.
- **Visual Waveform**: High-fidelity audio waveform visualization helps you sync visual changes perfectly with transients.

### 🎭 State-Based Visual Engine
Aura is built on a "State Snapshot" system.
- **State Inspector**: Rename your states and define custom transition types (Transform, Crossfade, or hard Cut).
- **Infinite Variation**: Capture any combination of 33+ visual modes and thousands of parameter settings as a single "State".
- **Dynamic Interpolation**: The engine smoothly morphs between states, animating colors, geometry, and post-processing.

### 🎥 Manual Camera Autonomy
- **Fly-through Control**: Move the camera freely during playback. Aura detects your manual input and suppresses automated paths to give you full creative freedom.
- **Orbit & Pan**: Smooth orbit controls with momentum and cinematic easing.

### 🎨 Premium Design System
- **Dynamic Theming**: Choose between **Cyberpunk, Matrix, Vaporwave, Mono, Matte**, and more. 
- **High Contrast**: Deep blacks (#000000) for maximum visual impact on OLED screens and high-end displays.
- **Glassmorphism UI**: A minimal, professional interface that keeps the focus on the visuals.

### 🎧 Elite Audio Engine
- **7-band Analysis**: Sub, Bass, Low Mid, Mid, High Mid, Treble, and Brilliance bands.
- **Beat Syncing**: Phase-locked beat detection for perfect rhythm-based pulsing.
- **Transient Detection**: Intelligent classification of percussive and melodic hits.

---

## 🎨 33+ Visual Modes

| Category | Modes |
|----------|-------|
| **Core** | Frequency Bars, Waveform Scope, Spectrogram, Radial Bloom |
| **Geometry** | Geometry Forge, Hyperforge, Möbius Rings, Polyhedron Explode, DNA Helix |
| **Cosmic** | Void Engine (Black Hole), Starfield, Nebula, Aurora |
| **Modern** | GPGPU Particles (65k GPU Sim), SDF Raymarcher, Noise Realm, Fractal Shader |
| **Abstract** | Particle Storm, Terrain Mesh, Kaleidoscope, Shader Tunnel, Dimensional Rift |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Tab` | Toggle Modes Drawer |
| `P` | Toggle Parameters Panel |
| `M` | Add Marker (Song Section) |
| `S` | Save Project State |
| `R` | Start / Stop Video Recording |
| `G` | Toggle Fullscreen Mode |
| `Ctrl+S` | High-Res Screenshot |
| `?` | Show Shortcut Guide |

---

## 🛠️ Tech Stack

Aura is built for performance with zero dependencies:
- **Three.js**: Real-time 3D rendering with custom GLSL shaders.
- **Web Audio API**: Advanced FFT analysis and low-latency processing.
- **MediaRecorder API**: Native MP4/WebM video export.
- **Vanilla JS**: Modular, high-performance architecture.

---

## 🤝 Contributing

We welcome new visual modes! 
1. Fork the repo.
2. Add your mode to `js/modes/`.
3. Follow the interface: `init()`, `update(audio, params, dt)`, and `dispose()`.
4. Open a PR.

---

<p align="center">
  Made with 🎵 and ✨ by <a href="https://github.com/theyeeetguyyy">theyeeetguyyy</a>
</p>

