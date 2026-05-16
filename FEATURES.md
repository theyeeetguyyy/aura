# Aura Studio — Feature Suggestions

> Organized by effort level. Quick wins at the top, ambitious ideas at the bottom.

---

## 🟢 Quick Wins (< 1 hour each)

### 1. Duplicate Timeline Clip (Ctrl+D)
Copy the currently selected visual clip or camera keyframe and paste it 5s later. Huge time-saver for repetitive sections.
- **Files**: `uiTimeline.js`, `ui.js`
- **Difficulty**: Easy — read selected event, clone it, offset time, dispatch `timeline/addVisualClip`

### 2. Snap-to-Beat for Markers & Clips
When placing a marker or dragging a clip, hold `Shift` to snap to the nearest beat based on the current BPM. Prevents manually aligning to beat grid.
- **Files**: `uiTimeline.js` (drag handlers), `ui.js` (addMarkerAtCurrentTime)
- **Difficulty**: Easy — `Math.round(time * bpm/60) * 60/bpm`

### 3. Section Indicator on Timeline Bar
Show colored region bands behind the waveform in the NLE timeline that correspond to the marker sections (Intro=blue, Drop=red, etc). Right now only the transport bar shows regions.
- **Files**: `uiTimeline.js` (render function after waveform)
- **Difficulty**: Easy — iterate markers, draw colored divs behind the tracks

### 4. Keyboard Shortcut to Cycle Marker Type
Press `Shift+M` to cycle the marker type dropdown (Intro → Build-up → Drop → ...) without clicking. Power users never leave the keyboard.
- **Files**: `ui.js`
- **Difficulty**: Trivial

### 5. Auto-Save to LocalStorage
Save project state to `localStorage` every 30 seconds. On page load, offer to restore. Prevents work loss from accidental refresh.
- **Files**: New file `js/project/autosave.js`, `app.js`
- **Difficulty**: Easy — `setInterval(() => localStorage.setItem('aura_autosave', JSON.stringify(ProjectStore.getState())), 30000)`

### 6. Persistent Camera Preview Mode
Save the selected preview mode (`orbit`/`move`/`follow`) to localStorage so it survives refresh.
- **Files**: `visuals.js` (`setPreviewMode`), `ui.js` (PMT button init)
- **Difficulty**: Trivial

### 7. Toast Notifications for CRUD Actions
Show a small toast ("💥 Drop marker added at 1:23") when adding/deleting markers, clips, and camera KFs. Currently these actions are silent.
- **Files**: `ui.js` (already has `showToast`), `uiTimeline.js`, `markers.js`
- **Difficulty**: Trivial — add `UI.showToast()` calls after dispatch

---

## 🟡 Medium Effort (1-4 hours each)

### 8. Marker Type Editor / Custom Marker Types
Let users define their own marker types with custom name, color, icon, and intensity multipliers. Store in project JSON.
- **Files**: New modal in `index.html`, `markers.js` (dynamic MARKER_TYPES), `store.js`
- **Why**: Every genre has different energy profiles. EDM needs "breakdown", trap needs "808 section", etc.

### 9. Solo/Mute Tracks in Timeline
Add solo (S) and mute (M) buttons per track row (Visual, Camera, Markers). Muted tracks are ignored during playback. Essential NLE feature.
- **Files**: `uiTimeline.js`, `visuals.js` (skip muted tracks in update), `index.html`
- **Why**: Lets you isolate camera movement without visual changes, or preview visuals without camera following

### 10. Undo/Redo UI Buttons + Indicator
Show undo/redo buttons in the timeline dock with a badge showing history depth. Currently Ctrl+Z/Y works but there's no visual affordance.
- **Files**: `index.html`, `ui.js`, `store.js` (expose history length)

### 11. Timeline Ruler with Beat Grid
Draw vertical beat lines on the timeline based on BPM. With 140 BPM, lines every ~0.43s. Makes visual alignment to music structure trivial.
- **Files**: `uiTimeline.js` (render function), `style.css`
- **Why**: Every professional DAW/NLE has this. It's the single most impactful feature for precision editing.

