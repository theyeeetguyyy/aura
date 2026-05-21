// ============================================================
// AURA — State Library v2
// Left sidebar — manage visual states for the timeline workflow
// ============================================================

const StateLibrary = (() => {
  let _list = null;
  let _captureBtn = null;

  function init() {
    _list = document.getElementById('state-list');
    _captureBtn = document.getElementById('btn-capture-state');
    if (!_list) return;

    if (_captureBtn) {
      _captureBtn.addEventListener('click', captureNewState);
    }

    ProjectStore.subscribe(render);
    render();
  }

  function captureNewState() {
    if (!AudioEngine?.audioBus?.loaded) {
      if (UI?.showToast) UI.showToast('Load audio first.', 'info');
      return;
    }
    const modeKey = VisualEngine?.activeModeKey || 'geometryForge';
    const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const t = AudioEngine.audioBus.currentTime || 0;
    const camState = VisualEngine?.getCameraSnapshot
      ? VisualEngine.getCameraSnapshot()
      : { pos: { x: 0, y: 0, z: 100 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 75 };

    ProjectStore.dispatch({ type: 'nodes/upsert', node: {
      id: nodeId,
      name: `State @ ${TimelineModel.formatTime(t)}`,
      visual: { modeKey, globalParams: ParamSystem.getAllGlobal(), modeParams: ParamSystem.getAllMode(), mappings: ParamSystem.getMappings() },
      camera: camState,
      ui: { x: 120 + Math.random() * 200, y: 80 + Math.random() * 150 },
    }});
    if (UI?.showToast) UI.showToast(`State captured — '${modeKey}'`, 'success');
  }

  function render() {
    if (!_list) return;
    const project = ProjectStore.getState();
    const nodes = project.nodes || [];

    _list.innerHTML = '';

    for (const node of nodes) {
      const row = document.createElement('div');
      row.className = 'state-card';

      const modeLabel = node.visual?.modeKey || '—';
      const hasParams = !!(node.visual?.modeParams || node.visual?.globalParams);

      row.innerHTML = `
        <div class="state-card-head">
          <div class="state-card-name" title="${escapeHtml(node.name || node.id)}">${escapeHtml(node.name || node.id)}</div>
          <div class="state-card-mode">${escapeHtml(modeLabel)}</div>
          ${hasParams ? '<span class="state-card-dot" title="Has captured params">●</span>' : ''}
        </div>
        <div class="state-card-actions">
          <button class="state-btn apply" title="Apply this state to the canvas">Apply</button>
          <button class="state-btn timeline" title="Add this state to the timeline at playhead">+ Timeline</button>
          <button class="state-btn capture-into" title="Capture current visual into this state">⦿ Update</button>
          <button class="state-btn delete" title="Delete this state">✕</button>
        </div>
      `;

      row.querySelector('.apply').addEventListener('click', () => {
        if (typeof VisualEngine !== 'undefined' && VisualEngine.applyNodeSnapshot) VisualEngine.applyNodeSnapshot(node);
        if (UI?.showToast) UI.showToast(`Applied: ${node.name || node.id}`, 'info');
      });

      row.querySelector('.timeline').addEventListener('click', () => {
        if (!AudioEngine?.audioBus?.loaded) { if (UI?.showToast) UI.showToast('Load audio first.', 'info'); return; }
        const t = AudioEngine.audioBus.currentTime || 0;
        ProjectStore.dispatch({ type: 'timeline/addStateEvent', time: t, nodeId: node.id });
        if (UI?.showToast) UI.showToast(`Added to timeline @ ${TimelineModel.formatTime(t)}`, 'success');
      });

      row.querySelector('.capture-into').addEventListener('click', () => {
        const updated = ProjectSchema.clone(node);
        updated.visual = {
          modeKey: VisualEngine?.activeModeKey || node.visual?.modeKey,
          globalParams: ParamSystem.getAllGlobal(),
          modeParams: ParamSystem.getAllMode(),
          mappings: ParamSystem.getMappings(),
        };
        updated.camera = VisualEngine?.getCameraSnapshot
          ? VisualEngine.getCameraSnapshot()
          : { pos: { x: 0, y: 0, z: 100 }, lookAt: { x: 0, y: 0, z: 0 }, fov: 75 };
        ProjectStore.dispatch({ type: 'nodes/upsert', node: updated });
        if (UI?.showToast) UI.showToast(`Updated: ${updated.name || updated.id}`, 'success');
      });

      row.querySelector('.delete').addEventListener('click', () => {
        if (!confirm(`Delete state "${node.name || node.id}"? This also removes its timeline clips.`)) return;
        ProjectStore.dispatch({ type: 'nodes/remove', id: node.id });
        if (UI?.showToast) UI.showToast('State deleted.', 'info');
      });

      row.addEventListener('dblclick', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        if (typeof VisualEngine !== 'undefined' && VisualEngine.applyNodeSnapshot) VisualEngine.applyNodeSnapshot(node);
      });

      _list.appendChild(row);
    }

    if (nodes.length === 0) {
      _list.innerHTML = '<div class="state-empty-hint">No states yet.<br>Capture your current visual above.</div>';
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { init, render, captureNewState };
})();
