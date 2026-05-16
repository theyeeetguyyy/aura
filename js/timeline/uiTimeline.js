// ============================================================
// AURA — Timeline UI v3
// Dual-track: Visual clips | Camera keyframes | Markers
// Zoom & scroll, playhead auto-follow
// ============================================================

const TimelineUI = (() => {
  let _root, _bar, _playhead, _eventLayer, _camLayer, _markerLayer, _list;
  let _btnAdd, _btnSave, _btnLoad, _fileInput;
  let _waveformCanvas, _waveformCtx;
  let _tracksWrapper = null;
  let _selectedEventId = null;
  let _draggingEventId = null;
  let _draggingMarkerId = null;
  let _draggingHandle = null;
  let _dragOffsetX = 0;
  let _dragStartEvent = null;
  let _isScrubbing = false;

  // Zoom & scroll state
  let _zoomLevel = 1;
  let _autoFollow = true;

  function ensureDom() {
    _root = document.getElementById('timeline-dock');
    if (!_root) return false;
    _bar = _root.querySelector('.timeline-bar');
    _playhead = _root.querySelector('.timeline-playhead');
    _eventLayer = _root.querySelector('.timeline-events');
    _camLayer = _root.querySelector('.timeline-camera-events');
    _markerLayer = _root.querySelector('.timeline-markers');
    _list = _root.querySelector('#timeline-event-list');
    _btnAdd = _root.querySelector('#btn-add-state');
    _btnSave = _root.querySelector('#btn-save-project');
    _btnLoad = _root.querySelector('#btn-load-project');
    _fileInput = _root.querySelector('#project-file-input');
    _waveformCanvas = _root.querySelector('#waveform-canvas');
    _tracksWrapper = _root.querySelector('.timeline-tracks');
    if (_waveformCanvas) _waveformCtx = _waveformCanvas.getContext('2d');
    return !!(_bar && _playhead && _list && _btnAdd && _btnSave && _btnLoad && _fileInput);
  }

  function init() {
    if (!ensureDom()) return;
    _root.classList.add('active');

    const toggleBtn = _root.querySelector('#btn-toggle-timeline');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const collapsed = !_root.classList.contains('collapsed');
        _root.classList.toggle('collapsed', collapsed);
        toggleBtn.innerHTML = collapsed ? '&#9654; Details' : '&#9660; Details';
      });
    }

    _btnAdd.addEventListener('click', () => addVisualClipAtCurrentTime());

    const btnCam = _root.querySelector('#btn-add-camera');
    if (btnCam) btnCam.addEventListener('click', () => addCameraKFAtCurrentTime());

    const addMkr = _root.querySelector('#btn-add-marker-tl');
    const clrMkr = _root.querySelector('#btn-clear-markers-tl');
    if (addMkr) addMkr.addEventListener('click', () => {
      if (!AudioEngine?.audioBus?.loaded) return;
      const sel = document.getElementById('marker-type-select');
      const t = AudioEngine.audioBus.currentTime || 0;
      ProjectStore.dispatch({ type: 'timeline/addMarker', time: t, label: sel?.value || 'Marker', markerType: sel?.value || 'custom' });
      render();
    });
    if (clrMkr) clrMkr.addEventListener('click', () => {
      ProjectStore.dispatch({ type: 'timeline/clearMarkers' });
      render();
    });

    _btnSave.addEventListener('click', () => ProjectIO.exportProject());
    _btnLoad.addEventListener('click', () => _fileInput.click());
    _fileInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try { await ProjectIO.importProjectFile(f); e.target.value = ''; render(); }
      catch (err) { console.error(err); if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('Failed to load project.', 'error'); }
    });

    // Scrub on bar click
    _bar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.timeline-state-clip') || e.target.closest('.timeline-camera-clip') || e.target.closest('.timeline-marker-pin')) return;
      if (!AudioEngine?.audioBus?.loaded) return;
      _isScrubbing = true;
      _autoFollow = false; // user is manually scrubbing
      scrubTo(e);
    });

    // Zoom (Ctrl/Shift+Wheel) and horizontal scroll (plain Wheel)
    const wrapper = _tracksWrapper || _root.querySelector('.timeline-bar-wrapper');
    if (wrapper) {
      wrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          e.preventDefault();
          const oldZoom = _zoomLevel;
          _zoomLevel = Math.max(1, Math.min(50, _zoomLevel * (e.deltaY < 0 ? 1.25 : 0.8)));

          // Zoom toward mouse pointer
          const rect = wrapper.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const scrollBefore = wrapper.scrollLeft;
          const mouseRatio = (scrollBefore + mouseX) / (rect.width * oldZoom);

          _bar.style.minWidth = `${_zoomLevel * 100}%`;
          wrapper.scrollLeft = mouseRatio * rect.width * _zoomLevel - mouseX;

          renderWaveform();
          _autoFollow = false;
        } else {
          // Horizontal scroll
          e.preventDefault();
          wrapper.scrollLeft += e.deltaY;
          _autoFollow = false;
        }
      }, { passive: false });

      // Re-enable auto-follow on double-click
      wrapper.addEventListener('dblclick', (e) => {
        if (e.target === wrapper || e.target === _bar) {
          _autoFollow = true;
        }
      });
    }

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    ProjectStore.subscribe(() => render());
    render();
  }

  // ── Helpers ──────────────────────────────────────────
  function getDur() {
    return TimelineModel.getDuration(ProjectStore.getState());
  }

  function scrubTo(e) {
    const rect = _bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const dur = AudioEngine.audioBus.duration || 0;
    AudioEngine.seek(ratio * dur);
    if (typeof VisualEngine !== 'undefined' && VisualEngine.applyStudioStateAtTime) {
      VisualEngine.applyStudioStateAtTime(AudioEngine.audioBus.currentTime || 0);
    }
  }

  function pct(time, dur) { return dur > 0 ? (time / dur) * 100 : 0; }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── Zoom helpers ───────────────────────────────────
  function getZoomLevel() { return _zoomLevel; }

  function setZoomLevel(z) {
    _zoomLevel = Math.max(1, Math.min(50, z));
    if (_bar) _bar.style.minWidth = `${_zoomLevel * 100}%`;
    renderWaveform();
  }

  function zoomToFit() {
    _zoomLevel = 1;
    if (_bar) _bar.style.minWidth = '100%';
    if (_tracksWrapper) _tracksWrapper.scrollLeft = 0;
    _autoFollow = true;
    renderWaveform();
  }

  // ── Add Actions ─────────────────────────────────────
  function addVisualClipAtCurrentTime() {
    if (!AudioEngine?.audioBus?.loaded) return;
    const t = AudioEngine.audioBus.currentTime || 0;
    const modeKey = VisualEngine?.activeModeKey || 'geometryForge';
    const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    let camState = { pos: { x: 0, y: 0, z: 100 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 75 };
    if (VisualEngine?.camera) {
      const c = VisualEngine.camera;
      camState = { pos: { x: c.position.x, y: c.position.y, z: c.position.z }, lookAt: { x: 0, y: 0, z: 0 }, fov: c.fov || 75 };
    }

    ProjectStore.dispatch({ type: 'nodes/upsert', node: {
      id: nodeId,
      name: `State @ ${TimelineModel.formatTime(t)}`,
      visual: { modeKey, globalParams: ParamSystem.getAllGlobal(), modeParams: ParamSystem.getAllMode(), mappings: ParamSystem.getMappings() },
      camera: camState,
    }});
    ProjectStore.dispatch({ type: 'timeline/addVisualClip', time: t, nodeId, duration: 5.0 });
  }

  function addCameraKFAtCurrentTime() {
    if (!AudioEngine?.audioBus?.loaded) return;
    const t = AudioEngine.audioBus.currentTime || 0;
    let val = { pos: { x: 0, y: 0, z: 100 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 75 };
    if (VisualEngine?.camera) {
      const c = VisualEngine.camera;
      val = { pos: { x: c.position.x, y: c.position.y, z: c.position.z }, lookAt: { x: 0, y: 0, z: 0 }, fov: c.fov || 75 };
    }
    ProjectStore.dispatch({ type: 'timeline/addCameraKeyframe', time: t, val, easing: 'easeInOutCubic' });
  }

  // ── Waveform ────────────────────────────────────────
  function renderWaveform() {
    if (!_waveformCanvas || !_waveformCtx || !AudioEngine?.audioBus?.waveformPeaks) return;
    const peaks = AudioEngine.audioBus.waveformPeaks;
    const cw = _bar.offsetWidth, ch = _bar.offsetHeight;
    _waveformCanvas.width = cw; _waveformCanvas.height = ch;
    _waveformCtx.clearRect(0, 0, cw, ch);
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#8b5cf6';
    _waveformCtx.fillStyle = `color-mix(in srgb, ${accent} 40%, transparent)`;
    const len = peaks.length / 2;
    _waveformCtx.beginPath(); _waveformCtx.moveTo(0, ch / 2);
    for (let i = 0; i < cw; i++) { const idx = Math.floor((i / cw) * len) * 2 + 1; if (idx < peaks.length) _waveformCtx.lineTo(i, (1 - peaks[idx]) * ch / 2); }
    for (let i = cw - 1; i >= 0; i--) { const idx = Math.floor((i / cw) * len) * 2; if (idx < peaks.length) _waveformCtx.lineTo(i, (1 - peaks[idx]) * ch / 2); }
    _waveformCtx.closePath(); _waveformCtx.fill();
  }

  // ── Update (per frame) ──────────────────────────────
  function update() {
    if (!ensureDom()) return;
    const dur = getDur();
    const t = AudioEngine?.audioBus?.currentTime || 0;
    _playhead.style.left = `${pct(t, dur)}%`;

    // Auto-follow: keep playhead visible during playback
    if (_autoFollow && _tracksWrapper && _zoomLevel > 1 && AudioEngine?.audioBus?.isPlaying) {
      const wrapperW = _tracksWrapper.clientWidth;
      const contentW = _bar.offsetWidth;
      const playheadPx = (t / Math.max(0.01, dur)) * contentW;
      const margin = wrapperW * 0.3; // keep 30% margin on right
      const idealScroll = playheadPx - wrapperW + margin;
      const clamped = Math.max(0, Math.min(contentW - wrapperW, idealScroll));
      // Smooth scroll
      _tracksWrapper.scrollLeft += (clamped - _tracksWrapper.scrollLeft) * 0.15;
    }
  }

  // ── Full Render ─────────────────────────────────────
  function render() {
    if (!ensureDom()) return;
    const project = ProjectStore.getState();
    const visualClips = project.timeline.visualTrack || project.timeline.stateEvents || [];
    const cameraKFs = project.timeline.cameraTrack || project.timeline.cameraEvents || [];
    const markers = project.timeline.markers || [];
    const dur = getDur();

    _root.classList.add('active');

    // Apply zoom
    _bar.style.minWidth = `${_zoomLevel * 100}%`;

    // Collapse on first init
    if (!_root.dataset.tlInit) {
      _root.classList.add('collapsed');
      _root.dataset.tlInit = '1';
    }

    // ── Visual Track (row 1) ──
    if (_eventLayer) {
      _eventLayer.innerHTML = '';
      for (const clip of visualClips) {
        const left = pct(clip.time, dur);
        const w = pct(clip.duration || 5, dur);
        const node = project.nodes.find(n => n.id === clip.nodeId);
        const el = document.createElement('div');
        el.className = 'timeline-state-clip' + (clip.id === _selectedEventId ? ' selected' : '');
        el.style.left = `${left}%`; el.style.width = `${Math.max(0.3, w)}%`;
        el.title = clip.name || node?.name || clip.nodeId;
        el.dataset.eventId = clip.id;
        el.innerHTML = `<div class="timeline-handle left-handle"></div><span class="timeline-clip-label">${escapeHtml(node?.name || clip.nodeId)}</span><div class="timeline-handle right-handle"></div>`;

        el.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          if (_selectedEventId !== clip.id) {
            _selectedEventId = clip.id;
            if (AudioEngine?.audioBus?.loaded) { AudioEngine.seek(clip.time); if (VisualEngine?.applyStudioStateAtTime) VisualEngine.applyStudioStateAtTime(clip.time); }
            if (UI?.buildStateInspector) UI.buildStateInspector(clip);
            render(); return;
          }
          _draggingEventId = clip.id; _dragStartEvent = { ...clip };
          const rect = _bar.getBoundingClientRect();
          _dragOffsetX = ((e.clientX - rect.left) / rect.width) * dur - clip.time;
          _draggingHandle = e.target.classList.contains('left-handle') ? 'left' : e.target.classList.contains('right-handle') ? 'right' : 'body';
        });
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); ProjectStore.dispatch({ type: 'timeline/removeVisualClip', id: clip.id }); });
        _eventLayer.appendChild(el);
      }
    }

    // ── Camera Track (row 2) ──
    if (_camLayer) {
      _camLayer.innerHTML = '';
      for (const kf of cameraKFs) {
        const left = pct(kf.time, dur);
        const el = document.createElement('div');
        el.className = 'timeline-camera-clip' + (kf.id === _selectedEventId ? ' selected' : '');
        el.style.left = `${left}%`;
        el.title = `Camera KF @ ${TimelineModel.formatTime(kf.time)}\nEase: ${kf.easing}`;
        el.dataset.eventId = kf.id;
        el.innerHTML = '<div class="camera-kf-diamond"></div>';

        el.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          if (_selectedEventId !== kf.id) { _selectedEventId = kf.id; if (AudioEngine?.audioBus?.loaded) AudioEngine.seek(kf.time); if (UI?.buildCameraInspector) UI.buildCameraInspector(kf); render(); return; }
          _draggingEventId = kf.id; _dragStartEvent = { ...kf, isCamera: true };
          const rect = _bar.getBoundingClientRect();
          _dragOffsetX = ((e.clientX - rect.left) / rect.width) * dur - kf.time;
          _draggingHandle = 'body';
        });
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); ProjectStore.dispatch({ type: 'timeline/removeCameraKeyframe', id: kf.id }); });
        _camLayer.appendChild(el);
      }
    }

    // ── Markers (row 3) ──
    if (_markerLayer) {
      _markerLayer.innerHTML = '';
      for (const mk of markers) {
        const left = pct(mk.time, dur);

        // Resolve type color + icon from MarkerSystem
        const typeKey = mk.markerType || 'intro';
        const typeDef = (typeof MarkerSystem !== 'undefined' && MarkerSystem.MARKER_TYPES)
          ? (MarkerSystem.MARKER_TYPES[typeKey] || null) : null;
        const color = typeDef ? typeDef.color : (mk.color || '#f59e0b');
        const icon  = typeDef ? typeDef.icon  : '📌';
        const label = typeDef ? typeDef.label : (mk.label || typeKey);

        const pin = document.createElement('div');
        pin.className = 'timeline-marker-pin' + (mk.id === _selectedEventId ? ' selected' : '');
        pin.style.left = `${left}%`;
        pin.style.setProperty('--mk-color', color);

        const handle = document.createElement('div');
        handle.className = 'timeline-marker-handle';
        handle.style.setProperty('--mk-color', color);
        handle.title = `${icon} ${label} @ ${TimelineModel.formatTime(mk.time)}`;
        handle.innerHTML = `<span class="mk-icon">${icon}</span><span class="mk-label">${label}</span>`;

        handle.addEventListener('click', (e) => { e.stopPropagation(); if (AudioEngine?.audioBus?.loaded) AudioEngine.seek(mk.time); });
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (_selectedEventId !== mk.id) { _selectedEventId = mk.id; render(); return; }
            _draggingMarkerId = mk.id;
        });
        handle.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); ProjectStore.dispatch({ type: 'timeline/removeMarker', id: mk.id }); render(); });
        pin.appendChild(handle);
        _markerLayer.appendChild(pin);
      }
    }

    // ── Detail List ──
    _list.innerHTML = '';
    for (const clip of visualClips) {
      const node = project.nodes.find(n => n.id === clip.nodeId);
      const li = document.createElement('div');
      li.className = 'timeline-event-row' + (clip.id === _selectedEventId ? ' selected' : '');
      li.innerHTML = `
        <div class="tcol time">${TimelineModel.formatTime(clip.time)}</div>
        <div class="tcol name">${escapeHtml(node?.name || clip.nodeId)}</div>
        <div class="tcol mode">
          <div class="mini">${escapeHtml(node?.visual?.modeKey || '—')}</div>
          <div class="miniControls">
            <label>Trans</label>
            <input class="tTrans" type="number" min="0" max="20" step="0.05" value="${Number(clip.transitionSec || 0).toFixed(2)}" />
            <select class="tEase">
              <option value="easeInOut" ${clip.easing === 'easeInOut' ? 'selected' : ''}>easeInOut</option>
              <option value="linear" ${clip.easing === 'linear' ? 'selected' : ''}>linear</option>
              <option value="easeOut" ${clip.easing === 'easeOut' ? 'selected' : ''}>easeOut</option>
              <option value="easeIn" ${clip.easing === 'easeIn' ? 'selected' : ''}>easeIn</option>
            </select>
          </div>
        </div>
        <button class="tcol del" title="Remove">✕</button>`;
      const tI = li.querySelector('.tTrans'), eS = li.querySelector('.tEase');
      if (tI) tI.addEventListener('change', () => ProjectStore.dispatch({ type: 'timeline/updateVisualClip', id: clip.id, patch: { transitionSec: Math.max(0, Number(tI.value || 0)) } }));
      if (eS) eS.addEventListener('change', () => ProjectStore.dispatch({ type: 'timeline/updateVisualClip', id: clip.id, patch: { easing: eS.value } }));
      li.querySelector('.del').addEventListener('click', () => ProjectStore.dispatch({ type: 'timeline/removeVisualClip', id: clip.id }));
      li.addEventListener('click', () => { _selectedEventId = clip.id; if (UI?.buildStateInspector) UI.buildStateInspector(clip); render(); });
      li.addEventListener('dblclick', () => { if (AudioEngine?.audioBus?.loaded) { AudioEngine.seek(clip.time); if (VisualEngine?.applyStudioStateAtTime) VisualEngine.applyStudioStateAtTime(clip.time); } });
      _list.appendChild(li);
    }

    for (const kf of cameraKFs) {
      const li = document.createElement('div');
      li.className = 'timeline-event-row camera-row' + (kf.id === _selectedEventId ? ' selected' : '');
      li.style.borderLeft = '3px solid #10b981';
      li.innerHTML = `
        <div class="tcol time">${TimelineModel.formatTime(kf.time)}</div>
        <div class="tcol name">🎥 Camera KF</div>
        <div class="tcol mode"><div class="miniControls" style="margin-left:0">
          <label>Ease</label>
          <select class="tEase">
            <option value="easeInOutCubic" ${kf.easing === 'easeInOutCubic' ? 'selected' : ''}>Smooth</option>
            <option value="catmullRom" ${kf.easing === 'catmullRom' ? 'selected' : ''}>Spline</option>
            <option value="linear" ${kf.easing === 'linear' ? 'selected' : ''}>Linear</option>
            <option value="step" ${kf.easing === 'step' ? 'selected' : ''}>Step</option>
            <option value="easeOutExpo" ${kf.easing === 'easeOutExpo' ? 'selected' : ''}>Punch</option>
          </select>
        </div></div>
        <button class="tcol del" title="Remove">✕</button>`;
      const eS = li.querySelector('.tEase');
      if (eS) eS.addEventListener('change', () => ProjectStore.dispatch({ type: 'timeline/updateCameraKeyframe', id: kf.id, patch: { easing: eS.value } }));
      li.querySelector('.del').addEventListener('click', () => ProjectStore.dispatch({ type: 'timeline/removeCameraKeyframe', id: kf.id }));
      li.addEventListener('click', () => { _selectedEventId = kf.id; if (UI?.buildCameraInspector) UI.buildCameraInspector(kf); render(); });
      li.addEventListener('dblclick', () => { if (AudioEngine?.audioBus?.loaded) AudioEngine.seek(kf.time); });
      _list.appendChild(li);
    }
  }

  // ── Delete Selected ─────────────────────────────────
  function deleteSelectedEvent() {
    if (!_selectedEventId) return false;
    ProjectStore.dispatch({ type: 'timeline/removeVisualClip', id: _selectedEventId });
    ProjectStore.dispatch({ type: 'timeline/removeCameraKeyframe', id: _selectedEventId });
    ProjectStore.dispatch({ type: 'timeline/removeMarker', id: _selectedEventId });
    _selectedEventId = null;
    render();
    return true;
  }

  // ── Drag ────────────────────────────────────────────
  function onDragMove(e) {
    if (!_draggingEventId && !_draggingMarkerId && !_isScrubbing) return;
    if (!AudioEngine?.audioBus?.loaded) return;
    const rect = _bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const dur = AudioEngine.audioBus.duration || 0;
    const time = Math.max(0, Math.min(dur, ratio * dur));

    if (_isScrubbing) { AudioEngine.seek(time); if (VisualEngine?.applyStudioStateAtTime) VisualEngine.applyStudioStateAtTime(time); }

    if (_draggingEventId && _dragStartEvent) {
      const origEnd = _dragStartEvent.time + (_dragStartEvent.duration || 5);
      let newTime = _dragStartEvent.time, newDur = _dragStartEvent.duration || 5;
      if (_draggingHandle === 'body') { newTime = Math.max(0, Math.min(dur - newDur, time - _dragOffsetX)); }
      else if (_draggingHandle === 'right') { newDur = Math.max(0.1, time - newTime); }
      else if (_draggingHandle === 'left') { newTime = Math.max(0, Math.min(origEnd - 0.1, time)); newDur = origEnd - newTime; }

      if (_dragStartEvent.isCamera) {
        ProjectStore.dispatch({ type: 'timeline/updateCameraKeyframe', id: _draggingEventId, patch: { time: newTime } }, { recordHistory: false });
      } else {
        ProjectStore.dispatch({ type: 'timeline/updateVisualClip', id: _draggingEventId, patch: { time: newTime, duration: newDur } }, { recordHistory: false });
      }
    }

    if (_draggingMarkerId) {
      ProjectStore.dispatch({ type: 'timeline/updateMarker', id: _draggingMarkerId, patch: { time } }, { recordHistory: false });
      render();
    }
  }

  function onDragEnd() {
    if (_draggingEventId && _dragStartEvent) {
      const isCam = _dragStartEvent.isCamera;
      const list = isCam ? (ProjectStore.getState().timeline.cameraTrack || []) : (ProjectStore.getState().timeline.visualTrack || []);
      const evt = list.find(e => e.id === _draggingEventId);
      if (evt) {
        if (isCam) { ProjectStore.dispatch({ type: 'timeline/updateCameraKeyframe', id: _draggingEventId, patch: { time: evt.time } }); if (UI?.buildCameraInspector) UI.buildCameraInspector(evt); }
        else { ProjectStore.dispatch({ type: 'timeline/updateVisualClip', id: _draggingEventId, patch: { time: evt.time, duration: evt.duration } }); if (UI?.buildStateInspector) UI.buildStateInspector(evt); }
      }
    }
    _draggingEventId = null; _draggingMarkerId = null; _isScrubbing = false; _draggingHandle = null; _dragStartEvent = null;
  }

  return { init, render, update, deleteSelectedEvent, renderWaveform, getZoomLevel, setZoomLevel, zoomToFit };
})();
