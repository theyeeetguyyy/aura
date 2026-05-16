<p align="center">
  <h1 align="center">🎵 AURA STUDIO</h1>
  <p align="center"><strong>The Professional Audio Visualization Engine</strong></p>
  <p align="center">
    Create, Sequence, and Render Cinematic 3D Visuals from any Audio.
  </p>
</p>

---

**AURA STUDIO** is a high-fidelity, real-time audio visualization suite built entirely in the browser. It moves beyond simple reactive visualizers by providing a **professional Non-Linear Editor (NLE)**, an advanced **State Node Graph**, and a deterministic **Cinematic Camera Engine**. 

Whether you are performing live, producing music videos, or generating high-quality 4K renders, Aura gives you total creative control over how your music is seen.

---

## 🚀 Core Architecture & Features

### 🎞️ Professional NLE Timeline
Aura's timeline is the deterministic source of truth for your visualization. It features a multi-track interface built for precision syncing:
- **Visual Track:** Sequence visual state snapshots. Trim edges to adjust durations, and overlap clips to create automatic, smooth interpolation blends between entirely different visual modes and parameter sets.
- **Camera Track:** Author cinematic camera movements. Drop keyframes and choose between interpolation methods like Smooth (Cubic), Spline (Catmull-Rom), Linear, Step, or Punch (OutExpo).
- **Marker Track:** Place section-aware markers (`Intro`, `Build-up`, `Fakeout`, `DROP`, `Fill`, `Outro`). The audio engine reads these markers in real-time, automatically adjusting the intensity of visual effects (shake, bloom, flash, speed) based on the current song section.

### 🎧 Elite Audio Engine & Stem Processing
- **7-Band FFT Analysis:** Deep spectral analysis of Sub, Bass, Low Mid, Mid, High Mid, Treble, and Brilliance frequencies.
- **Phase-Locked Beat Detection:** Intelligent transient and beat detection ensures visuals pulse perfectly on the grid.
- **Multi-Stem Support:** Upload your full mix or isolate stems via the **Stem Manager**. Assign dedicated audio files for **Drums**, **Bass**, **Mids**, and **Highs**, and independently tune their reactivity multipliers.

### 🎛️ Parameter Modulation & Live Mapping
Every visual mode exposes a unique set of parameters. 
- **Live UI Mapping:** Map any parameter directly to an audio property (e.g., tie camera zoom to the `Bass` band, or particle speed to `Onset Strength`).
- **Real-Time Modulation:** Watch sliders move autonomously as the audio drives the visuals, with customizable mapping intensities.

### 🕸️ State Node Graph
Move beyond linear transitions with a fully functional visual Node Graph editor.
- Connect visual states logically to map out the structure of your performance.
- Blend multiple states dynamically based on runtime audio parameters.
- Capture node graph outputs directly onto the timeline as concrete visual clips.

---

## 🎥 Camera Control System

Aura offers three distinct camera interaction models to suit your workflow:
- **⊙ Orbit Mode:** Smooth, mouse-driven orbital controls around the scene origin. Perfect for exploring modes and finding the right angle.
- **✈ Free Move (WASD):** First-person fly-through controls. Use WASD to navigate 3D space, capturing dynamic, manual angles.
- **⏵ Follow Mode:** Locks the camera to the deterministic keyframe track on the timeline. Ideal for final renders and automated sequencing.

---

## 🖥️ UI Panels & Workspace

Aura utilizes a sleek, dark-mode Glassmorphism UI that keeps the focus on your visuals:
- **Library (Tab):** Browse 33+ visual modes or load your saved custom visual States.
- **Parameters (P):** Adjust global settings (bloom, exposure) and mode-specific settings (geometry complexity, particle count, colors).
- **Graph Panel (N):** Visually route and blend state nodes.
- **Bottom Dock:** A consolidated control center housing the Timeline, Transport Controls, Stem Manager, and Project File I/O.

---

## 🎬 Export & Recording

Render your creations without ever leaving the browser:
- **WebM Video Export:** Native high-performance recording via the MediaRecorder API.
- **Customizable Bitrates:** Choose from Web Quality (10Mbps), High Quality (50Mbps), or Max Quality (100Mbps) for crisp 4K output.
- **High-Res Screenshots:** Instantly capture the current frame (Ctrl+S).
- **Project Serialization:** Save and load your entire workspace (timeline, nodes, parameters, camera paths) as a `.aura.json` project file.

---

## 🎨 33+ Visual Modes

Aura ships with a vast library of highly optimized WebGL/Three.js visual modes:

| Category | Modes |
|----------|-------|
| **Core** | Frequency Bars, Waveform Scope, Spectrogram, Radial Bloom |
| **Geometry** | Geometry Forge, Hyperforge, Möbius Rings, Polyhedron Explode, DNA Helix |
| **Cosmic** | Void Engine (Black Hole), Starfield, Nebula, Aurora |
| **Modern** | GPGPU Particles (65k GPU Sim), SDF Raymarcher, Noise Realm, Fractal Shader |
| **Abstract** | Particle Storm, Terrain Mesh, Kaleidoscope, Shader Tunnel, Dimensional Rift |

*(Plus 15+ more built-in modes...)*

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Playback** | |
| `Space` | Play / Pause |
| `L` | Toggle Loop |
| `← / →` | Seek ±5 seconds |
| `↑ / ↓` | Volume Up / Down |
| **Camera (Move Mode)**| |
| `W/A/S/D` | Free Fly Camera |
| `Drag` | Look around |
| **Timeline** | |
| `M` | Add Marker at Playhead |
| `Ctrl+Wheel`| Zoom Timeline |
| `Wheel` | Pan Timeline |
| `Del / Bksp`| Delete Selected Timeline Clip / Graph Node |
| `Ctrl+Z / Y`| Undo / Redo |
| **View & UI** | |
| `Tab` | Toggle Library Panel |
| `P` | Toggle Parameters Panel |
| `N` | Toggle State Graph Panel |
| `1–9` / `[ ]`| Quick switch visual modes |
| `F` | Toggle Manual Beat Flash |
| `R` | Start / Stop Video Recording |
| `G` | Toggle Fullscreen |
| `Ctrl+S` | Screenshot |
| `` ` `` (Backtick)| Toggle Debug HUD |

---

## 🛠️ Tech Stack

Aura is built for blistering performance with zero bloated framework dependencies:
- **Three.js**: Real-time 3D rendering with custom GLSL shaders & post-processing (Bloom, Tone Mapping).
- **Web Audio API**: Advanced FFT analysis and low-latency processing.
- **MediaRecorder API**: Native video export pipeline.
- **Vanilla HTML/CSS/JS**: Modular, high-performance architecture.

---

## 🤝 Contributing

We welcome new visual modes and engine improvements! 
1. Fork the repo.
2. Add your mode to `js/modes/`.
3. Follow the standard mode interface (`init`, `update(audio, params, dt)`, `dispose`).
4. Open a PR.

---

<p align="center">
  Made with 🎵 and ✨ by <a href="https://github.com/theyeeetguyyy">theyeeetguyyy</a>
</p>
