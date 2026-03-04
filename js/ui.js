// ============================================================
// AURA — UI System
// Transport bar, panels, file import, keyboard shortcuts
// ============================================================

const UI = (() => {
    let modePanelOpen = false;
    let paramsPanelOpen = false;
    let seekDragging = false;

    // Cached DOM references (populated in setupTransport)
    let _seekBar = null;
    let _timeDisplay = null;
    let _playBtn = null;
    let _recBtn = null;
    let _levelFill = null;

    function init() {
        setupTransport();
        setupFileImport();
        setupPanels();
        setupKeyboard();
        setupDropZone();
        setupMarkers();
    }

    // ── Transport Bar ──────────────────────────────────────
    function setupTransport() {
        _playBtn = document.getElementById('btn-play');
        _seekBar = document.getElementById('seek-bar');
        const volBar = document.getElementById('vol-bar');
        _recBtn = document.getElementById('btn-record');
        _timeDisplay = document.getElementById('time-display');
        _levelFill = document.getElementById('level-fill');

        _playBtn.addEventListener('click', () => {
            AudioEngine.togglePlay();
            updatePlayButton();
        });

        // Loop button
        const loopBtn = document.getElementById('btn-loop');
        if (loopBtn) {
            loopBtn.addEventListener('click', () => {
                const isLoop = AudioEngine.toggleLoop();
                loopBtn.classList.toggle('active', isLoop);
            });
        }

        // Seek bar
        _seekBar.addEventListener('mousedown', () => { seekDragging = true; });
        _seekBar.addEventListener('input', () => {
            if (AudioEngine.audioBus.loaded) {
                const t = (_seekBar.value / 1000) * AudioEngine.audioBus.duration;
                AudioEngine.seek(t);
            }
        });
        document.addEventListener('mouseup', () => { seekDragging = false; });

        // Volume
        volBar.addEventListener('input', () => {
            AudioEngine.setVolume(volBar.value / 100);
        });

        // Record
        _recBtn.addEventListener('click', () => {
            const canvas = document.getElementById('aura-canvas');
            Recorder.toggle(canvas);
            _recBtn.classList.toggle('recording', Recorder.isRecording);
        });

        // Flash toggle
        const flashBtn = document.getElementById('btn-flash');
        if (flashBtn) {
            flashBtn.addEventListener('click', () => {
                const enabled = VisualEngine.toggleFlash();
                flashBtn.style.opacity = enabled ? '1' : '0.35';
                flashBtn.title = enabled ? 'Beat Flash ON (F)' : 'Beat Flash OFF (F)';
            });
        }
    }

    function updatePlayButton() {
        if (_playBtn) _playBtn.textContent = AudioEngine.audioBus.isPlaying ? '⏸' : '▶';
    }

    function updateTransport() {
        const bus = AudioEngine.audioBus;
        if (!seekDragging && bus.duration > 0 && _seekBar) {
            _seekBar.value = (bus.currentTime / bus.duration) * 1000;
        }

        if (_timeDisplay) {
            _timeDisplay.textContent = `${formatTime(bus.currentTime)} / ${formatTime(bus.duration)}`;
        }

        // Update play button state
        if (_playBtn) _playBtn.textContent = bus.isPlaying ? '⏸' : '▶';

        // Recording time
        if (_recBtn) {
            if (Recorder.isRecording) {
                _recBtn.textContent = `⏺ ${formatTime(Recorder.getRecordingTime())}`;
                _recBtn.classList.add('recording');
            } else {
                _recBtn.textContent = '⏺';
                _recBtn.classList.remove('recording');
            }
        }

        // Update level meter
        if (_levelFill) {
            _levelFill.style.width = `${bus.rms * 100}%`;
        }
    }

    // ── File Import ────────────────────────────────────────
    function setupFileImport() {
        const fileInput = document.getElementById('file-input');
        const importBtn = document.getElementById('btn-import');

        importBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) await handleFile(file);
        });
    }

    async function handleFile(file) {
        const dropZone = document.getElementById('drop-zone');
        dropZone.classList.add('loading');

        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = `Loading ${file.name}...`;

        try {
            await AudioEngine.loadFile(file);
            AudioEngine.play();
            updatePlayButton();

            // Show track name
            const trackName = document.getElementById('track-name');
            if (trackName) trackName.textContent = file.name.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');

            // Hide the drop zone with fade
            dropZone.classList.add('hidden');

            // Show transport
            document.getElementById('transport-bar').classList.add('active');

        } catch (err) {
            console.error('Failed to load audio:', err);
            alert('Failed to load audio file. Please try another file.');
        }

        dropZone.classList.remove('loading');
    }

    // ── Drop Zone ──────────────────────────────────────────
    function setupDropZone() {
        const dropZone = document.getElementById('drop-zone');
        let dragCounter = 0;

        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            dropZone.classList.remove('hidden');
            dropZone.classList.add('drag-over');
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                if (AudioEngine.audioBus.loaded) {
                    dropZone.classList.add('hidden');
                }
                dropZone.classList.remove('drag-over');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragCounter = 0;
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && /\.(mp3|wav|ogg|flac|m4a|aac|wma)$/i.test(file.name)) {
                await handleFile(file);
            }
        });
    }

    // ── Panels ─────────────────────────────────────────────
    function setupPanels() {
        const modePanelBtn = document.getElementById('btn-modes');
        const paramsPanelBtn = document.getElementById('btn-params');

        modePanelBtn.addEventListener('click', () => toggleModesPanel());
        paramsPanelBtn.addEventListener('click', () => toggleParamsPanel());

        // Mode list click handler
        document.getElementById('mode-list').addEventListener('click', (e) => {
            const item = e.target.closest('.mode-item');
            if (item) {
                const key = item.dataset.mode;
                VisualEngine.setMode(key);
                updateModeList();
                buildParamsUI();
            }
        });

        // Randomize button
        const randomBtn = document.getElementById('btn-randomize');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => {
                ParamSystem.randomize();
                buildParamsUI();
            });
        }
    }

    function toggleModesPanel() {
        modePanelOpen = !modePanelOpen;
        const panel = document.getElementById('modes-panel');
        panel.classList.toggle('open', modePanelOpen);
        if (modePanelOpen) updateModeList();
    }

    function toggleParamsPanel() {
        paramsPanelOpen = !paramsPanelOpen;
        const panel = document.getElementById('params-panel');
        panel.classList.toggle('open', paramsPanelOpen);
        if (paramsPanelOpen) buildParamsUI();
    }

    function updateModeList() {
        const list = document.getElementById('mode-list');
        const keys = VisualEngine.getModeKeys();
        list.innerHTML = keys.map((key, idx) => `
            <div class="mode-item ${key === VisualEngine.activeModeKey ? 'active' : ''}" data-mode="${key}">
                <span class="mode-number">${(idx + 1).toString().padStart(2, '0')}</span>
                <span class="mode-icon">${getModeIcon(key)}</span>
                <span class="mode-name">${VisualEngine.getModeName(key)}</span>
            </div>
        `).join('');
    }

    function getModeIcon(key) {
        const icons = {
            frequencyBars: '📊', particleStorm: '✨', radialBloom: '🌸',
            terrainMesh: '🏔', waveformScope: '〰️', spectrogram: '🌈',
            kaleidoscope: '🔮', shaderTunnel: '🌀', geometryForge: '🔧',
            hyperforge: '⚡', godRays: '☀️', particleManipulation: '🎆',
            mathMode: '📐', fractalTree: '🌳', voronoiField: '🔷',
            lissajous: '∞', mobiusRings: '💍', gridDistortion: '🔲',
            dnaHelix: '🧬', polyhedronExplode: '💥', starfield: '⭐',
            nebula: '🌌', aurora: '🏔️', cyberGrid: '🏙️', neonPlasma: '🔮',
            dimensionalRift: '🌀', rhythmicGeometry: '🎶'
        };
        return icons[key] || '◆';
    }

    function buildParamsUI() {
        const container = document.getElementById('params-content');
        container.innerHTML = '';

        // Global section
        const globalSection = createSection('Global');
        for (const [key, schema] of Object.entries(ParamSystem.globalDefaults)) {
            globalSection.appendChild(createControl(key, schema, ParamSystem.globalValues[key], true));
        }
        container.appendChild(globalSection);

        // Mode section
        const modeSchema = ParamSystem.currentModeSchema;
        if (Object.keys(modeSchema).length > 0) {
            const modeName = VisualEngine.getModeName(VisualEngine.activeModeKey);
            const modeSection = createSection(modeName);
            for (const [key, schema] of Object.entries(modeSchema)) {
                modeSection.appendChild(createControl(key, schema, ParamSystem.modeValues[key], false));
            }
            container.appendChild(modeSection);
        }
    }

    function createSection(title) {
        const section = document.createElement('div');
        section.className = 'param-section';
        section.innerHTML = `<h3 class="param-section-title">${title}</h3>`;
        return section;
    }

    function createControl(key, schema, value, isGlobal) {
        const wrapper = document.createElement('div');
        wrapper.className = 'param-control';

        const label = document.createElement('label');
        label.textContent = schema.label || key;

        if (schema.type === 'range') {
            const row = document.createElement('div');
            row.className = 'param-row';

            const input = document.createElement('input');
            input.type = 'range';
            input.min = schema.min;
            input.max = schema.max;
            input.step = schema.step || 0.01;
            input.value = value ?? schema.default;
            input.className = 'param-slider';

            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'param-value';
            valueDisplay.textContent = parseFloat(input.value).toFixed(2);

            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                ParamSystem.set(key, v);
                valueDisplay.textContent = v.toFixed(2);
            });

            row.appendChild(label);
            row.appendChild(input);
            row.appendChild(valueDisplay);
            wrapper.appendChild(row);
        } else if (schema.type === 'toggle') {
            const row = document.createElement('div');
            row.className = 'param-row';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = value ?? schema.default;
            input.className = 'param-toggle';

            input.addEventListener('change', () => {
                ParamSystem.set(key, input.checked);
            });

            row.appendChild(label);
            row.appendChild(input);
            wrapper.appendChild(row);
        } else if (schema.type === 'select') {
            const row = document.createElement('div');
            row.className = 'param-row';

            const select = document.createElement('select');
            select.className = 'param-select';
            schema.options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === (value ?? schema.default)) o.selected = true;
                select.appendChild(o);
            });

            select.addEventListener('change', () => {
                ParamSystem.set(key, select.value);
            });

            row.appendChild(label);
            row.appendChild(select);
            wrapper.appendChild(row);
        } else if (schema.type === 'color') {
            const row = document.createElement('div');
            row.className = 'param-row';

            const input = document.createElement('input');
            input.type = 'color';
            input.value = value ?? schema.default;
            input.className = 'param-color';

            input.addEventListener('input', () => {
                ParamSystem.set(key, input.value);
            });

            row.appendChild(label);
            row.appendChild(input);
            wrapper.appendChild(row);
        }

        return wrapper;
    }

    // ── Keyboard Shortcuts ─────────────────────────────────
    function setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    AudioEngine.togglePlay();
                    updatePlayButton();
                    break;
                case 'Tab':
                    e.preventDefault();
                    toggleModesPanel();
                    break;
                case 'KeyP':
                    toggleParamsPanel();
                    break;
                case 'KeyR':
                    const canvas = document.getElementById('aura-canvas');
                    Recorder.toggle(canvas);
                    _recBtn.classList.toggle('recording', Recorder.isRecording);
                    break;
                case 'KeyM':
                    addMarkerAtCurrentTime();
                    break;
                case 'KeyF': {
                    // F = toggle beat flash
                    const enabled = VisualEngine.toggleFlash();
                    const flashBtn = document.getElementById('btn-flash');
                    if (flashBtn) {
                        flashBtn.style.opacity = enabled ? '1' : '0.35';
                        flashBtn.title = enabled ? 'Beat Flash ON (F)' : 'Beat Flash OFF (F)';
                    }
                    break;
                }
                case 'KeyG':
                    // G = fullscreen (F was taken by flash)
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen();
                    } else {
                        document.exitFullscreen();
                    }
                    break;
                case 'KeyL': {
                    const isLoop = AudioEngine.toggleLoop();
                    const loopBtn = document.getElementById('btn-loop');
                    if (loopBtn) loopBtn.classList.toggle('active', isLoop);
                    break;
                }
                case 'ArrowLeft':
                    e.preventDefault();
                    AudioEngine.seekRelative(-5);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    AudioEngine.seekRelative(5);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    AudioEngine.setVolume(Math.min(1, AudioEngine.getVolume() + 0.05));
                    document.getElementById('vol-bar').value = AudioEngine.getVolume() * 100;
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    AudioEngine.setVolume(Math.max(0, AudioEngine.getVolume() - 0.05));
                    document.getElementById('vol-bar').value = AudioEngine.getVolume() * 100;
                    break;
                case 'BracketRight':
                    VisualEngine.nextMode();
                    updateModeList();
                    buildParamsUI();
                    break;
                case 'BracketLeft':
                    VisualEngine.prevMode();
                    updateModeList();
                    buildParamsUI();
                    break;
            }

            // Number keys 1-9 for quick mode switch
            if (e.code.startsWith('Digit') && !e.ctrlKey && !e.altKey) {
                const idx = parseInt(e.code.replace('Digit', '')) - 1;
                const keys = VisualEngine.getModeKeys();
                if (idx >= 0 && idx < keys.length) {
                    VisualEngine.setMode(keys[idx]);
                    updateModeList();
                    buildParamsUI();
                }
            }
        });
    }

    // ── Helpers ────────────────────────────────────────────
    function formatTime(s) {
        if (!s || isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    function update() {
        updateTransport();
        updateMarkerSection();
    }

    // ── Marker System ─────────────────────────────────────

    function setupMarkers() {
        const addBtn = document.getElementById('btn-add-marker');
        const clearBtn = document.getElementById('btn-clear-markers');
        const markerTrack = document.getElementById('marker-track');

        if (addBtn) {
            addBtn.addEventListener('click', () => addMarkerAtCurrentTime());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                MarkerSystem.clearAll();
                renderMarkers();
            });
        }

        // Click on marker track to seek
        if (markerTrack) {
            markerTrack.addEventListener('click', (e) => {
                if (e.target.classList.contains('marker-dot')) return;
                const rect = markerTrack.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                const time = ratio * AudioEngine.audioBus.duration;
                AudioEngine.seek(time);
            });
        }
    }

    function addMarkerAtCurrentTime() {
        const bus = AudioEngine.audioBus;
        if (!bus.loaded || bus.duration <= 0) return;

        const typeSelect = document.getElementById('marker-type-select');
        const type = typeSelect ? typeSelect.value : 'drop';
        const time = bus.currentTime;

        MarkerSystem.addMarker(time, type);
        renderMarkers();
    }

    function renderMarkers() {
        const dotsContainer = document.getElementById('marker-dots');
        if (!dotsContainer) return;

        dotsContainer.innerHTML = '';
        const duration = AudioEngine.audioBus.duration;
        if (duration <= 0) return;

        const markers = MarkerSystem.getMarkers();

        // Render region backgrounds between markers
        for (let i = 0; i < markers.length; i++) {
            const m = markers[i];
            const nextTime = (i < markers.length - 1) ? markers[i + 1].time : duration;
            const leftPct = (m.time / duration) * 100;
            const widthPct = ((nextTime - m.time) / duration) * 100;

            const region = document.createElement('div');
            region.className = 'marker-region';
            region.style.left = leftPct + '%';
            region.style.width = widthPct + '%';
            region.style.backgroundColor = m.color;
            dotsContainer.appendChild(region);
        }

        // Render marker dots
        markers.forEach(m => {
            const pct = (m.time / duration) * 100;
            const dot = document.createElement('div');
            dot.className = 'marker-dot';
            dot.style.left = pct + '%';
            dot.style.backgroundColor = m.color;
            dot.style.color = m.color;
            dot.dataset.markerId = m.id;

            const label = document.createElement('span');
            label.className = 'marker-label';
            label.textContent = `${m.icon} ${m.label} [${formatTime(m.time)}]`;
            dot.appendChild(label);

            // Click to seek to marker
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                AudioEngine.seek(m.time);
            });

            // Right-click to delete
            dot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                MarkerSystem.removeMarker(m.id);
                renderMarkers();
            });

            dotsContainer.appendChild(dot);
        });
    }

    function updateMarkerSection() {
        const bus = AudioEngine.audioBus;
        // MarkerSystem.update() is already called in AudioEngine.updateSectionAwareness()
        // Just read the current state here — no duplicate call

        const indicator = document.getElementById('section-indicator');
        if (!indicator) return;

        const section = MarkerSystem.getCurrentSection();
        if (section) {
            indicator.classList.remove('section-hidden');
            indicator.textContent = section.icon + ' ' + section.label;
            indicator.style.backgroundColor = section.color + '33';
            indicator.style.color = section.color;
            indicator.style.border = '1px solid ' + section.color + '66';
        } else {
            indicator.classList.add('section-hidden');
        }
    }

    return {
        init,
        update,
        buildParamsUI,
        updateModeList,
        toggleModesPanel,
        toggleParamsPanel
    };
})();
