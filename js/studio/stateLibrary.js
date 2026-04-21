// ============================================================
// AURA — State Library
// Left sidebar list for timeline-first workflow
// ============================================================

const StateLibrary = (() => {
  let _list = null;

  function init() {
    _list = document.getElementById('state-list');
    if (!_list) return;
    ProjectStore.subscribe(render);
    render();
  }

  function render() {
    if (!_list) return;
    const project = ProjectStore.getState();
    const nodes = project.nodes || [];
    const selectedNodeId = (typeof GraphUI !== 'undefined' && GraphUI.getSelectedNodeId) ? GraphUI.getSelectedNodeId() : null;

    _list.innerHTML = '';
    for (const node of nodes) {
      const row = document.createElement('div');
      row.className = 'state-card';
      if (node.id === selectedNodeId) row.classList.add('selected');

      row.innerHTML = `
        <div class="state-card-head">
          <div class="state-card-name">${escapeHtml(node.name || node.id)}</div>
          <div class="state-card-mode">${escapeHtml(node.visual?.modeKey || '—')}</div>
        </div>
        <div class="state-card-actions">
          <button class="state-btn apply">Apply</button>
          <button class="state-btn timeline">To Timeline</button>
          <button class="state-btn select">Select</button>
          <button class="state-btn delete" ${node.id === 'node_1' ? 'disabled' : ''}>Delete</button>
        </div>
      `;

      row.querySelector('.apply').addEventListener('click', () => {
        if (typeof GraphUI !== 'undefined' && GraphUI.applyNodeById) GraphUI.applyNodeById(node.id);
      });
      row.querySelector('.timeline').addEventListener('click', () => {
        if (typeof GraphUI !== 'undefined' && GraphUI.addNodeToTimelineById) GraphUI.addNodeToTimelineById(node.id);
      });
      row.querySelector('.select').addEventListener('click', () => {
        if (typeof GraphUI !== 'undefined' && GraphUI.selectNodeById) GraphUI.selectNodeById(node.id);
      });
      row.querySelector('.delete').addEventListener('click', () => {
        if (node.id === 'node_1') {
          if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('Default state cannot be deleted.', 'info');
          return;
        }
        if (typeof ProjectStore !== 'undefined') {
          ProjectStore.dispatch({ type: 'nodes/remove', id: node.id });
          if (typeof UI !== 'undefined' && UI.showToast) UI.showToast('State deleted from library and timeline.', 'info');
        }
      });
      row.addEventListener('dblclick', () => {
        if (typeof GraphUI !== 'undefined' && GraphUI.applyNodeById) GraphUI.applyNodeById(node.id);
      });

      _list.appendChild(row);
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { init, render };
})();

