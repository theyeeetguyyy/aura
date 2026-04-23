// ============================================================
// AURA — Timeline UI (v1)
// Minimal dock to place state events along time
// ============================================================

const TimelineUI = (() => {
  let _root = null;
  let _bar = null;
  let _playhead = null;
  let _eventLayer = null;
  let _markerLayer = null;
  let _list = null;
  let _btnAdd = null;
  let _btnSave = null;
  let _btnLoad = null;
  let _fileInput = null;
  let _selectedEventId = null;
  let _draggingEventId = null;
  let _draggingMarkerId = null;
  let _zoomLevel = 1;
  let _waveformCanvas = null;
  let _waveformCtx = null;
  let _isScrubbing = false;
  let _draggingHandle = null;
  let _dragOffsetX = 0;
  let _dragStartEvent = null;

  function ensureDom() {
    _root = document.getElementById('timeline-dock');
    if (!_root) return false;

    _bar = _root.querySelector('.timeline-bar');
    _playhead = _root.querySelector('.timeline-playhead');
    _eventLayer = _root.querySelector('.timeline-events');
    _markerLayer = _root.querySelector('.timeline-markers');
    _list = _root.querySelector('#timeline-event-list');
    _btnAdd = _root.querySelector('#btn-add-state');
    _btnSave = _root.querySelector('#btn-save-project');
    _btnLoad = _root.querySelector('#btn-load-project');
    _fileInput = _root.querySelector('#project-file-input');
    _waveformCanvas = _root.querySelector('#waveform-canvas');
    if (_waveformCanvas) _waveformCtx = _waveformCanvas.getContext('2d');

    return !!(_bar && _playhead && _eventLayer && _markerLayer && _list && _btnAdd && _btnSave && _btnLoad && _fileInput);
  }

  function init() {
    if (!ensureDom()) return;

    // Ensure timeline is visible by default (we control collapse separately).
    _root.classList.add('active');

    const toggleBtn = _root.querySelector('#btn-toggle-timeline');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const collapsed = !_root.classList.contains('collapsed');
        _root.classList.toggle('collapsed', collapsed);
        toggleBtn.textContent = collapsed ? 'Show Details' : 'Hide Details';
      });
    }

    const followBtn = _root.querySelector('#btn-follow-timeline');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        const project = ProjectStore.getState();
        const current = !!(project.editor && project.editor.followTimeline);
        ProjectStore.dispatch({ type: 'editor/set', editor: { followTimeline: !current } }, { recordHistory: false });
        render();
      });
    }

    _btnAdd.addEventListener('click', () => addStateAtCurrentTime());
    const addMarkerBtn = _root.querySelector('#btn-add-marker-tl');
    const clearMarkersBtn = _root.querySelector('#btn-clear-markers-tl');
    if (addMarkerBtn) addMarkerBtn.addEventListener('click', () => {
      if (!AudioEngine?.audioBus?.loaded) return;
      const typeSelect = document.getElementById('marker-type-select');
      const markerType = typeSelect ? typeSelect.value : 'drop';
      MarkerSystem.addMarker(AudioEngine.audioBus.currentTime || 0, markerType);
      if (typeof UI !== 'undefined' && UI.renderMarkers) UI.renderMarkers();
      render();
    });
    if (clearMarkersBtn) clearMarkersBtn.addEventListener('click', () => {
      MarkerSystem.clearAll();
      if (typeof UI !== 'undefined' && UI.renderMarkers) UI.renderMarkers();
      render();
    });
    _btnSave.addEventListener('click', () => ProjectIO.exportProject());
    _btnLoad.addEventListener('click', () => _fileInput.click());

    _fileInput.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        await ProjectIO.importProjectFile(f);
        e.target.value = '';
        render();
      } catch (err) {
        console.error(err);
        if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('Failed to load project file.', 'error');
      }
    });

    // Scrub by clicking the bar
    _bar.addEventListener('mousedown', (e) => {
      // Ignore if clicking on a clip or marker (handled by their own mousedown)
      if (e.target.closest('.timeline-state-clip') || e.target.closest('.timeline-marker-pin')) return;
      if (!AudioEngine?.audioBus?.loaded) return;
      _isScrubbing = true;
      const rect = _bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ratio = rect.width > 0 ? x / rect.width : 0;
      const dur = AudioEngine.audioBus.duration || 0;
      AudioEngine.seek(ratio * dur);
      if (typeof VisualEngine !== 'undefined' && VisualEngine.applyStudioStateAtTime) {
        VisualEngine.applyStudioStateAtTime(AudioEngine.audioBus.currentTime || 0);
      }
    });

    // Zooming
    const wrapper = _root.querySelector('.timeline-bar-wrapper');
    if (wrapper) {
      wrapper.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          e.preventDefault();
          const zoomDelta = e.deltaY < 0 ? 1.2 : 0.8;
          const newZoom = Math.max(1, Math.min(30, _zoomLevel * zoomDelta));
          
          const rect = wrapper.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const scrollX = wrapper.scrollLeft;
          const timeRatioAtMouse = (mouseX + scrollX) / (_bar.offsetWidth || 1);
          
          _zoomLevel = newZoom;
          _bar.style.minWidth = `${_zoomLevel * 100}%`;
          
          const newWidth = wrapper.scrollWidth;
          wrapper.scrollLeft = (timeRatioAtMouse * newWidth) - mouseX;
          
          renderWaveform();
        } else {
          // Normal horizontal scroll
          wrapper.scrollLeft += e.deltaY;
        }
      });
    }

    ProjectStore.subscribe(() => render());
    render();
  }

  function update() {
    if (!ensureDom()) return;
    const project = ProjectStore.getState();
    const dur = TimelineModel.getDuration(project);
    const t = AudioEngine?.audioBus?.currentTime || 0;
    const pct = dur > 0 ? (t / dur) * 100 : 0;
    _playhead.style.left = `${pct}%`;
  }

  function addStateAtCurrentTime() {
    if (!AudioEngine?.audioBus?.loaded) return;
    const t = AudioEngine.audioBus.currentTime || 0;

    const modeKey = VisualEngine?.activeModeKey || 'geometryForge';
    const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    const node = {
      id: nodeId,
      name: `State @ ${TimelineModel.formatTime(t)}`,
      visual: {
        modeKey,
        globalParams: ParamSystem.getAllGlobal(),
        modeParams: ParamSystem.getAllMode(),
        mappings: ParamSystem.getMappings(),
      },
      camera: (VisualEngine?.getOrbitState ? VisualEngine.getOrbitState() : {
        orbitTheta: 0,
        orbitPhi: Math.PI / 2,
        orbitRadius: 100,
        fov: VisualEngine?.camera?.fov || 75,
      })
    };

    ProjectStore.dispatch({ type: 'nodes/upsert', node });
    ProjectStore.dispatch({ type: 'timeline/addStateEvent', time: t, nodeId });
  }

  function renderWaveform() {
    if (!_waveformCanvas || !_waveformCtx || !AudioEngine?.audioBus?.waveformPeaks) return;
    const peaks = AudioEngine.audioBus.waveformPeaks;
    const cw = _bar.offsetWidth;
    const ch = _bar.offsetHeight;
    
    _waveformCanvas.width = cw;
    _waveformCanvas.height = ch;
    
    _waveformCtx.clearRect(0, 0, cw, ch);
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#8b5cf6';
    _waveformCtx.fillStyle = `color-mix(in srgb, ${accent} 40%, transparent)`;
    
    const len = peaks.length / 2;
    const step = Math.max(1, Math.floor(len / cw));
    
    _waveformCtx.beginPath();
    _waveformCtx.moveTo(0, ch / 2);
    
    // Top half (max peaks)
    for (let i = 0; i < cw; i++) {
      const idx = Math.floor((i / cw) * len) * 2 + 1; // +1 for max
      if (idx < peaks.length) {
        const val = peaks[idx];
        const y = (1 - val) * ch / 2;
        _waveformCtx.lineTo(i, y);
      }
    }
    
    // Bottom half (min peaks)
    for (let i = cw - 1; i >= 0; i--) {
      const idx = Math.floor((i / cw) * len) * 2; // 0 for min
      if (idx < peaks.length) {
        const val = peaks[idx];
        const y = (1 - val) * ch / 2;
        _waveformCtx.lineTo(i, y);
      }
    }
    
    _waveformCtx.closePath();
    _waveformCtx.fill();
  }

  function render() {
    if (!ensureDom()) return;
    const project = ProjectStore.getState();
    const events = project.timeline.stateEvents || [];
    const dur = TimelineModel.getDuration(project);

    // Keep it visible once initialized.
    _root.classList.add('active');

    // Follow button state
    const followBtn = _root.querySelector('#btn-follow-timeline');
    if (followBtn) {
      const follow = !!(project.editor && project.editor.followTimeline);
      followBtn.classList.toggle('active', follow);
      followBtn.textContent = follow ? 'Follow: ON' : 'Follow: OFF';
    }

    // Keep list complexity hidden by default for clearer UX
    if (!_root.dataset.timelineInitialized) {
      _root.classList.add('collapsed');
      const toggleBtn = _root.querySelector('#btn-toggle-timeline');
      if (toggleBtn) toggleBtn.textContent = 'Show Details';
      _root.dataset.timelineInitialized = '1';
    }

    // events (clip blocks) on bar
    _eventLayer.innerHTML = '';
    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      const left = dur > 0 ? (evt.time / dur) * 100 : 0;
      const width = dur > 0 ? ((evt.duration || 5) / dur) * 100 : 0.8;
      const node = project.nodes.find(n => n.id === evt.nodeId);
      
      const clip = document.createElement('div');
      clip.className = 'timeline-state-clip';
      clip.style.left = `${left}%`;
      clip.style.width = `${width}%`;
      clip.title = `${evt.name || node?.name || evt.nodeId}`;
      clip.dataset.eventId = evt.id;
      
      // Trim Handles
      const leftHandle = document.createElement('div');
      leftHandle.className = 'timeline-handle left-handle';
      const rightHandle = document.createElement('div');
      rightHandle.className = 'timeline-handle right-handle';
      
      const label = document.createElement('span');
      label.className = 'timeline-clip-label';
      label.textContent = evt.name || node?.name || evt.nodeId;
      
      clip.appendChild(leftHandle);
      clip.appendChild(label);
      clip.appendChild(rightHandle);

      clip.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (_selectedEventId !== evt.id) {
          // Just select it first time
          _selectedEventId = evt.id;
          if (AudioEngine?.audioBus?.loaded) {
            AudioEngine.seek(evt.time);
            if (typeof VisualEngine !== 'undefined' && VisualEngine.applyStudioStateAtTime) {
              VisualEngine.applyStudioStateAtTime(evt.time);
            }
          }
          if (typeof UI !== 'undefined' && UI.buildStateInspector) UI.buildStateInspector(evt);
          render();
          return;
        }

        // Already selected -> Drag
        _draggingEventId = evt.id;
        _dragStartEvent = { ...evt }; // snapshot for trimming math

        const rect = _bar.getBoundingClientRect();
        const mouseRatio = (e.clientX - rect.left) / rect.width;
        const mouseTime = mouseRatio * dur;
        _dragOffsetX = mouseTime - evt.time; // how far into the clip the user clicked

        if (e.target.classList.contains('left-handle')) {
          _draggingHandle = 'left';
        } else if (e.target.classList.contains('right-handle')) {
          _draggingHandle = 'right';
        } else {
          _draggingHandle = 'body';
        }
      });
      clip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        ProjectStore.dispatch({ type: 'timeline/removeStateEvent', id: evt.id });
      });
      if (evt.id === _selectedEventId) clip.classList.add('selected');
      _eventLayer.appendChild(clip);
    }

    // markers on same bar
    _markerLayer.innerHTML = '';
    if (AudioEngine?.audioBus?.loaded) {
      const markers = MarkerSystem.getMarkers ? MarkerSystem.getMarkers() : [];
      for (const marker of markers) {
        const p = dur > 0 ? (marker.time / dur) * 100 : 0;
        
        const m = document.createElement('div');
        m.className = 'timeline-marker-pin';
        m.style.left = `${p}%`;
        m.style.background = `linear-gradient(to bottom, ${marker.color || '#f59e0b'}, transparent)`;

        const handle = document.createElement('div');
        handle.className = 'timeline-marker-handle';
        handle.style.borderTopColor = marker.color || '#f59e0b';
        handle.title = `${marker.label} @ ${TimelineModel.formatTime(marker.time)}`;
        handle.dataset.markerId = marker.id;
        
        handle.addEventListener('click', (e) => {
          e.stopPropagation();
          if (AudioEngine?.audioBus?.loaded) AudioEngine.seek(marker.time);
        });
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          _draggingMarkerId = marker.id;
        });
        handle.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          MarkerSystem.removeMarker(marker.id);
          render();
          if (typeof UI !== 'undefined' && UI.renderMarkers) UI.renderMarkers();
        });

        m.appendChild(handle);
        _markerLayer.appendChild(m);
      }
    }

    if (!_root.dataset.dragListenersBound) {
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      _root.dataset.dragListenersBound = '1';
    }

    // list
    _list.innerHTML = '';
    for (const evt of events) {
      const li = document.createElement('div');
      li.className = 'timeline-event-row';
      const node = project.nodes.find(n => n.id === evt.nodeId);
      li.innerHTML = `
        <div class="tcol time">${TimelineModel.formatTime(evt.time)}</div>
        <div class="tcol name">${escapeHtml(node?.name || evt.nodeId)}</div>
        <div class="tcol mode">
          <div class="mini">${escapeHtml(node?.visual?.modeKey || '—')}</div>
          <div class="miniControls">
            <label>Trans</label>
            <input class="tTrans" type="number" min="0" max="20" step="0.05" value="${Number(evt.transitionSec || 0).toFixed(2)}" />
            <select class="tEase">
              <option value="easeInOut" ${evt.easing === 'easeInOut' ? 'selected' : ''}>easeInOut</option>
              <option value="linear" ${evt.easing === 'linear' ? 'selected' : ''}>linear</option>
              <option value="easeOut" ${evt.easing === 'easeOut' ? 'selected' : ''}>easeOut</option>
              <option value="easeIn" ${evt.easing === 'easeIn' ? 'selected' : ''}>easeIn</option>
            </select>
          </div>
        </div>
        <button class="tcol del" title="Remove">✕</button>
      `;
      if (evt.id === _selectedEventId) li.classList.add('selected');

      const transInput = li.querySelector('input.tTrans');
      const easeSelect = li.querySelector('select.tEase');
      if (transInput) {
        transInput.addEventListener('change', () => {
          const v = Math.max(0, Number(transInput.value || 0));
          ProjectStore.dispatch({ type: 'timeline/updateStateEvent', id: evt.id, patch: { transitionSec: v } });
        });
      }
      if (easeSelect) {
        easeSelect.addEventListener('change', () => {
          ProjectStore.dispatch({ type: 'timeline/updateStateEvent', id: evt.id, patch: { easing: easeSelect.value } });
        });
      }
      li.querySelector('button.del').addEventListener('click', () => {
        ProjectStore.dispatch({ type: 'timeline/removeStateEvent', id: evt.id });
      });
      li.addEventListener('click', () => {
        _selectedEventId = evt.id;
        render();
      });
      li.addEventListener('dblclick', () => {
        if (AudioEngine?.audioBus?.loaded) {
          AudioEngine.seek(evt.time);
          if (typeof VisualEngine !== 'undefined' && VisualEngine.applyStudioStateAtTime) {
            VisualEngine.applyStudioStateAtTime(evt.time);
          }
        }
      });
      _list.appendChild(li);
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function deleteSelectedEvent() {
    if (!_selectedEventId) return;
    ProjectStore.dispatch({ type: 'timeline/removeStateEvent', id: _selectedEventId });
    _selectedEventId = null;
  }

  function onDragMove(e) {
    if (!_draggingEventId && !_draggingMarkerId && !_isScrubbing) return;
    if (!AudioEngine?.audioBus?.loaded) return;
    const rect = _bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    const dur = AudioEngine.audioBus.duration || 0;
    const time = Math.max(0, Math.min(dur, ratio * dur));
    
    if (_isScrubbing) {
      AudioEngine.seek(time);
      if (typeof VisualEngine !== 'undefined' && VisualEngine.applyStudioStateAtTime) {
        VisualEngine.applyStudioStateAtTime(time);
      }
    }
    if (_draggingEventId && _dragStartEvent) {
      const origEnd = _dragStartEvent.time + (_dragStartEvent.duration || 5);
      let newTime = _dragStartEvent.time;
      let newDuration = _dragStartEvent.duration || 5;

      if (_draggingHandle === 'body') {
        newTime = time - _dragOffsetX;
        newTime = Math.max(0, Math.min(dur - newDuration, newTime));
      } else if (_draggingHandle === 'right') {
        newDuration = Math.max(0.1, time - newTime);
      } else if (_draggingHandle === 'left') {
        newTime = Math.max(0, Math.min(origEnd - 0.1, time));
        newDuration = origEnd - newTime;
      }

      ProjectStore.dispatch({ 
        type: 'timeline/updateStateEvent', 
        id: _draggingEventId, 
        patch: { time: newTime, duration: newDuration } 
      }, { recordHistory: false });
    }
    if (_draggingMarkerId && MarkerSystem.moveMarker) {
      MarkerSystem.moveMarker(_draggingMarkerId, time);
      render();
    }
  }

  function onDragEnd() {
    if (_draggingEventId) {
      // Dispatch once with history to save the move
      const evt = ProjectStore.getState().timeline.stateEvents.find(e => e.id === _draggingEventId);
      if (evt) {
        ProjectStore.dispatch({ type: 'timeline/updateStateEvent', id: _draggingEventId, patch: { time: evt.time, duration: evt.duration } });
        if (typeof UI !== 'undefined' && UI.buildStateInspector) UI.buildStateInspector(evt);
      }
    }
    _draggingEventId = null;
    _draggingMarkerId = null;
    _isScrubbing = false;
    _draggingHandle = null;
    _dragStartEvent = null;
  }

  return { init, render, update, deleteSelectedEvent, renderWaveform };
})();

