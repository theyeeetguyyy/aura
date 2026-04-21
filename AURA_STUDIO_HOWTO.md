# Aura Studio — How To Guide (living doc)

This guide explains **how to use the new “Aura Studio” editor layer** (Graph + Timeline + state transitions).  
It will be updated as features evolve.

## Quick mental model (important)
- **States (Library)** = saved “looks” (mode + params + mappings). This is now the main workflow.
- **Timeline** = where those states are placed over time.
- **Advanced Graph** = optional power-user view for linking states.
- **Follow Timeline** decides who is in control during playback:
  - **Follow: ON** → playback uses timeline states (deterministic).
  - **Follow: OFF** → playback uses whatever you’re doing live (mode switching / randomize stays).

## Studio layout
- **Top bar**: view toggles (`Library`, `Inspector`, `Timeline`, `Advanced Graph`) + status
- **Left**: `Library`
  - `States` tab = your saved states
  - `Modes` tab = visual mode browser
- **Right**: `Inspector`
  - parameter editing / randomize / presets
- **Bottom**: `Timeline`
  - simple view by default
  - `Show Details` reveals the event list

## Start here (first run)
### 1) Run Aura locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

### 2) Import audio
- Click **Import Audio** or drag & drop a file.

## Main workflow (recommended)
1. Load audio
2. Build or capture a few **States**
3. Put them on the **Timeline**
4. Play / scrub and refine transitions
5. Open **Advanced Graph** only if you want to organize complex relationships

## The Timeline dock (bottom)
### Follow Timeline toggle
- **Follow: ON**: when you press Play, Aura applies the active timeline state for the current time.
- **Follow: OFF**: when you press Play, Aura does **not** force timeline states (good for experimenting).

If mode switching or Randomize “does nothing”, check:
- are you **playing** AND **Follow: ON**?  
If yes: pause or toggle Follow OFF.

### Add a state at current time
Click **`＋ State`** to capture a new state from the current visual and place it on the timeline at the current time.

### Scrubbing / previewing
- Click on the timeline bar → seeks there and previews that time’s state.
- Click a state dot → seeks + previews.
- Double click a row → seeks + previews.
- Drag a **state pin** on the timeline bar to move it in time.
- Right click a state pin to delete it.

### Transition controls (per event)
In the timeline list, each event has:
- **Trans**: transition duration in seconds.
- **Easing**: `easeInOut`, `linear`, `easeOut`, `easeIn`.

## State Library (left panel)
### States tab
Each state card has:
- **Apply** → preview that state immediately
- **To Timeline** → place that state at the current playhead time
- **Select** → select it for editing / graph sync
- **Delete** → remove state (and all linked timeline events)

### Modes tab
- Browse visual modes
- Click a mode to switch the current live preview

## The Advanced Graph panel (optional)
### Open/close
- Use the top bar **Advanced Graph** button, or press **`N`**.

### Create nodes
- Click **`＋ Node`**.

### Select & move nodes
- Click a node to select it.
- Drag to move it.
- Mouse wheel to zoom.
- Drag empty space to pan.

### Connect nodes (edges)
- Click a node’s **right port (out)**.
- Click another node’s **left port (in)**.

Edges exist for the “state machine” concept, but **timeline placement is still the main driver for playback** right now.

### Inspector (inside Graph panel)
When a node is selected:
- **Name**: rename it.
- **Mode**: set its mode key.
- **⦿ Capture**: overwrite the node with your current live mode/params/mappings.
- **＋ To Timeline**: place the node onto the timeline at the current playhead time.

### Delete node
- Select a node → press **Delete** (or Backspace).
- `node_1` is protected (cannot be deleted).

## Modes & Parameters
### Switch modes
- Modes panel: **Tab** to open, click a mode.
- If a graph node is selected, switching mode also updates that node’s `modeKey`.

### Randomize
- Parameters panel: click **Randomize**.
- If a graph node is selected, Randomize also captures the new params into that node.

## Save / Load projects
### Save
- Timeline dock → **Save**
- Downloads a `.aura.json` file (project structure, nodes, timeline, etc.)

### Load
- Timeline dock → **Load**
- Loads a previously saved `.aura.json`

Note: audio file bytes are not embedded yet. You may need to re-import the audio file after loading a project.

## Keyboard shortcuts (editor)
- **Space**: Play / Pause
- **Tab**: Toggle Modes panel
- **P**: Toggle Parameters panel
- **N**: Toggle Graph panel
- **Ctrl+Z**: Undo
- **Ctrl+Y** / **Ctrl+Shift+Z**: Redo
- **Delete/Backspace**: Delete selected node (Graph)

## Markers (timeline controls)
- Use timeline buttons:
  - **＋ Marker** to add marker at current time
  - **Clear Markers** to clear all
- Marker pins are now on the **same bottom timeline bar** as state clips.
- Drag marker pins to reposition, right-click marker pin to delete.

## BPM and Themes
- **Manual BPM**:
  - Open **Settings** (top bar).
  - Toggle `Auto BPM` and set `Manual BPM` to override detection.
- **Themes**:
  - Open **Settings** and pick (`Purple`, `Black/White`, `Shiny`, `Matte`).

## Known current limitations (so expectations match reality)
- **Cross-mode blending**: timeline now uses a softer staged transition (first half source mode, second half target mode), but it is not full dual-render compositing yet.
- **Camera track**: not implemented yet (camera is still mostly mode-driven + orbit controls).
- **Offline “highest quality” export**: not implemented yet (coming with offline renderer + ffmpeg path).

