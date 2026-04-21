// ============================================================
// AURA — UI System
// Transport bar, panels, file import, keyboard shortcuts
// ============================================================

const UI = (() => {
    let modePanelOpen = false;
    let paramsPanelOpen = false;
    let seekDragging = false;
    let modeListBuilt = false; // 2.5: Track if mode list DOM exists
    let debugHUDVisible = false; // 5.9: Debug HUD state
    let clearMarkersConfirm = false; // 4.6: 2-step confirm state
    let clearMarkersTimer = null;

    // Cached DOM references (populated in setupTransport)
    let _seekBar = null;
    let _timeDisplay = null;
    let _playBtn = null;
    let _recBtn = null;
    let _levelFill = null;
    let _bpmDisplay = null;
    let _volDisplay = null;
    let _debugHUD = null;
    let _recOverlay = null;
    let _fpsHistory = [];
    let _lastFpsTime = performance.now();

    function init() {
        setupTransport();
        setupStudioControls();
        setupGlobalSettings();
        setupFileImport();
        setupPanels();
        setupKeyboard();
        setupDropZone();
        setupMarkers();
        setupShortcutsModal();
        setupPresets();
        if (typeof TimelineUI !== 'undefined') TimelineUI.init();
        if (typeof GraphUI !== 'undefined') GraphUI.init();
        if (typeof StateLibrary !== 'undefined') StateLibrary.init();
        if (typeof StudioLayout !== 'undefined') StudioLayout.init();
    }

    function setupStudioControls() {
        const themeSelect = document.getElementById('theme-select');
        const savedTheme = localStorage.getItem('aura_theme') || 'purple';
        if (themeSelect) {
            themeSelect.value = savedTheme;
            applyTheme(savedTheme);
            themeSelect.addEventListener('change', () => {
                applyTheme(themeSelect.value);
                localStorage.setItem('aura_theme', themeSelect.value);
            });
        }
    }

    function applyTheme(theme) {
        document.body.classList.remove('theme-mono', 'theme-shiny', 'theme-matte');
        if (theme === 'mono') document.body.classList.add('theme-mono');
        else if (theme === 'shiny') document.body.classList.add('theme-shiny');
        else if (theme === 'matte') document.body.classList.add('theme-matte');
    }

    function setupGlobalSettings() {
        const openBtn = document.getElementById('btn-global-settings');
        const modal = document.getElementById('global-settings-modal');
        const closeBtn = document.getElementById('global-settings-close');
        const liveMap = document.getElementById('settings-live-ui-mapping');
        const followTimeline = document.getElementById('settings-follow-timeline');
        const bpmAuto = document.getElementById('bpm-auto');
        const bpmManual = document.getElementById('bpm-manual');
        if (!openBtn || !modal || !closeBtn) return;

        openBtn.addEventListener('click', () => {
            if (liveMap) liveMap.checked = !!ParamSystem.get('liveUIMapping');
            if (bpmAuto) bpmAuto.checked = !!AudioEngine.audioBus.autoBpm;
            if (bpmManual) bpmManual.value = String(AudioEngine.audioBus.manualBpm || 140);
            if (followTimeline && typeof ProjectStore !== 'undefined') {
                const p = ProjectStore.getState();
                followTimeline.checked = !!(p.editor && p.editor.followTimeline);
            }
            modal.classList.add('open');
        });
        closeBtn.addEventListener('click', () => modal.classList.remove('open'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });
        if (liveMap) {
            liveMap.addEventListener('change', () => {
                ParamSystem.set('liveUIMapping', !!liveMap.checked);
            });
        }
        if (followTimeline) {
            followTimeline.addEventListener('change', () => {
                if (typeof ProjectStore !== 'undefined') {
                    ProjectStore.dispatch({
                        type: 'editor/set',
                        editor: { followTimeline: !!followTimeline.checked }
                    }, { recordHistory: false });
                }
            });
        }
    }

    // ── Transport Bar ──────────────────────────────────────
    function setupTransport() {
        _playBtn = document.getElementById('btn-play');
        _seekBar = document.getElementById('seek-bar');
        const volBar = document.getElementById('vol-bar');
        _recBtn = document.getElementById('btn-record');
        _timeDisplay = document.getElementById('time-display');
        _levelFill = document.getElementById('level-fill');
        _bpmDisplay = document.getElementById('bpm-display');
        _volDisplay = document.getElementById('vol-display');
        const bpmAuto = document.getElementById('bpm-auto');
        const bpmManual = document.getElementById('bpm-manual');

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

        // Volume — 4.13: Show percentage
        volBar.addEventListener('input', () => {
            const v = volBar.value / 100;
            AudioEngine.setVolume(v);
            if (_volDisplay) _volDisplay.textContent = `${volBar.value}%`;
        });

        // Record
        _recBtn.addEventListener('click', () => {
            const canvas = document.getElementById('aura-canvas');
            Recorder.toggle(canvas);
            _recBtn.classList.toggle('recording', Recorder.isRecording);
            updateRecOverlay();
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

        // 5.9: Create debug HUD
        createDebugHUD();
        // 4.10: Create REC overlay
        createRecOverlay();

        if (bpmAuto) {
            bpmAuto.addEventListener('change', () => {
                if (AudioEngine.setAutoBpm) AudioEngine.setAutoBpm(bpmAuto.checked);
            });
        }
        if (bpmManual) {
            bpmManual.addEventListener('change', () => {
                const v = Math.max(60, Math.min(220, Number(bpmManual.value || 140)));
                bpmManual.value = String(v);
                if (AudioEngine.setManualBpm) AudioEngine.setManualBpm(v);
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

        // 3.3: Update BPM display
        if (_bpmDisplay && bus.loaded) {
            _bpmDisplay.textContent = `${bus.bpm} BPM`;
        }

        // Update play button state
        if (_playBtn) _playBtn.textContent = bus.isPlaying ? '⏸' : '▶';

        // Recording time + 4.10: REC overlay
        if (_recBtn) {
            if (Recorder.isRecording) {
                _recBtn.textContent = `⏺ ${formatTime(Recorder.getRecordingTime())}`;
                _recBtn.classList.add('recording');
                if (_recOverlay) {
                    _recOverlay.style.display = 'block';
                    _recOverlay.textContent = `● REC ${formatTime(Recorder.getRecordingTime())}`;
                }
            } else {
                _recBtn.textContent = '⏺';
                _recBtn.classList.remove('recording');
                if (_recOverlay) _recOverlay.style.display = 'none';
            }
        }

        // Update level meter
        if (_levelFill) {
            _levelFill.style.width = `${bus.rms * 100}%`;
        }

        if (debugHUDVisible && _debugHUD) updateDebugHUD(bus);

        // Active parameter modulation rendering
        if (ParamSystem.get('liveUIMapping')) {
            const mappings = ParamSystem.getMappings();
            for (const key in mappings) {
                const map = mappings[key];
                let audioVal = 0;
                if (map.band === 'onset') audioVal = bus.onsetStrength || 0;
                else if (map.band === 'envelope') audioVal = bus.envelope || 0;
                else audioVal = bus.smoothBands[map.band] || bus.rawBands[map.band] || 0;
                
                const paramInput = document.querySelector(`input.param-slider[data-param-key="${key}"]`);
                const paramDisplay = document.querySelector(`span[data-param-value-for="${key}"]`);
                if (paramInput && paramDisplay) {
                    const baseSchema = ParamSystem.currentModeSchema[key] || ParamSystem.globalDefaults[key];
                    if (baseSchema) {
                        const baseVal = ParamSystem.get(key);
                        const modulated = Math.max(baseSchema.min, Math.min(baseSchema.max, baseVal + audioVal * map.amount));
                        paramInput.value = modulated;
                        paramDisplay.textContent = parseFloat(modulated).toFixed(2);
                        paramInput.classList.add('modulated-live');
                    }
                }
            }
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

            // Aura Studio: ensure timeline dock is visible after load
            const timelineDock = document.getElementById('timeline-dock');
            if (timelineDock) timelineDock.classList.add('active');
            if (typeof StudioLayout !== 'undefined' && StudioLayout.updateStatus) {
                StudioLayout.updateStatus(`Editing: ${file.name}`);
            }

            // Show track name
            const trackName = document.getElementById('track-name');
            if (trackName) trackName.textContent = file.name.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');

            // Aura Studio: store audio metadata on project
            if (typeof ProjectStore !== 'undefined') {
                ProjectStore.dispatch({
                    type: 'audio/meta',
                    audio: { fileName: file.name, duration: AudioEngine.audioBus.duration || 0 }
                }, { recordHistory: false });
            }

            // Hide the drop zone with fade
            dropZone.classList.add('hidden');

            // Show transport
            document.getElementById('transport-bar').classList.add('active');

            // 1.9: Re-render markers for new file (clears stale markers from old duration)
            renderMarkers();

            // 1.14: Sync loop button state on file load
            const loopBtn = document.getElementById('btn-loop');
            if (loopBtn) loopBtn.classList.toggle('active', AudioEngine.isLooping());

        } catch (err) {
            console.error('Failed to load audio:', err);
            // BUG-19 fix: Non-blocking toast instead of alert() which freezes rendering
            showToast('Failed to load audio file. Please try another file.', 'error');
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
        // --- Panel Resizing Logic ---
        function makeResizable(panelId, isLeft) {
            const panel = document.getElementById(panelId);
            if (!panel) return;
            const handle = document.createElement('div');
            handle.className = 'panel-resize-handle';
            panel.appendChild(handle);
            
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;

            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startWidth = panel.offsetWidth;
                panel.classList.add('resizing');
                handle.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const dx = e.clientX - startX;
                let newWidth = isLeft ? startWidth + dx : startWidth - dx;
                newWidth = Math.max(220, Math.min(newWidth, 500));
                panel.style.width = `${newWidth}px`;
            });

            document.addEventListener('mouseup', () => {
                if (!isResizing) return;
                isResizing = false;
                panel.classList.remove('resizing');
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
            });
        }
        
        makeResizable('modes-panel', true);
        makeResizable('params-panel', false);

        const modePanelBtn = document.getElementById('btn-modes');
        const paramsPanelBtn = document.getElementById('btn-params');
        const graphPanelBtn = document.getElementById('btn-graph');

        modePanelBtn.addEventListener('click', () => toggleModesPanel());
        paramsPanelBtn.addEventListener('click', () => toggleParamsPanel());
        if (graphPanelBtn) graphPanelBtn.addEventListener('click', () => toggleGraphPanel());

        // Mode list click handler
        document.getElementById('mode-list').addEventListener('click', (e) => {
            const item = e.target.closest('.mode-item');
            if (item) {
                const key = item.dataset.mode;
                VisualEngine.setMode(key);
                updateModeList();
                buildParamsUI();

                // If timeline-follow is on and we are currently playing, inform user.
                if (AudioEngine?.audioBus?.isPlaying && typeof ProjectStore !== 'undefined') {
                    const follow = !!(ProjectStore.getState().editor && ProjectStore.getState().editor.followTimeline);
                    if (follow && UI.showToast) UI.showToast('Playback is following Timeline. Pause or toggle Follow: OFF to freely switch modes.', 'info');
                }

                // NOTE: mode switch now updates live preview only.
                // Persisting to a state is explicit via Capture actions.
            }
        });

        // 4.3: Mode search filter
        const modeSearch = document.getElementById('mode-search');
        if (modeSearch) {
            modeSearch.addEventListener('input', () => {
                const query = modeSearch.value.toLowerCase();
                document.querySelectorAll('.mode-item').forEach(el => {
                    const name = (el.querySelector('.mode-name')?.textContent || '').toLowerCase();
                    const key = (el.dataset.mode || '').toLowerCase();
                    el.style.display = (name.includes(query) || key.includes(query)) ? '' : 'none';
                });
            });
        }

        // 1.10: Randomize — update param values in-place instead of full rebuild
        const randomBtn = document.getElementById('btn-randomize');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => {
                ParamSystem.randomize();
                refreshParamValues();

                if (AudioEngine?.audioBus?.isPlaying && typeof ProjectStore !== 'undefined') {
                    const follow = !!(ProjectStore.getState().editor && ProjectStore.getState().editor.followTimeline);
                    if (follow && UI.showToast) UI.showToast('Playback is following Timeline. Pause or toggle Follow: OFF to Randomize live.', 'info');
                }

                // NOTE: randomize now updates live preview only.
                // Persisting to a state is explicit via Capture actions.
            });
        }
    }

    function toggleModesPanel() {
        const panel = document.getElementById('modes-panel');
        modePanelOpen = !panel.classList.contains('open');
        panel.classList.toggle('open', modePanelOpen);
        if (modePanelOpen) updateModeList();
    }

    function toggleParamsPanel() {
        const panel = document.getElementById('params-panel');
        paramsPanelOpen = !panel.classList.contains('open');
        panel.classList.toggle('open', paramsPanelOpen);
        if (paramsPanelOpen) buildParamsUI();
    }

    function toggleGraphPanel() {
        const panel = document.getElementById('graph-panel');
        if (!panel) return;
        const isOpen = !panel.classList.contains('open');
        panel.classList.toggle('open', isOpen);
        const btn = document.getElementById('btn-graph');
        if (btn) btn.classList.toggle('active', isOpen);
        if (isOpen && typeof GraphUI !== 'undefined') GraphUI.render();
    }

    function updateModeList() {
        const list = document.getElementById('mode-list');
        const keys = VisualEngine.getModeKeys();

        // 2.5: Build DOM only once, then just toggle active class
        if (!modeListBuilt) {
            list.innerHTML = keys.map((key, idx) => `
                <div class="mode-item" data-mode="${key}">
                    <span class="mode-number">${(idx + 1).toString().padStart(2, '0')}</span>
                    <span class="mode-icon">${getModeIcon(key)}</span>
                    <span class="mode-name">${VisualEngine.getModeName(key)}</span>
                </div>
            `).join('');
            modeListBuilt = true;
        }
        // Just toggle active class
        document.querySelectorAll('.mode-item').forEach(el => {
            el.classList.toggle('active', el.dataset.mode === VisualEngine.activeModeKey);
        });
    }

    function getModeIcon(key) {
        const icons = {
            frequencyBars: '📊', particleStorm: '✨', radialBloom: '🌸',
            terrainMesh: '🏔', waveformScope: '〰️', spectrogram: '🌈',
            kaleidoscope: '🔮', shaderTunnel: '🌀', geometryForge: '🔧',
            hyperforge: '⚡', particleManipulation: '🎆',
            mathMode: '📐', fractalTree: '🌳', voronoiField: '🔷',
            lissajous: '∞', mobiusRings: '💍', gridDistortion: '🔲',
            starfield: '⭐', cyberGrid: '🏙️', neonPlasma: '🔮',
            rhythmicGeometry: '🎶'
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
            input.dataset.paramKey = key; // 1.10: For refreshParamValues

            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'param-value';
            valueDisplay.dataset.paramValueFor = key; // 1.10
            valueDisplay.textContent = parseFloat(input.value).toFixed(2);
            valueDisplay.title = "Double-click to edit";

            // Double click to type inline exact values
            valueDisplay.addEventListener('dblclick', () => {
                const numInput = document.createElement('input');
                numInput.type = 'number';
                numInput.className = 'param-value-input';
                numInput.value = parseFloat(input.value).toFixed(2);
                numInput.min = schema.min;
                numInput.max = schema.max;
                numInput.step = schema.step || 0.01;
                
                const commit = () => {
                    let v = parseFloat(numInput.value);
                    if(isNaN(v)) v = parseFloat(input.value);
                    v = Math.max(schema.min, Math.min(schema.max, v));
                    input.value = v;
                    ParamSystem.set(key, v);
                    valueDisplay.textContent = v.toFixed(2);
                    valueDisplay.style.display = '';
                    numInput.remove();
                };

                numInput.addEventListener('blur', commit);
                numInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') commit();
                    if (e.key === 'Escape') {
                        valueDisplay.style.display = '';
                        numInput.remove();
                    }
                });

                valueDisplay.style.display = 'none';
                row.insertBefore(numInput, valueDisplay);
                numInput.focus();
                numInput.select();
            });

            const linkBtn = document.createElement('button');
            linkBtn.className = 'param-link-btn';
            linkBtn.innerHTML = '🔗';
            linkBtn.title = 'Audio Modulation Mappings';
            linkBtn.onclick = () => showMappingModal(key, label.textContent, isGlobal ? 'global' : 'mode');
            
            // Mark if already mapped
            if (ParamSystem.getMapping(key)) linkBtn.classList.add('mapped');

            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                ParamSystem.set(key, v);
                valueDisplay.textContent = v.toFixed(2);
            });

            row.appendChild(label);
            row.appendChild(linkBtn);
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
            input.dataset.paramKey = key; // 1.10

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
            select.dataset.paramKey = key; // 1.10
            schema.options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                if (opt === (value ?? schema.default)) o.selected = true;
                select.appendChild(o);
            });

            select.addEventListener('change', () => {
                ParamSystem.set(key, select.value);
                if (key === 'aspectRatio') {
                    window.dispatchEvent(new Event('resize'));
                }
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
            input.dataset.paramKey = key; // 1.10

            input.addEventListener('input', () => {
                ParamSystem.set(key, input.value);
            });

            row.appendChild(label);
            row.appendChild(input);
            wrapper.appendChild(row);
        }

        return wrapper;
    }

    // ── Audio Mapping Modal ────────────────────────────────────────
    function showMappingModal(paramKey, paramName, type) {
        let modal = document.getElementById('mapping-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mapping-modal';
            modal.className = 'mapping-modal';
            document.body.appendChild(modal);
        }

        const map = ParamSystem.getMapping(paramKey) || { band: '', amount: 0 };
        
        modal.innerHTML = `
            <div class="mapping-modal-content">
                <h3>Modulate: ${paramName}</h3>
                <div class="mapping-row">
                    <label>Source:</label>
                    <select id="map-source">
                        <option value="">None</option>
                        <option value="sub" ${map.band === 'sub' ? 'selected' : ''}>Sub-bass</option>
                        <option value="bass" ${map.band === 'bass' ? 'selected' : ''}>Bass</option>
                        <option value="lowMid" ${map.band === 'lowMid' ? 'selected' : ''}>Low-Mid</option>
                        <option value="mid" ${map.band === 'mid' ? 'selected' : ''}>Mid</option>
                        <option value="highMid" ${map.band === 'highMid' ? 'selected' : ''}>High-Mid</option>
                        <option value="treble" ${map.band === 'treble' ? 'selected' : ''}>Treble</option>
                        <option value="onset" ${map.band === 'onset' ? 'selected' : ''}>Transient/Onset</option>
                        <option value="envelope" ${map.band === 'envelope' ? 'selected' : ''}>Volume Envelope</option>
                    </select>
                </div>
                <div class="mapping-row">
                    <label>Amount:</label>
                    <input type="range" id="map-amount" min="-5" max="5" step="0.1" value="${map.amount}">
                    <span id="map-amount-val">${map.amount}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:15px;">
                    <button id="map-clear" style="background:#ef4444;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Clear</button>
                    <div>
                        <button id="map-cancel" style="background:transparent;color:#bbb;border:1px solid #444;padding:5px 10px;border-radius:4px;cursor:pointer;margin-right:5px;">Cancel</button>
                        <button id="map-save" style="background:#8b5cf6;color:#fff;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">Apply</button>
                    </div>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';

        document.getElementById('map-amount').oninput = (e) => {
            document.getElementById('map-amount-val').textContent = e.target.value;
        };

        document.getElementById('map-cancel').onclick = () => modal.style.display = 'none';
        
        document.getElementById('map-clear').onclick = () => {
            ParamSystem.setMapping(paramKey, null, 0, type);
            buildParamsUI();
            modal.style.display = 'none';
        };

        document.getElementById('map-save').onclick = () => {
            const src = document.getElementById('map-source').value;
            const amt = parseFloat(document.getElementById('map-amount').value);
            ParamSystem.setMapping(paramKey, src, amt, type);
            buildParamsUI(); // Rebuild to show green chain icon
            modal.style.display = 'none';
        };
    }

    // 1.10: Refresh param input values in-place (no DOM rebuild)
    function refreshParamValues() {
        document.querySelectorAll('[data-param-key]').forEach(el => {
            const key = el.dataset.paramKey;
            const val = ParamSystem.get(key);
            if (val === undefined) return;
            if (el.type === 'range' || el.type === 'color') el.value = val;
            if (el.type === 'checkbox') el.checked = val;
            if (el.tagName === 'SELECT') el.value = val;
        });
        // Update value display spans
        document.querySelectorAll('[data-param-value-for]').forEach(span => {
            const key = span.dataset.paramValueFor;
            const val = ParamSystem.get(key);
            if (val !== undefined && typeof val === 'number') {
                span.textContent = val.toFixed(2);
            }
        });
    }

    // ── Keyboard Shortcuts ─────────────────────────────────
    function setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

            // Editor undo/redo
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ') {
                e.preventDefault();
                if (typeof ProjectStore !== 'undefined') ProjectStore.undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) {
                e.preventDefault();
                if (typeof ProjectStore !== 'undefined') ProjectStore.redo();
                return;
            }

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
                case 'KeyN':
                    toggleGraphPanel();
                    break;
                case 'Delete':
                case 'Backspace': {
                    // Delete selected graph node
                    if (typeof GraphUI !== 'undefined' && typeof ProjectStore !== 'undefined') {
                        const id = GraphUI.getSelectedNodeId ? GraphUI.getSelectedNodeId() : null;
                        if (id && id !== 'node_1') {
                            ProjectStore.dispatch({ type: 'nodes/remove', id });
                            break;
                        }
                    }
                    // If no node deletion happened, try deleting selected timeline event
                    if (typeof TimelineUI !== 'undefined' && TimelineUI.deleteSelectedEvent) {
                        TimelineUI.deleteSelectedEvent();
                    }
                    break;
                }
                case 'KeyR': {
                    const canvas = document.getElementById('aura-canvas');
                    Recorder.toggle(canvas);
                    _recBtn.classList.toggle('recording', Recorder.isRecording);
                    updateRecOverlay();
                    break;
                }
                case 'KeyM':
                    addMarkerAtCurrentTime();
                    break;
                case 'KeyD': {
                    // 5.9: Toggle debug HUD
                    debugHUDVisible = !debugHUDVisible;
                    if (_debugHUD) _debugHUD.style.display = debugHUDVisible ? 'block' : 'none';
                    break;
                }
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
                case 'KeyS': {
                    // 5.7: Screenshot (Ctrl+S)
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        screenshot();
                    }
                    break;
                }
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
                    if (_volDisplay) _volDisplay.textContent = `${Math.round(AudioEngine.getVolume() * 100)}%`;
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    AudioEngine.setVolume(Math.max(0, AudioEngine.getVolume() - 0.05));
                    document.getElementById('vol-bar').value = AudioEngine.getVolume() * 100;
                    if (_volDisplay) _volDisplay.textContent = `${Math.round(AudioEngine.getVolume() * 100)}%`;
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
                case 'KeyT':
                    // T = tap BPM
                    if (typeof AudioEngine !== 'undefined' && AudioEngine.tapBPM) AudioEngine.tapBPM();
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

    // 5.7: Screenshot
    function screenshot() {
        const canvas = document.getElementById('aura-canvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `aura_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // 5.9: Create debug HUD overlay
    function createDebugHUD() {
        _debugHUD = document.createElement('div');
        _debugHUD.id = 'debug-hud';
        _debugHUD.style.cssText = `position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:200;font-family:var(--mono);font-size:11px;color:#0f0;background:rgba(0,0,0,0.7);padding:8px 14px;border-radius:8px;pointer-events:none;display:none;white-space:pre;line-height:1.6;border:1px solid rgba(0,255,0,0.2);`;
        document.body.appendChild(_debugHUD);
    }

    function updateDebugHUD(bus) {
        const now = performance.now();
        _fpsHistory.push(1000 / (now - _lastFpsTime));
        _lastFpsTime = now;
        if (_fpsHistory.length > 60) _fpsHistory.shift();
        const avgFps = _fpsHistory.length > 0 ? (_fpsHistory.reduce((a, b) => a + b) / _fpsHistory.length).toFixed(0) : '—';

        const renderer = VisualEngine.renderer;
        const info = renderer ? renderer.info.render : {};

        // 7-band ASCII spectrum bar
        const bandKeys = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'brilliance'];
        const bandLabels = ['SUB', 'BAS', 'LMD', 'MID', 'HMD', 'TRE', 'BRI'];
        let specBar = '';
        for (let i = 0; i < bandKeys.length; i++) {
            const v = bus.smoothBands?.[bandKeys[i]] ?? 0;
            const bars = Math.min(8, Math.round(v * 8));
            specBar += bandLabels[i] + ' ' + '█'.repeat(bars) + '░'.repeat(8 - bars) + (i < 6 ? '  ' : '');
        }

        // Tearout detector states
        const gunState = bus.gunShotDetected ? `🔫 GUN ✦ ${bus.gunShotIntensity?.toFixed(2) || ''}` : '🔫 —';
        const sirenState = (bus.sirenIntensity || 0) > 0.1 ? `🚨 SIREN ${bus.sirenRising > bus.sirenFalling ? '↑' : '↓'} ${bus.sirenIntensity.toFixed(2)}` : '🚨 —';
        const screechState = bus.screechDetected ? `⚡ SCREECH ${bus.screechIntensity?.toFixed(2) || ''}` : '⚡ —';
        const subState = bus.hasSustainedBass ? `🔉 SUB ${bus.subSustain?.toFixed(2) || ''}` : '🔉 —';
        const wobbleState = (bus.wobbleIntensity || 0) > 0.15 ? `🌊 WOB ${bus.wobbleRateHz?.toFixed(1) || '?'}Hz LFO:${bus.wobbleLFO?.toFixed(2) || ''}` : '🌊 —';

        _debugHUD.textContent =
            `FPS: ${avgFps}  Mode: ${VisualEngine.activeModeKey || '—'}  BPM: ${bus.bpm}\n` +
            `RMS: ${bus.rms.toFixed(3)}  Section: ${bus.sectionType || '—'}  ColorT: ${bus.colorTemp || '—'}\n` +
            `${specBar}\n` +
            `${gunState}  ${sirenState}  ${screechState}\n` +
            `${subState}  ${wobbleState}\n` +
            `Draws: ${info.calls || 0}  Triangles: ${info.triangles || 0}  Drop: ${bus.dropDecay?.toFixed(2) || '0'}`;
    }

    // 4.10: REC overlay on canvas
    function createRecOverlay() {
        _recOverlay = document.createElement('div');
        _recOverlay.id = 'rec-overlay';
        _recOverlay.style.cssText = `position:fixed;top:16px;right:70px;z-index:200;font-family:var(--mono);font-size:13px;font-weight:700;color:#ef4444;background:rgba(0,0,0,0.6);padding:4px 12px;border-radius:8px;border:1px solid rgba(239,68,68,0.4);display:none;animation:recPulse 1s ease-in-out infinite;`;
        _recOverlay.textContent = '● REC 0:00';
        document.body.appendChild(_recOverlay);
    }

    function updateRecOverlay() {
        if (_recOverlay) {
            _recOverlay.style.display = Recorder.isRecording ? 'block' : 'none';
        }
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
        if (typeof TimelineUI !== 'undefined' && TimelineUI.update) TimelineUI.update();
    }

    // ── Marker System ─────────────────────────────────────

    function setupMarkers() {
        const addBtn = document.getElementById('btn-add-marker');
        const clearBtn = document.getElementById('btn-clear-markers');
        const markerTrack = document.getElementById('marker-track');

        if (addBtn) {
            addBtn.addEventListener('click', () => addMarkerAtCurrentTime());
        }

        // 4.6: 2-step confirmation for Clear Markers
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (clearMarkersConfirm) {
                    MarkerSystem.clearAll();
                    renderMarkers();
                    clearMarkersConfirm = false;
                    clearBtn.textContent = '🗑️';
                    clearBtn.title = 'Clear All Markers';
                    if (clearMarkersTimer) { clearTimeout(clearMarkersTimer); clearMarkersTimer = null; }
                } else {
                    clearMarkersConfirm = true;
                    clearBtn.textContent = '⚠️';
                    clearBtn.title = 'Click again to confirm';
                    clearMarkersTimer = setTimeout(() => {
                        clearMarkersConfirm = false;
                        clearBtn.textContent = '🗑️';
                        clearBtn.title = 'Clear All Markers';
                    }, 2000);
                }
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
        const markerTrack = document.getElementById('marker-track');
        if (!dotsContainer) return;

        dotsContainer.innerHTML = '';
        const duration = AudioEngine.audioBus.duration;
        if (duration <= 0) return;

        const markers = MarkerSystem.getMarkers();
        let draggingMarkerId = null;

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

            // Drag to move marker
            dot.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                draggingMarkerId = m.id;
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

        if (markerTrack && !markerTrack.dataset.markerDragBound) {
            document.addEventListener('mousemove', (e) => {
                if (!draggingMarkerId) return;
                const duration = AudioEngine.audioBus.duration;
                if (duration <= 0) return;
                const rect = markerTrack.getBoundingClientRect();
                const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
                const ratio = rect.width > 0 ? x / rect.width : 0;
                const t = ratio * duration;
                if (MarkerSystem.moveMarker) {
                    MarkerSystem.moveMarker(draggingMarkerId, t);
                    renderMarkers();
                }
            });
            document.addEventListener('mouseup', () => { draggingMarkerId = null; });
            markerTrack.dataset.markerDragBound = '1';
        }
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

    // ── Shortcuts Modal (4.11) ──────────────────────────────
    function setupShortcutsModal() {
        const openBtn = document.getElementById('btn-shortcuts');
        const modal = document.getElementById('shortcuts-modal');
        const closeBtn = document.getElementById('shortcuts-close');
        if (!openBtn || !modal || !closeBtn) return;

        openBtn.addEventListener('click', () => modal.classList.toggle('open'));
        closeBtn.addEventListener('click', () => modal.classList.remove('open'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('open');
        });

        // Screenshot button
        const screenshotBtn = document.getElementById('btn-screenshot');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => screenshot());
        }
    }

    // ── Preset System (5.1) ─────────────────────────────────
    function setupPresets() {
        const saveBtn = document.getElementById('btn-save-preset');
        const loadBtn = document.getElementById('btn-load-preset');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const name = prompt('Preset name:');
                if (!name) return;
                const data = {
                    name,
                    mode: VisualEngine.activeModeKey,
                    global: ParamSystem.getAllGlobal(),
                    mode_params: ParamSystem.getAllMode()
                };
                // Save to localStorage
                const presets = JSON.parse(localStorage.getItem('aura_presets') || '[]');
                presets.push(data);
                localStorage.setItem('aura_presets', JSON.stringify(presets));
                renderPresetList();
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                renderPresetList();
                document.getElementById('preset-list')?.classList.toggle('open');
            });
        }
    }

    function renderPresetList() {
        const container = document.getElementById('preset-list');
        if (!container) return;

        const presets = JSON.parse(localStorage.getItem('aura_presets') || '[]');
        if (presets.length === 0) {
            container.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--text-dim);">No presets saved</div>';
            return;
        }

        container.innerHTML = presets.map((p, idx) => `
            <div class="preset-item" data-idx="${idx}">
                <span class="preset-name">${p.name}</span>
                <button class="preset-delete" data-delete="${idx}" title="Delete">✕</button>
            </div>
        `).join('');

        // Load on click
        container.querySelectorAll('.preset-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('preset-delete')) return;
                const idx = parseInt(el.dataset.idx);
                const p = presets[idx];
                if (!p) return;
                // Apply mode
                if (p.mode && VisualEngine.getModeKeys().includes(p.mode)) {
                    VisualEngine.setMode(p.mode);
                    updateModeList();
                }
                // Apply global params
                if (p.global) Object.entries(p.global).forEach(([k, v]) => ParamSystem.set(k, v));
                // Apply mode params
                if (p.mode_params) Object.entries(p.mode_params).forEach(([k, v]) => ParamSystem.set(k, v));
                buildParamsUI();
                container.classList.remove('open');
            });
        });

        // Delete
        container.querySelectorAll('.preset-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.delete);
                presets.splice(idx, 1);
                localStorage.setItem('aura_presets', JSON.stringify(presets));
                renderPresetList();
            });
        });
    }

    // ── Toast Notification System ──
    function showToast(message, type = 'info') {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;`;
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Base styling for modern look
        toast.style.cssText = `background: rgba(10,10,15,0.9); backdrop-filter: blur(8px); border: 1px solid ${type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.3)'}; color: #fff; padding: 12px 20px; border-radius: 8px; font-family: var(--header-font, 'Inter', sans-serif); font-size: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); transform: translateX(120%); opacity: 0; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease;`;
        
        toast.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><span style="color:${type === 'error' ? '#ef4444' : '#8b5cf6'};font-size:18px;">${type === 'error' ? '⚠️' : 'ℹ️'}</span> <span>${message}</span></div>`;
        
        toastContainer.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(0)';
                toast.style.opacity = '1';
            });
        });

        // Remove after 4s
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 400); // Wait for transition
        }, 4000);
    }

    return {
        init,
        update,
        buildParamsUI,
        updateModeList,
        toggleModesPanel,
        toggleParamsPanel,
        refreshParamValues,
        screenshot,
        showToast,
        renderMarkers
    };
})();
