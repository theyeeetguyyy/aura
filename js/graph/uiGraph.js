// ============================================================
// AURA — Graph UI (v1)
// Minimal node graph: create/select/drag nodes, connect edges.
// ============================================================

const GraphUI = (() => {
  let _panel = null;
  let _svg = null;
  let _nodeLayer = null;
  let _edgeLayer = null;
  let _btnNewNode = null;
  let _btnCapture = null;
  let _giName = null;
  let _giMode = null;
  let _giToTimeline = null;
  let _giCapture = null;

  let _selectedNodeId = null;
  let _connectingFromId = null;

  // View transform
  let _panX = 0;
  let _panY = 0;
  let _zoom = 1;
  let _panning = false;
  let _lastPan = { x: 0, y: 0 };

  // Dragging
  let _dragNodeId = null;
  let _dragStart = { x: 0, y: 0, nx: 0, ny: 0 };

  function init() {
    _panel = document.getElementById('graph-panel');
    if (!_panel) return;
    _svg = _panel.querySelector('#graph-svg');
    _edgeLayer = _panel.querySelector('#graph-edges');
    _nodeLayer = _panel.querySelector('#graph-nodes');
    _btnNewNode = _panel.querySelector('#btn-graph-new-node');
    _btnCapture = _panel.querySelector('#btn-graph-capture');
    _giName = _panel.querySelector('#gi-name');
    _giMode = _panel.querySelector('#gi-mode');
    _giToTimeline = _panel.querySelector('#gi-add-to-timeline');
    _giCapture = _panel.querySelector('#gi-capture');

    if (!_svg || !_edgeLayer || !_nodeLayer || !_btnNewNode || !_btnCapture || !_giName || !_giMode || !_giToTimeline || !_giCapture) return;

    _btnNewNode.addEventListener('click', () => createNode());
    _btnCapture.addEventListener('click', () => captureSelectedNode());

    _giCapture.addEventListener('click', () => captureSelectedNode());
    _giToTimeline.addEventListener('click', () => addSelectedNodeToTimeline());

    _giName.addEventListener('change', () => {
      const project = ProjectStore.getState();
      const node = project.nodes.find(n => n.id === _selectedNodeId);
      if (!node) return;
      const updated = ProjectSchema.clone(node);
      updated.name = _giName.value || updated.name;
      ProjectStore.dispatch({ type: 'nodes/upsert', node: updated });
    });

    _giMode.addEventListener('change', () => {
      const project = ProjectStore.getState();
      const node = project.nodes.find(n => n.id === _selectedNodeId);
      if (!node) return;
      const updated = ProjectSchema.clone(node);
      updated.visual = updated.visual || {};
      updated.visual.modeKey = _giMode.value;
      ProjectStore.dispatch({ type: 'nodes/upsert', node: updated });
    });

    // Background interactions: pan/zoom
    _svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = Math.sign(e.deltaY);
      const next = _zoom * (delta > 0 ? 0.9 : 1.1);
      _zoom = Math.max(0.35, Math.min(2.5, next));
      render();
    }, { passive: false });

    _svg.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target && (e.target.closest('.gNode') || e.target.closest('.gPort'))) return;
      _panning = true;
      _lastPan = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (_panning) {
        const dx = e.clientX - _lastPan.x;
        const dy = e.clientY - _lastPan.y;
        _lastPan = { x: e.clientX, y: e.clientY };
        _panX += dx;
        _panY += dy;
        render();
      }

      if (_dragNodeId) {
        const project = ProjectStore.getState();
        const node = project.nodes.find(n => n.id === _dragNodeId);
        if (!node) return;
        const { x, y } = clientToWorld(e.clientX, e.clientY);
        const nx = _dragStart.nx + (x - _dragStart.x);
        const ny = _dragStart.ny + (y - _dragStart.y);
        const updated = ProjectSchema.clone(node);
        updated.ui = updated.ui || {};
        updated.ui.x = nx;
        updated.ui.y = ny;
        ProjectStore.dispatch({ type: 'nodes/upsert', node: updated }, { recordHistory: false });
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        _panning = false;
        _dragNodeId = null;
      }
    });

    ProjectStore.subscribe(() => render());
    render();
  }

  function createNode() {
    const t = AudioEngine?.audioBus?.currentTime || 0;
    const modeKey = VisualEngine?.activeModeKey || 'geometryForge';
    const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    const node = {
      id: nodeId,
      name: `Node ${nodeId.slice(-4)}`,
      visual: { modeKey, globalParams: null, modeParams: null, mappings: null },
      camera: { orbitTheta: 0, orbitPhi: Math.PI / 2, orbitRadius: 100, fov: 75 },
      ui: {
        x: 120 + Math.random() * 260,
        y: 80 + Math.random() * 180,
      },
    };
    ProjectStore.dispatch({ type: 'nodes/upsert', node });
    _selectedNodeId = nodeId;
    _connectingFromId = null;
    render();
  }

  function captureSelectedNode() {
    const project = ProjectStore.getState();
    const node = project.nodes.find(n => n.id === _selectedNodeId);
    if (!node) return;

    const updated = ProjectSchema.clone(node);
    updated.visual = {
      modeKey: VisualEngine?.activeModeKey || updated.visual.modeKey,
      globalParams: ParamSystem.getAllGlobal(),
      modeParams: ParamSystem.getAllMode(),
      mappings: ParamSystem.getMappings(),
    };
    updated.camera = {
      ...(VisualEngine?.getOrbitState ? VisualEngine.getOrbitState() : {
        orbitTheta: 0,
        orbitPhi: Math.PI / 2,
        orbitRadius: 100,
        fov: VisualEngine?.camera?.fov || 75,
      })
    };

    ProjectStore.dispatch({ type: 'nodes/upsert', node: updated });
  }

  function addSelectedNodeToTimeline() {
    if (!_selectedNodeId) return;
    addNodeToTimelineById(_selectedNodeId);
  }

  function addNodeToTimelineById(nodeId) {
    if (!nodeId) return;
    if (!AudioEngine?.audioBus?.loaded) return;
    const t = AudioEngine.audioBus.currentTime || 0;
    ProjectStore.dispatch({ type: 'timeline/addStateEvent', time: t, nodeId });
  }

  function selectNodeById(nodeId) {
    _selectedNodeId = nodeId;
    render();
  }

  function applyNodeById(nodeId) {
    const project = ProjectStore.getState();
    const n = project.nodes.find(node => node.id === nodeId);
    if (!n) return;
    _selectedNodeId = nodeId;
    if (typeof VisualEngine !== 'undefined') {
      if (n.visual?.modeKey) VisualEngine.setMode(n.visual.modeKey);
      if (n.visual?.globalParams) for (const [k, v] of Object.entries(n.visual.globalParams)) ParamSystem.set(k, v);
      if (n.visual?.modeParams) for (const [k, v] of Object.entries(n.visual.modeParams)) ParamSystem.set(k, v);
      if (n.camera && VisualEngine.setOrbitState) VisualEngine.setOrbitState(n.camera);
    }
    render();
  }

  function render() {
    if (!_panel) return;
    const project = ProjectStore.getState();
    const nodes = project.nodes || [];
    const edges = project.edges || [];

    // Ensure nodes have non-overlapping default positions (migrate old projects)
    // We do this once per render pass when we detect missing ui positions.
    let needsPatch = false;
    const patchedNodes = [];
    let autoX = 120;
    let autoY = 90;
    for (const n of nodes) {
      if (n.ui && typeof n.ui.x === 'number' && typeof n.ui.y === 'number') {
        patchedNodes.push(n);
        continue;
      }
      needsPatch = true;
      const nn = ProjectSchema.clone(n);
      nn.ui = nn.ui || {};
      nn.ui.x = autoX;
      nn.ui.y = autoY;
      autoX += 220;
      if (autoX > 720) { autoX = 120; autoY += 140; }
      patchedNodes.push(nn);
    }
    if (needsPatch) {
      for (const n of patchedNodes) {
        ProjectStore.dispatch({ type: 'nodes/upsert', node: n }, { recordHistory: false });
      }
      // Let the store update re-render cleanly
      return;
    }

    // Populate mode dropdown once we have VisualEngine
    if (_giMode && _giMode.options.length === 0 && typeof VisualEngine !== 'undefined') {
      const keys = VisualEngine.getModeKeys ? VisualEngine.getModeKeys() : [];
      _giMode.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
    }

    setViewBox();

    // edges
    _edgeLayer.innerHTML = '';
    for (const e of edges) {
      const a = nodes.find(n => n.id === e.from);
      const b = nodes.find(n => n.id === e.to);
      if (!a || !b) continue;
      const ax = (a.ui?.x ?? 0) + 180;
      const ay = (a.ui?.y ?? 0) + 34;
      const bx = (b.ui?.x ?? 0);
      const by = (b.ui?.y ?? 0) + 34;
      const dx = Math.max(40, Math.abs(bx - ax) * 0.5);
      const d = `M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'gEdge');
      _edgeLayer.appendChild(path);
    }

    // nodes
    _nodeLayer.innerHTML = '';
    for (const n of nodes) {
      const x = n.ui?.x ?? 40;
      const y = n.ui?.y ?? 40;
      const g = el('div', 'gNode');
      if (n.id === _selectedNodeId) g.classList.add('selected');
      g.style.left = `${x}px`;
      g.style.top = `${y}px`;
      g.dataset.nodeId = n.id;

      const title = el('div', 'gTitle');
      title.textContent = n.name || n.id;

      const meta = el('div', 'gMeta');
      meta.textContent = (n.visual?.modeKey || '—');

      const ports = el('div', 'gPorts');
      const inPort = el('div', 'gPort in');
      inPort.title = 'Connect from another node';
      inPort.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_connectingFromId && _connectingFromId !== n.id) {
          connect(_connectingFromId, n.id);
          _connectingFromId = null;
          render();
        }
      });

      const outPort = el('div', 'gPort out');
      outPort.title = 'Start connecting';
      outPort.addEventListener('click', (e) => {
        e.stopPropagation();
        _connectingFromId = n.id;
        render();
      });

      ports.appendChild(inPort);
      ports.appendChild(outPort);

      g.appendChild(title);
      g.appendChild(meta);
      g.appendChild(ports);

      g.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target && e.target.closest('.gPort')) return; // don't cancel edge linking
        _selectedNodeId = n.id;
        _connectingFromId = null;
        // start drag
        _dragNodeId = n.id;
        const w = clientToWorld(e.clientX, e.clientY);
        _dragStart = { x: w.x, y: w.y, nx: x, ny: y };
        render();
      });

      g.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        // Double click: apply this node immediately (scrubless preview)
        if (typeof VisualEngine !== 'undefined') {
          // Create a “virtual” event: apply now by directly writing params
          // Reuse VisualEngine internal logic via timeline by inserting temp event is overkill.
          if (n.visual?.modeKey) VisualEngine.setMode(n.visual.modeKey);
          if (n.visual?.globalParams) for (const [k, v] of Object.entries(n.visual.globalParams)) ParamSystem.set(k, v);
          if (n.visual?.modeParams) for (const [k, v] of Object.entries(n.visual.modeParams)) ParamSystem.set(k, v);
        }
      });

      _nodeLayer.appendChild(g);
    }

    // Inspector binding
    const sel = nodes.find(n => n.id === _selectedNodeId) || null;
    if (_giName) _giName.value = sel ? (sel.name || '') : '';
    if (_giMode && sel?.visual?.modeKey) _giMode.value = sel.visual.modeKey;
    if (_giToTimeline) _giToTimeline.disabled = !sel;
    if (_giCapture) _giCapture.disabled = !sel;
    if (_giName) _giName.disabled = !sel;
    if (_giMode) _giMode.disabled = !sel;

    // Connection hint
    _panel.classList.toggle('connecting', !!_connectingFromId);
    if (typeof StateLibrary !== 'undefined' && StateLibrary.render) StateLibrary.render();
  }

  function connect(fromId, toId) {
    const project = ProjectStore.getState();
    const edges = project.edges || [];
    const exists = edges.some(e => e.from === fromId && e.to === toId);
    if (exists) return;
    ProjectStore.dispatch({
      type: 'graph/addEdge',
      edge: {
      id: `edge_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      from: fromId,
      to: toId,
      transitionSec: 0.75,
      easing: 'easeInOut',
      }
    });
  }

  function setViewBox() {
    // Node layer is HTML, so we emulate zoom/pan with CSS transforms.
    // SVG edges follow via viewBox.
    const w = _svg.clientWidth || 1;
    const h = _svg.clientHeight || 1;
    const vbW = w / _zoom;
    const vbH = h / _zoom;
    const vbX = -_panX / _zoom;
    const vbY = -_panY / _zoom;
    _svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    _nodeLayer.style.transform = `translate(${_panX}px, ${_panY}px) scale(${_zoom})`;
  }

  function clientToWorld(cx, cy) {
    const rect = _svg.getBoundingClientRect();
    const x = (cx - rect.left - _panX) / _zoom;
    const y = (cy - rect.top - _panY) / _zoom;
    return { x, y };
  }

  function el(tag, cls) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }

  return {
    init,
    render,
    getSelectedNodeId: () => _selectedNodeId,
    selectNodeById,
    applyNodeById,
    addNodeToTimelineById
  };
})();