### 12. Camera Path Preview Line
In the 3D viewport, draw a thin spline curve showing the camera keyframe path. Click points on the curve to select KFs.
- **Files**: `visuals.js`, `cameraEngine.js`, new `cameraPathPreview.js`
- **Why**: Currently there's no way to see where the camera will go without playing the timeline

### 13. Waveform Zoom + Scroll Enhancement  
Implement smooth horizontal scrolling with playhead-follow (auto-scroll waveform to keep playhead centered during playback).
- **Files**: `uiTimeline.js` (update function)
- **Why**: Long tracks (5+ min) make the playhead invisible at 1x zoom

### 14. Mode Transition Preview
When two visual clips overlap, show a small gradient blend indicator in the timeline between them to visualize the crossfade zone.
- **Files**: `uiTimeline.js` (render visual track)
- **Difficulty**: Medium — calculate overlap region, draw gradient div

---

## 🔴 Ambitious (1-3 days each)

### 15. Multi-Track Audio Visualization (Per-Stem Modes)
Allow assigning different visual modes to different stems (drums → particleStorm, bass → geometryForge). Each stem drives its own layer, composited together.
- **Files**: Major refactor of `visuals.js`, `audio.js` (per-stem analysis), new compositing layer
- **Why**: This is the killer feature that separates Aura from basic visualizers

### 16. Render Queue / Offline Render
Queue a high-quality offline render at exact resolution (4K, 60fps) that processes frame-by-frame instead of real-time. No frame drops.
- **Files**: New `js/renderQueue.js`, modify `app.js` loop to support stepped rendering
- **Why**: Real-time recording always drops frames on complex modes. Offline rendering guarantees quality.

### 17. Visual Mode Blending (A/B Crossfade)
Instead of hard-cutting between modes on clip boundaries, render both modes simultaneously and alpha-blend them during the transition zone.
- **Files**: `visuals.js` (dual scene rendering), `graphEvaluator.js`
- **Why**: Currently mode transitions are instant cuts. Smooth crossfades would be cinematic.

### 18. AI-Assisted Beat Mapping
Use onset detection + energy analysis to auto-generate a marker map (intro/buildup/drop/fill) from the audio waveform. User can then fine-tune.
- **Files**: New `js/engine/autoMapper.js`, `audio.js` (expose onset data), `markers.js`
- **Why**: Manually placing 20+ markers per track is tedious. Even rough auto-detection saves 80% of the work.

### 19. Timeline Clip Color Coding
Auto-color visual clips based on their mode type (particle modes = orange, geometry = blue, shader = purple). Makes the timeline instantly scannable.
- **Files**: `uiTimeline.js`, `style.css`, mode registry needs a `category` field
- **Difficulty**: Medium — need a mode→category→color mapping

### 20. Export Project as Standalone HTML
Bundle the current project + all settings into a single self-contained HTML file that plays the visualization with embedded audio (base64 or Blob URL).
- **Files**: New `js/project/bundler.js`
- **Why**: Easy sharing — send someone a single file and they see your creation

---

## 💎 Dream Features (Research-level)

### 21. MIDI Controller Support
Map MIDI CC knobs/faders to visual parameters for live VJing. MIDI note triggers could fire mode switches.
- **Files**: New `js/engine/midiController.js`, Web MIDI API
- **Why**: Live performance is the ultimate use case

### 22. Collaborative Editing (WebRTC)
Real-time multiplayer editing where one person handles audio/markers while another controls camera/visuals.
- **Files**: Massive — WebRTC sync layer, conflict resolution, cursor awareness

### 23. GPU Compute for Audio Analysis (WebGPU)
Move FFT and onset detection to GPU compute shaders for zero-latency analysis of multiple stems simultaneously.
- **Files**: `audio.js` refactor to WebGPU compute pipeline
