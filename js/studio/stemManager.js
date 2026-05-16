// ============================================================
// AURA — Stem Manager
// Handles multi-stem import, waveform preview, reactivity config.
// Single-file flow delegated to existing AudioEngine.loadFile().
// ============================================================

const StemManager = (() => {
    const STEMS = ['drums', 'bass', 'mids', 'highs'];
    const stemState = {
        drums: { file: null, buffer: null, enabled: true, reactivity: 1.0 },
        bass:  { file: null, buffer: null, enabled: true, reactivity: 1.0 },
        mids:  { file: null, buffer: null, enabled: true, reactivity: 1.0 },
        highs: { file: null, buffer: null, enabled: true, reactivity: 1.0 },
    };

    let offlineCtx = null;

    function openModal() {
        const modal = document.getElementById('stem-manager-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('stem-manager-modal');
        if (modal) modal.style.display = 'none';
    }

    function updateStemInfo(stemKey) {
        const st = stemState[stemKey];
        const infoEl = document.getElementById(`stem-info-${stemKey}`);
        if (!infoEl) return;
        if (st.file) {
            const dur = st.buffer ? ` | ${st.buffer.duration.toFixed(1)}s` : '';
            infoEl.textContent = `✓ ${st.file.name}${dur}`;
            infoEl.style.color = '#4ade80';
        } else {
            infoEl.textContent = 'No file';
            infoEl.style.color = '';
        }
    }

    async function loadStemFile(stemKey, file) {
        stemState[stemKey].file = file;
        updateStemInfo(stemKey);

        // Decode for waveform preview
        try {
            if (!offlineCtx) offlineCtx = new (window.AudioContext || window.webkitAudioContext)();
            const ab = await file.arrayBuffer();
            const decoded = await offlineCtx.decodeAudioData(ab);
            stemState[stemKey].buffer = decoded;
            drawWaveform(stemKey, decoded);
            updateStemInfo(stemKey);
        } catch (e) {
            console.warn(`[StemManager] Failed to decode ${stemKey}:`, e);
        }
    }

    function drawWaveform(stemKey, buffer) {
        const container = document.getElementById(`stem-wave-${stemKey}`);
        if (!container) return;

        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth || 400;
        canvas.height = 48;
        canvas.style.width = '100%';
        canvas.style.height = '48px';
        container.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const data = buffer.getChannelData(0);
        const step = Math.floor(data.length / canvas.width);
        const midY = canvas.height / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let x = 0; x < canvas.width; x++) {
            let max = 0;
            const start = x * step;
            for (let i = start; i < start + step && i < data.length; i++) {
                if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
            }
            ctx.moveTo(x, midY - max * midY);
            ctx.lineTo(x, midY + max * midY);
        }
        ctx.stroke();
    }

    async function loadAllStems() {
        const bpmInput = document.getElementById('stem-bpm-input');
        const bpm = parseInt(bpmInput?.value) || 140;

        const enabledStems = STEMS.filter(k => stemState[k].enabled && stemState[k].file);
        if (enabledStems.length === 0) {
            alert('Please pick at least one stem file.');
            return;
        }

        // Apply reactivity to ParamSystem
        for (const k of STEMS) {
            const paramKey = {
                drums: 'stemReactivity_drums', bass: 'stemReactivity_bass',
                mids: 'stemReactivity_mids', highs: 'stemReactivity_highs'
            }[k];
            if (typeof ParamSystem !== 'undefined') {
                ParamSystem.set(paramKey, stemState[k].enabled ? stemState[k].reactivity : 0);
            }
        }

        // Update project store with stem meta
        if (typeof ProjectStore !== 'undefined') {
            const stemsMeta = {};
            for (const k of STEMS) {
                stemsMeta[k] = { fileName: stemState[k].file?.name || null, enabled: stemState[k].enabled, reactivity: stemState[k].reactivity };
            }
            ProjectStore.dispatch({ type: 'audio/meta', audio: { mode: 'stems', bpm, stems: stemsMeta } }, { recordHistory: false });
        }

        // Set BPM
        if (typeof AudioEngine !== 'undefined') AudioEngine.setManualBpm(bpm);

        // Load the first enabled stem as the main audio source (for waveform + playback sync)
        const primaryStem = enabledStems[0];
        const primaryFile = stemState[primaryStem].file;

        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = `Loading ${primaryFile.name}...`;

        if (typeof AudioEngine !== 'undefined') {
            await AudioEngine.loadFile(primaryFile);
        }

        closeModal();

        // Hide drop zone
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) dropZone.style.display = 'none';

        if (loadingText) loadingText.textContent = '';

        console.log(`[StemManager] Loaded ${enabledStems.length} stems. Primary: ${primaryFile.name}`);
    }

    function initUI() {
        // Import cards on landing
        const btnSingle = document.getElementById('btn-import-single');
        const btnStems  = document.getElementById('btn-import-stems');
        const fileInput = document.getElementById('file-input');

        if (btnSingle) {
            btnSingle.addEventListener('click', () => {
                fileInput?.click();
            });
        }

        if (btnStems) {
            btnStems.addEventListener('click', () => openModal());
        }

        // Drop zone drag-and-drop for single file
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
            dropZone.addEventListener('drop', e => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                const files = e.dataTransfer?.files;
                if (files && files.length === 1) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change'));
                } else if (files && files.length > 1) {
                    // Multiple files → try auto-assign to stems by filename keywords
                    openModal();
                    for (const file of files) {
                        const name = file.name.toLowerCase();
                        for (const k of STEMS) {
                            if (name.includes(k) || (k === 'drums' && (name.includes('drum') || name.includes('perc')))) {
                                loadStemFile(k, file);
                                break;
                            }
                        }
                    }
                }
            });
        }

        // Stem pick buttons
        document.querySelectorAll('.stem-pick-btn').forEach(btn => {
            const key = btn.dataset.stem;
            const hiddenInput = document.getElementById(`stem-file-${key}`);
            if (!hiddenInput) return;
            btn.addEventListener('click', () => hiddenInput.click());
            hiddenInput.addEventListener('change', () => {
                if (hiddenInput.files[0]) loadStemFile(key, hiddenInput.files[0]);
            });
        });

        // Enable toggles
        STEMS.forEach(k => {
            const en = document.getElementById(`stem-en-${k}`);
            if (en) en.addEventListener('change', () => { stemState[k].enabled = en.checked; });
        });

        // Reactivity sliders
        STEMS.forEach(k => {
            const sl = document.getElementById(`stem-react-${k}`);
            const valEl = document.getElementById(`stem-react-val-${k}`);
            if (sl) sl.addEventListener('input', () => {
                stemState[k].reactivity = parseFloat(sl.value);
                if (valEl) valEl.textContent = parseFloat(sl.value).toFixed(2) + '×';
                if (typeof ParamSystem !== 'undefined') {
                    const paramMap = { drums: 'stemReactivity_drums', bass: 'stemReactivity_bass', mids: 'stemReactivity_mids', highs: 'stemReactivity_highs' };
                    ParamSystem.set(paramMap[k], stemState[k].reactivity);
                }
            });
        });

        // Load all button
        const loadBtn = document.getElementById('stem-load-all');
        if (loadBtn) loadBtn.addEventListener('click', loadAllStems);

        // Close
        const closeBtn = document.getElementById('stem-manager-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        // Camera mode buttons — now in timeline toprow (pmt-orbit/move/follow)
        const pmBtns = {
            orbit:  document.getElementById('pmt-orbit'),
            move:   document.getElementById('pmt-move'),
            follow: document.getElementById('pmt-follow'),
        };
        Object.entries(pmBtns).forEach(([mode, btn]) => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                Object.values(pmBtns).forEach(b => b?.classList.remove('active'));
                btn.classList.add('active');
                if (typeof VisualEngine !== 'undefined') VisualEngine.setPreviewMode(mode);
            });
        });

    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

    return { openModal, closeModal, loadStemFile, stemState, STEMS };
})();
